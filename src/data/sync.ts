/**
 * Sync engine: local-first Dexie ⇄ Supabase `records` table.
 *
 * push: everything in the outbox → rpc('push_records') (server applies last-write-wins).
 * pull: rows with server_ts > cursor → merged locally with last-write-wins.
 *
 * Runs on sign-in, app start, when the connection comes back, when the app returns to the
 * foreground, a couple of seconds after each local change, and every minute while visible.
 */
import type { Session } from '@supabase/supabase-js'
import { db as defaultDb, type HabitosDB } from './db'
import { remoteWins } from './merge'
import { onLocalChange } from './store'
import { supabase } from './supabase'
import { COLLECTIONS, type CollectionName, type SyncFields } from './types'

export type SyncStatus = 'disabled' | 'signedOut' | 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncState {
  status: SyncStatus
  lastSyncAt?: string
  error?: string
  email?: string
}

const PUSH_CHUNK = 300
const PULL_PAGE = 1000
const CURSOR_OVERLAP_MS = 5_000

let state: SyncState = { status: supabase ? 'signedOut' : 'disabled' }
const subscribers = new Set<() => void>()

function setState(next: Partial<SyncState>) {
  state = { ...state, ...next }
  subscribers.forEach((s) => s())
}

export function getSyncState(): SyncState {
  return state
}

export function subscribeSync(fn: () => void): () => void {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

interface RemoteRow {
  collection: string
  id: string
  data: SyncFields
  server_ts: string
}

async function getMeta<T>(db: HabitosDB, key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

async function setMeta(db: HabitosDB, key: string, value: unknown) {
  await db.meta.put({ key, value })
}

async function push(db: HabitosDB) {
  const entries = await db.outbox.toArray()
  for (let i = 0; i < entries.length; i += PUSH_CHUNK) {
    const chunk = entries.slice(i, i + PUSH_CHUNK)
    const rows = []
    for (const e of chunk) {
      const rec = (await db.table(e.collection).get(e.id)) as SyncFields | undefined
      if (!rec) continue
      rows.push({
        collection: e.collection,
        id: e.id,
        data: rec,
        updated_at: rec.updatedAt,
        deleted_at: rec.deletedAt ?? '',
      })
    }
    if (rows.length) {
      const { error } = await supabase!.rpc('push_records', { rows })
      if (error) throw new Error(error.message)
    }
    // Drop outbox entries only if the record wasn't modified again while we were pushing.
    await db.transaction('rw', db.outbox, async () => {
      for (const e of chunk) {
        const current = await db.outbox.get(e.key)
        if (current && current.updatedAt === e.updatedAt) await db.outbox.delete(e.key)
      }
    })
  }
}

async function pull(db: HabitosDB) {
  let cursor = await getMeta<string>(db, 'pullCursor')
  let first = true
  for (;;) {
    let q = supabase!
      .from('records')
      .select('collection,id,data,server_ts')
      .order('server_ts', { ascending: true })
      .limit(PULL_PAGE)
    if (cursor) {
      // Small overlap on the first page only, to catch rows committed slightly out of order.
      const from = first ? new Date(new Date(cursor).getTime() - CURSOR_OVERLAP_MS).toISOString() : cursor
      q = q.gt('server_ts', from)
    }
    first = false
    const { data, error } = await q
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as RemoteRow[]
    await applyRemote(db, rows)
    if (rows.length) cursor = rows[rows.length - 1].server_ts
    await setMeta(db, 'pullCursor', cursor)
    if (rows.length < PULL_PAGE) break
  }
}

/** Merge remote rows into Dexie (exported for tests). */
export async function applyRemote(db: HabitosDB, rows: RemoteRow[]) {
  const known = new Set<string>(COLLECTIONS)
  const tables = COLLECTIONS.map((c) => db.table(c))
  await db.transaction('rw', [...tables, db.outbox], async () => {
    for (const row of rows) {
      if (!known.has(row.collection)) continue
      const table = db.table(row.collection as CollectionName)
      const local = (await table.get(row.id)) as SyncFields | undefined
      if (remoteWins(local, row.data)) {
        await table.put(row.data)
        // A pending local change that is older than what we just took is obsolete.
        const pending = await db.outbox.get(`${row.collection}|${row.id}`)
        if (pending && pending.updatedAt <= row.data.updatedAt) await db.outbox.delete(pending.key)
      }
    }
  })
}

let running: Promise<void> | null = null
let again = false

/** Push then pull. Concurrent calls coalesce into one extra run. */
export function syncNow(db: HabitosDB = defaultDb): Promise<void> {
  if (!supabase) return Promise.resolve()
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      const { data } = await supabase!.auth.getSession()
      if (!data.session) {
        setState({ status: 'signedOut' })
        return
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setState({ status: 'offline' })
        return
      }
      setState({ status: 'syncing', error: undefined })
      try {
        await push(db)
        await pull(db)
        setState({ status: 'idle', lastSyncAt: new Date().toISOString() })
      } catch (e) {
        setState({ status: navigator.onLine ? 'error' : 'offline', error: (e as Error).message })
        return
      }
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}

/**
 * Called when a session appears. If the local DB belongs to another account, wipe it first;
 * if it belongs to nobody (used before signing in), adopt it — it will be pushed.
 */
async function onSignedIn(session: Session, db: HabitosDB) {
  const owner = await getMeta<string>(db, 'ownerUserId')
  if (owner && owner !== session.user.id) await clearLocal(db)
  if (owner !== session.user.id) {
    await setMeta(db, 'ownerUserId', session.user.id)
    // Queue every existing record so data created offline before signing in gets uploaded.
    await db.transaction('rw', [...COLLECTIONS.map((c) => db.table(c)), db.outbox], async () => {
      for (const c of COLLECTIONS) {
        const recs = (await db.table(c).toArray()) as SyncFields[]
        await db.outbox.bulkPut(recs.map((r) => ({ key: `${c}|${r.id}`, collection: c, id: r.id, updatedAt: r.updatedAt })))
      }
    })
  }
  setState({ email: session.user.email ?? undefined, status: 'idle' })
  await syncNow(db)
}

export async function clearLocal(db: HabitosDB = defaultDb) {
  await db.transaction('rw', [...COLLECTIONS.map((c) => db.table(c)), db.outbox, db.meta], async () => {
    for (const c of COLLECTIONS) await db.table(c).clear()
    await db.outbox.clear()
    await db.meta.clear()
  })
}

let started = false
let debounce: ReturnType<typeof setTimeout> | undefined

/** Wire triggers. Call once at app start. */
export function startSync(db: HabitosDB = defaultDb) {
  if (!supabase || started) return
  started = true

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      setState({ status: 'signedOut', email: undefined })
      return
    }
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      // Defer: supabase-js warns against awaiting other auth calls inside this callback.
      setTimeout(() => void onSignedIn(session, db), 0)
    }
  })

  onLocalChange(() => {
    clearTimeout(debounce)
    debounce = setTimeout(() => void syncNow(db), 2_000)
  })
  window.addEventListener('online', () => void syncNow(db))
  window.addEventListener('offline', () => setState({ status: 'offline' }))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow(db)
  })
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow(db)
  }, 60_000)
}

