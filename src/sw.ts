/// <reference lib="webworker" />
/**
 * Service worker: precaches the whole app (works fully offline) and serves index.html for
 * every navigation (SPA routes). Also shows the morning reminder push notifications.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

self.skipWaiting()
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// ─── Push notifications (morning reminder) ──────────────────────────────────

self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string } = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { body: event.data?.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Hábitos', {
      body: data.body ?? '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      tag: 'morning-reminder',
      data: { url: data.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/'
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const win = wins[0] as WindowClient | undefined
      if (win) {
        await win.focus()
        await win.navigate(url).catch(() => undefined)
      } else {
        await self.clients.openWindow(url)
      }
    })(),
  )
})
