import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response } from 'express';
import {
  generateVAPIDKeys,
  sendNotification,
  setVapidDetails,
} from 'web-push';
import { initializeApp } from 'firebase/app';
import {
  collection,
  getFirestore,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FELLOWSHIP_ID = 'GIDEONITES';
const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const VAPID_STORE_PATH = path.join(__dirname, '.gideonites-vapid.json');
const SUBS_STORE_PATH = path.join(__dirname, '.gideonites-push-subs.json');
const NOTIFS_STORE_PATH = path.join(__dirname, '.gideonites-notifications.json');

interface PushSubscriptionPayload {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface StoredSubscription {
  endpoint: string;
  subscription: PushSubscriptionPayload;
  userId?: string;
  role?: string;
  platform?: string;
  updatedAt: number;
}

interface ServerNotificationRecord {
  id: string;
  dedupKey?: string;
  fellowshipId: string;
  title: string;
  message: string;
  type: string;
  targetRole: 'ALL' | 'ADMINISTRATOR' | 'EXECUTIVE';
  recipientUserId?: string;
  senderDeviceId?: string;
  targetTab: string;
  readByJson: string;
  createdAt: number;
}

function safeReadJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson(filePath: string, data: unknown): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // Container or read-only filesystem fallback: keep state in memory
  }
}

function normalizeRoleKey(role?: string | null): string {
  const upper = (role || '').trim().toUpperCase();
  if (upper === 'YOUTH_EXECUTIVE') return 'EXECUTIVE';
  return upper;
}

function getTargetTabForType(type?: string): string {
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

function isNotificationRelevant(
  notif: { targetRole?: string; recipientUserId?: string },
  userId?: string,
  role?: string
): boolean {
  if (notif.recipientUserId && notif.recipientUserId.trim().length > 0) {
    if (!userId) return false;
    return notif.recipientUserId.trim() === userId.trim();
  }
  const target = (notif.targetRole || 'ALL').trim().toUpperCase();
  if (!target || target === 'ALL') return true;
  const userRole = normalizeRoleKey(role);
  if (target === 'ADMINISTRATOR') return userRole === 'ADMINISTRATOR';
  if (target === 'EXECUTIVE') {
    return userRole === 'ADMINISTRATOR' || userRole === 'EXECUTIVE';
  }
  return true;
}

function getOrCreateVapidKeys(): {
  publicKey: string;
  privateKey: string;
  subject: string;
} {
  const envPublic = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPrivate = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() || 'mailto:fellowship@gideonites.org';

  if (envPublic && envPrivate) {
    return { publicKey: envPublic, privateKey: envPrivate, subject };
  }

  const stored = safeReadJson<{ publicKey?: string; privateKey?: string }>(
    VAPID_STORE_PATH,
    {}
  );
  if (stored.publicKey && stored.privateKey) {
    return {
      publicKey: stored.publicKey,
      privateKey: stored.privateKey,
      subject,
    };
  }

  const generated = generateVAPIDKeys();
  safeWriteJson(VAPID_STORE_PATH, generated);
  return {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
    subject,
  };
}

const vapid = getOrCreateVapidKeys();
setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

let subscriptions: StoredSubscription[] = safeReadJson<StoredSubscription[]>(
  SUBS_STORE_PATH,
  []
);
let notificationHistory: ServerNotificationRecord[] = safeReadJson<
  ServerNotificationRecord[]
>(NOTIFS_STORE_PATH, []);

const recentDedupKeys = new Map<string, number>();
for (const n of notificationHistory) {
  if (n.dedupKey) {
    recentDedupKeys.set(n.dedupKey, n.createdAt);
  }
}

const sseClients = new Set<Response>();

function pruneDedupMap(): void {
  if (recentDedupKeys.size <= 500) return;
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [k, ts] of recentDedupKeys.entries()) {
    if (ts < cutoff) recentDedupKeys.delete(k);
  }
}

