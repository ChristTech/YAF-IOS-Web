import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import {
  ADMIN_DOC_ID,
  FELLOWSHIP_ID,
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from './firebase';
import { hashPassword, verifyPassword } from '../utils/crypto';
import { normalizeLanguageCode } from '../data/translations';
import {
  ADMIN_SECRETARIAT_ADDRESS,
  DEFAULT_MINISTRY_AUTHOR,
  applyAccountBrandMigration,
  buildNewAccountFirestoreDoc,
  buildReminderSchedule,
  chunkStringForFirestore,
  computeProgrammeEndDateMillis,
  filterActiveAccounts,
  formatProgrammeFullDateTime,
  generate16CharId,
  getEventCategoryLabel,
  getProgrammeLimit,
  getProgrammeStartMillis,
  isEventDatePassed,
  isForumPostExpired,
  isWithinFirestoreDocLimit,
  normalizeAccountRoleForFirestore,
  normalizeDepartmentType,
  normalizeLanguageForFirestore,
  parseJsonArray,
  resolveMigratedAccountAddress,
  serializeCommentsWithinLimit,
  type ParsedBibleVerse,
} from '../utils/fellowshipLogic';
import {
  AUDIO_SLICE_BYTES,
  buildCappedPrayerPromptJson,
  buildSermonAudioChunkFirestorePayload,
  buildSpiritualResourceFirestorePayload,
  combineDecodedChunksToBlob,
  generateAudioCloudId,
  inferAudioMimeType,
  sliceAudioBytesToChunkBase64,
  type ExtendedSpiritualKind,
} from '../utils/spiritualLogic';
import {
  deleteAudioSermonBlob,
  loadAudioSermonBlob,
  purgeAllAudioSermonBlobsExcept,
  saveAudioSermonBlob,
} from '../utils/offlineStorage';
import {
  DEFAULT_LEADERBOARD_DURATION_SEC,
  clampNumber,
  compareSessionProgress,
  decodeBibleEditionSections,
  encodeCompactBibleSectionsChunks,
  encodeCompactVersePackChunk,
  evaluateMultiplayerAnswerSubmission,
  getEffectiveQuestionTimeLimit,
  getGameTypeDefaultTimer,
  mergeParticipantsJson,
  normalizeSessionStatus,
  parseMultiplayerParticipants,
  parseMultiplayerQuestions,
  parseMultiplayerSessionDoc,
  serializeMultiplayerQuestions,
} from '../utils/gamesLogic';
import { buildLocalizedSessionTitles } from '../data/presetGameSessions';
import { getNotificationTargetTab } from '../utils/notificationLogic';
import {
  cancelProgrammeReminders,
  getDeviceInstanceId,
  markLocalNotifsRead,
  recordLocallyOriginatingIds,
  saveLocalNotification,
} from '../utils/pushNotifications';
import type {
  AttendanceRecord,
  AuditLogEntry,
  CommunityPost,
  DailyScriptureDoc,
  EventCategory,
  ExecutiveInquiry,
  FellowshipAccount,
  FellowshipNotification,
  GameQuiz,
  GameScore,
  GameType,
  GivingRecord,
  LanguageCode,
  MultiplayerParticipant,
  MultiplayerQuestion,
  PostComment,
  Programme,
  ProgrammeRegistration,
  QuizSession,
  SessionStatus,
  SessionSubstate,
  SoloQuizCategory,
  SoloQuizQuestion,
  SpiritualResource,
  UploadedBibleDoc,
  UploadedBibleSection,
  UserRole,
  WeeklyReport,
} from '../types/fellowship';

export const COLLECTIONS = {
  ACCOUNTS: 'fellowship_accounts',
  PROGRAMMES: 'programmes',
  COMMUNITY_POSTS: 'community_posts',
  INQUIRIES: 'executive_inquiries',
  DAILY_SCRIPTURES: 'daily_scriptures',
  SERMON_AUDIO_CHUNKS: 'sermon_audio_chunks',
  QUIZ_SESSIONS: 'quiz_sessions',
  GAME_QUIZZES: 'game_quizzes',
  GAME_SCORES: 'game_scores',
  NOTIFICATIONS: 'fellowship_notifications',
  GIVING: 'giving_records',
  ATTENDANCE: 'unit_attendance',
  WEEKLY_REPORTS: 'weekly_reports',
  AUDIT_LOGS: 'audit_logs',
} as const;

const SESSION_STORAGE_KEY = 'gideonites_session_account_id';
const SECONDARY_CACHE_PREFIX = 'gideonites_cache_';
const LIKED_POSTS_PREFIX = 'gideonites_liked_posts_';
const QR_PASS_STORAGE_KEY = 'gideonites_active_qr_pass_code';
const LOCAL_STORE_EVENT = 'gideonites-local-collection-updated';

export function getActiveQrPassCode(): string {
  try {
    return localStorage.getItem(QR_PASS_STORAGE_KEY) || 'CYP-2026';
  } catch {
    return 'CYP-2026';
  }
}

export function saveActiveQrPassCode(code: string): void {
  try {
    localStorage.setItem(QR_PASS_STORAGE_KEY, code);
  } catch {
    // ignore
  }
}

export function getLocalLikedPostIds(userId: string): string[] {
  try {
    const raw = localStorage.getItem(LIKED_POSTS_PREFIX + userId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function setLocalLikedPostIds(userId: string, postIds: string[]): void {
  try {
    localStorage.setItem(LIKED_POSTS_PREFIX + userId, JSON.stringify(postIds));
  } catch {
    // ignore storage errors
  }
}

function readLocalCache<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(SECONDARY_CACHE_PREFIX + key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalCache<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(SECONDARY_CACHE_PREFIX + key, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

export function getSavedAccountId(): string | null {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveAccountId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(SESSION_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export function normalizeDocTimestamp(data: Record<string, unknown>): number {
  const raw = data.createdAt;
  if (typeof raw === 'number') return raw;
  if (raw && typeof (raw as { toMillis?: () => number }).toMillis === 'function') {
    return (raw as { toMillis: () => number }).toMillis();
  }
  if (raw && typeof (raw as { seconds?: number }).seconds === 'number') {
    return (raw as { seconds: number }).seconds * 1000;
  }
  return Date.now();
}

export function subscribeCollection<T>(
  collectionName: string,
  mapDoc: (id: string, data: Record<string, unknown>) => T,
  onData: (items: T[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = query(collection(db, collectionName), where('fellowshipId', '==', FELLOWSHIP_ID));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => mapDoc(d.id, d.data() as Record<string, unknown>));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, collectionName, true);
      if (onError) onError(error);
    }
  );
}

export async function fetchDocsServerFirst<T>(
  collectionName: string,
  mapDoc: (id: string, data: Record<string, unknown>) => T
): Promise<T[]> {
  const q = query(collection(db, collectionName), where('fellowshipId', '==', FELLOWSHIP_ID));
  try {
    const snap = await getDocsFromServer(q);
    return snap.docs.map((d) => mapDoc(d.id, d.data() as Record<string, unknown>));
  } catch {
    try {
      const snap = await getDocs(q);
      return snap.docs.map((d) => mapDoc(d.id, d.data() as Record<string, unknown>));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, collectionName, true);
      return [];
    }
  }
}

export function subscribeLocalCollection<T extends { id: string; createdAt: number }>(
  collectionName: string,
  onData: (items: T[]) => void
): Unsubscribe {
  const emit = () => {
    const items = [...readLocalCache<T>(collectionName, [])].sort((a, b) => b.createdAt - a.createdAt);
    onData(items);
  };
  emit();

  const onLocalEvent = (e: Event) => {
    const custom = e as CustomEvent<string>;
    if (!custom.detail || custom.detail === collectionName) {
      emit();
    }
  };
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === SECONDARY_CACHE_PREFIX + collectionName) {
      emit();
    }
  };

  window.addEventListener(LOCAL_STORE_EVENT, onLocalEvent);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(LOCAL_STORE_EVENT, onLocalEvent);
    window.removeEventListener('storage', onStorage);
  };
}

export function writeLocalRecord<T extends { id: string; createdAt: number }>(
  collectionName: string,
  record: T
): void {
  const existing = readLocalCache<T>(collectionName, []);
  const next = [record, ...existing.filter((r) => r.id !== record.id)];
  writeLocalCache(collectionName, next);
  window.dispatchEvent(new CustomEvent(LOCAL_STORE_EVENT, { detail: collectionName }));
}

export function subscribeHybridCollection<T extends { id: string; createdAt: number }>(
  collectionName: string,
  onData: (items: T[]) => void
): Unsubscribe {
  // Immediately emit cached items
  const initial = readLocalCache<T>(collectionName, []);
  if (initial.length > 0) {
    onData(initial);
  }

  const q = query(collection(db, collectionName), where('fellowshipId', '==', FELLOWSHIP_ID));
  return onSnapshot(
    q,
    (snapshot) => {
      const remoteItems = snapshot.docs.map((d) => ({
        ...(d.data() as Record<string, unknown>),
        id: d.id,
        createdAt: normalizeDocTimestamp(d.data() as Record<string, unknown>),
      })) as T[];
      remoteItems.sort((a, b) => b.createdAt - a.createdAt);
      writeLocalCache(collectionName, remoteItems);
      onData(remoteItems);
    },
    () => {
      // Fall back to local cache gracefully if secondary collection isn't enabled in Firestore rules
      onData(readLocalCache<T>(collectionName, []));
    }
  );
}

export async function writeHybridRecord<T extends { id: string; fellowshipId: string; createdAt: number }>(
  collectionName: string,
  record: T
): Promise<void> {
  writeLocalRecord(collectionName, record);

  if (!auth.currentUser) {
    return;
  }
  try {
    await setDoc(doc(db, collectionName, record.id), record);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${record.id}`, true);
  }
}

const attemptedAddressMigrations = new Map<string, string>();

export async function migrateAccountAddressesInFirestore(
  accounts: FellowshipAccount[]
): Promise<void> {
  for (const acc of accounts) {
    if (!acc?.id) continue;
    const { address, changed } = resolveMigratedAccountAddress(acc);
    if (!changed || !address) continue;
    if (attemptedAddressMigrations.get(acc.id) === address) continue;
    attemptedAddressMigrations.set(acc.id, address);

    try {
      await updateDoc(doc(db, COLLECTIONS.ACCOUNTS, acc.id), {
        address,
        updatedAt: serverTimestamp(),
      });
      const uid = acc.userId || acc.id;
      if (auth.currentUser && auth.currentUser.uid === uid) {
        await setDoc(
          doc(db, 'users', auth.currentUser.uid),
          { address, updatedAt: Date.now() },
          { merge: true }
        ).catch(() => {});
      }
    } catch {
      // Non-fatal: e.g. read-only session or offline; cached value already sanitized in memory
    }
  }
}

export async function ensureAdminAccountExists(): Promise<FellowshipAccount> {
  const ref = doc(db, COLLECTIONS.ACCOUNTS, ADMIN_DOC_ID);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as Record<string, unknown>;
      const baseAdmin: FellowshipAccount = {
        ...(data as unknown as FellowshipAccount),
        id: snap.id,
        fullName: 'Admin',
        role: 'ADMINISTRATOR',
        status: 'APPROVED',
      };
      const migrated = applyAccountBrandMigration(baseAdmin);
      if (migrated.changed) {
        void migrateAccountAddressesInFirestore([baseAdmin]);
      }
      return migrated.account;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${COLLECTIONS.ACCOUNTS}/${ADMIN_DOC_ID}`, true);
  }

  const hashed = await hashPassword('AdminPass#2026');
  const now = Date.now();
  const adminFirestoreDoc = {
    userId: ADMIN_DOC_ID,
    fellowshipId: FELLOWSHIP_ID,
    fullName: 'Admin',
    email: 'admin@youthalive.org',
    phone: '08000000001',
    address: ADMIN_SECRETARIAT_ADDRESS,
    salt: hashed.saltBase64,
    passwordHash: hashed.hashBase64,
    role: 'ADMINISTRATOR' as const,
    status: 'APPROVED' as const,
    department: 'GENERAL',
    preferredLanguage: 'en',
    englishOverride: false,
    xpPoints: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(ref, adminFirestoreDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${COLLECTIONS.ACCOUNTS}/${ADMIN_DOC_ID}`, true);
  }
  return {
    id: ADMIN_DOC_ID,
    userId: ADMIN_DOC_ID,
    fellowshipId: FELLOWSHIP_ID,
    fullName: 'Admin',
    email: 'admin@youthalive.org',
    phone: '08000000001',
    phoneNumber: '08000000001',
    address: ADMIN_SECRETARIAT_ADDRESS,
    salt: hashed.saltBase64,
    passwordHash: hashed.hashBase64,
    role: 'ADMINISTRATOR',
    status: 'APPROVED',
    department: 'GENERAL',
    preferredLanguage: 'EN',
    englishOverride: false,
    xpPoints: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export async function signInWithCredentials(
  identifier: string,
  password: string
): Promise<FellowshipAccount> {
  const cleanId = identifier.trim().toLowerCase();
  if (!cleanId || !password) {
    throw new Error('Please enter your email or phone number and password.');
  }

  const q = query(collection(db, COLLECTIONS.ACCOUNTS), where('fellowshipId', '==', FELLOWSHIP_ID));
  let accounts: FellowshipAccount[] = [];
  try {
    const snap = await getDocs(q);
    accounts = filterActiveAccounts(
      snap.docs.map((d) => ({
        ...(d.data() as FellowshipAccount),
        id: d.id,
      }))
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.ACCOUNTS, true);
    throw new Error('Unable to reach Fellowship database. Please check your internet connection.');
  }

  // Special handling if admin@youthalive.org signs in and doc hasn't been seeded yet
  if (cleanId === 'admin@youthalive.org' && !accounts.some((a) => a.id === ADMIN_DOC_ID || a.email?.toLowerCase() === cleanId)) {
    if (password === 'AdminPass#2026') {
      const seededAdmin = await ensureAdminAccountExists();
      saveAccountId(seededAdmin.id);
      return seededAdmin;
    }
  }

  const match = accounts.find((acc) => {
    const emailMatch = acc.email?.trim().toLowerCase() === cleanId;
    const phoneMatch =
      (acc.phoneNumber && acc.phoneNumber.trim().toLowerCase() === cleanId) ||
      (acc.phone && acc.phone.trim().toLowerCase() === cleanId);
    return emailMatch || phoneMatch;
  });

  if (!match) {
    throw new Error('No active fellowship account found matching that email or phone number.');
  }

  if (match.status === 'DECLINED') {
    throw new Error('This account request was declined by the Administrator.');
  }

  const valid = await verifyPassword(password, match);
  if (!valid) {
    // Allow official AdminPass#2026 fallback only for user-admin-01 if Android stored plain or alternate key
    if (match.id === ADMIN_DOC_ID && password === 'AdminPass#2026') {
      const migrated = applyAccountBrandMigration({ ...match, fullName: 'Admin' });
      if (migrated.changed) {
        void migrateAccountAddressesInFirestore([match]);
      }
      saveAccountId(match.id);
      return migrated.account;
    }
    throw new Error('Incorrect password. Please try again.');
  }

  const baseNormalized: FellowshipAccount =
    match.id === ADMIN_DOC_ID || match.role === 'ADMINISTRATOR'
      ? { ...match, fullName: 'Admin' }
      : match;
  const migrated = applyAccountBrandMigration(baseNormalized);
  if (migrated.changed) {
    void migrateAccountAddressesInFirestore([baseNormalized]);
  }

  saveAccountId(migrated.account.id);
  return migrated.account;
}

export async function registerFellowshipAccount(params: {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: Exclude<UserRole, 'ADMINISTRATOR'>;
  department: string;
  preferredLanguage: LanguageCode;
}): Promise<FellowshipAccount> {
  const emailLower = params.email.trim().toLowerCase();
  if (!params.fullName.trim() || !emailLower || params.password.length < 6) {
    throw new Error('Full name, valid email, and a password of at least 6 characters are required.');
  }

  const q = query(collection(db, COLLECTIONS.ACCOUNTS), where('fellowshipId', '==', FELLOWSHIP_ID));
  const snap = await getDocs(q);
  const existing = filterActiveAccounts(
    snap.docs.map((d) => ({ ...(d.data() as FellowshipAccount), id: d.id }))
  );

  if (existing.some((a) => a.email?.trim().toLowerCase() === emailLower)) {
    throw new Error('An account with this email already exists in The Gideonites Fellowship.');
  }

  const hashed = await hashPassword(params.password);
  const newId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const normalizedRole = normalizeAccountRoleForFirestore(params.role);
  const role: Exclude<UserRole, 'ADMINISTRATOR'> =
    normalizedRole === 'ADMINISTRATOR' ? 'YOUTH_MEMBER' : normalizedRole;
  const status = role === 'YOUTH_EXECUTIVE' ? 'PENDING' : 'APPROVED';
  const normalizedDept = normalizeDepartmentType(params.department);
  const now = Date.now();

  const firestoreDoc = buildNewAccountFirestoreDoc({
    userId: newId,
    fellowshipId: FELLOWSHIP_ID,
    fullName: params.fullName.trim(),
    email: emailLower,
    phone: params.phoneNumber.trim(),
    salt: hashed.saltBase64,
    passwordHash: hashed.hashBase64,
    role,
    status,
    department: normalizedDept,
    preferredLanguage: params.preferredLanguage,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const account: FellowshipAccount = {
    id: newId,
    userId: newId,
    fellowshipId: FELLOWSHIP_ID,
    fullName: params.fullName.trim(),
    email: emailLower,
    phone: params.phoneNumber.trim(),
    phoneNumber: params.phoneNumber.trim(),
    salt: hashed.saltBase64,
    passwordHash: hashed.hashBase64,
    role,
    status,
    department: normalizedDept,
    preferredLanguage: normalizeLanguageCode(params.preferredLanguage),
    englishOverride: false,
    xpPoints: 0,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, COLLECTIONS.ACCOUNTS, newId), firestoreDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${COLLECTIONS.ACCOUNTS}/${newId}`);
  }

  if (status === 'PENDING') {
    await createNotification({
      dedupKey: `acc:${newId}`,
      title: 'New Youth Executive Request',
      message: `${account.fullName} (${normalizedDept}) requested Youth Executive access.`,
      type: 'APPROVAL',
      targetRole: 'ADMINISTRATOR',
    }).catch(() => {});
  }

  saveAccountId(account.id);
  return account;
}

export async function signInWithGoogleAccount(): Promise<FellowshipAccount> {
  const result = await signInWithPopup(auth, googleProvider);
  const gUser = result.user;
  const email = (gUser.email || '').trim().toLowerCase();
  if (!email) {
    throw new Error('Google sign-in did not return an email address.');
  }

  const q = query(collection(db, COLLECTIONS.ACCOUNTS), where('fellowshipId', '==', FELLOWSHIP_ID));
  const snap = await getDocs(q);
  const existing = filterActiveAccounts(
    snap.docs.map((d) => ({ ...(d.data() as FellowshipAccount), id: d.id }))
  );

  const match = existing.find((a) => a.email?.trim().toLowerCase() === email);
  if (match) {
    const baseNormalized =
      match.id === ADMIN_DOC_ID || match.role === 'ADMINISTRATOR'
        ? { ...match, fullName: 'Admin' }
        : match;
    const migrated = applyAccountBrandMigration(baseNormalized);
    if (migrated.changed) {
      void migrateAccountAddressesInFirestore([baseNormalized]);
    }
    saveAccountId(migrated.account.id);
    return migrated.account;
  }

  const newId = `user-g-${gUser.uid.slice(0, 12)}`;
  const now = Date.now();
  const displayName = gUser.displayName || email.split('@')[0];
  const phone = gUser.phoneNumber || '';
  const photo = gUser.photoURL || undefined;

  const firestoreDoc = buildNewAccountFirestoreDoc({
    userId: newId,
    fellowshipId: FELLOWSHIP_ID,
    fullName: displayName,
    email,
    phone,
    role: 'YOUTH_MEMBER',
    status: 'APPROVED',
    department: 'MEDIA',
    preferredLanguage: 'EN',
    profilePhotoUri: photo,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const account: FellowshipAccount = {
    id: newId,
    userId: newId,
    fellowshipId: FELLOWSHIP_ID,
    fullName: displayName,
    email,
    phone,
    phoneNumber: phone,
    role: 'YOUTH_MEMBER',
    status: 'APPROVED',
    department: 'MEDIA',
    preferredLanguage: 'EN',
    englishOverride: false,
    xpPoints: 0,
    profilePhotoUri: photo,
    avatarUrl: photo,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, COLLECTIONS.ACCOUNTS, newId), firestoreDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${COLLECTIONS.ACCOUNTS}/${newId}`);
  }
  saveAccountId(account.id);
  return account;
}

export async function signOutAccount(): Promise<void> {
  saveAccountId(null);
  try {
    await firebaseSignOut(auth);
  } catch {
    // ignore if signed in purely via custom credentials
  }
}

export async function updateAccountProfile(
  accountId: string,
  updates: Partial<
    Pick<
      FellowshipAccount,
      | 'fullName'
      | 'email'
      | 'phoneNumber'
      | 'phone'
      | 'address'
      | 'department'
      | 'preferredLanguage'
      | 'avatarUrl'
      | 'profilePhotoUri'
      | 'userId'
    >
  >,
  silent = false
): Promise<void> {
  if (silent && !auth.currentUser) {
    return;
  }
  const { userId: explicitUid, phoneNumber, avatarUrl, ...rest } = updates;
  const sanitized: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (rest.fullName !== undefined) sanitized.fullName = rest.fullName;
  if (rest.email !== undefined) sanitized.email = rest.email;
  const resolvedPhone = rest.phone ?? phoneNumber;
  if (resolvedPhone !== undefined) sanitized.phone = resolvedPhone;
  if (rest.address !== undefined) sanitized.address = rest.address;
  if (rest.department !== undefined) {
    sanitized.department = normalizeDepartmentType(rest.department);
  }
  if (rest.preferredLanguage !== undefined) {
    sanitized.preferredLanguage = normalizeLanguageForFirestore(rest.preferredLanguage);
  }
  const resolvedPhoto = rest.profilePhotoUri ?? avatarUrl;
  if (resolvedPhoto !== undefined) sanitized.profilePhotoUri = resolvedPhoto;
  if (accountId === ADMIN_DOC_ID) {
    sanitized.fullName = 'Admin';
  }
  try {
    await updateDoc(doc(db, COLLECTIONS.ACCOUNTS, accountId), sanitized);
    const uidToSync = explicitUid || accountId;
    if (auth.currentUser && auth.currentUser.uid === uidToSync) {
      await setDoc(
        doc(db, 'users', auth.currentUser.uid),
        {
          ...(sanitized.fullName ? { fullName: sanitized.fullName } : {}),
          ...(sanitized.phone !== undefined ? { phone: sanitized.phone } : {}),
          ...(sanitized.address !== undefined ? { address: sanitized.address } : {}),
          ...(sanitized.department !== undefined ? { department: sanitized.department } : {}),
          ...(sanitized.profilePhotoUri !== undefined
            ? { profilePhotoUri: sanitized.profilePhotoUri }
            : {}),
          updatedAt: Date.now(),
        },
        { merge: true }
      ).catch(() => {});
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.ACCOUNTS}/${accountId}`, silent);
  }
}

export async function upgradeGuestToMember(account: FellowshipAccount): Promise<FellowshipAccount> {
  const next: FellowshipAccount = {
    ...account,
    role: 'YOUTH_MEMBER',
    updatedAt: Date.now(),
  };
  try {
    await updateDoc(doc(db, COLLECTIONS.ACCOUNTS, account.id), {
      role: 'YOUTH_MEMBER',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.ACCOUNTS}/${account.id}`);
  }
  return next;
}

export async function setExecutiveAccountStatus(
  accountId: string,
  status: 'APPROVED' | 'SUSPENDED' | 'DECLINED'
): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTIONS.ACCOUNTS, accountId), {
      status,
      updatedAt: serverTimestamp(),
    });
    await createNotification({
      dedupKey: `acc-status:${accountId}:${status}`,
      title: status === 'APPROVED' ? 'Executive Request Approved' : 'Executive Request Declined',
      message: `Account ${accountId} status updated to ${status}.`,
      type: 'APPROVAL',
      recipientUserId: accountId,
      targetRole: 'ALL',
    }).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.ACCOUNTS}/${accountId}`);
  }
}

// Programmes
export async function createProgramme(params: {
  createdById: string;
  titleEn: string;
  descriptionEn: string;
  category: EventCategory;
  venue: string;
  speaker: string;
  contactPerson: string;
  participantLimit: number;
  startDateMillis: number;
}): Promise<string> {
  const randomSuffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const id = `prog_${randomSuffix}`;
  const titleClean = params.titleEn.trim();
  const venueClean = params.venue.trim();
  const limit = Math.max(0, Number(params.participantLimit) || 100);

  const payload = {
    createdById: params.createdById,
    fellowshipId: FELLOWSHIP_ID,
    titleEn: titleClean,
    descriptionEn: params.descriptionEn.trim(),
    category: params.category,
    venue: venueClean,
    speaker: params.speaker.trim(),
    contactPerson: params.contactPerson.trim(),
    participantLimit: limit,
    isRegistrationEnabled: true,
    startDateMillis: params.startDateMillis,
    endDateMillis: computeProgrammeEndDateMillis(params.startDateMillis),
    status: 'UPCOMING',
    registeredCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, COLLECTIONS.PROGRAMMES, id), payload);
    recordLocallyOriginatingIds([`prog:${id}`, `syn-prog-${id}`]);
    await createNotification({
      dedupKey: `prog:${id}`,
      title: `New Programme: ${titleClean}`,
      message: `${getEventCategoryLabel(params.category)} · ${formatProgrammeFullDateTime(params.startDateMillis)} at ${venueClean}`,
      type: 'EVENT',
      targetRole: 'ALL',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${COLLECTIONS.PROGRAMMES}/${id}`);
  }
  return id;
}

export async function registerForProgramme(
  programme: Programme,
  user: FellowshipAccount
): Promise<ProgrammeRegistration> {
  if (programme.isRegistrationEnabled === false) {
    throw new Error('Registration is currently closed for this programme.');
  }

  const startMillis = getProgrammeStartMillis(programme);
  if (isEventDatePassed(startMillis)) {
    throw new Error("This programme's date has already passed.");
  }

  const progRef = doc(db, COLLECTIONS.PROGRAMMES, programme.id);
  const current = parseJsonArray<ProgrammeRegistration>(programme.registrationsJson, []);
  const userIds = new Set([user.id, user.userId].filter(Boolean) as string[]);
  const existing = current.find((r) => userIds.has(r.userId));
  if (existing) {
    return existing;
  }

  const limit = getProgrammeLimit(programme);
  if (limit > 0 && current.length >= limit) {
    throw new Error('This programme has reached its participant capacity.');
  }

  const { fiveDaysBefore, oneDayBefore } = buildReminderSchedule(startMillis);
  const resolvedUserId = user.userId || user.id;
  const displayName = user.role === 'ADMINISTRATOR' || user.id === ADMIN_DOC_ID ? 'Admin' : user.fullName;

  const newReg: ProgrammeRegistration = {
    id: `reg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    eventId: programme.id,
    userId: resolvedUserId,
    userName: displayName,
    userEmail: user.email,
    userPhone: user.phone || user.phoneNumber || '',
    registeredAt: Date.now(),
    reminder5DaysScheduledAt: fiveDaysBefore,
    reminder1DayScheduledAt: oneDayBefore,
  };

  const nextRegs = [...current, newReg];
  const existingCount = typeof programme.registeredCount === 'number' ? programme.registeredCount : current.length;
  const newCount = Math.max(existingCount + 1, nextRegs.length);

  try {
    const snap = await getDoc(progRef);
    if (!snap.exists()) {
      throw new Error('This programme is no longer available.');
    }
    await updateDoc(progRef, {
      registeredCount: newCount,
      registrationsJson: JSON.stringify(nextRegs),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'This programme is no longer available.') {
      throw err;
    }
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.PROGRAMMES}/${programme.id}`);
  }

  return newReg;
}

const purgedExpiredProgrammeIds = new Set<string>();

export async function purgeExpiredEvents(programmes: Programme[]): Promise<number> {
  const now = Date.now();
  const expired = programmes.filter((prog) => {
    if (!prog?.id || purgedExpiredProgrammeIds.has(prog.id)) return false;
    return isEventDatePassed(getProgrammeStartMillis(prog), now);
  });
  if (expired.length === 0) return 0;

  let purgedCount = 0;
  for (const prog of expired) {
    purgedExpiredProgrammeIds.add(prog.id);
    cancelProgrammeReminders(prog.id);
    try {
      await deleteDoc(doc(db, COLLECTIONS.PROGRAMMES, prog.id));
      purgedCount += 1;
    } catch {
      // Non-fatal: e.g., offline or member without delete permissions
    }
  }
  return purgedCount;
}

// Community Posts & Announcements
export async function createCommunityPost(params: {
  author: FellowshipAccount;
  category: CommunityPost['category'];
  title?: string;
  content: string;
  attachmentPhotoUri?: string;
  photoUrl?: string;
  whatsappContact?: string;
  whatsappNumber?: string;
}): Promise<string> {
  const id = `post_${generate16CharId()}`;
  const authorId = params.author.userId || params.author.id;
  const authorName =
    params.author.role === 'ADMINISTRATOR' || params.author.id === ADMIN_DOC_ID
      ? 'Admin'
      : params.author.fullName;
  const attachment = (params.attachmentPhotoUri || params.photoUrl || '').trim();
  const contact = (params.whatsappContact || params.whatsappNumber || '').trim();

  if (attachment && attachment.length > 350_000) {
    throw new Error('Attached image is too large (max 350 KB). Please pick a smaller image.');
  }

  const payload: Record<string, unknown> = {
    authorId,
    authorName,
    authorRole: params.author.role,
    fellowshipId: FELLOWSHIP_ID,
    category: params.category,
    title: (params.title || '').trim(),
    content: params.content.trim(),
    likesCount: 0,
    commentsCount: 0,
    commentsJson: '[]',
    isPinned: false,
    isFlagged: false,
    isHidden: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (params.author.avatarUrl) {
    payload.authorAvatarUri = params.author.avatarUrl;
  }
  if (attachment) {
    payload.attachmentPhotoUri = attachment;
  }
  if (contact) {
    payload.whatsappContact = contact;
  }

  if (!isWithinFirestoreDocLimit(payload)) {
    throw new Error(
      'Post with photo attachment exceeds the 1 MB storage limit. Please choose a smaller photo.'
    );
  }

  try {
    await setDoc(doc(db, COLLECTIONS.COMMUNITY_POSTS, id), payload);
    const isAnnouncement =
      params.category === 'ANNOUNCEMENT_NORMAL' || params.category === 'ANNOUNCEMENT_URGENT';
    await createNotification({
      dedupKey: `post:${id}`,
      title: isAnnouncement
        ? params.category === 'ANNOUNCEMENT_URGENT'
          ? `URGENT: ${params.title || 'Fellowship Announcement'}`
          : params.title || 'Fellowship Announcement'
        : `New Forum Post: ${params.title?.trim() || params.category}`,
      message: `${authorName}: ${params.content.trim().slice(0, 120)}`,
      type: isAnnouncement ? 'ANNOUNCEMENT' : 'COMMUNITY_POST',
      targetRole: 'ALL',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${COLLECTIONS.COMMUNITY_POSTS}/${id}`);
  }
  return id;
}

