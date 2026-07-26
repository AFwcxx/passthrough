const CACHE = "passthrough-v1";
self.addEventListener("install", (e) =>
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(["/", "/manifest.webmanifest", "/icon.svg"])),
  ),
);
self.addEventListener("fetch", (e) => {
  if (
    e.request.method === "GET" &&
    !new URL(e.request.url).pathname.startsWith("/api/")
  )
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
