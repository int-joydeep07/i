/* ============================================================
   sw.js
   Minimal service worker. Its main job is to exist and be
   registered so the browser treats Inta as an installable,
   notification-capable app. It also focuses/opens the app
   when a notification is tapped.
   ============================================================ */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("home.html");
    })
  );
});
