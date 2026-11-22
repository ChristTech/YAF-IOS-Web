/* eslint-disable no-undef */
/* Firebase Cloud Messaging Service Worker for The Gideonites — Youth Alive Fellowship */

try {
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

  const firebaseConfig = {
    apiKey: 'AIzaSyDEDEbwBaEKPz9GMK63zCI8qd8HG5pbiRs',
    authDomain: 'gen-lang-client-0477394918.firebaseapp.com',
    projectId: 'gen-lang-client-0477394918',
    storageBucket: 'gen-lang-client-0477394918.firebasestorage.app',
    messagingSenderId: '742042240421',
    appId: '1:742042240421:web:487e63778332f9be0c944c',
  };

  if (typeof firebase !== 'undefined' && firebase.initializeApp) {
    if (!firebase.apps || firebase.apps.length === 0) {
      firebase.initializeApp(firebaseConfig);
    }
    if (typeof firebase.messaging === 'function') {
      const messaging = firebase.messaging();
      messaging.onBackgroundMessage((payload) => {
        const title =
          (payload && payload.notification && payload.notification.title) ||
          (payload && payload.data && payload.data.title) ||
          'The Gideonites — Youth Alive';
        const body =
          (payload && payload.notification && payload.notification.body) ||
          (payload && payload.data && (payload.data.message || payload.data.body)) ||
          'New fellowship update awaits you.';
        const targetTab = (payload && payload.data && payload.data.targetTab) || 'home';
        const tag =
          (payload && payload.data && payload.data.id) ||
          (payload && payload.notification && payload.notification.tag) ||
          `fcm-${Date.now()}`;

        return self.registration.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag,
          renotify: true,
          data: {
            url: `/?openNotifications=true&tab=${encodeURIComponent(targetTab)}`,
            targetTab,
            notificationId: tag,
          },
        });
      });
    }
  }
} catch {
  // Safe offline or strict-CSP fallback when Firebase CDN scripts are unreachable
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = (event.notification && event.notification.data) || {};
  const targetTab = data.targetTab || 'home';
  const targetUrl = new URL(
    data.url || `/?openNotifications=true&tab=${encodeURIComponent(targetTab)}`,
    self.location.origin
  ).href;

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin)) {
          if (client.focus) await client.focus();
          client.postMessage({
            type: 'OPEN_NOTIFICATIONS',
            openNotifications: true,
            targetTab,
            notificationId: data.notificationId,
          });
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
