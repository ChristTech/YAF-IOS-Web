import { useEffect, useMemo, useRef, useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { TopAppBar } from './components/TopAppBar';
import { BottomNav } from './components/BottomNav';
import { HomeDashboard } from './components/HomeDashboard';
import { CommunityTab } from './components/CommunityTab';
import { GamesTab } from './components/GamesTab';
import { SpiritualTab } from './components/SpiritualTab';
import { ProfileTab } from './components/ProfileTab';
import {
  AnnouncementsModal,
  LiveNotificationBanner,
  NotificationsModal,
} from './components/Overlays';
import { OfflineIndicator } from './components/PWAInstallUI';
import {
  DEFAULT_DAILY_SCRIPTURE,
  DEFAULT_SPIRITUAL_RESOURCES,
} from './data/bibleData';
import { LANGUAGE_CYCLE, TRANSLATIONS, normalizeLanguageCode } from './data/translations';
import { testConnection } from './services/firebase';
import {
  COLLECTIONS,
  cleanupExpiredForumPosts,
  ensureAdminAccountExists,
  extractDailyResources,
  fetchDocsServerFirst,
  getSavedAccountId,
  migrateAccountAddressesInFirestore,
  normalizeDocTimestamp,
  purgeExpiredEvents,
  saveAccountId,
  subscribeCollection,
  subscribeLocalCollection,
  updateAccountProfile,
} from './services/fellowshipService';
import {
  applyAccountBrandMigration,
  extractScriptureOfTheDay,
  filterActiveAccounts,
  filterActiveProgrammes,
  sortProgrammesAscending,
} from './utils/fellowshipLogic';
import {
  CATCH_UP_NOTIFICATION_CAP,
  evaluateDueProgrammeReminders,
  isNotificationReadByAccount,
  mergeAndFilterNotifications,
  selectCatchUpNotifications,
  synthesizeNotificationFromFirestoreChange,
} from './utils/notificationLogic';
import {
  normalizeGameQuizDoc,
  parseMultiplayerSessionDoc,
} from './utils/gamesLogic';
import {
  LOCAL_NOTIF_EVENT,
  evaluateAndDispatchRemoteNotification,
  getDeviceInstanceId,
  readDeliveredNotifIds,
  readLocalNotifications,
  readLocalReadNotifIds,
  readLocallyOriginatingIds,
  recordDeliveredNotifIds,
  registerPeriodicOrBackgroundSync,
  saveLocalNotification,
  showBackgroundLocalNotification,
  syncExistingPushSubscription,
} from './utils/pushNotifications';
import type {
  AttendanceRecord,
  AuditLogEntry,
  CommunityPost,
  DailyScriptureDoc,
  ExecutiveInquiry,
  FellowshipAccount,
  FellowshipNotification,
  GameQuiz,
  GameScore,
  GivingRecord,
  LanguageCode,
  MainTab,
  Programme,
  QuizSession,
  WeeklyReport,
} from './types/fellowship';

const THEME_STORAGE_KEY = 'gideonites_theme';
const LANGUAGE_STORAGE_KEY = 'gideonites_language';

const VALID_TABS: MainTab[] = ['home', 'community', 'games', 'spiritual', 'profile'];

function getInitialTabFromUrl(): MainTab {
  if (typeof window === 'undefined') return 'home';
  try {
    const param = new URLSearchParams(window.location.search).get('tab') as MainTab | null;
    if (param && VALID_TABS.includes(param)) return param;
  } catch {
    // ignore URL parse issues
  }
  return 'home';
}

function shouldOpenNotificationsFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('openNotifications') === 'true';
  } catch {
    return false;
  }
}

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
    } catch {
      return false;
    }
  });

  const [currentAccount, setCurrentAccount] = useState<FellowshipAccount | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [activeTab, setActiveTab] = useState<MainTab>(() => getInitialTabFromUrl());
  const [language, setLanguage] = useState<LanguageCode>(() => {
    try {
      return normalizeLanguageCode(localStorage.getItem(LANGUAGE_STORAGE_KEY));
    } catch {
      return 'EN';
    }
  });

  // Modals & Live Banner
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showNotifications, setShowNotifications] = useState(() =>
    shouldOpenNotificationsFromUrl()
  );
  const [liveBanner, setLiveBanner] = useState<FellowshipNotification | null>(null);
  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const initialNotifsSettledRef = useRef(false);
  const bgSyncRunningRef = useRef(false);

  // Live Firestore Collections
  const [accounts, setAccounts] = useState<FellowshipAccount[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [inquiries, setInquiries] = useState<ExecutiveInquiry[]>([]);
  const [scriptureDocs, setScriptureDocs] = useState<DailyScriptureDoc[]>([]);
  const [quizSessions, setQuizSessions] = useState<QuizSession[]>([]);
  const [gameQuizzes, setGameQuizzes] = useState<GameQuiz[]>([]);
  const [gameScores, setGameScores] = useState<GameScore[]>([]);
  const [firestoreNotifications, setFirestoreNotifications] = useState<FellowshipNotification[]>([]);
  const [serverNotifications, setServerNotifications] = useState<FellowshipNotification[]>([]);
  const [localNotifications, setLocalNotifications] = useState<FellowshipNotification[]>(() =>
    readLocalNotifications()
  );
  const [synthesizedNotifications, setSynthesizedNotifications] = useState<
    FellowshipNotification[]
  >([]);
  const [localReadIds, setLocalReadIds] = useState<string[]>([]);

  // Hybrid Collections
  const [givingRecords, setGivingRecords] = useState<GivingRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [isDark]);

  useEffect(() => {
    void testConnection();
    void ensureAdminAccountExists();

    const handleOnlineReconnect = () => {
      void testConnection({ forceEnableNetwork: true });
      void ensureAdminAccountExists();
    };
    window.addEventListener('online', handleOnlineReconnect);
    return () => window.removeEventListener('online', handleOnlineReconnect);
  }, []);

  // Subscribe to fellowship_accounts & restore session if saved
  useEffect(() => {
    const savedId = getSavedAccountId();
    let restored = false;

    const unsub = subscribeCollection<FellowshipAccount>(
      COLLECTIONS.ACCOUNTS,
      (id, data) => ({
        ...(data as unknown as FellowshipAccount),
        id,
        createdAt: normalizeDocTimestamp(data),
      }),
      (items) => {
        const rawActive = filterActiveAccounts(items);
        if (rawActive.some((acc) => applyAccountBrandMigration(acc).changed)) {
          void migrateAccountAddressesInFirestore(rawActive);
        }
        const active = rawActive.map((acc) => applyAccountBrandMigration(acc).account);
        setAccounts(active);

        if (savedId && !restored) {
          restored = true;
          const match = active.find((a) => a.id === savedId);
          if (match) {
            const normalized =
              match.id === 'user-admin-01' || match.role === 'ADMINISTRATOR'
                ? { ...match, fullName: 'Admin' }
                : match;
            setCurrentAccount(normalized);
            setLanguage(normalizeLanguageCode(normalized.preferredLanguage));
          } else {
            saveAccountId(null);
          }
          setBootstrapping(false);
        } else if (!savedId && !restored) {
          restored = true;
          setBootstrapping(false);
        } else if (currentAccount) {
          const updated = active.find((a) => a.id === currentAccount.id);
          if (updated) {
            setCurrentAccount(
              updated.id === 'user-admin-01' || updated.role === 'ADMINISTRATOR'
                ? { ...updated, fullName: 'Admin' }
                : updated
            );
          }
        }
      },
      () => {
        setBootstrapping(false);
      }
    );

    const timer = setTimeout(() => setBootstrapping(false), 1800);
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [currentAccount?.id]);

  const runBackgroundSyncRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    runBackgroundSyncRef.current = async () => {
      if (!currentAccount || bgSyncRunningRef.current) return;
      bgSyncRunningRef.current = true;
      try {
        const activeUserId = currentAccount.userId || currentAccount.id;
        const accountIds = [currentAccount.id, currentAccount.userId].filter(
          (v): v is string => typeof v === 'string' && v.trim().length > 0
        );
        const [freshProgrammes, freshNotifs, freshPosts] = await Promise.all([
          fetchDocsServerFirst<Programme>(COLLECTIONS.PROGRAMMES, (id, data) => ({
            ...(data as unknown as Programme),
            id,
            createdAt: normalizeDocTimestamp(data),
          })),
          fetchDocsServerFirst<FellowshipNotification>(COLLECTIONS.NOTIFICATIONS, (id, data) => ({
            ...(data as unknown as FellowshipNotification),
            id,
            createdAt: normalizeDocTimestamp(data),
          })),
          fetchDocsServerFirst<CommunityPost>(COLLECTIONS.COMMUNITY_POSTS, (id, data) => ({
            ...(data as unknown as CommunityPost),
            id,
            createdAt: normalizeDocTimestamp(data),
          })),
        ]);

        if (freshProgrammes.length > 0) {
          void purgeExpiredEvents(freshProgrammes);
        }
        if (freshPosts.length > 0) {
          void cleanupExpiredForumPosts(freshPosts);
        }

        const deliveredIds = readDeliveredNotifIds(activeUserId);
        const dueReminders = evaluateDueProgrammeReminders({
          programmes: freshProgrammes,
          account: currentAccount,
          deliveredIds,
        });
        for (const rem of dueReminders) {
          saveLocalNotification(rem);
          recordDeliveredNotifIds(activeUserId, [rem.id]);
          await showBackgroundLocalNotification(rem);
        }

        const catchUp = selectCatchUpNotifications({
          notifications: [...freshNotifs, ...readLocalNotifications()],
          account: currentAccount,
          activeUserId,
          deviceInstanceId: getDeviceInstanceId(),
          locallyOriginatingIds: readLocallyOriginatingIds(),
          deliveredIds: readDeliveredNotifIds(activeUserId),
          localReadIds: readLocalReadNotifIds(accountIds),
          cap: CATCH_UP_NOTIFICATION_CAP,
        });

        for (const notif of catchUp) {
          const tokens = [notif.id, notif.dedupKey].filter(
            (v): v is string => typeof v === 'string' && v.trim().length > 0
          );
          recordDeliveredNotifIds(activeUserId, tokens);
          await showBackgroundLocalNotification(notif);
        }
      } finally {
        bgSyncRunningRef.current = false;
      }
    };
  }, [currentAccount]);

  // Listen for Service Worker notification click deep links & background sync triggers
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const handleSwMessage = (event: MessageEvent) => {
      const payload = event.data as
        | {
            type?: string;
            targetTab?: MainTab;
            openNotifications?: boolean;
          }
        | undefined;
      if (payload?.type === 'RUN_BACKGROUND_SYNC') {
        void runBackgroundSyncRef.current();
        return;
      }
      if (payload?.type === 'OPEN_NOTIFICATIONS' || payload?.openNotifications) {
        if (payload.targetTab && VALID_TABS.includes(payload.targetTab)) {
          setActiveTab(payload.targetTab);
        }
        setShowNotifications(true);
        return;
      }
      if (payload?.type === 'NOTIFICATION_NAVIGATE' && payload.targetTab) {
        if (VALID_TABS.includes(payload.targetTab)) {
          setActiveTab(payload.targetTab);
          setShowNotifications(false);
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, []);

  // Attach real-time Firestore, SSE server push, and local mirror listeners once signed in
  useEffect(() => {
    if (!currentAccount) {
      initialNotifsSettledRef.current = false;
      seenNotifIdsRef.current.clear();
      setSynthesizedNotifications([]);
      setServerNotifications([]);
      setFirestoreNotifications([]);
      return;
    }

    const accountIds = [currentAccount.id, currentAccount.userId].filter(
      (v): v is string => typeof v === 'string' && v.trim().length > 0
    );
    const refreshLocalNotifMirror = () => {
      setLocalNotifications(readLocalNotifications());
      setLocalReadIds(readLocalReadNotifIds(accountIds));
    };
    refreshLocalNotifMirror();
    window.addEventListener(LOCAL_NOTIF_EVENT, refreshLocalNotifMirror);

    // Sync existing Web Push subscription & register optional Periodic/Background Sync
    void syncExistingPushSubscription({
      userId: currentAccount.userId || currentAccount.id,
      role: currentAccount.role,
    });
    void registerPeriodicOrBackgroundSync();
    void runBackgroundSyncRef.current();

    const handleResumeSync = () => {
      if (document.visibilityState === 'visible') {
        void runBackgroundSyncRef.current();
      }
    };
    const handleOnlineSync = () => {
      void runBackgroundSyncRef.current();
    };
    window.addEventListener('online', handleOnlineSync);
    document.addEventListener('visibilitychange', handleResumeSync);

    const settleTimer = window.setTimeout(() => {
      initialNotifsSettledRef.current = true;
    }, 2200);

    // Track initial snapshot completion per collection to synthesize live cross-device alerts
    let progInit = false;
    const seenProgs = new Set<string>();
    const unsubProgrammes = subscribeCollection<Programme>(
      COLLECTIONS.PROGRAMMES,
      (id, data) => ({
        ...(data as unknown as Programme),
        id,
        createdAt: normalizeDocTimestamp(data),
      }),
      (items) => {
        setProgrammes(sortProgrammesAscending(items));
        void purgeExpiredEvents(items);
        if (!progInit) {
          progInit = true;
          items.forEach((p) => seenProgs.add(p.id));
        } else {
          for (const p of items) {
            if (!seenProgs.has(p.id)) {
              seenProgs.add(p.id);
              const syn = synthesizeNotificationFromFirestoreChange({
                collectionName: COLLECTIONS.PROGRAMMES,
                docId: p.id,
                data: p as unknown as Record<string, unknown>,
                changeType: 'added',
              });
              if (syn) {
                setSynthesizedNotifications((prev) => [
                  {
                    id: syn.id,
                    dedupKey: syn.dedupKey,
                    fellowshipId: syn.fellowshipId,
                    title: syn.title,
                    message: syn.message,
                    type: syn.type,
                    targetRole: syn.targetRole,
                    readByJson: '[]',
                    createdAt: syn.createdAt,
                  },
                  ...prev.filter((x) => x.id !== syn.id),
                ]);
              }
            }
          }
        }
      }
    );

    const cleanedIds = new Set<string>();
    let postsInit = false;
    const prevPostsMap = new Map<string, CommunityPost>();
    const unsubPosts = subscribeCollection<CommunityPost>(
      COLLECTIONS.COMMUNITY_POSTS,
      (id, data) => ({
        ...(data as unknown as CommunityPost),
        id,
        createdAt: normalizeDocTimestamp(data),
      }),
      (items) => {
        setCommunityPosts([...items].sort((a, b) => b.createdAt - a.createdAt));
        if (!postsInit) {
          postsInit = true;
          items.forEach((p) => prevPostsMap.set(p.id, p));
        } else {
          for (const p of items) {
            const prev = prevPostsMap.get(p.id);
            const syn = synthesizeNotificationFromFirestoreChange({
              collectionName: COLLECTIONS.COMMUNITY_POSTS,
              docId: p.id,
              data: p as unknown as Record<string, unknown>,
              changeType: prev ? 'modified' : 'added',
              prevData: prev as unknown as Record<string, unknown> | undefined,
            });
            prevPostsMap.set(p.id, p);
            if (syn) {
              setSynthesizedNotifications((list) => [
                {
                  id: syn.id,
                  dedupKey: syn.dedupKey,
                  fellowshipId: syn.fellowshipId,
                  title: syn.title,
                  message: syn.message,
                  type: syn.type,
                  targetRole: syn.targetRole,
                  readByJson: '[]',
                  createdAt: syn.createdAt,
                },
                ...list.filter((x) => x.id !== syn.id),
              ]);
            }
          }
        }

        if (typeof navigator === 'undefined' || navigator.onLine !== false) {
          const toClean = items.filter((p) => !cleanedIds.has(p.id));
          if (toClean.length > 0) {
            toClean.forEach((p) => cleanedIds.add(p.id));
            void cleanupExpiredForumPosts(toClean);
          }
        }
      }
    );

    let inqInit = false;
    const prevInqMap = new Map<string, ExecutiveInquiry>();
    const unsubInquiries = subscribeCollection<ExecutiveInquiry>(
      COLLECTIONS.INQUIRIES,
      (id, data) => ({
        ...(data as unknown as ExecutiveInquiry),
        id,
        createdAt: normalizeDocTimestamp(data),
      }),
      (items) => {
        setInquiries([...items].sort((a, b) => b.createdAt - a.createdAt));
        if (!inqInit) {
          inqInit = true;
          items.forEach((inq) => prevInqMap.set(inq.id, inq));
        } else {
          for (const inq of items) {
            const prev = prevInqMap.get(inq.id);
            const syn = synthesizeNotificationFromFirestoreChange({
              collectionName: COLLECTIONS.INQUIRIES,
              docId: inq.id,
              data: inq as unknown as Record<string, unknown>,
              changeType: prev ? 'modified' : 'added',
              prevData: prev as unknown as Record<string, unknown> | undefined,
            });
            prevInqMap.set(inq.id, inq);
            if (syn) {
              setSynthesizedNotifications((list) => [
                {
                  id: syn.id,
                  dedupKey: syn.dedupKey,
                  fellowshipId: syn.fellowshipId,
                  title: syn.title,
                  message: syn.message,
                  type: syn.type,
                  targetRole: syn.targetRole,
                  ...(syn.recipientUserId ? { recipientUserId: syn.recipientUserId } : {}),
                  readByJson: '[]',
                  createdAt: syn.createdAt,
                },
                ...list.filter((x) => x.id !== syn.id),
              ]);
            }
          }
        }
      }
    );

    let scrInit = false;
    const seenScrIds = new Set<string>();
    const unsubScriptures = subscribeCollection<DailyScriptureDoc>(
      COLLECTIONS.DAILY_SCRIPTURES,
      (id, data) => ({
        ...(data as unknown as DailyScriptureDoc),
        id,
        createdAt: normalizeDocTimestamp(data),
      }),
      (items) => {
        setScriptureDocs([...items].sort((a, b) => b.createdAt - a.createdAt));
        if (!scrInit) {
          scrInit = true;
          items.forEach((s) => seenScrIds.add(s.id));
        } else {
          for (const s of items) {
            if (!seenScrIds.has(s.id)) {
              seenScrIds.add(s.id);
              const syn = synthesizeNotificationFromFirestoreChange({
                collectionName: COLLECTIONS.DAILY_SCRIPTURES,
                docId: s.id,
                data: s as unknown as Record<string, unknown>,
                changeType: 'added',
              });
              if (syn) {
                setSynthesizedNotifications((list) => [
                  {
                    id: syn.id,
                    dedupKey: syn.dedupKey,
                    fellowshipId: syn.fellowshipId,
                    title: syn.title,
                    message: syn.message,
                    type: syn.type,
                    targetRole: syn.targetRole,
                    readByJson: '[]',
                    createdAt: syn.createdAt,
                  },
                  ...list.filter((x) => x.id !== syn.id),
                ]);
              }
            }
          }
        }
      }
    );

    let quizInit = false;
    const seenQuizIds = new Set<string>();
    const unsubQuizzes = subscribeCollection<QuizSession>(
      COLLECTIONS.QUIZ_SESSIONS,
      (id, data) => parseMultiplayerSessionDoc(id, data, normalizeDocTimestamp(data)),
      (items) => {
        setQuizSessions([...items].sort((a, b) => b.createdAt - a.createdAt));
        if (!quizInit) {
          quizInit = true;
          items.forEach((q) => seenQuizIds.add(q.id));
        } else {
          for (const q of items) {
            if (!seenQuizIds.has(q.id)) {
              seenQuizIds.add(q.id);
              const syn = synthesizeNotificationFromFirestoreChange({
                collectionName: COLLECTIONS.QUIZ_SESSIONS,
                docId: q.id,
                data: q as unknown as Record<string, unknown>,
                changeType: 'added',
              });
              if (syn) {
                setSynthesizedNotifications((list) => [
                  {
                    id: syn.id,
                    dedupKey: syn.dedupKey,
                    fellowshipId: syn.fellowshipId,
                    title: syn.title,
                    message: syn.message,
                    type: syn.type,
                    targetRole: syn.targetRole,
                    readByJson: '[]',
                    createdAt: syn.createdAt,
                  },
                  ...list.filter((x) => x.id !== syn.id),
                ]);
              }
            }
          }
        }
      }
    );

    const unsubGameQuizzes = subscribeCollection<GameQuiz>(
      COLLECTIONS.GAME_QUIZZES,
      (id, data) => normalizeGameQuizDoc(id, data, normalizeDocTimestamp(data)),
      (items) => {
        setGameQuizzes([...items].sort((a, b) => b.createdAt - a.createdAt));
      }
    );

    const unsubGameScores = subscribeCollection<GameScore>(
      COLLECTIONS.GAME_SCORES,
      (id, data) => ({
        id,
        quizId: String(data.quizId || ''),
        quizTitle: String(data.quizTitle || 'Bible Quiz'),
        userId: String(data.userId || ''),
        userName: String(data.userName || 'Member'),
        fellowshipId: String(data.fellowshipId || 'GIDEONITES'),
        score: Number(data.score) || 0,
        totalQuestions: Math.max(1, Number(data.totalQuestions) || 1),
        timeTakenSeconds: Number(data.timeTakenSeconds) || 0,
        completedAt: Number(data.completedAt) || normalizeDocTimestamp(data),
        createdAt: normalizeDocTimestamp(data),
        updatedAt: Number(data.updatedAt) || normalizeDocTimestamp(data),
      }),
      (items) => {
        setGameScores([...items].sort((a, b) => b.score - a.score || b.completedAt - a.completedAt));
      }
    );

    const unsubNotifs = subscribeCollection<FellowshipNotification>(
      COLLECTIONS.NOTIFICATIONS,
      (id, data) => ({
        ...(data as unknown as FellowshipNotification),
        id,
        createdAt: normalizeDocTimestamp(data),
      }),
      (items) => {
        setFirestoreNotifications([...items].sort((a, b) => b.createdAt - a.createdAt));
      }
    );

    // Fetch & subscribe to server notification history & SSE live push events when Express backend is present
    let notifStreamCancelled = false;
    let evtSource: EventSource | null = null;
    const uidParam = encodeURIComponent(currentAccount.userId || currentAccount.id);
    const roleParam = encodeURIComponent(currentAccount.role);
    void fetch(`/api/notifications?userId=${uidParam}&role=${roleParam}`)
      .then((res) => {
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || !ct.includes('application/json')) return null;
        return res.json();
      })
      .then((data: { notifications?: FellowshipNotification[] } | null) => {
        if (notifStreamCancelled || !data) return;
        if (Array.isArray(data.notifications)) {
          setServerNotifications(data.notifications);
        }
        if (typeof EventSource !== 'undefined') {
          evtSource = new EventSource('/api/notifications/stream');
          evtSource.addEventListener('notification', (ev: MessageEvent) => {
            try {
              const item = JSON.parse(ev.data) as FellowshipNotification;
              if (item && item.id) {
                setServerNotifications((prev) => [
                  item,
                  ...prev.filter((x) => x.id !== item.id),
                ]);
              }
            } catch {
              // ignore malformed SSE packet
            }
          });
        }
      })
      .catch(() => {});

    const unsubGiving = subscribeLocalCollection<GivingRecord>(
      COLLECTIONS.GIVING,
      setGivingRecords
    );
    const unsubAttendance = subscribeLocalCollection<AttendanceRecord>(
      COLLECTIONS.ATTENDANCE,
      setAttendanceRecords
    );
    const unsubReports = subscribeLocalCollection<WeeklyReport>(
      COLLECTIONS.WEEKLY_REPORTS,
      setWeeklyReports
    );
    const unsubAudit = subscribeLocalCollection<AuditLogEntry>(
      COLLECTIONS.AUDIT_LOGS,
      setAuditLogs
    );

    return () => {
      notifStreamCancelled = true;
      window.clearTimeout(settleTimer);
      window.removeEventListener(LOCAL_NOTIF_EVENT, refreshLocalNotifMirror);
      window.removeEventListener('online', handleOnlineSync);
      document.removeEventListener('visibilitychange', handleResumeSync);
      evtSource?.close();
      unsubProgrammes();
      unsubPosts();
      unsubInquiries();
      unsubScriptures();
      unsubQuizzes();
      unsubGameQuizzes();
      unsubGameScores();
      unsubNotifs();
      unsubGiving();
      unsubAttendance();
      unsubReports();
      unsubAudit();
    };
  }, [currentAccount?.id]);

  const { spiritualResources, uploadedBibles } = useMemo(() => {
    const extracted = extractDailyResources(scriptureDocs);
    return {
      spiritualResources:
        extracted.spiritualResources.length > 0
          ? extracted.spiritualResources
          : DEFAULT_SPIRITUAL_RESOURCES,
      uploadedBibles: extracted.uploadedBibles,
    };
  }, [scriptureDocs]);

  const dailyScripture = useMemo(
    () =>
      extractScriptureOfTheDay(
        scriptureDocs.length > 0 ? scriptureDocs : [DEFAULT_DAILY_SCRIPTURE],
        language
      ),
    [scriptureDocs, language]
  );

  const announcements = useMemo(
    () =>
      communityPosts.filter(
        (p) => p.category === 'ANNOUNCEMENT_URGENT' || p.category === 'ANNOUNCEMENT_NORMAL'
      ),
    [communityPosts]
  );

  const notifications = useMemo(
    () =>
      mergeAndFilterNotifications(
        [
          firestoreNotifications,
          serverNotifications,
          localNotifications,
          synthesizedNotifications,
        ],
        currentAccount,
        localReadIds
      ),
    [
      firestoreNotifications,
      serverNotifications,
      localNotifications,
      synthesizedNotifications,
      currentAccount,
      localReadIds,
    ]
  );

  // Show live in-app banner & hidden-tab Service Worker alert via dedup/local-origin guard
  useEffect(() => {
    if (!currentAccount) return;
    const seen = seenNotifIdsRef.current;
    const isSeen = (n: FellowshipNotification) =>
      seen.has(n.id) || (n.dedupKey ? seen.has(n.dedupKey) : false);
    const markSeen = (n: FellowshipNotification) => {
      seen.add(n.id);
      if (n.dedupKey) seen.add(n.dedupKey);
    };

    if (!initialNotifsSettledRef.current) {
      notifications.forEach(markSeen);
      return;
    }

    const brandNew = notifications.find(
      (n) => !isSeen(n) && !isNotificationReadByAccount(n, currentAccount, localReadIds)
    );
    notifications.forEach(markSeen);

    if (brandNew) {
      const activeUserId = currentAccount.userId || currentAccount.id;
      const isLocallyOriginated =
        (brandNew.senderDeviceId && brandNew.senderDeviceId === getDeviceInstanceId()) ||
        readLocallyOriginatingIds().some(
          (tok) => tok === brandNew.id || tok === brandNew.dedupKey
        );

      if (!isLocallyOriginated) {
        setLiveBanner(brandNew);
      }

      void evaluateAndDispatchRemoteNotification({
        notification: brandNew,
        account: currentAccount,
        activeUserId,
        localReadIds,
        onlyWhenHidden: true,
      });
    }
  }, [notifications, currentAccount, localReadIds]);

  // Auto-dismiss live notification banner after 7s
  useEffect(() => {
    if (!liveBanner) return;
    const t = window.setTimeout(() => setLiveBanner(null), 7000);
    return () => window.clearTimeout(t);
  }, [liveBanner]);

  const unreadNotificationsCount = useMemo(() => {
    if (!currentAccount) return 0;
    return notifications.filter(
      (n) => !isNotificationReadByAccount(n, currentAccount, localReadIds)
    ).length;
  }, [notifications, currentAccount, localReadIds]);

  const isGameTimeActive = useMemo(() => {
    const cutoff = Date.now() - 30 * 60_000;
    return notifications.some(
      (n) => n.type === 'GAME_TIME' && (n.createdAt || 0) >= cutoff
    );
  }, [notifications]);

  const handleCycleLanguage = async () => {
    const nextIdx = (LANGUAGE_CYCLE.indexOf(language) + 1) % LANGUAGE_CYCLE.length;
    const nextLang = LANGUAGE_CYCLE[nextIdx];
    setLanguage(nextLang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLang);
    } catch {
      // ignore
    }
    if (currentAccount) {
      await updateAccountProfile(currentAccount.id, { preferredLanguage: nextLang }, true).catch(
        () => {}
      );
    }
  };

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-16 h-16 rounded-full bg-white border-2 border-[#F59E0B] p-1.5 flex items-center justify-center">
          <img
            src="/assets/aistudio/image_fe132291.png"
            alt="The Gideonites Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <p className="font-display text-sm font-bold tracking-wider text-[#F59E0B]">
          THE GIDEONITES • YOUTH ALIVE
        </p>
        <p className="text-xs text-[#94A3B8]">Connecting to live fellowship database...</p>
      </div>
    );
  }

  if (!currentAccount) {
    return (
      <>
        <AuthScreen
          onAuthenticated={(acc) => {
            setCurrentAccount(acc);
            setLanguage(normalizeLanguageCode(acc.preferredLanguage));
            setActiveTab('home');
          }}
          isDark={isDark}
          onToggleTheme={() => setIsDark((d) => !d)}
        />
        <OfflineIndicator />
      </>
    );
  }

  const labels = TRANSLATIONS[normalizeLanguageCode(language)] || TRANSLATIONS.EN;

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] text-[#0F172A] dark:text-[#F8FAFC] transition-colors">
      <TopAppBar
        account={currentAccount}
        language={language}
        onCycleLanguage={handleCycleLanguage}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        unreadNotifications={unreadNotificationsCount}
        onOpenAnnouncements={() => setShowAnnouncements(true)}
        onOpenNotifications={() => {
          setLiveBanner(null);
          setShowNotifications(true);
        }}
      />

      <LiveNotificationBanner
        notification={liveBanner}
        onDismiss={() => setLiveBanner(null)}
        onOpen={() => {
          setLiveBanner(null);
          setShowNotifications(true);
        }}
      />

      <main className="max-w-3xl mx-auto px-3 sm:px-4 pt-4">
        {activeTab === 'home' && (
          <HomeDashboard
            account={currentAccount}
            dailyScripture={dailyScripture}
            programmes={filterActiveProgrammes(programmes)}
            language={language}
            labels={labels}
          />
        )}

        {activeTab === 'community' && (
          <CommunityTab
            account={currentAccount}
            accounts={accounts}
            posts={communityPosts}
            inquiries={inquiries}
            attendanceRecords={attendanceRecords}
            weeklyReports={weeklyReports}
            labels={labels}
            onAccountUpdated={(updated) => {
              setCurrentAccount(updated);
              setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
            }}
            onMemberDepartmentAssigned={(accountId, dept) => {
              setAccounts((prev) =>
                prev.map((a) => (a.id === accountId ? { ...a, department: dept } : a))
              );
              if (currentAccount.id === accountId) {
                setCurrentAccount((prev) => (prev ? { ...prev, department: dept } : prev));
              }
            }}
          />
        )}

        {activeTab === 'games' && (
          <GamesTab
            account={currentAccount}
            quizSessions={quizSessions}
            gameQuizzes={gameQuizzes}
            gameScores={gameScores}
            isGameTimeActive={isGameTimeActive}
            uploadedBibles={uploadedBibles}
            scriptureDocs={scriptureDocs}
            language={language}
            labels={labels}
          />
        )}

        {activeTab === 'spiritual' && (
          <SpiritualTab
            account={currentAccount}
            resources={spiritualResources}
            uploadedBibles={uploadedBibles}
            scriptureDocs={scriptureDocs}
            language={language}
            labels={labels}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            account={currentAccount}
            accounts={accounts}
            programmes={programmes}
            posts={communityPosts}
            spiritualResources={spiritualResources}
            uploadedBibles={uploadedBibles}
            givingRecords={givingRecords}
            attendanceRecords={attendanceRecords}
            auditLogs={auditLogs}
            isDark={isDark}
            onToggleTheme={() => setIsDark((d) => !d)}
            labels={labels}
            onSignedOut={() => {
              setCurrentAccount(null);
              setActiveTab('home');
            }}
            onAccountUpdated={(updated) => {
              setCurrentAccount(updated);
              setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
            }}
          />
        )}
      </main>

      <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} labels={labels.tabs} />

      <AnnouncementsModal
        isOpen={showAnnouncements}
        onClose={() => setShowAnnouncements(false)}
        announcements={announcements}
        account={currentAccount}
        titleLabel={labels.announcementsTitle}
      />

      <NotificationsModal
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        notifications={notifications}
        account={currentAccount}
        titleLabel={labels.notificationsTitle}
        onNavigateTab={(tab) => setActiveTab(tab)}
        onPermissionGranted={() => void runBackgroundSyncRef.current()}
      />

      <OfflineIndicator />
    </div>
  );
}