export async function updateCommunityPost(
  postId: string,
  updates: {
    category?: string;
    title?: string;
    content?: string;
    attachmentPhotoUri?: string;
    whatsappContact?: string;
    isPinned?: boolean;
    isFlagged?: boolean;
    isHidden?: boolean;
  }
): Promise<void> {
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.title !== undefined) payload.title = updates.title.trim();
  if (updates.content !== undefined) payload.content = updates.content.trim();
  if (updates.attachmentPhotoUri !== undefined) {
    if (updates.attachmentPhotoUri.length > 350_000) {
      throw new Error('Attached image is too large (max 350 KB). Please pick a smaller image.');
    }
    payload.attachmentPhotoUri = updates.attachmentPhotoUri;
  }
  if (updates.whatsappContact !== undefined) payload.whatsappContact = updates.whatsappContact.trim();
  if (updates.isPinned !== undefined) payload.isPinned = updates.isPinned;
  if (updates.isFlagged !== undefined) payload.isFlagged = updates.isFlagged;
  if (updates.isHidden !== undefined) payload.isHidden = updates.isHidden;

  try {
    await updateDoc(doc(db, COLLECTIONS.COMMUNITY_POSTS, postId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.COMMUNITY_POSTS}/${postId}`);
  }
}

export async function toggleLikePost(post: CommunityPost, userId: string): Promise<void> {
  const localLikedIds = getLocalLikedPostIds(userId);
  const remoteLikedIds = parseJsonArray<string>(post.likedByJson, []);
  const hasLiked = localLikedIds.includes(post.id) || remoteLikedIds.includes(userId);
  const nextLikes = hasLiked ? Math.max(0, (post.likesCount || 0) - 1) : (post.likesCount || 0) + 1;
  const nextLocalIds = hasLiked
    ? localLikedIds.filter((id) => id !== post.id)
    : Array.from(new Set([...localLikedIds, post.id]));

  const postRef = doc(db, COLLECTIONS.COMMUNITY_POSTS, post.id);
  try {
    const snap = await getDoc(postRef);
    if (!snap.exists()) {
      throw new Error('This post is no longer available.');
    }
    await updateDoc(postRef, {
      likesCount: nextLikes,
      updatedAt: serverTimestamp(),
    });
    setLocalLikedPostIds(userId, nextLocalIds);
  } catch (err) {
    if (err instanceof Error && err.message === 'This post is no longer available.') {
      throw err;
    }
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.COMMUNITY_POSTS}/${post.id}`);
  }
}

