const CACHE_FIRST = "cache-first-v1";
const NETWORK_FIRST = "network-first-v1";
const API_CACHE_PATHS = ["/api/weeks/current", "/api/buckets"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_FIRST && k !== NETWORK_FIRST)
          .map((k) => caches.delete(k))
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (API_CACHE_PATHS.some((p) => url.pathname === p)) {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  const dest = request.destination;
  if (dest === "script" || dest === "style" || dest === "image" || dest === "font") {
    event.respondWith(cacheFirst(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_FIRST);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstWithFallback(request) {
  const cache = await caches.open(NETWORK_FIRST);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? Response.error();
  }
}

// PUSH_STUB: push event listener added in Iteration 2
