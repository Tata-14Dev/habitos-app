import { db } from './db'
import { store } from './store'
import { COLLECTIONS, type CollectionMap, type CollectionName } from './types'

export interface BackupFile {
  app: 'habitos'
  version: 1
  exportedAt: string
  data: Partial<{ [C in CollectionName]: CollectionMap[C][] }>
}

/** Everything that isn't deleted, as a JSON-serializable object. */
export async function exportBackup(): Promise<BackupFile> {
  const data: BackupFile['data'] = {}
  for (const c of COLLECTIONS) {
    if (c === 'pushSubscriptions') continue // device-specific
    const rows = (await db.table(c).toArray()) as { deletedAt?: string }[]
    ;(data as Record<string, unknown[]>)[c] = rows.filter((r) => !r.deletedAt)
  }
  return { app: 'habitos', version: 1, exportedAt: new Date().toISOString(), data }
}

/**
 * Restores a backup: every record in the file is written as a NEW change (fresh updatedAt),
 * so it also wins on the server and reaches the other devices. Records not in the file are kept.
 */
export async function importBackup(json: unknown): Promise<number> {
  const file = json as BackupFile
  if (!file || file.app !== 'habitos' || typeof file.data !== 'object') {
    throw new Error('El archivo no es un respaldo de Hábitos.')
  }
  let n = 0
  for (const c of COLLECTIONS) {
    const rows = file.data[c]
    if (!Array.isArray(rows) || c === 'pushSubscriptions') continue
    await store.putMany(c, rows.map((r) => ({ ...r, deletedAt: undefined })) as never)
    n += rows.length
  }
  return n
}

export function downloadFile(name: string, content: string, mime = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
