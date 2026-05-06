importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAuOzt2aFoWsntR54qzG9wKqKy_tIrcmVg',
  authDomain: 'qrproduct-3340b.firebaseapp.com',
  projectId: 'qrproduct-3340b',
  storageBucket: 'qrproduct-3340b.firebasestorage.app',
  messagingSenderId: '1071993503530',
  appId: '1:1071993503530:web:8abb96a305ea453651e853',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? '呼び出し';
  const body = payload.notification?.body ?? '';
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'staff-call',
    renotify: true,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/staff'));
});
