import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

interface PrecacheManifestItem {
  url: string;
  revision: string | null;
}

interface SwWindowClient {
  url: string;
  focused?: boolean;
  focus?: () => Promise<SwWindowClient>;
  postMessage: (message: unknown) => void;
}

interface SwClients {
  matchAll: (options?: {
    type?: 'window' | 'worker' | 'sharedworker' | 'all';
    includeUncontrolled?: boolean;
  }) => Promise<SwWindowClient[]>;
  openWindow: (url: string) => Promise<SwWindowClient | null>;
}

interface SwNotificationOptions {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  renotify?: boolean;
  data?: Record<string, unknown>;
}

interface SwPushSubscription {
  toJSON: () => unknown;
}

interface SwPushManager {
  subscribe: (options: {
    userVisibleOnly: boolean;
    applicationServerKey?: ArrayBuffer | ArrayBufferView | string;
  }) => Promise<SwPushSubscription>;
  getSubscription: () => Promise<SwPushSubscription | null>;
}

interface SwRegistration {
  showNotification: (title: string, options?: SwNotificationOptions) => Promise<void>;
  pushManager: SwPushManager;
}

interface SwScope {
  __WB_MANIFEST: Array<PrecacheManifestItem | string>;
  skipWaiting: () => Promise<void>;
  registration: SwRegistration;
  clients: SwClients;
  location: Location;
  addEventListener: (type: string, listener: (event: unknown) => void) => void;
}

interface PushEventLike {
  data?: {
    json: () => unknown;
    text: () => string;
  };
  waitUntil: (promise: Promise<unknown>) => void;
}

interface NotificationEventLike {
  notification: {
    close: () => void;
    data?: {
      url?: string;
      targetTab?: string;
      notificationId?: string;
    };
  };
  waitUntil: (promise: Promise<unknown>) => void;
}

interface ExtendableEventLike {
  tag?: string;
  waitUntil: (promise: Promise<unknown>) => void;
}

declare const self: SwScope;

// Activate updated Service Worker immediately so background push fixes apply right away
void self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);
const sw = self;

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

let lastCheckedTimestamp = Date.now();

/**
 * Fires when a Web Push notification arrives from FCM (Android) or APNs (iOS 16.4+ installed PWA),
 * even when the phone app & browser are completely closed.
 */
sw.addEventListener('push', (rawEvent) => {
  const event = rawEvent as PushEventLike;
  const work = (async () => {
    let payload: {
      id?: string;
      title?: string;
      message?: string;
      body?: string;
      type?: string;
      targetTab?: string;
      url?: string;
      tag?: string;
      createdAt?: number;
      notification?: { title?: string; body?: string; tag?: string };
      data?: {
        id?: string;
        title?: string;
        message?: string;
        body?: string;
        targetTab?: string;
        url?: string;
        tag?: string;
      };
    } = {};

    if (event.data) {
      try {
        payload = event.data.json() as typeof payload;
      } catch {
        try {
          payload = { message: event.data.text() };
        } catch {
          payload = {};
        }
      }
    }

    const title =
      payload.notification?.title ||
      payload.data?.title ||
      payload.title ||
      'The Gideonites — Youth Alive';
    const body =
      payload.notification?.body ||
      payload.data?.message ||
      payload.data?.body ||
      payload.message ||
      payload.body ||
      'New fellowship alert awaits you.';
    const targetTab = payload.data?.targetTab || payload.targetTab || 'home';
    const notificationId =
      payload.data?.id || payload.id || `push-${Date.now()}`;
    const tag =
      payload.notification?.tag || payload.data?.tag || payload.tag || notificationId;
    const url =
      payload.data?.url ||
      payload.url ||
      `/?openNotifications=true&tab=${encodeURIComponent(targetTab)}`;

    if (typeof payload.createdAt === 'number' && payload.createdAt > lastCheckedTimestamp) {
      lastCheckedTimestamp = payload.createdAt;
    }

    await sw.registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag,
      renotify: true,
      data: {
        url,
        targetTab,
        notificationId,
      },
    });
  })();

  event.waitUntil(work);
});