export async function togglePinPost(post: CommunityPost): Promise<void> {
  await updateCommunityPost(post.id, { isPinned: !post.isPinned });
}

export async function flagCommunityPost(post: CommunityPost): Promise<void> {
  await updateCommunityPost(post.id, { isFlagged: true });
  await createNotification({
    dedupKey: `flag:${post.id}`,
    title: 'Flagged Community Post Needs Review',
    message: `${post.authorName}: ${(post.title || post.content).slice(0, 100)}`,
    type: 'COMMUNITY_POST',
    targetRole: 'ADMINISTRATOR',
  });
}

export async function approveUnflagCommunityPost(post: CommunityPost): Promise<void> {
  await updateCommunityPost(post.id, { isFlagged: false });
}

export async function deleteCommunityPost(postId: string, userId?: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.COMMUNITY_POSTS, postId));
    if (userId) {
      const liked = getLocalLikedPostIds(userId).filter((id) => id !== postId);
      setLocalLikedPostIds(userId, liked);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.COMMUNITY_POSTS}/${postId}`);
  }
}

export async function cleanupExpiredForumPosts(posts: CommunityPost[]): Promise<number> {
  const now = Date.now();
  const expired = posts.filter((p) => isForumPostExpired(p, now));
  let cleaned = 0;
  for (const post of expired) {
    try {
      await deleteDoc(doc(db, COLLECTIONS.COMMUNITY_POSTS, post.id));
      cleaned++;
    } catch {
      // ignore cleanup failures (e.g. offline or rule restriction)
    }
  }
  return cleaned;
}

export async function addCommentToPost(
  post: CommunityPost,
  author: FellowshipAccount,
  contentText: string
): Promise<void> {
  const cleanText = contentText.trim();
  if (!cleanText) return;

  const existing = parseJsonArray<PostComment>(post.commentsJson, []);
  const authorId = author.userId || author.id;
  const authorName =
    author.role === 'ADMINISTRATOR' || author.id === ADMIN_DOC_ID ? 'Admin' : author.fullName;

  const newComment: PostComment = {
    id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    postId: post.id,
    authorId,
    authorName,
    authorRole: author.role,
    ...(author.avatarUrl ? { authorAvatarUri: author.avatarUrl } : {}),
    content: cleanText,
    createdAt: Date.now(),
  };

  const nextComments = [...existing, newComment];
  const nextCommentsJson = serializeCommentsWithinLimit(nextComments);
  const postRef = doc(db, COLLECTIONS.COMMUNITY_POSTS, post.id);

  if (!isWithinFirestoreDocLimit({ ...post, commentsJson: nextCommentsJson })) {
    throw new Error('This post has reached the maximum reply storage limit.');
  }

  try {
    const snap = await getDoc(postRef);
    if (!snap.exists()) {
      throw new Error('This post is no longer available.');
    }
    await updateDoc(postRef, {
      commentsJson: nextCommentsJson,
      commentsCount: nextComments.length,
      updatedAt: serverTimestamp(),
    });
    await createNotification({
      dedupKey: `reply:${post.id}:${nextComments.length}`,
      title: `New Reply on "${(post.title || post.content).slice(0, 40)}"`,
      message: `${authorName}: ${cleanText.slice(0, 100)}`,
      type: 'COMMUNITY_POST',
      targetRole: 'ALL',
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'This post is no longer available.') {
      throw err;
    }
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.COMMUNITY_POSTS}/${post.id}`);
  }
}

// Executive Inquiries (Executive Contact)
export async function createExecutiveInquiry(params: {
  sender: FellowshipAccount;
  isAnonymous: boolean;
  topic?: string;
  subject?: string;
  message?: string;
  question?: string;
}): Promise<string> {
  const id = `inq_${generate16CharId()}`;
  const senderId = params.sender.userId || params.sender.id;
  const topicClean = (params.topic || params.subject || 'Youth Inquiry').trim();
  const messageClean = (params.message || params.question || '').trim();
  const nonAnonName =
    params.sender.role === 'ADMINISTRATOR' || params.sender.id === ADMIN_DOC_ID
      ? 'Admin'
      : params.sender.fullName;

  const payload: Record<string, unknown> = {
    senderId,
    senderName: params.isAnonymous ? 'Anonymous Youth Member' : nonAnonName,
    senderRole: params.sender.role,
    senderAvatarUri: params.isAnonymous ? null : params.sender.avatarUrl || null,
    fellowshipId: FELLOWSHIP_ID,
    isAnonymous: params.isAnonymous,
    topic: topicClean,
    message: messageClean,
    status: 'PENDING',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, COLLECTIONS.INQUIRIES, id), payload);
    await createNotification({
      dedupKey: `inq:${id}`,
      title: `New Executive Inquiry: ${topicClean}`,
      message: `${payload.senderName}: ${messageClean.slice(0, 100)}`,
      type: 'COMMUNITY_POST',
      targetRole: 'EXECUTIVE',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${COLLECTIONS.INQUIRIES}/${id}`);
  }
  return id;
}

export async function respondToInquiry(
  inquiry: ExecutiveInquiry,
  params: {
    status: 'IN_PROGRESS' | 'RESOLVED';
    responseMessage: string;
    responderName: string;
    responderRole: string;
  }
): Promise<void> {
  const respondedAt = Date.now();
  try {
    await updateDoc(doc(db, COLLECTIONS.INQUIRIES, inquiry.id), {
      status: params.status,
      responseMessage: params.responseMessage.trim(),
      respondedByName: params.responderName,
      respondedByRole: params.responderRole,
      respondedAt,
      updatedAt: serverTimestamp(),
    });
    await createNotification({
      dedupKey: `inq-resp:${inquiry.id}`,
      title: `Pastoral Response: ${inquiry.topic || inquiry.subject || 'Your Inquiry'}`,
      message: params.responseMessage.trim().slice(0, 120),
      type: 'ANNOUNCEMENT',
      recipientUserId: inquiry.senderId,
      targetRole: 'ALL',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.INQUIRIES}/${inquiry.id}`);
  }
}

// Daily Scriptures, Sermons & Devotionals, Sermon Audio Chunks, and Uploaded PDF/EPUB Bibles
export async function deleteAudioChunksForCloudId(audioCloudId: string): Promise<void> {
  const targetCloudId = (audioCloudId || '').trim();
  if (!targetCloudId) return;

  await deleteAudioSermonBlob(targetCloudId);

  try {
    const q = query(
      collection(db, COLLECTIONS.SERMON_AUDIO_CHUNKS),
      where('fellowshipId', '==', FELLOWSHIP_ID)
    );
    const snap = await getDocs(q);
    const matchingDocs = snap.docs.filter(
      (d) => String((d.data() as Record<string, unknown>).audioCloudId || '').trim() === targetCloudId
    );
    await Promise.all(
      matchingDocs.map((d) =>
        deleteDoc(doc(db, COLLECTIONS.SERMON_AUDIO_CHUNKS, d.id)).catch(() => {})
      )
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, COLLECTIONS.SERMON_AUDIO_CHUNKS, true);
  }
}

