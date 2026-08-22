/* Murmur service worker — Web Push only (no fetch handler, so it won't affect the OCEAN app). */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (_) {}
  const title = d.title || "Murmur";
  const options = {
    body: d.body || "",
    icon: d.icon || "/icon.png",
    badge: d.badge || "/icon.png",
    tag: d.tag,
    data: { url: d.url || "/Murmur.dc.html", taskId: d.taskId || null },
    actions: [
      { action: "done", title: "เสร็จแล้ว" },
      { action: "snooze", title: "เลื่อน 10 นาที" },
    ],
    requireInteraction: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let target = data.url || "/Murmur.dc.html";
  // carry the tapped action + task id back to the app so it can apply it after focus
  if (event.action && data.taskId) {
    const sep = target.includes("?") ? "&" : "?";
    target += `${sep}action=${event.action}&task=${encodeURIComponent(data.taskId)}`;
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes("Murmur") && "focus" in w) {
          w.postMessage({ type: "notification-action", action: event.action, taskId: data.taskId });
          return w.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