// ─── Auth (email + password, no confirmation mail) ──────────────────────────

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'La sincronización no está configurada.'
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return error ? translateAuthError(error.message) : null
}

export async function signUp(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'La sincronización no está configurada.'
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return translateAuthError(error.message)
  if (!data.session) {
    return 'La cuenta se creó pero Supabase pide confirmar el mail. Desactivá "Confirm email" en Authentication → Providers → Email y volvé a entrar.'
  }
  return null
}

/** Signs out and wipes this device's local copy (everything is already on the server). */
export async function signOut(db: HabitosDB = defaultDb): Promise<string | null> {
  if (!supabase) return null
  await syncNow(db)
  if ((await db.outbox.count()) > 0) {
    return 'Hay cambios sin subir. Conectate a internet y probá de nuevo para no perderlos.'
  }
  await supabase.auth.signOut()
  await clearLocal(db)
  return null
}

function translateAuthError(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'Mail o contraseña incorrectos.'
  if (/already registered/i.test(msg)) return 'Ya existe una cuenta con ese mail. Iniciá sesión.'
  if (/password should be at least/i.test(msg)) return 'La contraseña tiene que tener al menos 6 caracteres.'
  if (/fetch|network/i.test(msg)) return 'Sin conexión. Probá de nuevo cuando tengas internet.'
  return msg
}
