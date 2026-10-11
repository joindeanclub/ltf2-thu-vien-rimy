/* Service worker: lưu sẵn giao diện và văn bản đã mở để dùng khi mất mạng (dữ liệu việc nằm trong localStorage). */
var CACHE = "ltf2-v4";
var FILES = ["./", "index.html", "css/app.css", "js/app.js", "data/documents.json", "data/workflows.json",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];
var CDN = ["cdnjs.cloudflare.com"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.origin !== location.origin && CDN.indexOf(u.hostname) < 0) return;
  e.respondWith(
    fetch(e.request).then(function (r) {
      if (r && (r.ok || r.type === "opaque")) { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
      return r;
    }).catch(function () { return caches.match(e.request); })
  );
});


