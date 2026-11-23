import {
  DAY_MS,
  FIVE_DAYS_MS,
  getProgrammeStartMillis,
  getProgrammeTitle,
  isEventDatePassed,
  isForumPostExpired,
  isUserRegisteredForProgramme,
  parseJsonArray,
} from './fellowshipLogic';
import type {
  FellowshipAccount,
  FellowshipNotification,
  MainTab,
  Programme,
} from '../types/fellowship';

export const CATCH_UP_NOTIFICATION_CAP = 15;
export const MAX_TRACKED_NOTIF_IDS = 300;

export type PushReadinessState =
  | 'push-active'
  | 'permission-default'
  | 'permission-denied'
  | 'ios-install-required'
  | 'unsupported';

export interface PushReadinessInput {
  hasNotificationApi: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  permission: 'granted' | 'denied' | 'default' | 'unsupported';
  isIOS: boolean;
  isStandalone: boolean;
  hasActiveSubscription: boolean;
}

export function appendCappedIds(
  existing: string[],
  additions: string[],
  cap: number = MAX_TRACKED_NOTIF_IDS
): string[] {
  const merged = Array.from(
    new Set(
      [...existing, ...additions].filter(
        (v): v is string => typeof v === 'string' && v.trim().length > 0
      )
    )
  );
  if (merged.length <= cap) return merged;
  return merged.slice(merged.length - cap);
}

export function normalizeRoleKey(role?: string | null): string {
  const upper = (role || '').trim().toUpperCase();
  if (upper === 'YOUTH_EXECUTIVE') return 'EXECUTIVE';
  return upper;
}

export function isNotificationForAccount(
  notif: Pick<FellowshipNotification, 'targetRole' | 'recipientUserId'>,
  account: Pick<FellowshipAccount, 'id' | 'userId' | 'role'> | null | undefined
): boolean {
  if (!account) return false;
  const accountIds = [account.id, account.userId].filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0
  );

  if (notif.recipientUserId && notif.recipientUserId.trim().length > 0) {
    return accountIds.includes(notif.recipientUserId.trim());
  }

  const target = (notif.targetRole || 'ALL').trim().toUpperCase();
  if (!target || target === 'ALL') return true;

  const userRole = normalizeRoleKey(account.role);
  if (target === 'ADMINISTRATOR') {
    return userRole === 'ADMINISTRATOR';
  }
  if (target === 'EXECUTIVE') {
    return userRole === 'ADMINISTRATOR' || userRole === 'EXECUTIVE';
  }
  return true;
}

export function isNotificationReadByAccount(
  notif: Pick<FellowshipNotification, 'id' | 'dedupKey' | 'readByJson'>,
  account: Pick<FellowshipAccount, 'id' | 'userId'> | null | undefined,
  localReadIds: string[] = []
): boolean {
  if (!account) return false;
  if (
    localReadIds.includes(notif.id) ||
    (notif.dedupKey && localReadIds.includes(notif.dedupKey))
  ) {
    return true;
  }
  const readList = parseJsonArray<string>(notif.readByJson, []);
  const ids = [account.id, account.userId].filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0
  );
  return ids.some((id) => readList.includes(id));
}