export async function deleteAllOtherAudioSermons(
  keepDocId?: string | null,
  keepAudioCloudId?: string | null
): Promise<void> {
  const keepIdClean = keepDocId?.trim() || '';
  const keepCloudClean = keepAudioCloudId?.trim() || '';

  await purgeAllAudioSermonBlobsExcept(keepCloudClean || null);

  try {
    const scripturesQ = query(
      collection(db, COLLECTIONS.DAILY_SCRIPTURES),
      where('fellowshipId', '==', FELLOWSHIP_ID)
    );
    const scripturesSnap = await getDocs(scripturesQ);
    const docsToDelete: string[] = [];

    for (const d of scripturesSnap.docs) {
      if (keepIdClean && d.id === keepIdClean) continue;
      const data = d.data() as Record<string, unknown>;
      const rawPrompt = String(data.prayerPromptEn || '').trim();
      if (!rawPrompt.startsWith('{')) continue;
      try {
        const meta = JSON.parse(rawPrompt) as Record<string, unknown>;
        const metaCloudId = String(meta.audioCloudId || '').trim();
        const metaChunkCount = Number(meta.audioChunkCount) || 0;
        if (metaCloudId && (metaChunkCount > 0 || metaCloudId !== keepCloudClean)) {
          docsToDelete.push(d.id);
        }
      } catch {
        // Skip malformed non-audio docs
      }
    }

    await Promise.all(
      docsToDelete.map((docId) =>
        deleteDoc(doc(db, COLLECTIONS.DAILY_SCRIPTURES, docId)).catch(() => {})
      )
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, COLLECTIONS.DAILY_SCRIPTURES, true);
  }

  try {
    const chunksQ = query(
      collection(db, COLLECTIONS.SERMON_AUDIO_CHUNKS),
      where('fellowshipId', '==', FELLOWSHIP_ID)
    );
    const chunksSnap = await getDocs(chunksQ);
    const staleChunks = chunksSnap.docs.filter((d) => {
      const cid = String((d.data() as Record<string, unknown>).audioCloudId || '').trim();
      return !keepCloudClean || cid !== keepCloudClean;
    });
    await Promise.all(
      staleChunks.map((d) =>
        deleteDoc(doc(db, COLLECTIONS.SERMON_AUDIO_CHUNKS, d.id)).catch(() => {})
      )
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, COLLECTIONS.SERMON_AUDIO_CHUNKS, true);
  }
}

export async function uploadSermonAudioChunks(params: {
  file: File | Blob;
  fileName: string;
  uploadedById: string;
  audioCloudId?: string;
  onProgress?: (completed: number, total: number) => void;
}): Promise<{
  audioCloudId: string;
  audioFileName: string;
  audioMimeType: string;
  audioSizeBytes: number;
  audioChunkCount: number;
}> {
  const buffer = await params.file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const base64Chunks = sliceAudioBytesToChunkBase64(bytes, AUDIO_SLICE_BYTES);
  const audioCloudId = params.audioCloudId?.trim() || generateAudioCloudId();
  const uploadedById = auth.currentUser?.uid || params.uploadedById || ADMIN_DOC_ID;
  const totalChunks = base64Chunks.length;
  const rawType = 'type' in params.file && params.file.type ? params.file.type : '';
  const mimeType = inferAudioMimeType(params.fileName, rawType);

  let lastChunkPath: string = COLLECTIONS.SERMON_AUDIO_CHUNKS;

  try {
    for (let i = 0; i < base64Chunks.length; i += 1) {
      const chunkDocId = `${audioCloudId}_c${i}`;
      lastChunkPath = `${COLLECTIONS.SERMON_AUDIO_CHUNKS}/${chunkDocId}`;
      const chunkPayload = buildSermonAudioChunkFirestorePayload({
        audioCloudId,
        uploadedById,
        chunkIndex: i,
        totalChunks,
        dataBase64: base64Chunks[i],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, COLLECTIONS.SERMON_AUDIO_CHUNKS, chunkDocId), chunkPayload);
      params.onProgress?.(i + 1, totalChunks);
    }
  } catch (err) {
    await deleteAudioChunksForCloudId(audioCloudId);
    handleFirestoreError(err, OperationType.CREATE, lastChunkPath);
  }

  await saveAudioSermonBlob(audioCloudId, params.file, params.fileName).catch(() => {});

  return {
    audioCloudId,
    audioFileName: params.fileName,
    audioMimeType: mimeType,
    audioSizeBytes: bytes.byteLength,
    audioChunkCount: totalChunks,
  };
}

export async function fetchAndReassembleSermonAudioBlob(
  resource: Pick<
    SpiritualResource,
    'audioCloudId' | 'audioMimeType' | 'audioFileName' | 'audioChunkCount'
  >
): Promise<Blob> {
  const cloudId = resource.audioCloudId?.trim() || '';
  if (!cloudId) {
    throw new Error('This sermon does not have an attached audio file.');
  }

  const cached = await loadAudioSermonBlob(cloudId);
  if (cached && cached.size > 0) {
    return cached;
  }

  const q = query(
    collection(db, COLLECTIONS.SERMON_AUDIO_CHUNKS),
    where('fellowshipId', '==', FELLOWSHIP_ID)
  );
  let docs: Array<{ data: () => unknown }> = [];
  try {
    const serverSnap = await getDocsFromServer(q);
    docs = serverSnap.docs;
  } catch {
    try {
      const snap = await getDocs(q);
      docs = snap.docs;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, COLLECTIONS.SERMON_AUDIO_CHUNKS);
      docs = [];
    }
  }

  const matchingChunks = docs
    .map((d) => d.data() as Record<string, unknown>)
    .filter((d) => String(d.audioCloudId || '').trim() === cloudId)
    .map((d) => ({
      chunkIndex: Number(d.chunkIndex) || 0,
      dataBase64: String(d.dataBase64 || ''),
    }))
    .filter((c) => c.dataBase64.length > 0);

  if (matchingChunks.length === 0) {
    throw new Error(
      'This audio sermon was replaced or removed. Refresh to see the latest sermon.'
    );
  }

  const blob = combineDecodedChunksToBlob(
    matchingChunks,
    resource.audioMimeType || 'audio/mpeg'
  );
  await saveAudioSermonBlob(cloudId, blob, resource.audioFileName);
  return blob;
}

export async function publishDailyScripture(params: {
  authorId: string;
  authorName: string;
  referenceEn: string;
  verseTextEn: string;
  chargeText: string;
}): Promise<string> {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const id = `scripture_${suffix}`;
  const refClean = params.referenceEn.trim().slice(0, 120);
  const verseClean = params.verseTextEn.trim().slice(0, 2000);
  const chargeClean = params.chargeText.trim() || 'Rise as mighty Gideonites today and do Kingdom exploits!';
  const fullBody = `${verseClean}\n\nGideonites Youth Charge:\n${chargeClean}`;
  const [reflectionEn, reflectionYo, reflectionHa, reflectionIg] = chunkStringForFirestore(fullBody, 4, 3000);
  const dateKey = new Date().toISOString().slice(0, 10);

  const docData: Record<string, unknown> = {
    authorId: params.authorId,
    authorName: params.authorName.trim() || DEFAULT_MINISTRY_AUTHOR,
    fellowshipId: FELLOWSHIP_ID,
    dateKey,
    referenceEn: refClean,
    verseTextEn: verseClean,
    reflectionEn,
    ...(reflectionYo ? { reflectionYo } : {}),
    ...(reflectionHa ? { reflectionHa } : {}),
    ...(reflectionIg ? { reflectionIg } : {}),
    prayerPromptEn: buildCappedPrayerPromptJson({
      category: 'SCRIPTURE_OF_THE_DAY',
      title: `Scripture for the Day • ${refClean}`,
      summary: verseClean.slice(0, 220),
      audioDurationMinutes: 0,
      publishedAt: Date.now(),
    }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, COLLECTIONS.DAILY_SCRIPTURES, id), docData);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${COLLECTIONS.DAILY_SCRIPTURES}/${id}`);
  }

  recordLocallyOriginatingIds([`scr:${id}`, `syn-scr-${id}`]);
  await createNotification({
    dedupKey: `scr:${id}`,
    title: `Scripture for the Day: ${refClean}`,
    message: verseClean.slice(0, 120),
    type: 'ANNOUNCEMENT',
    targetRole: 'ALL',
    targetTab: 'spiritual',
  });

  return id;
}

export async function publishSpiritualResource(
  resource: Omit<SpiritualResource, 'id' | 'createdAt' | 'bookmarkedBy'> & {
    authorId?: string;
    audioFile?: File | null;
    onUploadProgress?: (completed: number, total: number) => void;
  }
): Promise<string> {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const id = `scripture_${suffix}`;
  const now = Date.now();
  const titleClean = resource.title.trim();
  const refClean = (resource.scriptureRef || 'Psalm 119:105').trim().slice(0, 120);
  const authorId = resource.authorId || ADMIN_DOC_ID;

  let audioMeta:
    | {
        audioCloudId: string;
        audioFileName: string;
        audioMimeType: string;
        audioSizeBytes: number;
        audioChunkCount: number;
      }
    | undefined;

  if (resource.kind === 'SERMON' && resource.audioFile) {
    audioMeta = await uploadSermonAudioChunks({
      file: resource.audioFile,
      fileName: resource.audioFile.name,
      uploadedById: authorId,
      onProgress: resource.onUploadProgress,
    });
  }

  const hasAudio = Boolean(audioMeta);
  const audioFallback = hasAudio ? `Audio Sermon • ${audioMeta!.audioFileName}` : '';
  const bodyClean = resource.body.trim() || audioFallback;
  const summaryClean = (resource.summary || bodyClean.slice(0, 180)).trim() || audioFallback;
  const audioMins =
    resource.audioDurationMinutes ?? (resource.kind === 'SERMON' ? (hasAudio ? 1 : 25) : 0);

  const docData: Record<string, unknown> = {
    ...buildSpiritualResourceFirestorePayload({
      authorId,
      authorName: resource.speaker.trim() || DEFAULT_MINISTRY_AUTHOR,
      category: resource.kind,
      title: titleClean,
      speaker: resource.speaker.trim() || DEFAULT_MINISTRY_AUTHOR,
      scriptureRef: refClean,
      summary: summaryClean,
      body: bodyClean,
      audioDurationMinutes: audioMins,
      ...(audioMeta || {}),
      bookmarkedBy: [],
      publishedAt: now,
    }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, COLLECTIONS.DAILY_SCRIPTURES, id), docData);
    if (audioMeta) {
      await deleteAllOtherAudioSermons(id, audioMeta.audioCloudId);
    }
    const notifId = audioMeta ? `notif_res_${id}` : undefined;
    recordLocallyOriginatingIds(
      [`scr:${id}`, `syn-scr-${id}`, ...(notifId ? [notifId] : [])]
    );
    await createNotification({
      explicitId: notifId,
      dedupKey: `scr:${id}`,
      title: audioMeta
        ? `🎧 New Audio Sermon: ${titleClean}`
        : `New ${resource.kind.replace('_', ' ')}: ${titleClean}`,
      message: `${resource.speaker.trim() || DEFAULT_MINISTRY_AUTHOR} · ${refClean}`,
      type: 'ANNOUNCEMENT',
      targetRole: 'ALL',
      targetTab: 'spiritual',
    });
  } catch (err) {
    if (audioMeta) {
      await deleteAudioChunksForCloudId(audioMeta.audioCloudId);
    }
    handleFirestoreError(err, OperationType.CREATE, `${COLLECTIONS.DAILY_SCRIPTURES}/${id}`);
  }
  return id;
}

export async function updateSpiritualResource(
  docId: string,
  params: {
    authorId: string;
    authorName: string;
    category: ExtendedSpiritualKind;
    title: string;
    speaker: string;
    scriptureRef: string;
    summary: string;
    body: string;
    audioDurationMinutes: number;
    bookmarkedBy?: string[];
    audioFile?: File | null;
    removeAudio?: boolean;
    existingAudioCloudId?: string;
    existingAudioFileName?: string;
    existingAudioMimeType?: string;
    existingAudioSizeBytes?: number;
    existingAudioChunkCount?: number;
    onUploadProgress?: (completed: number, total: number) => void;
  }
): Promise<void> {
  let audioCloudId = params.existingAudioCloudId?.trim() || undefined;
  let audioFileName = params.existingAudioFileName;
  let audioMimeType = params.existingAudioMimeType;
  let audioSizeBytes = params.existingAudioSizeBytes;
  let audioChunkCount = params.existingAudioChunkCount;
  let uploadedNewCloudId: string | undefined;

  if (params.category !== 'SERMON' || params.removeAudio) {
    if (audioCloudId) {
      await deleteAudioChunksForCloudId(audioCloudId);
    }
    audioCloudId = undefined;
    audioFileName = undefined;
    audioMimeType = undefined;
    audioSizeBytes = undefined;
    audioChunkCount = undefined;
  } else if (params.audioFile) {
    const uploaded = await uploadSermonAudioChunks({
      file: params.audioFile,
      fileName: params.audioFile.name,
      uploadedById: params.authorId,
      onProgress: params.onUploadProgress,
    });
    uploadedNewCloudId = uploaded.audioCloudId;
    audioCloudId = uploaded.audioCloudId;
    audioFileName = uploaded.audioFileName;
    audioMimeType = uploaded.audioMimeType;
    audioSizeBytes = uploaded.audioSizeBytes;
    audioChunkCount = uploaded.audioChunkCount;
  }

  const payload = buildSpiritualResourceFirestorePayload({
    authorId: params.authorId,
    authorName: params.authorName,
    category: params.category,
    title: params.title,
    speaker: params.speaker,
    scriptureRef: params.scriptureRef,
    summary: params.summary,
    body: params.body,
    audioDurationMinutes: params.audioDurationMinutes,
    audioCloudId,
    audioFileName,
    audioMimeType,
    audioSizeBytes,
    audioChunkCount,
    bookmarkedBy: params.bookmarkedBy,
    publishedAt: Date.now(),
  });

  try {
    await updateDoc(doc(db, COLLECTIONS.DAILY_SCRIPTURES, docId), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
    if (uploadedNewCloudId) {
      await deleteAllOtherAudioSermons(docId, uploadedNewCloudId);
    }
  } catch (err) {
    if (uploadedNewCloudId) {
      await deleteAudioChunksForCloudId(uploadedNewCloudId);
    }
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.DAILY_SCRIPTURES}/${docId}`);
  }
}

