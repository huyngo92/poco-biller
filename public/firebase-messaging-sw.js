importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAQuwwgd-YhPLnLVpH9QIKQ-MmuBNVUYIA",
  authDomain: "poco-biller-b6ce2.firebaseapp.com",
  projectId: "poco-biller-b6ce2",
  storageBucket: "poco-biller-b6ce2.firebasestorage.app",
  messagingSenderId: "531240252268",
  appId: "1:531240252268:web:cdbdaa71b58784f4ae7949",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[sw] Received background message: ', payload);
  const notificationTitle = payload.notification?.title || "Poco Biller";
  const notificationOptions = {
    body: payload.notification?.body || "",
    icon: "/logo.png",
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(link);
    })
  );
});
