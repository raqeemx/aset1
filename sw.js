/**
 * Service Worker for Government Asset Inventory System
 * Enables offline functionality and caching
 */

const CACHE_NAME = 'asset-inventory-v5';
const OFFLINE_URL = 'offline.html';

// Assets to cache immediately (with and without leading slash for compatibility)
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    'index.html',
    '/css/style.css',
    'css/style.css',
    '/js/app.js',
    'js/app.js',
    '/manifest.json',
    'manifest.json',
    '/offline.html',
    'offline.html'
];

// External resources to cache
const EXTERNAL_ASSETS = [
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/@ericblade/quagga2@1.8.4/dist/quagga.min.js',
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching app shell');
                
                // Cache local assets
                return cache.addAll(PRECACHE_ASSETS)
                    .then(() => {
                        // Try to cache external assets (don't fail if they don't work)
                        return Promise.allSettled(
                            EXTERNAL_ASSETS.map(url => 
                                cache.add(url).catch(err => {
                                    console.warn(`[Service Worker] Failed to cache: ${url}`, err);
                                })
                            )
                        );
                    });
            })
            .then(() => {
                console.log('[Service Worker] Install complete');
                return self.skipWaiting();
            })
            .catch((err) => {
                console.error('[Service Worker] Install failed:', err);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[Service Worker] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[Service Worker] Activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Handle API requests differently
    if (url.pathname.startsWith('/tables/') || url.pathname.startsWith('tables/')) {
        event.respondWith(handleApiRequest(request));
        return;
    }
    
    // Handle other requests with cache-first strategy
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached response and update cache in background
                    fetchAndCache(request);
                    return cachedResponse;
                }
                
                // Not in cache, fetch from network
                return fetchAndCache(request);
            })
            .catch(() => {
                // If both cache and network fail, show offline page
                if (request.mode === 'navigate') {
                    return caches.match(OFFLINE_URL);
                }
                
                // Return a simple error response for other requests
                return new Response('Offline', { status: 503 });
            })
    );
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        return networkResponse;
    } catch (error) {
        // Network failed, return error (data is handled by IndexedDB in app)
        return new Response(
            JSON.stringify({ error: 'Offline', message: 'Network unavailable' }),
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

// Fetch from network and cache
async function fetchAndCache(request) {
    try {
        const networkResponse = await fetch(request);
        
        // Only cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Network failed, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        throw error;
    }
}

// Handle background sync
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Sync event:', event.tag);
    
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

// Sync data when online
async function syncData() {
    console.log('[Service Worker] Syncing data...');
    
    // Notify all clients to sync
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({
            type: 'SYNC_REQUESTED'
        });
    });
}

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push received');
    
    const options = {
        body: event.data ? event.data.text() : 'إشعار جديد',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now()
        },
        dir: 'rtl',
        lang: 'ar'
    };
    
    event.waitUntil(
        self.registration.showNotification('نظام جرد الأصول', options)
    );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification clicked');
    
    event.notification.close();
    
    event.waitUntil(
        self.clients.matchAll({ type: 'window' })
            .then((clientList) => {
                // Focus existing window or open new one
                for (const client of clientList) {
                    if (client.url === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                if (self.clients.openWindow) {
                    return self.clients.openWindow('/');
                }
            })
    );
});

// Listen for messages from clients
self.addEventListener('message', (event) => {
    console.log('[Service Worker] Message received:', event.data);
    
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data.type === 'CACHE_URLS') {
        event.waitUntil(
            caches.open(CACHE_NAME)
                .then((cache) => cache.addAll(event.data.urls))
        );
    }
});

// Periodic background sync (for future use)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'sync-assets') {
        event.waitUntil(syncData());
    }
});
