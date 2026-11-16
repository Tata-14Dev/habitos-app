/**
 * Web Push subscription. On iOS this only works when the app was added to the home screen
 * (iOS 16.4+) and permission is requested from a user tap.
 */
import { db } from './db'
import { updateSettings } from './repo'
import { store } from './store'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type PushSupport =
  | { ok: true }
  | { ok: false; reason: 'no-key' | 'ios-not-installed' | 'unsupported' | 'denied' }

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

export function pushSupport(): PushSupport {
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: 'no-key' }
  if (isIOS() && !isStandalone()) return { ok: false, reason: 'ios-not-installed' }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { ok: false, reason: 'unsupported' }
  }
  if (Notification.permission === 'denied') return { ok: false, reason: 'denied' }
  return { ok: true }
}

function base64UrlToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function subscriptionId(endpoint: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

/** Must be called from a click/tap handler. Returns an error message or null. */
export async function enablePush(): Promise<string | null> {
  const support = pushSupport()
  if (!support.ok) return support.reason
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY!) }))
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  await store.put('pushSubscriptions', {
    id: await subscriptionId(json.endpoint),
    endpoint: json.endpoint,
    keys: json.keys,
    userAgent: navigator.userAgent,
  })
  await updateSettings({ reminderEnabled: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
  return null
}

/** Turns reminders off for the account and unsubscribes this device. */
export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker?.ready
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    const id = await subscriptionId(sub.endpoint)
    if (await db.pushSubscriptions.get(id)) await store.softDelete('pushSubscriptions', [id])
    await sub.unsubscribe()
  }
  await updateSettings({ reminderEnabled: false })
}

/** Is THIS device subscribed? */
export async function thisDeviceSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false
  const reg = await navigator.serviceWorker.getRegistration()
  return !!(await reg?.pushManager.getSubscription())
}