export async function deleteSpiritualResource(
  docId: string,
  audioCloudId?: string
): Promise<void> {
  let targetCloudId = audioCloudId?.trim() || '';
  if (!targetCloudId) {
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.DAILY_SCRIPTURES, docId));
      if (snap.exists()) {
        const rawPrompt = String((snap.data() as Record<string, unknown>).prayerPromptEn || '');
        if (rawPrompt.startsWith('{')) {
          const parsed = JSON.parse(rawPrompt) as Record<string, unknown>;
          targetCloudId = String(parsed.audioCloudId || '').trim();
        }
      }
    } catch {
      // ignore metadata lookup failure before delete
    }
  }

  if (targetCloudId) {
    await deleteAudioChunksForCloudId(targetCloudId);
  }

  try {
    await deleteDoc(doc(db, COLLECTIONS.DAILY_SCRIPTURES, docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.DAILY_SCRIPTURES}/${docId}`);
  }
}

export async function toggleBookmarkSpiritualResource(
  docId: string,
  resource: SpiritualResource,
  userId: string
): Promise<void> {
  const has = resource.bookmarkedBy.includes(userId);
  const nextBookmarks = has
    ? resource.bookmarkedBy.filter((id) => id !== userId)
    : [...resource.bookmarkedBy, userId];

  try {
    const ref = doc(db, COLLECTIONS.DAILY_SCRIPTURES, docId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const rawPrompt = String((snap.data() as Record<string, unknown>).prayerPromptEn || '{}');
    let nextPromptObj: Record<string, unknown>;
    try {
      nextPromptObj = JSON.parse(rawPrompt) as Record<string, unknown>;
    } catch {
      nextPromptObj = { kind: resource.kind, title: resource.title };
    }
    nextPromptObj.bookmarkedBy = nextBookmarks;
    await updateDoc(ref, {
      prayerPromptEn: buildCappedPrayerPromptJson(nextPromptObj),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.DAILY_SCRIPTURES}/${docId}`, true);
  }
}

