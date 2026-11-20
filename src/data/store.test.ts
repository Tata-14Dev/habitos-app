import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { HabitosDB } from './db'
import { remoteWins } from './merge'
import { createStore } from './store'
import { applyRemote } from './sync'

let db: HabitosDB
let store: ReturnType<typeof createStore>

beforeEach(async () => {
  db = new HabitosDB(`test-${Math.random()}`)
  await db.open()
  store = createStore(db)
})

describe('remoteWins (last-write-wins)', () => {
  it('gana el más nuevo; empate gana el local', () => {
    expect(remoteWins(undefined, { id: 'a', updatedAt: '2026-01-01T00:00:00.000Z' })).toBe(true)
    expect(remoteWins({ id: 'a', updatedAt: '2026-01-02T00:00:00.000Z' }, { id: 'a', updatedAt: '2026-01-01T00:00:00.000Z' })).toBe(false)
    expect(remoteWins({ id: 'a', updatedAt: '2026-01-01T00:00:00.000Z' }, { id: 'a', updatedAt: '2026-01-02T00:00:00.000Z' })).toBe(true)
    expect(remoteWins({ id: 'a', updatedAt: '2026-01-01T00:00:00.000Z' }, { id: 'a', updatedAt: '2026-01-01T00:00:00.000Z' })).toBe(false)
  })
})

describe('store', () => {
  it('cada escritura sella updatedAt y queda en el outbox', async () => {
    const t = await store.put('tasks', { id: 't1', date: '2026-11-16', title: 'Dentista', done: false, order: 0 })
    expect(t.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(await db.outbox.get('tasks|t1')).toMatchObject({ collection: 'tasks', id: 't1', updatedAt: t.updatedAt })
  })
  it('updatedAt siempre crece, aunque sea el mismo milisegundo', async () => {
    const a = await store.put('tasks', { id: 't1', date: '2026-11-16', title: 'A', done: false, order: 0 })
    const b = await store.patch('tasks', 't1', { done: true })
    expect(b!.updatedAt > a.updatedAt).toBe(true)
  })
  it('softDelete marca deletedAt en vez de borrar', async () => {
    await store.put('tasks', { id: 't1', date: '2026-11-16', title: 'A', done: false, order: 0 })
    await store.softDelete('tasks', ['t1'])
    expect((await db.tasks.get('t1'))?.deletedAt).toBeTruthy()
  })
})

describe('applyRemote', () => {
  const remote = (id: string, updatedAt: string, title: string) => ({
    collection: 'tasks',
    id,
    server_ts: updatedAt,
    data: { id, updatedAt, date: '2026-11-16', title, done: false, order: 0 },
  })

  it('trae registros nuevos sin meterlos al outbox', async () => {
    await applyRemote(db, [remote('t1', '2026-11-16T10:00:00.000Z', 'Del teléfono')])
    expect((await db.tasks.get('t1'))?.title).toBe('Del teléfono')
    expect(await db.outbox.count()).toBe(0)
  })
  it('no pisa un cambio local más nuevo', async () => {
    const local = await store.put('tasks', { id: 't1', date: '2026-11-16', title: 'Local', done: false, order: 0 })
    await applyRemote(db, [remote('t1', '2000-01-01T00:00:00.000Z', 'Viejo')])
    expect((await db.tasks.get('t1'))?.title).toBe('Local')
    expect(await db.outbox.get('tasks|t1')).toMatchObject({ updatedAt: local.updatedAt })
  })
  it('un remoto más nuevo reemplaza al local y descarta el pendiente viejo', async () => {
    await store.put('tasks', { id: 't1', date: '2026-11-16', title: 'Local', done: false, order: 0 })
    await applyRemote(db, [remote('t1', '2999-01-01T00:00:00.000Z', 'Nuevo')])
    expect((await db.tasks.get('t1'))?.title).toBe('Nuevo')
    expect(await db.outbox.get('tasks|t1')).toBeUndefined()
  })
  it('ignora colecciones desconocidas', async () => {
    await applyRemote(db, [{ ...remote('x', '2026-11-16T10:00:00.000Z', 'x'), collection: 'nope' }])
    expect(await db.tasks.count()).toBe(0)
  })
})

describe('customFoods (v4)', () => {
  it('la tabla existe y se sincroniza como las demás', async () => {
    expect(db.verno).toBeGreaterThanOrEqual(4)
    await store.put('customFoods', { id: 'c1', name: 'Tarta de la abuela', kcalPerUnit: 450 })
    expect(await db.customFoods.get('c1')).toMatchObject({ name: 'Tarta de la abuela', kcalPerUnit: 450 })
    expect(await db.outbox.get('customFoods|c1')).toMatchObject({ collection: 'customFoods' })
  })
})