/**
 * Clicking an OS notification wakes/focuses the installed PWA and opens Notification Center / tab.
 */
sw.addEventListener('notificationclick', (rawEvent) => {
  const event = rawEvent as NotificationEventLike;
  event.notification.close();

  const data = event.notification.data || {};
  const targetTab = data.targetTab || 'home';
  const rawUrl = data.url || `/?openNotifications=true&tab=${encodeURIComponent(targetTab)}`;
  const urlObj = new URL(rawUrl, sw.location.origin);
  if (!urlObj.searchParams.has('openNotifications')) {
    urlObj.searchParams.set('openNotifications', 'true');
  }
  const targetUrl = urlObj.href;

  event.waitUntil(
    (async () => {
      const windowClients = await sw.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of windowClients) {
        if (client.url.startsWith(sw.location.origin)) {
          if (client.focus) {
            await client.focus();
          }
          client.postMessage({
            type: 'OPEN_NOTIFICATIONS',
            openNotifications: true,
            targetTab,
            notificationId: data.notificationId,
          });
          return;
        }
      }

      if (sw.clients.openWindow) {
        await sw.clients.openWindow(targetUrl);
      }
    })()
  );
});

/**
 * Automatically re-sync push subscription if Android Chrome / Safari rotates browser push keys.
 */
sw.addEventListener('pushsubscriptionchange', (rawEvent) => {
  const event = rawEvent as ExtendableEventLike;
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch('/api/push/vapid-public-key');
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || !ct.includes('application/json')) return;
        const { publicKey } = (await res.json()) as { publicKey?: string };
        if (!publicKey) return;

        const padding = '='.repeat((4 - (publicKey.length % 4)) % 4);
        const base64 = (publicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; i += 1) {
          outputArray[i] = rawData.charCodeAt(i);
        }

        const subscription = await sw.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: outputArray,
        });

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        });
      } catch {
        // Ignore silent subscription refresh failures
      }
    })()
  );
});

/**
 * Periodic & One-off Background Sync fallback for supported installed Chromium PWAs.
 */
async function triggerClientOrServerSync() {
  try {
    const windowClients = await sw.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    for (const client of windowClients) {
      if (client.url.startsWith(sw.location.origin)) {
        client.postMessage({ type: 'RUN_BACKGROUND_SYNC' });
      }
    }

    const res = await fetch(`/api/notifications?since=${lastCheckedTimestamp}`);
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.includes('application/json')) return;
    const data = (await res.json()) as {
      notifications?: Array<{
        id: string;
        title: string;
        message: string;
        type?: string;
        createdAt?: number;
      }>;
    };
    const items = Array.isArray(data.notifications) ? data.notifications : [];
    if (items.length === 0) return;

    const newest = items[0];
    if (typeof newest.createdAt === 'number') {
      lastCheckedTimestamp = Math.max(lastCheckedTimestamp, newest.createdAt);
    }

    await sw.registration.showNotification(newest.title || 'The Gideonites Alert', {
      body: newest.message || 'New update in Youth Alive Fellowship.',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: newest.id,
      renotify: true,
      data: {
        url: '/?openNotifications=true&tab=home',
        targetTab: 'home',
        notificationId: newest.id,
      },
    });
  } catch {
    // ignore network errors during background sync
  }
}

sw.addEventListener('periodicsync', (rawEvent) => {
  const event = rawEvent as ExtendableEventLike;
  if (event.tag !== 'gideonites-check-notifications') return;
  event.waitUntil(triggerClientOrServerSync());
});

sw.addEventListener('sync', (rawEvent) => {
  const event = rawEvent as ExtendableEventLike;
  if (event.tag !== 'gideonites-bg-sync') return;
  event.waitUntil(triggerClientOrServerSync());
});