export async function publishUploadedBibleEdition(params: {
  title: string;
  translation: string;
  format: 'PDF' | 'EPUB';
  fileName: string;
  fileSizeKb: number;
  sections: UploadedBibleSection[];
  pageOrChapterCount: number;
  verses: ParsedBibleVerse[];
  uploadedBy: string;
  authorId: string;
}): Promise<{ editionId: string; docId: string; chunkDocsCount: number }> {
  const editionId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const docId = `scripture_bibledoc_${editionId}`;
  const now = Date.now();
  const sectionChunks = encodeCompactBibleSectionsChunks(params.sections);

  const bibleDocPayload: Record<string, unknown> = {
    authorId: auth.currentUser?.uid || params.authorId || ADMIN_DOC_ID,
    authorName: params.uploadedBy,
    fellowshipId: FELLOWSHIP_ID,
    dateKey: 'BIBLE_EDITION',
    referenceEn: `${params.translation} (${params.format})`.slice(0, 120),
    verseTextEn: params.title.trim().slice(0, 2000),
    reflectionEn: sectionChunks.reflectionEn || '[]',
    ...(sectionChunks.reflectionYo ? { reflectionYo: sectionChunks.reflectionYo } : {}),
    ...(sectionChunks.reflectionHa ? { reflectionHa: sectionChunks.reflectionHa } : {}),
    ...(sectionChunks.reflectionIg ? { reflectionIg: sectionChunks.reflectionIg } : {}),
    ...(sectionChunks.verseTextYo ? { verseTextYo: sectionChunks.verseTextYo } : {}),
    ...(sectionChunks.verseTextHa ? { verseTextHa: sectionChunks.verseTextHa } : {}),
    prayerPromptEn: buildCappedPrayerPromptJson({
      category: 'BIBLE_DOCUMENT',
      editionId,
      title: params.title.trim(),
      translation: params.translation,
      fileFormat: params.format,
      fileName: params.fileName,
      fileSizeKb: params.fileSizeKb,
      pageOrChapterCount: params.pageOrChapterCount,
      extractedVersesCount: params.verses.length,
      uploadedAt: now,
    }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (!isWithinFirestoreDocLimit(bibleDocPayload)) {
    throw new Error('Bible edition metadata exceeds Firestore 1 MB document limit.');
  }

  try {
    await setDoc(doc(db, COLLECTIONS.DAILY_SCRIPTURES, docId), bibleDocPayload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${COLLECTIONS.DAILY_SCRIPTURES}/${docId}`);
  }

  let chunkDocsCount = 0;
  if (params.verses.length > 0) {
    const cleanBatchKey =
      params.translation.toLowerCase().replace(/[^a-z0-9]/g, '') || 'kjv';
    const versesPerDoc = 35;
    const maxChunks = 4;
    for (
      let i = 0;
      i < Math.min(params.verses.length, versesPerDoc * maxChunks);
      i += versesPerDoc
    ) {
      const slice = params.verses.slice(i, i + versesPerDoc);
      const chunkIdx = chunkDocsCount;
      const packId = `scripture_biblepack_${cleanBatchKey}_${chunkIdx}`;
      const packChunks = encodeCompactVersePackChunk(slice);
      const packDoc: Record<string, unknown> = {
        authorId: auth.currentUser?.uid || params.authorId || ADMIN_DOC_ID,
        authorName: params.uploadedBy,
        fellowshipId: FELLOWSHIP_ID,
        dateKey: 'BIBLE_PACK',
        referenceEn: `${params.translation} Verse Pack #${chunkIdx + 1}`.slice(0, 120),
        verseTextEn: `${slice.length} verses`.slice(0, 2000),
        reflectionEn: packChunks.reflectionEn || '[]',
        ...(packChunks.reflectionYo ? { reflectionYo: packChunks.reflectionYo } : {}),
        ...(packChunks.reflectionHa ? { reflectionHa: packChunks.reflectionHa } : {}),
        ...(packChunks.reflectionIg ? { reflectionIg: packChunks.reflectionIg } : {}),
        prayerPromptEn: buildCappedPrayerPromptJson({
          category: 'BIBLE_VERSE_PACK',
          batchKey: cleanBatchKey,
          chunkIdx,
          translation: params.translation,
          publishedAt: now,
        }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      try {
        await setDoc(doc(db, COLLECTIONS.DAILY_SCRIPTURES, packId), packDoc);
        chunkDocsCount++;
      } catch {
        // continue gracefully on individual chunk error
      }
    }
  }

  await createNotification({
    dedupKey: `scr:${docId}`,
    title: `Bible Edition Uploaded: ${params.title}`,
    message: `${params.translation} (${params.format}) · ${params.verses.length} verses synced.`,
    type: 'ANNOUNCEMENT',
    targetRole: 'ALL',
  });

  return { editionId, docId, chunkDocsCount };
}

export async function deleteUploadedBibleEdition(docId: string): Promise<void> {
  if (!docId || docId === 'bdoc_default_kjv') return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.DAILY_SCRIPTURES, docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.DAILY_SCRIPTURES}/${docId}`);
  }
}

export async function uploadBibleDocument(
  bibleDoc: Omit<UploadedBibleDoc, 'id' | 'createdAt'>
): Promise<void> {
  await publishUploadedBibleEdition({
    title: bibleDoc.title,
    translation: bibleDoc.translation || bibleDoc.version || 'KJV',
    format: bibleDoc.format === 'EPUB' ? 'EPUB' : 'PDF',
    fileName: bibleDoc.fileName,
    fileSizeKb: bibleDoc.fileSizeKb,
    sections:
      bibleDoc.sections && bibleDoc.sections.length > 0
        ? bibleDoc.sections
        : [{ title: 'Excerpt', content: bibleDoc.contentText }],
    pageOrChapterCount: bibleDoc.pageOrChapterCount || 1,
    verses: [],
    uploadedBy: bibleDoc.uploadedBy,
    authorId: 'user-admin-01',
  });
}

export function extractDailyResources(docs: DailyScriptureDoc[]): {
  dailyScripture: DailyScriptureDoc | null;
  spiritualResources: SpiritualResource[];
  uploadedBibles: UploadedBibleDoc[];
} {
  let dailyScripture: DailyScriptureDoc | null = null;
  const spiritualResources: SpiritualResource[] = [];
  const uploadedBibles: UploadedBibleDoc[] = [];

  const sorted = [...docs].sort((a, b) => b.createdAt - a.createdAt);

  for (const d of sorted) {
    const refVal = d.referenceEn || d.reference || '';
    const verseVal = d.verseTextEn || d.verseText || '';
    const joinedReflections = [d.reflectionEn, d.reflectionYo, d.reflectionHa, d.reflectionIg]
      .filter((part): part is string => typeof part === 'string' && part.length > 0)
      .join('');

    let meta: Record<string, unknown> | null = null;
    if (d.prayerPromptEn && d.prayerPromptEn.trim().startsWith('{')) {
      try {
        meta = JSON.parse(d.prayerPromptEn) as Record<string, unknown>;
      } catch {
        meta = null;
      }
    }

    const metaCategory = String(meta?.category || meta?.kind || '').toUpperCase();

    if (
      d.dateKey === 'BIBLE_PACK' ||
      d.id.startsWith('scripture_biblepack_') ||
      metaCategory === 'BIBLE_VERSE_PACK'
    ) {
      continue;
    }

    if (
      d.dateKey === 'BIBLE_EDITION' ||
      d.id.startsWith('scripture_bibledoc_') ||
      metaCategory === 'BIBLE_DOCUMENT' ||
      d.type === 'BIBLE_DOC'
    ) {
      const sections = decodeBibleEditionSections(d);
      const fallbackContent =
        sections.length > 0
          ? sections.map((s) => `${s.title}\n${s.content}`).join('\n\n')
          : joinedReflections || String(meta?.contentText || verseVal);

      const rawFormat = String(meta?.fileFormat || meta?.format || (refVal.includes('EPUB') ? 'EPUB' : 'PDF')).toUpperCase();
      const format: 'PDF' | 'EPUB' = rawFormat === 'EPUB' ? 'EPUB' : 'PDF';
      const translation = String(meta?.translation || meta?.version || refVal.split('(')[0]?.trim() || 'KJV');

      uploadedBibles.push({
        id: d.id,
        title: String(meta?.title || verseVal || refVal),
        version: translation,
        translation,
        format,
        fileFormat: format,
        fileName: String(meta?.fileName || d.chargeEn || `${translation.toLowerCase()}.${format.toLowerCase()}`),
        fileSizeKb: Number(meta?.fileSizeKb) || 0,
        pageOrChapterCount: Number(meta?.pageOrChapterCount) || Math.max(1, sections.length),
        extractedVersesCount: Number(meta?.extractedVersesCount) || 0,
        sections,
        contentText: fallbackContent,
        fileDataUrl: typeof meta?.fileDataUrl === 'string' ? meta.fileDataUrl : undefined,
        uploadedBy: d.authorName || String(meta?.uploadedBy || 'Admin'),
        createdAt: Number(meta?.uploadedAt || meta?.publishedAt) || d.createdAt,
      });
      continue;
    }

    const isResourceKind =
      d.type === 'SERMON' ||
      d.type === 'DEVOTIONAL' ||
      d.type === 'BIBLE_STUDY' ||
      d.type === 'PRAYER_POINTS' ||
      d.id.startsWith('scripture_res_') ||
      metaCategory === 'SERMON' ||
      metaCategory === 'DEVOTIONAL' ||
      metaCategory === 'BIBLE_STUDY' ||
      metaCategory === 'PRAYER_POINTS';

    if (isResourceKind) {
      const kind = (
        ['SERMON', 'DEVOTIONAL', 'BIBLE_STUDY', 'PRAYER_POINTS'].includes(metaCategory)
          ? metaCategory
          : d.type && ['SERMON', 'DEVOTIONAL', 'BIBLE_STUDY', 'PRAYER_POINTS'].includes(d.type)
          ? d.type
          : 'DEVOTIONAL'
      ) as SpiritualResource['kind'];

      const audioMins = Number(meta?.audioDurationMinutes) || 0;
      const audioCloudId =
        typeof meta?.audioCloudId === 'string' && meta.audioCloudId.trim()
          ? meta.audioCloudId.trim()
          : undefined;
      const audioFileName =
        typeof meta?.audioFileName === 'string' && meta.audioFileName.trim()
          ? meta.audioFileName.trim()
          : undefined;
      const audioMimeType =
        typeof meta?.audioMimeType === 'string' && meta.audioMimeType.trim()
          ? meta.audioMimeType.trim()
          : undefined;
      const audioSizeBytes =
        typeof meta?.audioSizeBytes === 'number' && meta.audioSizeBytes > 0
          ? meta.audioSizeBytes
          : undefined;
      const audioChunkCount =
        typeof meta?.audioChunkCount === 'number' && meta.audioChunkCount > 0
          ? meta.audioChunkCount
          : undefined;

      spiritualResources.push({
        id: d.id,
        kind,
        title: String(meta?.title || verseVal || refVal || 'Fellowship Teaching'),
        speaker: String(meta?.speaker || d.authorName || d.chargeEn || DEFAULT_MINISTRY_AUTHOR),
        scriptureRef: String(meta?.scriptureRef || refVal || 'Psalm 119:105'),
        duration: String(
          meta?.duration || (kind === 'SERMON' && audioMins > 0 ? `${audioMins} min audio` : '5 min read')
        ),
        audioDurationMinutes: audioMins || undefined,
        ...(audioCloudId ? { audioCloudId } : {}),
        ...(audioFileName ? { audioFileName } : {}),
        ...(audioMimeType ? { audioMimeType } : {}),
        ...(audioSizeBytes ? { audioSizeBytes } : {}),
        ...(audioChunkCount ? { audioChunkCount } : {}),
        summary: typeof meta?.summary === 'string' ? meta.summary : undefined,
        body: String(joinedReflections || meta?.body || meta?.summary || d.chargeEn || ''),
        bookmarkedBy: Array.isArray(meta?.bookmarkedBy) ? (meta.bookmarkedBy as string[]) : [],
        createdAt: Number(meta?.publishedAt) || d.createdAt,
      });
      continue;
    }

    if (!dailyScripture) {
      dailyScripture = d;
    }
  }

  return { dailyScripture, spiritualResources, uploadedBibles };
}

// Synchronized Multiplayer Quiz Sessions, Solo Quizzes & Global Leaderboard Scores
function resolveSessionHostId(host: Pick<FellowshipAccount, 'id' | 'userId'>): string {
  return auth.currentUser?.uid || host.userId || host.id;
}

function resolveParticipantUserId(account: Pick<FellowshipAccount, 'id' | 'userId'>): string {
  return account.userId || account.id;
}

function generateQuizSessionId(): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return `quiz_${rand}`;
}

function generateRoomPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function buildStrictQuizSessionWritePayload(params: {
  hostId: string;
  hostName: string;
  roomPin: string;
  titleEn: string;
  titleYo?: string;
  titleHa?: string;
  titleIg?: string;
  description?: string;
  gameType: GameType;
  status: SessionStatus;
  scheduledStartTime: number;
  timeLimitPerQuestionSeconds: number;
  leaderboardDurationSeconds: number;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentSubstate: SessionSubstate;
  currentQuestionDeadline: number;
  leaderboardDeadline: number;
  baseScorePerQuestion: number;
  speedBonusEnabled: boolean;
  maxSpeedBonus: number;
  penaltyForIncorrect: boolean;
  questionsJson: string;
  participantsJson: string;
  participantCount: number;
  isCreate: boolean;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    hostId: params.hostId,
    hostName: params.hostName,
    fellowshipId: FELLOWSHIP_ID,
    roomPin: params.roomPin.slice(0, 12),
    titleEn: params.titleEn.trim() || 'Bible Showdown',
    gameType: params.gameType,
    status: params.status,
    currentQuestionIndex: Math.max(0, Math.floor(params.currentQuestionIndex)),
    totalQuestions: clampNumber(Math.floor(params.totalQuestions), 1, 500),
    participantCount: Math.max(0, Math.floor(params.participantCount)),
    scheduledStartTime: Math.max(0, Math.floor(params.scheduledStartTime)),
    timeLimitPerQuestionSeconds: clampNumber(Math.floor(params.timeLimitPerQuestionSeconds), 1, 600),
    leaderboardDurationSeconds: clampNumber(Math.floor(params.leaderboardDurationSeconds), 1, 600),
    currentSubstate: params.currentSubstate,
    currentQuestionDeadline: Math.max(0, Math.floor(params.currentQuestionDeadline)),
    leaderboardDeadline: Math.max(0, Math.floor(params.leaderboardDeadline)),
    baseScorePerQuestion: clampNumber(Math.floor(params.baseScorePerQuestion), 1, 10000),
    speedBonusEnabled: Boolean(params.speedBonusEnabled),
    maxSpeedBonus: clampNumber(Math.floor(params.maxSpeedBonus), 0, 5000),
    penaltyForIncorrect: Boolean(params.penaltyForIncorrect),
    questionsJson: params.questionsJson,
    participantsJson: params.participantsJson,
    updatedAt: serverTimestamp(),
  };

  if (params.titleYo?.trim()) payload.titleYo = params.titleYo.trim();
  if (params.titleHa?.trim()) payload.titleHa = params.titleHa.trim();
  if (params.titleIg?.trim()) payload.titleIg = params.titleIg.trim();
  if (params.description?.trim()) payload.description = params.description.trim().slice(0, 600);
  if (params.isCreate) {
    payload.createdAt = serverTimestamp();
  }
  return payload;
}

export interface UpsertMultiplayerSessionParams {
  existingSessionId?: string;
  existingSession?: QuizSession | null;
  host: FellowshipAccount;
  titleEn: string;
  titleYo?: string;
  titleHa?: string;
  titleIg?: string;
  description?: string;
  gameType: GameType;
  delayMinutes?: number;
  timeLimitPerQuestionSeconds: number;
  leaderboardDurationSeconds?: number;
  baseScorePerQuestion: number;
  speedBonusEnabled: boolean;
  maxSpeedBonus?: number;
  penaltyForIncorrect?: boolean;
  questions: MultiplayerQuestion[];
}

export async function saveDraftMultiplayerSession(
  params: UpsertMultiplayerSessionParams
): Promise<QuizSession> {
  const isEditingExisting = Boolean(
    params.existingSessionId && params.existingSessionId.startsWith('quiz_')
  );
  const sessionId =
    isEditingExisting && params.existingSessionId
      ? params.existingSessionId
      : generateQuizSessionId();
  const hostId = params.existingSession?.hostId || resolveSessionHostId(params.host);
  const hostName =
    params.host.role === 'ADMINISTRATOR' || params.host.id === ADMIN_DOC_ID
      ? 'Admin'
      : params.host.fullName;
  const roomPin = params.existingSession?.roomPin || generateRoomPin();
  const questionsJson = serializeMultiplayerQuestions(params.questions);
  const parsedQs = parseMultiplayerQuestions(questionsJson);
  const existingParticipants = parseMultiplayerParticipants(
    params.existingSession?.participantsJson
  );
  const participantsJson = JSON.stringify(existingParticipants);
  const titles = buildLocalizedSessionTitles(params.gameType, params.titleEn);

  const payload = buildStrictQuizSessionWritePayload({
    hostId,
    hostName,
    roomPin,
    titleEn: params.titleEn.trim() || titles.titleEn,
    titleYo: params.titleYo || titles.titleYo,
    titleHa: params.titleHa || titles.titleHa,
    titleIg: params.titleIg || titles.titleIg,
    description: params.description,
    gameType: params.gameType,
    status: 'DRAFT',
    scheduledStartTime: 0,
    timeLimitPerQuestionSeconds: params.timeLimitPerQuestionSeconds,
    leaderboardDurationSeconds:
      params.leaderboardDurationSeconds ?? DEFAULT_LEADERBOARD_DURATION_SEC,
    currentQuestionIndex: 0,
    totalQuestions: Math.max(1, parsedQs.length),
    currentSubstate: 'WAITING_TO_START',
    currentQuestionDeadline: 0,
    leaderboardDeadline: 0,
    baseScorePerQuestion: params.baseScorePerQuestion,
    speedBonusEnabled: params.speedBonusEnabled,
    maxSpeedBonus: params.maxSpeedBonus ?? 50,
    penaltyForIncorrect: params.penaltyForIncorrect ?? false,
    questionsJson,
    participantsJson,
    participantCount: existingParticipants.length,
    isCreate: !isEditingExisting,
  });

  try {
    const ref = doc(db, COLLECTIONS.QUIZ_SESSIONS, sessionId);
    if (isEditingExisting) {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const curStatus = normalizeSessionStatus(
          String((snap.data() as Record<string, unknown>).status)
        );
        if (curStatus === 'COMPLETED' || curStatus === 'CANCELLED') {
          throw new Error('Cannot modify a completed or cancelled session.');
        }
        await updateDoc(ref, payload);
      } else {
        payload.createdAt = serverTimestamp();
        await setDoc(ref, payload);
      }
    } else {
      await setDoc(ref, payload);
    }
  } catch (err) {
    handleFirestoreError(
      err,
      isEditingExisting ? OperationType.UPDATE : OperationType.CREATE,
      `${COLLECTIONS.QUIZ_SESSIONS}/${sessionId}`
    );
  }

  return parseMultiplayerSessionDoc(sessionId, payload, Date.now());
}

export async function publishMultiplayerSession(
  params: UpsertMultiplayerSessionParams
): Promise<QuizSession> {
  const isEditingExisting = Boolean(
    params.existingSessionId && params.existingSessionId.startsWith('quiz_')
  );
  const sessionId =
    isEditingExisting && params.existingSessionId
      ? params.existingSessionId
      : generateQuizSessionId();
  const hostId = params.existingSession?.hostId || resolveSessionHostId(params.host);
  const hostName =
    params.host.role === 'ADMINISTRATOR' || params.host.id === ADMIN_DOC_ID
      ? 'Admin'
      : params.host.fullName;
  const roomPin = params.existingSession?.roomPin || generateRoomPin();
  const questionsJson = serializeMultiplayerQuestions(params.questions);
  const parsedQs = parseMultiplayerQuestions(questionsJson);
  const existingParticipants = parseMultiplayerParticipants(
    params.existingSession?.participantsJson
  );
  const participantsJson = JSON.stringify(existingParticipants);
  const titles = buildLocalizedSessionTitles(params.gameType, params.titleEn);

  const now = Date.now();
  const delayMin = Math.max(0, Number(params.delayMinutes) || 0);
  const launchImmediately = delayMin === 0;
  const firstQSec = getEffectiveQuestionTimeLimit(
    { timeLimitPerQuestionSeconds: params.timeLimitPerQuestionSeconds },
    parsedQs[0]
  );

  const payload = buildStrictQuizSessionWritePayload({
    hostId,
    hostName,
    roomPin,
    titleEn: params.titleEn.trim() || titles.titleEn,
    titleYo: params.titleYo || titles.titleYo,
    titleHa: params.titleHa || titles.titleHa,
    titleIg: params.titleIg || titles.titleIg,
    description: params.description,
    gameType: params.gameType,
    status: launchImmediately ? 'ACTIVE' : 'SCHEDULED',
    scheduledStartTime: launchImmediately ? 0 : now + delayMin * 60_000,
    timeLimitPerQuestionSeconds: params.timeLimitPerQuestionSeconds,
    leaderboardDurationSeconds:
      params.leaderboardDurationSeconds ?? DEFAULT_LEADERBOARD_DURATION_SEC,
    currentQuestionIndex: 0,
    totalQuestions: Math.max(1, parsedQs.length),
    currentSubstate: launchImmediately ? 'QUESTION_OPEN' : 'WAITING_TO_START',
    currentQuestionDeadline: launchImmediately ? now + firstQSec * 1000 : 0,
    leaderboardDeadline: 0,
    baseScorePerQuestion: params.baseScorePerQuestion,
    speedBonusEnabled: params.speedBonusEnabled,
    maxSpeedBonus: params.maxSpeedBonus ?? 50,
    penaltyForIncorrect: params.penaltyForIncorrect ?? false,
    questionsJson,
    participantsJson,
    participantCount: existingParticipants.length,
    isCreate: !isEditingExisting,
  });

  try {
    const ref = doc(db, COLLECTIONS.QUIZ_SESSIONS, sessionId);
    if (isEditingExisting) {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const curStatus = normalizeSessionStatus(
          String((snap.data() as Record<string, unknown>).status)
        );
        if (curStatus === 'COMPLETED' || curStatus === 'CANCELLED') {
          throw new Error('Cannot launch a completed or cancelled session.');
        }
        await updateDoc(ref, payload);
      } else {
        payload.createdAt = serverTimestamp();
        await setDoc(ref, payload);
      }
    } else {
      await setDoc(ref, payload);
    }

    await createNotification({
      dedupKey: `gametime:${sessionId}`,
      title: launchImmediately
        ? `GAME TIME! ${params.titleEn.trim()}`
        : `Showdown Scheduled: ${params.titleEn.trim()}`,
      message: launchImmediately
        ? `Live Arena is NOW OPEN! Join with PIN ${roomPin}`
        : `Starts in ${delayMin} min · Enter lobby now (PIN ${roomPin})`,
      type: 'GAME_TIME',
      targetRole: 'ALL',
      targetTab: 'games',
    });
  } catch (err) {
    handleFirestoreError(
      err,
      isEditingExisting ? OperationType.UPDATE : OperationType.CREATE,
      `${COLLECTIONS.QUIZ_SESSIONS}/${sessionId}`
    );
  }

  return parseMultiplayerSessionDoc(sessionId, payload, now);
}

export async function launchDraftSession(
  session: QuizSession,
  account: FellowshipAccount
): Promise<QuizSession> {
  const qs = parseMultiplayerQuestions(session.questionsJson);
  return publishMultiplayerSession({
    existingSessionId: session.id,
    existingSession: session,
    host: account,
    titleEn: session.titleEn || session.title || 'Bible Showdown',
    titleYo: session.titleYo,
    titleHa: session.titleHa,
    titleIg: session.titleIg,
    description: session.description,
    gameType: session.gameType || 'TRIVIA_CHALLENGE',
    delayMinutes: 0,
    timeLimitPerQuestionSeconds:
      session.timeLimitPerQuestionSeconds ||
      getGameTypeDefaultTimer(session.gameType || 'TRIVIA_CHALLENGE'),
    leaderboardDurationSeconds:
      session.leaderboardDurationSeconds || DEFAULT_LEADERBOARD_DURATION_SEC,
    baseScorePerQuestion: session.baseScorePerQuestion || 100,
    speedBonusEnabled: session.speedBonusEnabled !== false,
    maxSpeedBonus: session.maxSpeedBonus ?? 50,
    penaltyForIncorrect: session.penaltyForIncorrect === true,
    questions: qs,
  });
}

export async function startScheduledSessionNow(session: QuizSession): Promise<void> {
  const status = normalizeSessionStatus(session.status);
  if (status === 'COMPLETED' || status === 'CANCELLED') return;
  const qs = parseMultiplayerQuestions(session.questionsJson);
  const firstQSec = getEffectiveQuestionTimeLimit(session, qs[0]);
  const now = Date.now();
  try {
    await updateDoc(doc(db, COLLECTIONS.QUIZ_SESSIONS, session.id), {
      status: 'ACTIVE',
      currentSubstate: 'QUESTION_OPEN',
      currentQuestionIndex: 0,
      currentQuestionDeadline: now + firstQSec * 1000,
      leaderboardDeadline: 0,
      updatedAt: serverTimestamp(),
    });
    await createNotification({
      dedupKey: `gametime:start:${session.id}`,
      title: `GAME TIME! ${session.titleEn || session.title || 'Bible Showdown'}`,
      message: `Live Arena started! Jump into Round 1 now (PIN ${session.roomPin}).`,
      type: 'GAME_TIME',
      targetRole: 'ALL',
      targetTab: 'games',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.QUIZ_SESSIONS}/${session.id}`);
  }
}

