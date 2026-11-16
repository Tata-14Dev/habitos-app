import type { SyncFields } from './types'

/**
 * Last-write-wins: should the incoming `remote` record replace what we have locally?
 * Ties keep the local version (the same write coming back from the server).
 */
export function remoteWins(local: SyncFields | undefined, remote: SyncFields): boolean {
  if (!local) return true
  return remote.updatedAt > local.updatedAt
}
