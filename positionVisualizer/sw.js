// Empty service worker to prevent 404 errors
// This file exists only to satisfy browser requests for service worker registration
// No actual service worker functionality is implemented

self.addEventListener('install', (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all pages immediately
  event.waitUntil(self.clients.claim());
});

// No fetch handler - all requests pass through normally