export async function cancelMultiplayerSession(sessionId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.QUIZ_SESSIONS, sessionId);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const status = normalizeSessionStatus(
      String((snap.data() as Record<string, unknown>).status)
    );
    if (status === 'COMPLETED' || status === 'CANCELLED') return;
    await updateDoc(ref, {
      status: 'CANCELLED',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.QUIZ_SESSIONS}/${sessionId}`);
  }
}

export async function endMultiplayerSession(sessionId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.QUIZ_SESSIONS, sessionId);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const status = normalizeSessionStatus(
      String((snap.data() as Record<string, unknown>).status)
    );
    if (status === 'COMPLETED' || status === 'CANCELLED') return;
    await updateDoc(ref, {
      status: 'COMPLETED',
      currentSubstate: 'LEADERBOARD',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.QUIZ_SESSIONS}/${sessionId}`);
  }
}

export async function deleteDraftSession(sessionId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.QUIZ_SESSIONS, sessionId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.QUIZ_SESSIONS}/${sessionId}`);
  }
}

export async function advanceMultiplayerSessionState(
  sessionId: string,
  updates: {
    status: SessionStatus;
    currentSubstate: SessionSubstate;
    currentQuestionIndex: number;
    currentQuestionDeadline: number;
    leaderboardDeadline: number;
  }
): Promise<boolean> {
  const ref = doc(db, COLLECTIONS.QUIZ_SESSIONS, sessionId);
  try {
    let wrote = false;
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const existing = snap.data() as Record<string, unknown>;
      const existingSession = parseMultiplayerSessionDoc(snap.id, existing, Date.now());
      if (existingSession.status === 'COMPLETED' || existingSession.status === 'CANCELLED') {
        wrote = true;
        return;
      }

      const cmp = compareSessionProgress(updates, existingSession);
      if (cmp < 0) {
        // Server already ahead -> do not regress state
        wrote = true;
        return;
      }
      if (cmp === 0) {
        const needsQuestionDeadlineInit =
          existingSession.currentSubstate === 'QUESTION_OPEN' &&
          (existingSession.currentQuestionDeadline ?? 0) <= 0 &&
          updates.currentQuestionDeadline > 0;
        const needsLeaderboardDeadlineInit =
          existingSession.currentSubstate === 'LEADERBOARD' &&
          (existingSession.leaderboardDeadline ?? 0) <= 0 &&
          updates.leaderboardDeadline > 0;
        if (!needsQuestionDeadlineInit && !needsLeaderboardDeadlineInit) {
          wrote = true;
          return;
        }
      }

      tx.update(ref, {
        status: updates.status,
        currentSubstate: updates.currentSubstate,
        currentQuestionIndex: Math.max(0, updates.currentQuestionIndex),
        currentQuestionDeadline: Math.max(0, updates.currentQuestionDeadline),
        leaderboardDeadline: Math.max(0, updates.leaderboardDeadline),
        updatedAt: serverTimestamp(),
      });
      wrote = true;
    });
    return wrote;
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `${COLLECTIONS.QUIZ_SESSIONS}/${sessionId}`,
      true
    );
    return false;
  }
}

export async function joinSessionWithTransaction(
  sessionId: string,
  account: FellowshipAccount
): Promise<MultiplayerParticipant> {
  const userId = resolveParticipantUserId(account);
  const displayName =
    account.role === 'ADMINISTRATOR' || account.id === ADMIN_DOC_ID
      ? 'Admin'
      : account.fullName || 'Kingdom Giant';
  const ref = doc(db, COLLECTIONS.QUIZ_SESSIONS, sessionId);

  let joinedRecord: MultiplayerParticipant = {
    id: userId,
    userId,
    userName: displayName,
    userRole: account.role,
    joinedAt: Date.now(),
    joinedAtQuestionIndex: 0,
    currentScore: 0,
    lastQuestionPoints: 0,
    lastAnswerTimestamp: 0,
    answeredQuestionsCount: 0,
    isOnline: true,
  };

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        throw new Error('This quiz session no longer exists.');
      }
      const data = snap.data() as Record<string, unknown>;
      const status = normalizeSessionStatus(String(data.status || ''));
      if (status === 'CANCELLED') {
        throw new Error('This game session was cancelled.');
      }

      const existingJson = String(data.participantsJson || '[]');
      const existingList = parseMultiplayerParticipants(existingJson);
      const existingCount = Math.max(
        Number(data.participantCount) || 0,
        existingList.length
      );
      const found = existingList.find((p) => p.userId === userId);
      if (
        found &&
        found.isOnline !== false &&
        found.userName === displayName &&
        found.userRole === account.role
      ) {
        joinedRecord = found;
        return;
      }

      const candidate: MultiplayerParticipant = found
        ? {
            ...found,
            userName: displayName,
            userRole: account.role,
            isOnline: true,
          }
        : {
            id: userId,
            userId,
            userName: displayName,
            userRole: account.role,
            joinedAt: Date.now(),
            joinedAtQuestionIndex:
              status === 'ACTIVE' ? Math.max(0, Number(data.currentQuestionIndex) || 0) : 0,
            currentScore: 0,
            lastQuestionPoints: 0,
            lastAnswerTimestamp: 0,
            answeredQuestionsCount: 0,
            isOnline: true,
          };

      joinedRecord = candidate;
      const merged = mergeParticipantsJson(existingJson, [candidate]);
      const clampedCount = clampNumber(
        Math.max(existingCount, merged.participantCount),
        existingCount,
        existingCount + 10
      );

      // Non-host allowed keys ONLY: ['participantCount', 'participantsJson', 'updatedAt']
      tx.update(ref, {
        participantCount: clampedCount,
        participantsJson: merged.participantsJson,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `${COLLECTIONS.QUIZ_SESSIONS}/${sessionId}`,
      true
    );
  }

  return joinedRecord;
}

export async function submitMultiplayerAnswerWithTransaction(params: {
  sessionId: string;
  question: MultiplayerQuestion;
  questionIndex: number;
  account: FellowshipAccount;
  submittedAnswer: string;
  alreadyAnsweredLedger: Set<string>;
  localQuestionDeadlineMs?: number;
}): Promise<{
  status: 'Scored' | 'MissedQuestion' | 'DuplicateRejected' | 'DeadlineExpired';
  isCorrect: boolean;
  pointsAwarded: number;
  speedBonus: number;
  newTotalScore: number;
  participant: MultiplayerParticipant;
}> {
  const {
    sessionId,
    question,
    questionIndex,
    account,
    submittedAnswer,
    alreadyAnsweredLedger,
    localQuestionDeadlineMs,
  } = params;
  const userId = resolveParticipantUserId(account);
  const displayName =
    account.role === 'ADMINISTRATOR' || account.id === ADMIN_DOC_ID
      ? 'Admin'
      : account.fullName || 'Kingdom Giant';
  const ref = doc(db, COLLECTIONS.QUIZ_SESSIONS, sessionId);
  const submissionTimeMs = Date.now();

  let resultOutcome: {
    status: 'Scored' | 'MissedQuestion' | 'DuplicateRejected' | 'DeadlineExpired';
    isCorrect: boolean;
    pointsAwarded: number;
    speedBonus: number;
    newTotalScore: number;
    participant: MultiplayerParticipant;
  } = {
    status: 'DeadlineExpired',
    isCorrect: false,
    pointsAwarded: 0,
    speedBonus: 0,
    newTotalScore: 0,
    participant: {
      id: userId,
      userId,
      userName: displayName,
      userRole: account.role,
      joinedAt: submissionTimeMs,
      joinedAtQuestionIndex: 0,
      currentScore: 0,
      lastQuestionPoints: 0,
      lastAnswerTimestamp: submissionTimeMs,
      answeredQuestionsCount: 0,
      isOnline: true,
    },
  };

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        throw new Error('This session is no longer active.');
      }
      const data = snap.data() as Record<string, unknown>;
      const sessionObj = parseMultiplayerSessionDoc(
        snap.id,
        data,
        normalizeDocTimestamp(data)
      );
      if (sessionObj.status === 'CANCELLED') {
        throw new Error('This session has been cancelled.');
      }

      const existingList = parseMultiplayerParticipants(sessionObj.participantsJson);
      const existingCount = Math.max(sessionObj.participantCount || 0, existingList.length);
      const existingParticipant: MultiplayerParticipant = existingList.find(
        (p) => p.userId === userId
      ) || {
        id: userId,
        userId,
        userName: displayName,
        userRole: account.role,
        joinedAt: submissionTimeMs,
        joinedAtQuestionIndex: 0,
        currentScore: 0,
        lastQuestionPoints: 0,
        lastAnswerTimestamp: 0,
        answeredQuestionsCount: 0,
        isOnline: true,
      };

      const useLocalDeadlineFallback =
        localQuestionDeadlineMs &&
        localQuestionDeadlineMs > 0 &&
        (sessionObj.currentQuestionIndex !== questionIndex ||
          (sessionObj.currentQuestionDeadline ?? 0) <= 0);
      const sessionForEvaluation = useLocalDeadlineFallback
        ? {
            ...sessionObj,
            currentQuestionIndex: questionIndex,
            currentQuestionDeadline: localQuestionDeadlineMs,
          }
        : sessionObj;

      const evalRes = evaluateMultiplayerAnswerSubmission({
        session: sessionForEvaluation,
        question,
        questionIndex,
        participant: existingParticipant,
        submittedAnswer,
        submissionTimeMs,
        alreadyAnsweredLedger,
      });

      if (evalRes.status === 'DuplicateRejected' || evalRes.status === 'MissedQuestion') {
        resultOutcome = { ...evalRes, participant: existingParticipant };
        return;
      }

      const isLate = evalRes.status === 'DeadlineExpired';
      const updatedParticipant: MultiplayerParticipant = {
        ...existingParticipant,
        userName: displayName,
        userRole: account.role,
        currentScore: evalRes.newTotalScore,
        lastQuestionPoints: isLate ? 0 : evalRes.pointsAwarded,
        lastAnswerTimestamp: submissionTimeMs,
        answeredQuestionsCount: Math.max(
          existingParticipant.answeredQuestionsCount + 1,
          questionIndex + 1
        ),
        isOnline: true,
        lastSubmittedQuestionIndex: questionIndex,
        lastSubmittedCorrect: evalRes.isCorrect,
        lastSubmittedLate: isLate,
      };

      const merged = mergeParticipantsJson(sessionObj.participantsJson, [
        updatedParticipant,
      ]);
      const clampedCount = clampNumber(
        Math.max(existingCount, merged.participantCount),
        existingCount,
        existingCount + 10
      );

      // Non-host allowed keys ONLY: ['participantCount', 'participantsJson', 'updatedAt']
      tx.update(ref, {
        participantCount: clampedCount,
        participantsJson: merged.participantsJson,
        updatedAt: serverTimestamp(),
      });

      resultOutcome = {
        ...evalRes,
        participant: updatedParticipant,
      };
    });
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `${COLLECTIONS.QUIZ_SESSIONS}/${sessionId}`,
      true
    );
  }

  return resultOutcome;
}

export async function broadcastGameTimeAlert(
  senderName: string,
  customMessage?: string
): Promise<void> {
  await createNotification({
    dedupKey: `gametime:alert:${Math.floor(Date.now() / 15_000)}`,
    title: 'GAME TIME! Live Bible Showdown',
    message:
      customMessage?.trim() ||
      `${senderName} opened the Youth Alive Fellowship Live Bible Games Arena. Join now!`,
    type: 'GAME_TIME',
    targetRole: 'ALL',
    targetTab: 'games',
  });
}

// Solo Scripture Quizzes (/game_quizzes)
export async function createSoloGameQuiz(params: {
  author: FellowshipAccount;
  title: string;
  description?: string;
  category: SoloQuizCategory;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  timeLimitSeconds: number;
  questions: SoloQuizQuestion[];
}): Promise<GameQuiz> {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const id = `gquiz_${rand}`;
  const createdById = resolveSessionHostId(params.author);
  const questionsJson = JSON.stringify(params.questions.slice(0, 500));
  const totalQuestions = clampNumber(params.questions.length, 1, 500);
  const timeLimitSeconds = clampNumber(Math.floor(params.timeLimitSeconds || 90), 10, 7200);

  const payload: Record<string, unknown> = {
    createdById,
    fellowshipId: FELLOWSHIP_ID,
    title: params.title.trim(),
    category: params.category,
    questionsJson,
    totalQuestions,
    timeLimitSeconds,
    difficulty: params.difficulty,
    ...(params.description?.trim() ? { description: params.description.trim() } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, COLLECTIONS.GAME_QUIZZES, id), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${COLLECTIONS.GAME_QUIZZES}/${id}`);
  }

  return {
    id,
    createdById,
    fellowshipId: FELLOWSHIP_ID,
    title: params.title.trim(),
    description: params.description?.trim() || undefined,
    category: params.category,
    questionsJson,
    totalQuestions,
    timeLimitSeconds,
    difficulty: params.difficulty,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export async function deleteSoloGameQuiz(quizId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.GAME_QUIZZES, quizId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.GAME_QUIZZES}/${quizId}`);
  }
}

// Leaderboard Scores (/game_scores)
export async function saveGameScore(params: {
  explicitScoreId?: string;
  quizId: string;
  quizTitle: string;
  account: FellowshipAccount;
  score: number;
  totalQuestions: number;
  timeTakenSeconds: number;
}): Promise<GameScore | null> {
  if (params.account.role === 'GUEST') {
    return null;
  }
  const userId = resolveParticipantUserId(params.account);
  const userName =
    params.account.role === 'ADMINISTRATOR' || params.account.id === ADMIN_DOC_ID
      ? 'Admin'
      : params.account.fullName || 'Member';
  const safeId =
    params.explicitScoreId?.replace(/[^a-zA-Z0-9_\-]/g, '_') ||
    `score_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();

  const payload = {
    quizId: params.quizId,
    quizTitle: params.quizTitle.trim() || 'Bible Quiz',
    userId,
    userName,
    fellowshipId: FELLOWSHIP_ID,
    score: Math.max(0, Math.floor(params.score)),
    totalQuestions: Math.max(1, Math.floor(params.totalQuestions)),
    timeTakenSeconds: Math.max(1, Math.floor(params.timeTakenSeconds)),
    completedAt: now,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const ref = doc(db, COLLECTIONS.GAME_SCORES, safeId);
    if (params.explicitScoreId) {
      const existing = await getDoc(ref);
      if (existing.exists()) {
        return {
          ...(existing.data() as Omit<GameScore, 'id'>),
          id: existing.id,
        };
      }
    }
    await setDoc(ref, payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${COLLECTIONS.GAME_SCORES}/${safeId}`, true);
  }

  return {
    id: safeId,
    quizId: params.quizId,
    quizTitle: params.quizTitle.trim() || 'Bible Quiz',
    userId,
    userName,
    fellowshipId: FELLOWSHIP_ID,
    score: Math.max(0, Math.floor(params.score)),
    totalQuestions: Math.max(1, Math.floor(params.totalQuestions)),
    timeTakenSeconds: Math.max(1, Math.floor(params.timeTakenSeconds)),
    completedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

export async function deleteGameScore(scoreId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.GAME_SCORES, scoreId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.GAME_SCORES}/${scoreId}`);
  }
}

