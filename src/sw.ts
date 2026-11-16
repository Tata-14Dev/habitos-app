/// <reference lib="webworker" />
/**
 * Service worker: precaches the whole app (works fully offline) and serves index.html for
 * every navigation (SPA routes). Push notification handlers are added in the reminders step.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

self.skipWaiting()
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))
