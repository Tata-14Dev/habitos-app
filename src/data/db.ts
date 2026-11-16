import Dexie, { type Table } from 'dexie'
import type { CollectionMap, CollectionName } from './types'

/** A local change not yet pushed to the server. */
export interface OutboxEntry {
  /** `${collection}|${id}` */
  key: string
  collection: CollectionName
  id: string
  /** updatedAt of the record when queued; lets sync drop the entry only if nothing changed since. */
  updatedAt: string
}

export interface MetaEntry {
  key: string
  value: unknown
}

export class HabitosDB extends Dexie {
  habits!: Table<CollectionMap['habits'], string>
  habitLogs!: Table<CollectionMap['habitLogs'], string>
  dayMoods!: Table<CollectionMap['dayMoods'], string>
  plans!: Table<CollectionMap['plans'], string>
  planItems!: Table<CollectionMap['planItems'], string>
  milestones!: Table<CollectionMap['milestones'], string>
  projections!: Table<CollectionMap['projections'], string>
  tasks!: Table<CollectionMap['tasks'], string>
  settings!: Table<CollectionMap['settings'], string>
  pushSubscriptions!: Table<CollectionMap['pushSubscriptions'], string>
  outbox!: Table<OutboxEntry, string>
  meta!: Table<MetaEntry, string>

  constructor(name = 'habitos') {
    super(name)
    this.version(1).stores({
      habits: 'id, order, updatedAt',
      habitLogs: 'id, habitId, date, updatedAt',
      dayMoods: 'id, date, updatedAt',
      plans: 'id, updatedAt',
      planItems: 'id, planId, [planId+order], doneDate, updatedAt',
      milestones: 'id, planId, updatedAt',
      projections: 'id',
      tasks: 'id, date, updatedAt',
      settings: 'id',
      pushSubscriptions: 'id',
      outbox: 'key, collection',
      meta: 'key',
    })
  }

  table_<C extends CollectionName>(c: C): Table<CollectionMap[C], string> {
    return this.table(c) as Table<CollectionMap[C], string>
  }
}

export const db = new HabitosDB()
