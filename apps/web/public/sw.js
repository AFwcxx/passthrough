const CACHE = "passthrough-v1";
self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const response = await fetch("/");
      const html = await response.clone().text();
      // ponytail: Vite emits quoted root-relative assets; use its build manifest if that changes.
      const assets = [...html.matchAll(/\b(?:src|href)="(\/[^"]+)"/g)].map(
        (match) => match[1],
      );
      await cache.put("/", response);
      await cache.addAll([
        ...new Set(["/manifest.webmanifest", "/icon.svg", ...assets]),
      ]);
    })(),
  );
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/"))
    return;
  e.respondWith(
    e.request.mode === "navigate"
      ? fetch(e.request)
          .then(async (response) => {
            if (response.ok)
              await (await caches.open(CACHE)).put("/", response.clone());
            return response;
          })
          .catch(() => caches.match("/"))
      : caches.match(e.request).then(async (cached) => {
          if (cached) return cached;
          const response = await fetch(e.request);
          if (response.ok)
            await (await caches.open(CACHE)).put(e.request, response.clone());
          return response;
        }),
  );
});
