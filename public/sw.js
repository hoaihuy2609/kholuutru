self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => caches.delete(cacheName))
            );
        }).then(() => {
            self.clients.claim();
            return self.registration.unregister();
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Do nothing, bypass cache completely
    return;
});
