/** Thrown by the learning-mode templates in `schedule.ts` until Tomás implements them. */
export class NotImplementedError extends Error {
  readonly fnName: string
  constructor(fnName: string) {
    super(`NotImplemented: ${fnName} (ver docs/GUIA_REPROGRAMACION.md)`)
    this.name = 'NotImplementedError'
    this.fnName = fnName
  }
}

export function isNotImplemented(e: unknown): e is NotImplementedError {
  return e instanceof NotImplementedError || (e instanceof Error && e.name === 'NotImplementedError')
}

export type Safe<T> =
  | { ok: true; value: T }
  | { ok: false; notImplemented: string }
  | { ok: false; error: Error }

/**
 * Runs `fn` and never throws: lets the UI show "🛠️ Pendiente: implementá X"
 * instead of crashing while `schedule.ts` is still a template.
 */
export function safeCall<T>(fn: () => T): Safe<T> {
  try {
    return { ok: true, value: fn() }
  } catch (e) {
    if (isNotImplemented(e)) return { ok: false, notImplemented: (e as NotImplementedError).fnName }
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) }
  }
}