export function mergeAndFilterNotifications(
  sources: FellowshipNotification[][],
  account: Pick<FellowshipAccount, 'id' | 'userId' | 'role'> | null | undefined,
  localReadIds: string[] = []
): FellowshipNotification[] {
  if (!account) return [];
  const byKey = new Map<string, FellowshipNotification>();

  for (const list of sources) {
    for (const item of list) {
      if (!item || !item.id) continue;
      if (!isNotificationForAccount(item, account)) continue;
      const mergeKey = (item.dedupKey && item.dedupKey.trim()) || item.id;
      const existing = byKey.get(mergeKey);
      if (!existing) {
        byKey.set(mergeKey, item);
      } else {
        const mergedReadBy = Array.from(
          new Set([
            ...parseJsonArray<string>(existing.readByJson, []),
            ...parseJsonArray<string>(item.readByJson, []),
          ])
        );
        const preferredId = existing.id.startsWith('notif-')
          ? existing.id
          : item.id.startsWith('notif-')
          ? item.id
          : existing.id;
        byKey.set(mergeKey, {
          ...existing,
          ...item,
          id: preferredId,
          readByJson: JSON.stringify(mergedReadBy),
          createdAt: Math.max(existing.createdAt || 0, item.createdAt || 0),
        });
      }
    }
  }

  return Array.from(byKey.values())
    .map((item) => {
      if (
        localReadIds.includes(item.id) ||
        (item.dedupKey && localReadIds.includes(item.dedupKey))
      ) {
        const readList = parseJsonArray<string>(item.readByJson, []);
        const nextList = Array.from(new Set([...readList, account.id]));
        return { ...item, readByJson: JSON.stringify(nextList) };
      }
      return item;
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function getNotificationTargetTab(
  type?: FellowshipNotification['type'] | string
): MainTab {
  switch ((type || '').toUpperCase()) {
    case 'EVENT':
    case 'PROGRAMME':
      return 'home';
    case 'COMMUNITY':
    case 'COMMUNITY_POST':
    case 'ANNOUNCEMENT':
    case 'REPORT_REVIEW':
      return 'community';
    case 'QUIZ':
    case 'GAME_TIME':
      return 'games';
    case 'SPIRITUAL':
    case 'SCRIPTURE':
      return 'spiritual';
    case 'APPROVAL':
    case 'FINANCE':
      return 'profile';
    default:
      return 'home';
  }
}

export function evaluatePushReadiness(input: PushReadinessInput): PushReadinessState {
  if (input.isIOS && !input.isStandalone) {
    return 'ios-install-required';
  }
  if (!input.hasNotificationApi || !input.hasServiceWorker || !input.hasPushManager) {
    return 'unsupported';
  }
  if (input.permission === 'denied') {
    return 'permission-denied';
  }
  if (input.permission === 'granted' && input.hasActiveSubscription) {
    return 'push-active';
  }
  return 'permission-default';
}

export interface SyncRemoteNotificationDecision {
  shouldDeliver: boolean;
  reason?:
    | 'no-active-user'
    | 'wrong-recipient'
    | 'local-device-origin'
    | 'locally-originating-id'
    | 'already-delivered'
    | 'already-read';
  tokens: string[];
}

export function syncRemoteNotificationIfNew(params: {
  notification: FellowshipNotification;
  account: Pick<FellowshipAccount, 'id' | 'userId' | 'role'> | null | undefined;
  activeUserId: string | null | undefined;
  deviceInstanceId?: string;
  locallyOriginatingIds?: string[];
  deliveredIds?: string[];
  localReadIds?: string[];
}): SyncRemoteNotificationDecision {
  const {
    notification,
    account,
    activeUserId,
    deviceInstanceId,
    locallyOriginatingIds = [],
    deliveredIds = [],
    localReadIds = [],
  } = params;

  const tokens = Array.from(
    new Set(
      [notification.id, notification.dedupKey].filter(
        (v): v is string => typeof v === 'string' && v.trim().length > 0
      )
    )
  );

  if (!activeUserId || !account) {
    return { shouldDeliver: false, reason: 'no-active-user', tokens };
  }

  if (!isNotificationForAccount(notification, account)) {
    return { shouldDeliver: false, reason: 'wrong-recipient', tokens };
  }

  if (
    deviceInstanceId &&
    notification.senderDeviceId &&
    notification.senderDeviceId === deviceInstanceId
  ) {
    return { shouldDeliver: false, reason: 'local-device-origin', tokens };
  }

  if (tokens.some((t) => locallyOriginatingIds.includes(t))) {
    return { shouldDeliver: false, reason: 'locally-originating-id', tokens };
  }

  if (tokens.some((t) => deliveredIds.includes(t))) {
    return { shouldDeliver: false, reason: 'already-delivered', tokens };
  }

  if (isNotificationReadByAccount(notification, account, localReadIds)) {
    return { shouldDeliver: false, reason: 'already-read', tokens };
  }

  return { shouldDeliver: true, tokens };
}

export function selectCatchUpNotifications(params: {
  notifications: FellowshipNotification[];
  account: Pick<FellowshipAccount, 'id' | 'userId' | 'role'> | null | undefined;
  activeUserId: string | null | undefined;
  deviceInstanceId?: string;
  locallyOriginatingIds?: string[];
  deliveredIds?: string[];
  localReadIds?: string[];
  cap?: number;
}): FellowshipNotification[] {
  const cap = params.cap ?? CATCH_UP_NOTIFICATION_CAP;
  if (!params.activeUserId || !params.account) return [];

  const eligible = [...params.notifications]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .filter(
      (n) =>
        syncRemoteNotificationIfNew({
          notification: n,
          account: params.account,
          activeUserId: params.activeUserId,
          deviceInstanceId: params.deviceInstanceId,
          locallyOriginatingIds: params.locallyOriginatingIds,
          deliveredIds: params.deliveredIds,
          localReadIds: params.localReadIds,
        }).shouldDeliver
    );

  return eligible.slice(0, cap);
}

export function evaluateDueProgrammeReminders(params: {
  programmes: Programme[];
  account: Pick<FellowshipAccount, 'id' | 'userId'> | null | undefined;
  deliveredIds?: string[];
  nowMs?: number;
}): FellowshipNotification[] {
  const { programmes, account, deliveredIds = [] } = params;
  const nowMs = params.nowMs ?? Date.now();
  if (!account) return [];

  const reminders: FellowshipNotification[] = [];
  for (const prog of programmes) {
    if (!isUserRegisteredForProgramme(prog, account)) continue;
    const startMs = getProgrammeStartMillis(prog);
    if (isEventDatePassed(startMs, nowMs)) continue;

    const fiveDaysBefore = startMs - FIVE_DAYS_MS;
    const oneDayBefore = startMs - DAY_MS;
    const title = getProgrammeTitle(prog);

    if (nowMs >= oneDayBefore) {
      const rem1Id = `notif_prog1d_${prog.id}`;
      if (!deliveredIds.includes(rem1Id)) {
        reminders.push({
          id: rem1Id,
          dedupKey: rem1Id,
          fellowshipId: prog.fellowshipId || 'GIDEONITES',
          title: `Reminder (1 Day): ${title}`,
          message: `Starts soon at ${prog.venue || 'Youth Sanctuary'}. Open Home for your pass.`,
          type: 'EVENT',
          targetRole: 'ALL',
          recipientUserId: account.userId || account.id,
          readByJson: '[]',
          createdAt: nowMs,
        });
      }
    } else if (nowMs >= fiveDaysBefore) {
      const rem5Id = `notif_prog5d_${prog.id}`;
      if (!deliveredIds.includes(rem5Id)) {
        reminders.push({
          id: rem5Id,
          dedupKey: rem5Id,
          fellowshipId: prog.fellowshipId || 'GIDEONITES',
          title: `Reminder (5 Days): ${title}`,
          message: `Coming up in 5 days at ${prog.venue || 'Youth Sanctuary'}.`,
          type: 'EVENT',
          targetRole: 'ALL',
          recipientUserId: account.userId || account.id,
          readByJson: '[]',
          createdAt: nowMs,
        });
      }
    }
  }

  return reminders;
}

export interface SynthesizedNotifEvent {
  id: string;
  dedupKey: string;
  fellowshipId: string;
  title: string;
  message: string;
  type: FellowshipNotification['type'];
  targetRole: 'ALL' | 'ADMINISTRATOR' | 'EXECUTIVE';
  recipientUserId?: string;
  senderDeviceId?: string;
  targetTab: MainTab;
  createdAt: number;
}

export function synthesizeNotificationFromFirestoreChange(params: {
  collectionName: string;
  docId: string;
  data: Record<string, unknown>;
  changeType: 'added' | 'modified';
  prevData?: Record<string, unknown>;
  nowMs?: number;
}): SynthesizedNotifEvent | null {
  const { collectionName, docId, data, changeType, prevData } = params;
  const now = params.nowMs ?? Date.now();
  const fellowshipId = String(data.fellowshipId || 'GIDEONITES');
  if (fellowshipId !== 'GIDEONITES') return null;

  if (collectionName === 'fellowship_notifications' && changeType === 'added') {
    return {
      id: docId,
      dedupKey: (typeof data.dedupKey === 'string' && data.dedupKey) || `notif:${docId}`,
      fellowshipId,
      title: String(data.title || 'The Gideonites Alert'),
      message: String(data.message || ''),
      type: (data.type as FellowshipNotification['type']) || 'ANNOUNCEMENT',
      targetRole:
        (data.targetRole as 'ALL' | 'ADMINISTRATOR' | 'EXECUTIVE') || 'ALL',
      ...(typeof data.recipientUserId === 'string' && data.recipientUserId
        ? { recipientUserId: data.recipientUserId }
        : {}),
      ...(typeof data.senderDeviceId === 'string' && data.senderDeviceId
        ? { senderDeviceId: data.senderDeviceId }
        : {}),
      targetTab: getNotificationTargetTab(String(data.type || 'ANNOUNCEMENT')),
      createdAt:
        typeof data.createdAt === 'number' ? data.createdAt : now,
    };
  }

  if (collectionName === 'programmes' && changeType === 'added') {
    const startMs = Number(data.startDateMillis || data.timestamp || data.createdAt || 0);
    if (startMs > 0 && isEventDatePassed(startMs, now)) {
      return null;
    }
    const titleEn = String(data.titleEn || 'Youth Programme').trim();
    const venue = String(data.venue || 'Living Faith Church Youth Hall').trim();
    return {
      id: `syn-prog-${docId}`,
      dedupKey: `prog:${docId}`,
      fellowshipId,
      title: `New Programme: ${titleEn}`,
      message: `Venue: ${venue}`,
      type: 'EVENT',
      targetRole: 'ALL',
      targetTab: 'home',
      createdAt: now,
    };
  }

  if (collectionName === 'community_posts') {
    const cat = String(data.category || '').trim().toUpperCase();
    const title = String(data.title || '').trim();
    const content = String(data.content || '').trim();
    const author = String(data.authorName || 'Member').trim();
    const createdAtNum = typeof data.createdAt === 'number' ? data.createdAt : now;
    if (isForumPostExpired({ category: String(data.category || ''), createdAt: createdAtNum }, now)) {
      return null;
    }

    if (changeType === 'added') {
      const isAnnouncement = cat.startsWith('ANNOUNCEMENT');
      return {
        id: `syn-post-${docId}`,
        dedupKey: `post:${docId}`,
        fellowshipId,
        title: isAnnouncement
          ? cat === 'ANNOUNCEMENT_URGENT'
            ? `URGENT: ${title || 'Fellowship Announcement'}`
            : title || 'Fellowship Announcement'
          : `New Forum Post: ${title || cat || 'Community'}`,
        message: `${author}: ${content.slice(0, 120)}`,
        type: isAnnouncement ? 'ANNOUNCEMENT' : 'COMMUNITY_POST',
        targetRole: 'ALL',
        targetTab: 'community',
        createdAt: now,
      };
    }

    if (changeType === 'modified' && prevData) {
      const wasFlagged = prevData.isFlagged === true;
      const isFlagged = data.isFlagged === true;
      if (!wasFlagged && isFlagged) {
        return {
          id: `syn-flag-${docId}-${now}`,
          dedupKey: `flag:${docId}`,
          fellowshipId,
          title: 'Flagged Community Post Needs Review',
          message: `${author}: ${(title || content).slice(0, 100)}`,
          type: 'COMMUNITY_POST',
          targetRole: 'ADMINISTRATOR',
          targetTab: 'community',
          createdAt: now,
        };
      }
      const prevComments = Number(prevData.commentsCount || 0);
      const nextComments = Number(data.commentsCount || 0);
      if (nextComments > prevComments) {
        return {
          id: `syn-reply-${docId}-${nextComments}`,
          dedupKey: `reply:${docId}:${nextComments}`,
          fellowshipId,
          title: `New Reply on "${(title || content).slice(0, 40)}"`,
          message: `${nextComments} ${nextComments === 1 ? 'reply' : 'replies'} in Youth Forum`,
          type: 'COMMUNITY_POST',
          targetRole: 'ALL',
          targetTab: 'community',
          createdAt: now,
        };
      }
    }
  }

  if (collectionName === 'daily_scriptures' && changeType === 'added') {
    let parsedMeta: {
      category?: string;
      title?: string;
      audioCloudId?: string;
    } = {};
    try {
      parsedMeta = JSON.parse(String(data.prayerPromptEn || '{}'));
    } catch {
      parsedMeta = {};
    }
    const cat = String(parsedMeta.category || '').toUpperCase();
    const dateKey = String(data.dateKey || '').toUpperCase();
    if (cat === 'BIBLE_VERSE_PACK' || dateKey === 'BIBLE_PACK') return null;

    const ref = String(data.referenceEn || 'Daily Word').trim();
    const verse = String(data.verseTextEn || '').trim();
    const hasAudioSermon =
      cat === 'SERMON' &&
      typeof parsedMeta.audioCloudId === 'string' &&
      parsedMeta.audioCloudId.trim().length > 0;
    const sermonTitle = (parsedMeta.title || verse || 'Audio Sermon').trim();

    const kindTitle =
      cat === 'BIBLE_DOCUMENT'
        ? `Bible Edition Uploaded: ${parsedMeta.title || ref}`
        : hasAudioSermon
        ? `🎧 New Audio Sermon: ${sermonTitle}`
        : cat && cat !== 'SCRIPTURE_OF_THE_DAY'
        ? `New ${cat.replace(/_/g, ' ')}: ${parsedMeta.title || verse.slice(0, 60)}`
        : `Scripture for the Day: ${ref}`;

    return {
      id: hasAudioSermon ? `notif_res_${docId}` : `syn-scr-${docId}`,
      dedupKey: `scr:${docId}`,
      fellowshipId,
      title: kindTitle,
      message: (verse || String(data.authorName || 'Youth Leadership')).slice(0, 120),
      type: 'ANNOUNCEMENT',
      targetRole: 'ALL',
      targetTab: 'spiritual',
      createdAt: now,
    };
  }

  if (collectionName === 'executive_inquiries') {
    const topic = String(data.topic || data.subject || 'Youth Inquiry').trim();
    if (changeType === 'added') {
      const sender = data.isAnonymous ? 'Anonymous Youth Member' : String(data.senderName || 'Member');
      return {
        id: `syn-inq-${docId}`,
        dedupKey: `inq:${docId}`,
        fellowshipId,
        title: `New Executive Inquiry: ${topic}`,
        message: `${sender}: ${String(data.message || data.question || '').slice(0, 100)}`,
        type: 'COMMUNITY_POST',
        targetRole: 'EXECUTIVE',
        targetTab: 'community',
        createdAt: now,
      };
    }
    if (changeType === 'modified' && prevData) {
      const prevResp = String(prevData.responseMessage || prevData.response || '').trim();
      const nextResp = String(data.responseMessage || data.response || '').trim();
      if (!prevResp && nextResp && typeof data.senderId === 'string' && data.senderId) {
        return {
          id: `syn-inq-resp-${docId}`,
          dedupKey: `inq-resp:${docId}`,
          fellowshipId,
          title: `Pastoral Response: ${topic}`,
          message: nextResp.slice(0, 120),
          type: 'ANNOUNCEMENT',
          targetRole: 'ALL',
          recipientUserId: data.senderId,
          targetTab: 'community',
          createdAt: now,
        };
      }
    }
  }

  if (collectionName === 'quiz_sessions' && changeType === 'added') {
    const status = String(data.status || '').toUpperCase();
    if (
      status === 'DRAFT' ||
      status === 'CANCELLED' ||
      status === 'COMPLETED' ||
      status === 'ENDED'
    ) {
      return null;
    }
    const title = String(data.titleEn || data.title || 'Bible Showdown').trim();
    const pin = String(data.roomPin || '').trim();
    return {
      id: `syn-quiz-${docId}`,
      dedupKey: `quiz:${docId}`,
      fellowshipId,
      title: `Live Bible Showdown: ${title}`,
      message: pin ? `Room PIN ${pin} is open now in Games!` : 'Join the live fellowship Bible showdown!',
      type: 'GAME_TIME',
      targetRole: 'ALL',
      targetTab: 'games',
      createdAt: now,
    };
  }

  if (collectionName === 'fellowship_accounts' && changeType === 'added') {
    const role = normalizeRoleKey(String(data.role || ''));
    const status = String(data.status || '').toUpperCase();
    if (role === 'EXECUTIVE' && status === 'PENDING') {
      return {
        id: `syn-acc-${docId}`,
        dedupKey: `acc:${docId}`,
        fellowshipId,
        title: 'New Youth Executive Request',
        message: `${String(data.fullName || 'Member')} requested Youth Executive access.`,
        type: 'APPROVAL',
        targetRole: 'ADMINISTRATOR',
        targetTab: 'profile',
        createdAt: now,
      };
    }
  }

  return null;
}
