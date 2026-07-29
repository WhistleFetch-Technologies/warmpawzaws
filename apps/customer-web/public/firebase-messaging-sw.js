// firebase-messaging-sw.js
// Service Worker for Firebase Cloud Messaging.
// Config is injected by the main app via postMessage after SW registration.
// This file must be at the /public root so it is served from the domain origin.

importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js');

// Prevent double-initialization if SW receives multiple config messages
let _initialized = false;

/**
 * Initialize Firebase and register the background message handler.
 * Called only after receiving a valid FIREBASE_CONFIG message from the main app.
 */
function setupFirebaseMessaging(config) {
  if (_initialized) return;
  if (!config || !config.apiKey || !config.projectId) {
    console.warn('[firebase-sw] Received incomplete config — skipping init');
    return;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }

    const messaging = firebase.messaging();
    _initialized = true;

    messaging.onBackgroundMessage((payload) => {
      const data = payload.data ?? {};

      if (data.type === 'commerce_switch_updated') {
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
          for (const client of clientList) {
            client.postMessage({
              type: 'COMMERCE_SWITCH_SYNC',
              data,
            });
          }
        });
        return;
      }

      const title = payload.notification?.title ?? 'Warmpawz';
      const body  = payload.notification?.body  ?? '';

      const notificationOptions = {
        body,
        data,
        tag:   'warmpawz-push',
        icon:  '/icons/icon-192x192.webp',
        badge: '/icons/badge-72x72.webp',
      };

      self.registration.showNotification(title, notificationOptions);
    });

    console.log('[firebase-sw] Firebase messaging initialized');
  } catch (err) {
    console.warn('[firebase-sw] Firebase messaging setup failed:', err);
    _initialized = false;
  }
}

/**
 * Receive Firebase config from the main app (push-bootstrap.ts).
 * The main app sends this immediately after registering the service worker.
 */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG') {
    setupFirebaseMessaging(event.data.config);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing Warmpawz tab if already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab at root
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
