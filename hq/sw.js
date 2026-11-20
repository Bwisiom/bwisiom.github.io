// Service Worker de BWISIOM HQ MOBILE.
// - Guarda la "carcasa" de la app (pantalla de carga, iconos) para abrir sin conexión.
// - Los datos NO se guardan aquí: viven en la base de datos segura de BWISIOM HQ (claude.ai).
// - Preparado para notificaciones push: cuando exista un servidor Web Push (claves VAPID),
//   los avisos llegarán por el evento "push" y abrirán BWISIOM HQ al tocarlos.
const VERSION = "bwisiom-hq-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png", "./icons/maskable-512.png"];
const APP_URL = "https://claude.ai/artifact/VdJfCcvH4SEFDKABrrFVru";

self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  // Red primero (para recibir actualizaciones), caché si no hay conexión.
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("./index.html"))));
});
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { titulo: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titulo || "BWISIOM HQ", { body: d.cuerpo || "", icon: "icons/icon-192.png", badge: "icons/maskable-192.png", data: { url: APP_URL } }));
});
self.addEventListener("notificationclick", e => { e.notification.close(); e.waitUntil(clients.openWindow((e.notification.data && e.notification.data.url) || APP_URL)); });
