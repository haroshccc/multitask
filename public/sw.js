/* Multitask service worker — conservative PWA shell.
 *
 * Strategy:
 *   /assets/*  → cache-first (Vite emits content-hashed, immutable filenames)
 *   navigate   → network-first, falling back to the cached shell offline
 *   everything else (Supabase API, fonts, etc.) → untouched
 *
 * Bump VERSION to invalidate old caches on deploy-breaking changes.
 */
const VERSION = "v1";
const RUNTIME = `multitask-${VERSION}`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== RUNTIME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(RUNTIME).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME).then((cache) => cache.put("/index.html", copy));
          return res;
        })
        .catch(async () => {
          const shell = await caches.match("/index.html");
          return shell ?? Response.error();
        }),
    );
  }
});