// Legacy wrappers kept for backward compatibility
export async function createQuizSession(params: {
  title: string;
  host: FellowshipAccount;
  scriptureFocus: string;
  questions: QuizSession['questionsJson'];
}): Promise<QuizSession> {
  const qs = parseMultiplayerQuestions(params.questions);
  return publishMultiplayerSession({
    host: params.host,
    titleEn: params.title,
    description: params.scriptureFocus,
    gameType: qs[0]?.gameType || 'TRIVIA_CHALLENGE',
    delayMinutes: 0,
    timeLimitPerQuestionSeconds: 20,
    baseScorePerQuestion: 100,
    speedBonusEnabled: true,
    questions: qs,
  });
}

export async function submitQuizParticipantScore(
  session: QuizSession,
  user: FellowshipAccount,
  score: number,
  answeredCount: number
): Promise<void> {
  const userId = resolveParticipantUserId(user);
  const displayName = user.role === 'ADMINISTRATOR' ? 'Admin' : user.fullName;
  const entry: MultiplayerParticipant = {
    id: userId,
    userId,
    userName: displayName,
    userRole: user.role,
    joinedAt: Date.now(),
    joinedAtQuestionIndex: 0,
    currentScore: score,
    lastQuestionPoints: 0,
    lastAnswerTimestamp: Date.now(),
    answeredQuestionsCount: answeredCount,
    isOnline: true,
  };
  const ref = doc(db, COLLECTIONS.QUIZ_SESSIONS, session.id);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const data = snap.data() as Record<string, unknown>;
      if (normalizeSessionStatus(String(data.status)) === 'CANCELLED') return;
      const existingJson = String(data.participantsJson || '[]');
      const existingCount = Number(data.participantCount) || 0;
      const merged = mergeParticipantsJson(existingJson, [entry]);
      tx.update(ref, {
        participantCount: clampNumber(
          Math.max(existingCount, merged.participantCount),
          existingCount,
          existingCount + 10
        ),
        participantsJson: merged.participantsJson,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.QUIZ_SESSIONS}/${session.id}`);
  }
}

// Notifications
export async function createNotification(
  params: {
    explicitId?: string;
    dedupKey?: string;
    title: string;
    message: string;
    type: FellowshipNotification['type'];
    targetRole?: FellowshipNotification['targetRole'];
    recipientUserId?: string;
    targetTab?: string;
  },
  silent = true
): Promise<void> {
  const now = Date.now();
  const id = params.explicitId?.trim() || `notif-${now}-${Math.random().toString(36).slice(2, 6)}`;
  const targetRole = params.targetRole || 'ALL';
  const senderDeviceId = getDeviceInstanceId();
  const item: FellowshipNotification = {
    id,
    ...(params.dedupKey ? { dedupKey: params.dedupKey } : {}),
    fellowshipId: FELLOWSHIP_ID,
    title: params.title,
    message: params.message,
    type: params.type,
    targetRole,
    ...(params.recipientUserId ? { recipientUserId: params.recipientUserId } : {}),
    senderDeviceId,
    readByJson: '[]',
    createdAt: now,
  };

  recordLocallyOriginatingIds(
    [id, params.dedupKey].filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  );

  // Always save to local mirror so email/password sessions see real-time in-app alerts immediately
  saveLocalNotification(item);

  // Dispatch through Express Web Push + SSE backend for background/closed-app PWA delivery
  if (typeof fetch === 'function') {
    void fetch('/api/push/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: item.id,
        dedupKey: params.dedupKey,
        title: item.title,
        message: item.message,
        type: item.type,
        targetRole,
        recipientUserId: params.recipientUserId,
        senderDeviceId,
        targetTab: params.targetTab || getNotificationTargetTab(item.type),
        createdAt: now,
      }),
    }).catch(() => {
      // Offline or local-only fallback already saved above
    });
  }

  // Persist to Firestore fellowship_notifications when Firebase Auth session is active
  if (auth.currentUser) {
    try {
      await setDoc(doc(db, COLLECTIONS.NOTIFICATIONS, id), item);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${COLLECTIONS.NOTIFICATIONS}/${id}`, silent);
    }
  }
}

export async function markNotificationsRead(
  notifications: FellowshipNotification[],
  userId: string,
  secondaryUserId?: string
): Promise<void> {
  const ids = Array.from(
    new Set([userId, secondaryUserId].filter((v): v is string => typeof v === 'string' && v.trim().length > 0))
  );
  const unread = notifications.filter(
    (n) => !ids.some((id) => parseJsonArray<string>(n.readByJson, []).includes(id))
  );
  if (unread.length === 0) return;

  // Persist read state immediately in local storage for instant badge updates across auth modes
  const readTokens = unread.flatMap((n) => (n.dedupKey ? [n.id, n.dedupKey] : [n.id]));
  markLocalNotifsRead(ids, readTokens);

  if (!auth.currentUser) return;

  await Promise.all(
    unread.map(async (n) => {
      const next = Array.from(new Set([...parseJsonArray<string>(n.readByJson, []), ...ids]));
      try {
        await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, n.id), {
          readByJson: JSON.stringify(next),
        });
      } catch {
        // ignore individual read errors for synthetic/server-only notifications
      }
    })
  );
}

// Secondary Collections (Local-first / IndexedDB-safe for non-provisioned Firestore collections)
export async function recordGivingEntry(entry: Omit<GivingRecord, 'id' | 'fellowshipId' | 'createdAt'>): Promise<GivingRecord> {
  const record: GivingRecord = {
    ...entry,
    id: `giv-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    fellowshipId: FELLOWSHIP_ID,
    amount: entry.amount ?? entry.amountNgn,
    amountNgn: entry.amountNgn ?? entry.amount ?? 0,
    userName: entry.userName || entry.donorName,
    donorName: entry.donorName || entry.userName || 'Member',
    createdAt: Date.now(),
  };
  writeLocalRecord(COLLECTIONS.GIVING, record);
  return record;
}

export async function recordUnitAttendance(entry: Omit<AttendanceRecord, 'id' | 'fellowshipId' | 'createdAt'>): Promise<void> {
  const record: AttendanceRecord = {
    ...entry,
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    fellowshipId: FELLOWSHIP_ID,
    createdAt: Date.now(),
  };
  writeLocalRecord(COLLECTIONS.ATTENDANCE, record);
}

export async function submitWeeklyReport(entry: Omit<WeeklyReport, 'id' | 'fellowshipId' | 'createdAt'>): Promise<void> {
  const record: WeeklyReport = {
    ...entry,
    status: entry.status || 'SUBMITTED',
    id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    fellowshipId: FELLOWSHIP_ID,
    createdAt: Date.now(),
  };
  writeLocalRecord(COLLECTIONS.WEEKLY_REPORTS, record);
  await createNotification({
    title: `Weekly Unit Report: ${record.department}`,
    message: `${record.title || record.weekLabel} (${record.attendanceCount} attended)`,
    type: 'REPORT_REVIEW',
    targetRole: 'ADMINISTRATOR',
  });
}

export async function reviewWeeklyReport(
  report: WeeklyReport,
  params: {
    status: 'REVIEWED' | 'ARCHIVED';
    reviewerNotes: string;
    reviewedBy: string;
  }
): Promise<void> {
  const updated: WeeklyReport = {
    ...report,
    status: params.status,
    reviewerNotes: params.reviewerNotes.trim(),
    reviewedBy: params.reviewedBy,
    reviewedAt: Date.now(),
  };
  writeLocalRecord(COLLECTIONS.WEEKLY_REPORTS, updated);
  await createNotification({
    title: `Unit Report ${params.status === 'REVIEWED' ? 'Approved' : 'Archived'}: ${report.department}`,
    message: params.reviewerNotes.trim() || `Reviewed by ${params.reviewedBy}`,
    type: 'REPORT_REVIEW',
    targetRole: 'EXECUTIVE',
  });
}

export async function assignMemberToDepartment(
  accountId: string,
  department: string
): Promise<void> {
  if (!auth.currentUser) {
    return;
  }
  try {
    await updateDoc(doc(db, COLLECTIONS.ACCOUNTS, accountId), {
      department: normalizeDepartmentType(department),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.ACCOUNTS}/${accountId}`, true);
  }
}

export async function logAuditTrail(entry: Omit<AuditLogEntry, 'id' | 'fellowshipId' | 'createdAt'>): Promise<void> {
  const record: AuditLogEntry = {
    ...entry,
    actionType: entry.actionType || entry.action,
    targetEntity: entry.targetEntity || entry.target,
    details: entry.details || entry.target,
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    fellowshipId: FELLOWSHIP_ID,
    createdAt: Date.now(),
  };
  writeLocalRecord(COLLECTIONS.AUDIT_LOGS, record);
}

export async function clearDatabasePreserveAdminOnly(): Promise<number> {
  let deletedCount = 0;
  const collectionsToClear = [
    COLLECTIONS.DAILY_SCRIPTURES,
    COLLECTIONS.PROGRAMMES,
    COLLECTIONS.QUIZ_SESSIONS,
    COLLECTIONS.GAME_QUIZZES,
    COLLECTIONS.GAME_SCORES,
    COLLECTIONS.COMMUNITY_POSTS,
    COLLECTIONS.INQUIRIES,
    COLLECTIONS.NOTIFICATIONS,
  ];

  for (const col of collectionsToClear) {
    try {
      const q = query(collection(db, col), where('fellowshipId', '==', FELLOWSHIP_ID));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(doc(db, col, d.id));
        deletedCount++;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, col, true);
    }
  }

  // Accounts: preserve user-admin-01 cleanly, delete/purge all others
  try {
    const q = query(collection(db, COLLECTIONS.ACCOUNTS), where('fellowshipId', '==', FELLOWSHIP_ID));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      if (d.id !== ADMIN_DOC_ID) {
        try {
          await deleteDoc(doc(db, COLLECTIONS.ACCOUNTS, d.id));
          deletedCount++;
        } catch {
          await updateDoc(doc(db, COLLECTIONS.ACCOUNTS, d.id), { status: 'PURGED' });
          deletedCount++;
        }
      }
    }
    const hashed = await hashPassword('AdminPass#2026');
    await setDoc(
      doc(db, COLLECTIONS.ACCOUNTS, ADMIN_DOC_ID),
      {
        userId: ADMIN_DOC_ID,
        fellowshipId: FELLOWSHIP_ID,
        fullName: 'Admin',
        email: 'admin@youthalive.org',
        phone: '+2348011223344',
        address: ADMIN_SECRETARIAT_ADDRESS,
        salt: hashed.saltBase64,
        passwordHash: hashed.hashBase64,
        role: 'ADMINISTRATOR',
        status: 'APPROVED',
        department: 'GENERAL',
        fellowshipGroup: 'Central Administration',
        preferredLanguage: 'en',
        englishOverride: false,
        xpPoints: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, COLLECTIONS.ACCOUNTS, true);
  }

  // Clear local secondary stores while preserving Admin session & baseline seeds
  writeLocalCache(COLLECTIONS.GIVING, []);
  writeLocalCache(COLLECTIONS.ATTENDANCE, []);
  writeLocalCache(COLLECTIONS.WEEKLY_REPORTS, []);
  window.dispatchEvent(new CustomEvent(LOCAL_STORE_EVENT, { detail: COLLECTIONS.GIVING }));
  window.dispatchEvent(new CustomEvent(LOCAL_STORE_EVENT, { detail: COLLECTIONS.ATTENDANCE }));
  window.dispatchEvent(new CustomEvent(LOCAL_STORE_EVENT, { detail: COLLECTIONS.WEEKLY_REPORTS }));

  return deletedCount;
}
