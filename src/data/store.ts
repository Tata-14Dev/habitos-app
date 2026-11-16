/**
 * Low-level local writes. Every write stamps `updatedAt` and queues the record in the outbox,
 * so the sync engine can push it later. The UI never talks to Dexie directly: it goes through
 * `repo.ts`, which is built on these helpers.
 */
import type { HabitosDB } from './db'
import { db as defaultDb } from './db'
import type { CollectionMap, CollectionName } from './types'

type Listener = () => void
const listeners = new Set<Listener>()

/** Called after any local write (the sync engine uses it to schedule a push). */
export function onLocalChange(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function newId(): string {
  return crypto.randomUUID()
}

/**
 * Strictly increasing timestamp: two writes in the same millisecond still get different
 * `updatedAt`, so last-write-wins never ties between them.
 */
let lastStamp = 0
export function nowStamp(): string {
  const t = Math.max(Date.now(), lastStamp + 1)
  lastStamp = t
  return new Date(t).toISOString()
}

type Input<C extends CollectionName> = Omit<CollectionMap[C], 'updatedAt'> & { updatedAt?: string }

export function createStore(db: HabitosDB = defaultDb) {
  async function putMany<C extends CollectionName>(collection: C, records: Input<C>[]): Promise<CollectionMap[C][]> {
    const stamped = records.map((r) => ({ ...r, updatedAt: nowStamp() }) as CollectionMap[C])
    await db.transaction('rw', db.table(collection), db.outbox, async () => {
      await db.table_(collection).bulkPut(stamped)
      await db.outbox.bulkPut(
        stamped.map((r) => ({ key: `${collection}|${r.id}`, collection, id: r.id, updatedAt: r.updatedAt })),
      )
    })
    listeners.forEach((l) => l())
    return stamped
  }

  async function put<C extends CollectionName>(collection: C, record: Input<C>): Promise<CollectionMap[C]> {
    const [r] = await putMany(collection, [record])
    return r
  }

  /** Merge `patch` into an existing record. No-op if it doesn't exist. */
  async function patch<C extends CollectionName>(
    collection: C,
    id: string,
    changes: Partial<CollectionMap[C]>,
  ): Promise<CollectionMap[C] | undefined> {
    const current = await db.table_(collection).get(id)
    if (!current) return undefined
    return put(collection, { ...current, ...changes, id } as Input<C>)
  }

  async function softDelete<C extends CollectionName>(collection: C, ids: string[]): Promise<void> {
    const current = (await db.table_(collection).bulkGet(ids)).filter(Boolean) as CollectionMap[C][]
    const deletedAt = new Date().toISOString()
    await putMany(collection, current.map((r) => ({ ...r, deletedAt })))
  }

  return { put, putMany, patch, softDelete }
}

export const store = createStore()
