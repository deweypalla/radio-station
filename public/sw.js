/* global self */
/**
 * Minimal service worker for PWA install / update lifecycle.
 * Fetch goes to the network only — avoids stale OAuth, APIs, and HTML.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
