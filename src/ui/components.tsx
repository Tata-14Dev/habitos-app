import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { t } from './i18n'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-2xl bg-white p-5 shadow-sm dark:bg-neutral-800', className)}>{children}</section>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft dark:text-neutral-400">{children}</h2>
      {right}
    </div>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'soft' }

export function Button({ variant = 'soft', className, ...props }: BtnProps) {
  return (
    <button
      {...props}
      className={cx(
        'min-h-11 rounded-xl px-4 py-2 text-base font-medium transition active:scale-[0.98] disabled:opacity-50',
        variant === 'primary' && 'bg-progress text-white dark:text-neutral-900',
        variant === 'soft' && 'bg-paper text-ink dark:bg-neutral-700 dark:text-neutral-100',
        variant === 'ghost' && 'text-ink-soft dark:text-neutral-300',
        variant === 'danger' && 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
        className,
      )}
    />
  )
}

/** Big one-tap check (≥ 44 px). */
export function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'grid size-11 shrink-0 place-items-center rounded-xl border-2 text-xl transition active:scale-95',
        checked
          ? 'border-progress bg-progress text-white dark:text-neutral-900'
          : 'border-line bg-white dark:border-neutral-600 dark:bg-neutral-800',
      )}
    >
      {checked ? '✓' : ''}
    </button>
  )
}

/** Thin progress bar. `value` in [0, 1] or null. */
export function ProgressBar({ value, color = 'bg-progress' }: { value: number | null; color?: string }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value)) * 100
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line dark:bg-neutral-700">
      <div className={cx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

/** "🛠️ Pendiente: implementá `X`" — shown while schedule.ts is a template. */
export function PendingNotice({ fns }: { fns: string[] }) {
  if (!fns.length) return null
  return (
    <div className="rounded-xl border border-dashed border-amber-400 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200">
      {t('🛠️ Pendiente: implementá')}{' '}
      {fns.map((f, i) => (
        <span key={f}>
          <code className="font-mono font-semibold">{f}</code>
          {i < fns.length - 1 ? ', ' : ''}
        </span>
      ))}{' '}
      ({t('ver')} <code className="font-mono">docs/GUIA_REPROGRAMACION.md</code>)
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-ink-soft dark:text-neutral-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft dark:text-neutral-500">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'w-full min-h-11 rounded-xl border border-line bg-white px-3 py-2 text-base text-ink outline-none focus:border-progress dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100'

/** Collapsible group for secondary fields ("Más opciones"). Native <details>: accessible, no state. */
export function MoreOptions({ children, summary = t('Más opciones'), hint }: { children: ReactNode; summary?: string; hint?: string }) {
  return (
    <details className="group rounded-xl bg-paper px-3 dark:bg-neutral-900">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span>
          {summary}
          {hint && <span className="block text-xs font-normal text-ink-soft dark:text-neutral-400">{hint}</span>}
        </span>
        <span className="text-ink-soft dark:text-neutral-400 transition group-open:rotate-180" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="space-y-4 pb-4 pt-1">{children}</div>
    </details>
  )
}

/** Bottom sheet / modal. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-0 mt-auto w-full max-w-none rounded-t-3xl bg-white p-0 text-ink backdrop:bg-black/40 sm:m-auto sm:max-w-lg sm:rounded-3xl dark:bg-neutral-800 dark:text-neutral-100"
    >
      <div className="max-h-[85dvh] overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button variant="ghost" onClick={onClose} aria-label={t('Cerrar')}>
            ✕
          </Button>
        </div>
        {open && children}
      </div>
    </dialog>
  )
}

/** 0–10 selector with big targets; tap the selected value again to clear. */
export function Scale({ value, onChange, color }: { value?: number; onChange: (v: number | undefined) => void; color: string }) {
  return (
    <div className="grid grid-cols-11 gap-1">
      {Array.from({ length: 11 }, (_, n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? undefined : n)}
          className={cx(
            'h-10 rounded-lg text-sm font-medium transition',
            value === n ? `${color} text-white dark:text-neutral-900` : 'bg-paper dark:bg-neutral-700',
          )}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-4 text-center text-sm text-ink-soft dark:text-neutral-400">{children}</p>
}
