/**
 * Demo mode: a separate local database filled with sample data, with sync turned off.
 * Turned on with `?demo=1` (remembered on the device) and off with `?demo=0` or "Salir".
 * Decided once at startup: switching modes reloads the page.
 */
const KEY = 'demo'

function readFlag(): boolean {
  try {
    if (typeof window === 'undefined') return false
    const url = new URL(window.location.href)
    const param = url.searchParams.get('demo')
    if (param !== null) {
      if (param === '0') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, '1')
      url.searchParams.delete('demo')
      window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    }
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export const DEMO = readFlag()

export const DEMO_DB_NAME = 'habitos-demo'

export function enterDemo() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // private mode without storage: the URL param still works for this visit
  }
  window.location.assign('/?demo=1')
}

export function exitDemo() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
  // Drop the sample database so the next demo starts fresh with dates relative to that day.
  const req = indexedDB.deleteDatabase(DEMO_DB_NAME)
  const go = () => window.location.assign('/')
  req.onsuccess = go
  req.onerror = go
  req.onblocked = go
}