async function dispatchNotification(params: {
  id?: string;
  dedupKey?: string;
  title: string;
  message: string;
  type?: string;
  targetRole?: 'ALL' | 'ADMINISTRATOR' | 'EXECUTIVE';
  recipientUserId?: string;
  senderDeviceId?: string;
  targetTab?: string;
  createdAt?: number;
  sendWebPush?: boolean;
}): Promise<{
  record: ServerNotificationRecord;
  deduplicated: boolean;
  sent: number;
  failed: number;
}> {
  const now = params.createdAt ?? Date.now();
  if (params.dedupKey) {
    const prevTs = recentDedupKeys.get(params.dedupKey);
    if (prevTs && now - prevTs < 60 * 60 * 1000) {
      const existing = notificationHistory.find(
        (item) => item.dedupKey === params.dedupKey
      );
      if (existing) {
        return { record: existing, deduplicated: true, sent: 0, failed: 0 };
      }
    }
    recentDedupKeys.set(params.dedupKey, now);
    pruneDedupMap();
  }

  const typeClean = (params.type || 'ANNOUNCEMENT').trim();
  const targetTab = params.targetTab || getTargetTabForType(typeClean);
  const record: ServerNotificationRecord = {
    id:
      params.id ||
      `srv-${now}-${Math.random().toString(36).slice(2, 7)}`,
    ...(params.dedupKey ? { dedupKey: params.dedupKey } : {}),
    fellowshipId: FELLOWSHIP_ID,
    title: params.title.trim() || 'The Gideonites Alert',
    message: params.message.trim(),
    type: typeClean,
    targetRole: params.targetRole || 'ALL',
    ...(params.recipientUserId
      ? { recipientUserId: params.recipientUserId }
      : {}),
    ...(params.senderDeviceId
      ? { senderDeviceId: params.senderDeviceId }
      : {}),
    targetTab,
    readByJson: '[]',
    createdAt: now,
  };

  notificationHistory = [
    record,
    ...notificationHistory.filter((n) => n.id !== record.id),
  ].slice(0, 150);
  safeWriteJson(NOTIFS_STORE_PATH, notificationHistory);

  // Broadcast via SSE to any open clients
  const ssePayload = `event: notification\ndata: ${JSON.stringify(record)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(ssePayload);
    } catch {
      sseClients.delete(res);
    }
  }

  let sent = 0;
  let failed = 0;

  if (params.sendWebPush !== false && subscriptions.length > 0) {
    const pushPayload = JSON.stringify({
      id: record.id,
      title: record.title,
      message: record.message,
      type: record.type,
      targetTab: record.targetTab,
      url: `/?openNotifications=true&tab=${encodeURIComponent(record.targetTab)}`,
      tag: record.dedupKey || record.id,
      createdAt: record.createdAt,
    });

    const staleEndpoints = new Set<string>();
    const matchingSubs = subscriptions.filter((sub) =>
      isNotificationRelevant(record, sub.userId, sub.role)
    );

    await Promise.all(
      matchingSubs.map(async (sub) => {
        try {
          await sendNotification(sub.subscription, pushPayload, {
            TTL: 60 * 60 * 12,
            urgency:
              record.title.startsWith('URGENT') || record.type === 'EVENT'
                ? 'high'
                : 'normal',
          });
          sent += 1;
        } catch (err: unknown) {
          failed += 1;
          const statusCode =
            typeof err === 'object' && err !== null && 'statusCode' in err
              ? Number((err as { statusCode?: unknown }).statusCode)
              : 0;
          if (statusCode === 404 || statusCode === 410) {
            staleEndpoints.add(sub.endpoint);
          }
        }
      })
    );

    if (staleEndpoints.size > 0) {
      subscriptions = subscriptions.filter(
        (s) => !staleEndpoints.has(s.endpoint)
      );
      safeWriteJson(SUBS_STORE_PATH, subscriptions);
    }
  }

  return { record, deduplicated: false, sent, failed };
}

function startFirestoreNotificationWatcher(): void {
  try {
    const configPath = path.join(__dirname, 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return;
    const firebaseConfig = JSON.parse(
      fs.readFileSync(configPath, 'utf8')
    ) as {
      apiKey?: string;
      authDomain?: string;
      projectId?: string;
      firestoreDatabaseId?: string;
    };
    const dbId =
      firebaseConfig.firestoreDatabaseId ||
      'ai-studio-android-youthali-dedc7e7c-c321-419b-be88-e862b3860a45';
    const fbApp = initializeApp(firebaseConfig, 'server-push-watcher');
    const fbDb = getFirestore(fbApp, dbId);

    const watchedCollections = [
      'fellowship_notifications',
      'programmes',
      'community_posts',
      'daily_scriptures',
      'executive_inquiries',
      'quiz_sessions',
      'fellowship_accounts',
    ];

    for (const colName of watchedCollections) {
      let initialized = false;
      const seenDocData = new Map<string, Record<string, unknown>>();

      const q = query(
        collection(fbDb, colName),
        where('fellowshipId', '==', FELLOWSHIP_ID)
      );

      onSnapshot(
        q,
        (snapshot) => {
          if (!initialized) {
            initialized = true;
            for (const docSnap of snapshot.docs) {
              seenDocData.set(
                docSnap.id,
                docSnap.data() as Record<string, unknown>
              );
            }
            return;
          }

          for (const change of snapshot.docChanges()) {
            const docId = change.doc.id;
            const data = change.doc.data() as Record<string, unknown>;
            const prevData = seenDocData.get(docId);

            if (change.type === 'removed') {
              seenDocData.delete(docId);
              continue;
            }
            seenDocData.set(docId, data);

            if (colName === 'fellowship_notifications' && change.type === 'added') {
              void dispatchNotification({
                id: docId,
                dedupKey: `notif:${docId}`,
                title: String(data.title || 'The Gideonites Alert'),
                message: String(data.message || ''),
                type: String(data.type || 'ANNOUNCEMENT'),
                targetRole:
                  (data.targetRole as 'ALL' | 'ADMINISTRATOR' | 'EXECUTIVE') ||
                  'ALL',
                recipientUserId:
                  typeof data.recipientUserId === 'string'
                    ? data.recipientUserId
                    : undefined,
                createdAt:
                  typeof data.createdAt === 'number'
                    ? data.createdAt
                    : Date.now(),
              });
              continue;
            }

            if (colName === 'programmes' && change.type === 'added') {
              const startMs = Number(
                data.startDateMillis || data.timestamp || data.createdAt || 0
              );
              const todayStart = new Date();
              todayStart.setHours(0, 0, 0, 0);
              if (startMs > 0 && startMs < todayStart.getTime()) {
                continue;
              }
              const titleEn = String(data.titleEn || 'Youth Programme').trim();
              const venue = String(data.venue || 'Living Faith Church Youth Hall').trim();
              void dispatchNotification({
                id: `syn-prog-${docId}`,
                dedupKey: `prog:${docId}`,
                title: `New Programme: ${titleEn}`,
                message: `Venue: ${venue}`,
                type: 'EVENT',
                targetRole: 'ALL',
              });
              continue;
            }

            if (colName === 'community_posts') {
              const cat = String(data.category || '').trim().toUpperCase();
              const title = String(data.title || '').trim();
              const content = String(data.content || '').trim();
              const author = String(data.authorName || 'Member').trim();

              if (change.type === 'added') {
                const isAnnouncement = cat.startsWith('ANNOUNCEMENT');
                void dispatchNotification({
                  id: `syn-post-${docId}`,
                  dedupKey: `post:${docId}`,
                  title: isAnnouncement
                    ? cat === 'ANNOUNCEMENT_URGENT'
                      ? `URGENT: ${title || 'Fellowship Announcement'}`
                      : title || 'Fellowship Announcement'
                    : `New Forum Post: ${title || cat || 'Community'}`,
                  message: `${author}: ${content.slice(0, 120)}`,
                  type: isAnnouncement ? 'ANNOUNCEMENT' : 'COMMUNITY_POST',
                  targetRole: 'ALL',
                });
              } else if (change.type === 'modified' && prevData) {
                if (prevData.isFlagged !== true && data.isFlagged === true) {
                  void dispatchNotification({
                    id: `syn-flag-${docId}`,
                    dedupKey: `flag:${docId}`,
                    title: 'Flagged Community Post Needs Review',
                    message: `${author}: ${(title || content).slice(0, 100)}`,
                    type: 'COMMUNITY_POST',
                    targetRole: 'ADMINISTRATOR',
                  });
                } else {
                  const prevComments = Number(prevData.commentsCount || 0);
                  const nextComments = Number(data.commentsCount || 0);
                  if (nextComments > prevComments) {
                    void dispatchNotification({
                      id: `syn-reply-${docId}-${nextComments}`,
                      dedupKey: `reply:${docId}:${nextComments}`,
                      title: `New Reply on "${(title || content).slice(0, 40)}"`,
                      message: `${nextComments} ${
                        nextComments === 1 ? 'reply' : 'replies'
                      } in Youth Forum`,
                      type: 'COMMUNITY_POST',
                      targetRole: 'ALL',
                    });
                  }
                }
              }
              continue;
            }

            if (colName === 'daily_scriptures' && change.type === 'added') {
              let parsedMeta: {
                category?: string;
                title?: string;
                audioCloudId?: string;
              } = {};
              try {
                parsedMeta = JSON.parse(String(data.prayerPromptEn || '{}')) as {
                  category?: string;
                  title?: string;
                  audioCloudId?: string;
                };
              } catch {
                parsedMeta = {};
              }
              const cat = String(parsedMeta.category || '').toUpperCase();
              const dateKey = String(data.dateKey || '').toUpperCase();
              if (cat === 'BIBLE_VERSE_PACK' || dateKey === 'BIBLE_PACK') continue;

              const ref = String(data.referenceEn || 'Daily Word').trim();
              const verse = String(data.verseTextEn || '').trim();
              const hasAudioSermon =
                cat === 'SERMON' &&
                typeof parsedMeta.audioCloudId === 'string' &&
                parsedMeta.audioCloudId.trim().length > 0;
              const titleText =
                cat === 'BIBLE_DOCUMENT'
                  ? `Bible Edition Uploaded: ${parsedMeta.title || ref}`
                  : hasAudioSermon
                  ? `🎧 New Audio Sermon: ${parsedMeta.title || verse || 'Audio Sermon'}`
                  : cat && cat !== 'SCRIPTURE_OF_THE_DAY'
                  ? `New ${cat.replace(/_/g, ' ')}: ${
                      parsedMeta.title || verse.slice(0, 60)
                    }`
                  : `Scripture for the Day: ${ref}`;

              void dispatchNotification({
                id: hasAudioSermon ? `notif_res_${docId}` : `syn-scr-${docId}`,
                dedupKey: `scr:${docId}`,
                title: titleText,
                message: (
                  verse || String(data.authorName || 'Youth Leadership')
                ).slice(0, 120),
                type: 'ANNOUNCEMENT',
                targetRole: 'ALL',
                targetTab: 'spiritual',
              });
              continue;
            }

            if (colName === 'executive_inquiries') {
              const topic = String(
                data.topic || data.subject || 'Youth Inquiry'
              ).trim();
              if (change.type === 'added') {
                const sender = data.isAnonymous
                  ? 'Anonymous Youth Member'
                  : String(data.senderName || 'Member');
                void dispatchNotification({
                  id: `syn-inq-${docId}`,
                  dedupKey: `inq:${docId}`,
                  title: `New Executive Inquiry: ${topic}`,
                  message: `${sender}: ${String(
                    data.message || data.question || ''
                  ).slice(0, 100)}`,
                  type: 'COMMUNITY_POST',
                  targetRole: 'EXECUTIVE',
                });
              } else if (change.type === 'modified' && prevData) {
                const prevResp = String(
                  prevData.responseMessage || prevData.response || ''
                ).trim();
                const nextResp = String(
                  data.responseMessage || data.response || ''
                ).trim();
                if (
                  !prevResp &&
                  nextResp &&
                  typeof data.senderId === 'string' &&
                  data.senderId
                ) {
                  void dispatchNotification({
                    id: `syn-inq-resp-${docId}`,
                    dedupKey: `inq-resp:${docId}`,
                    title: `Pastoral Response: ${topic}`,
                    message: nextResp.slice(0, 120),
                    type: 'ANNOUNCEMENT',
                    targetRole: 'ALL',
                    recipientUserId: data.senderId,
                  });
                }
              }
              continue;
            }

            if (colName === 'quiz_sessions' && change.type === 'added') {
              const status = String(data.status || '').toUpperCase();
              if (
                status === 'DRAFT' ||
                status === 'CANCELLED' ||
                status === 'COMPLETED' ||
                status === 'ENDED'
              ) {
                continue;
              }
              const title = String(data.titleEn || data.title || 'Bible Quiz').trim();
              const pin = String(data.roomPin || '').trim();
              void dispatchNotification({
                id: `syn-quiz-${docId}`,
                dedupKey: `quiz:${docId}`,
                title: `Live Bible Showdown: ${title}`,
                message: pin
                  ? `Room PIN ${pin} is open now in Games!`
                  : 'Join the live fellowship Bible showdown!',
                type: 'QUIZ',
                targetRole: 'ALL',
              });
              continue;
            }

            if (colName === 'fellowship_accounts' && change.type === 'added') {
              const role = normalizeRoleKey(String(data.role || ''));
              const status = String(data.status || '').toUpperCase();
              if (role === 'EXECUTIVE' && status === 'PENDING') {
                void dispatchNotification({
                  id: `syn-acc-${docId}`,
                  dedupKey: `acc:${docId}`,
                  title: 'New Youth Executive Request',
                  message: `${String(
                    data.fullName || 'Member'
                  )} requested Youth Executive access.`,
                  type: 'APPROVAL',
                  targetRole: 'ADMINISTRATOR',
                });
              }
            }
          }
        },
        () => {
          // Ignore transient listener errors; client & dispatch API continue working
        }
      );
    }
  } catch {
    // Non-fatal if Firestore watcher fails to initialize
  }
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      fellowshipId: FELLOWSHIP_ID,
      pushConfigured: Boolean(vapid.publicKey && vapid.privateKey),
      subscriptionsCount: subscriptions.length,
      notificationsCount: notificationHistory.length,
    });
  });

  app.get('/api/push/vapid-public-key', (_req: Request, res: Response) => {
    res.json({ publicKey: vapid.publicKey });
  });

  app.post('/api/push/subscribe', (req: Request, res: Response) => {
    const body = req.body as {
      subscription?: PushSubscriptionPayload;
      userId?: string;
      role?: string;
      platform?: string;
    };
    const sub = body?.subscription;
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      res.status(400).json({ error: 'Invalid Web Push subscription payload.' });
      return;
    }

    const nextEntry: StoredSubscription = {
      endpoint: sub.endpoint,
      subscription: sub,
      ...(body.userId ? { userId: body.userId } : {}),
      ...(body.role ? { role: body.role } : {}),
      ...(body.platform ? { platform: body.platform } : {}),
      updatedAt: Date.now(),
    };

    subscriptions = [
      nextEntry,
      ...subscriptions.filter((s) => s.endpoint !== sub.endpoint),
    ];
    safeWriteJson(SUBS_STORE_PATH, subscriptions);
    res.json({ ok: true, count: subscriptions.length });
  });

  app.post('/api/push/unsubscribe', (req: Request, res: Response) => {
    const body = req.body as { endpoint?: string };
    if (body?.endpoint) {
      subscriptions = subscriptions.filter((s) => s.endpoint !== body.endpoint);
      safeWriteJson(SUBS_STORE_PATH, subscriptions);
    }
    res.json({ ok: true, count: subscriptions.length });
  });

  app.post('/api/push/dispatch', async (req: Request, res: Response) => {
    const body = req.body as {
      id?: string;
      dedupKey?: string;
      title?: string;
      message?: string;
      type?: string;
      targetRole?: 'ALL' | 'ADMINISTRATOR' | 'EXECUTIVE';
      recipientUserId?: string;
      senderDeviceId?: string;
      targetTab?: string;
      createdAt?: number;
    };
    if (!body?.title && !body?.message) {
      res.status(400).json({ error: 'title or message is required.' });
      return;
    }
    const result = await dispatchNotification({
      id: body.id,
      dedupKey: body.dedupKey,
      title: body.title || 'The Gideonites Alert',
      message: body.message || '',
      type: body.type || 'ANNOUNCEMENT',
      targetRole: body.targetRole || 'ALL',
      recipientUserId: body.recipientUserId,
      senderDeviceId: body.senderDeviceId,
      targetTab: body.targetTab,
      createdAt: body.createdAt,
    });
    res.json({ ok: true, ...result });
  });

  app.post('/api/push/test', async (req: Request, res: Response) => {
    const body = req.body as {
      endpoint?: string;
      userId?: string;
      title?: string;
      message?: string;
    };
    const targets = body?.endpoint
      ? subscriptions.filter((s) => s.endpoint === body.endpoint)
      : body?.userId
      ? subscriptions.filter((s) => s.userId === body.userId)
      : subscriptions;

    const payload = JSON.stringify({
      id: `test-${Date.now()}`,
      title: body?.title || 'The Gideonites — Background Push Active',
      message:
        body?.message ||
        'Your device is ready to receive fellowship alerts even when the app is closed.',
      type: 'ANNOUNCEMENT',
      targetTab: 'home',
      url: '/?tab=home',
      tag: 'gideonites-push-test',
      createdAt: Date.now(),
    });

    let sent = 0;
    let failed = 0;
    const staleEndpoints = new Set<string>();

    await Promise.all(
      targets.map(async (sub) => {
        try {
          await sendNotification(sub.subscription, payload, {
            TTL: 300,
            urgency: 'high',
          });
          sent += 1;
        } catch (err: unknown) {
          failed += 1;
          const statusCode =
            typeof err === 'object' && err !== null && 'statusCode' in err
              ? Number((err as { statusCode?: unknown }).statusCode)
              : 0;
          if (statusCode === 404 || statusCode === 410) {
            staleEndpoints.add(sub.endpoint);
          }
        }
      })
    );

    if (staleEndpoints.size > 0) {
      subscriptions = subscriptions.filter(
        (s) => !staleEndpoints.has(s.endpoint)
      );
      safeWriteJson(SUBS_STORE_PATH, subscriptions);
    }

    res.json({
      ok: true,
      sent,
      failed,
      totalMatching: targets.length,
    });
  });

  app.get('/api/notifications', (req: Request, res: Response) => {
    const since = Number(req.query.since || 0);
    const userId =
      typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const role =
      typeof req.query.role === 'string' ? req.query.role : undefined;

    const filtered = notificationHistory.filter((n) => {
      if (since > 0 && n.createdAt <= since) return false;
      if (userId || role) {
        return isNotificationRelevant(n, userId, role);
      }
      return true;
    });

    res.json({ notifications: filtered });
  });

  app.get('/api/notifications/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write('event: connected\ndata: {"ok":true}\n\n');

    sseClients.add(res);
    const heartbeat = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 25_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  if (!IS_PROD) {
    process.env.DISABLE_HMR = 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: null,
      },
      appType: 'spa',
    });

    // Vite 8 @vite/client unconditionally opens a WebSocket even when hmr/ws are false.
    // Serve a zero-WebSocket compatible client module before vite.middlewares so CSS injection
    // (updateStyle/removeStyle) and module HMR stubs work with zero console/network errors.
    app.get('/@vite/client', (_req: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(`
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if (typeof document !== "undefined") {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
let lastInsertedStyle;
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => {
        lastInsertedStyle = undefined;
      }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id="' + CSS.escape(id) + '"]').forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return pathname + "?" + queryToInject + (search ? "&" + search.slice(1) : "") + (hash || "");
}
const BaseHTMLElement = typeof globalThis.HTMLElement === "function" ? globalThis.HTMLElement : class {};
export class ErrorOverlay extends BaseHTMLElement {}
`);
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gideonites server listening on http://0.0.0.0:${PORT}`);
    startFirestoreNotificationWatcher();
  });
}

void startServer();
