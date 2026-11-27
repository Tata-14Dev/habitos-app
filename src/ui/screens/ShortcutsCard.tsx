/**
 * "Atajos": links that open the app straight into an action. On Android and desktop the same
 * actions show up when you long-press the app icon (manifest `shortcuts`); on iPhone they go in
 * the Shortcuts app ("Abrir URL"), which Siri can also run.
 */
import { useState } from 'react'
import { isOneOff } from '../../domain/habits'
import { Card, SectionTitle } from '../components'
import { useHabits } from '../hooks'
import { t } from '../i18n'

function CopyRow({ label, path }: { label: string; path: string }) {
  const url = `${location.origin}${path}`
  const [copied, setCopied] = useState(false)
  return (
    <li className="flex items-center gap-2 py-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        <span className="block truncate font-mono text-xs text-ink-soft dark:text-neutral-400">{url}</span>
      </span>
      <button
        type="button"
        className="min-h-11 rounded-xl bg-paper px-3 text-sm dark:bg-neutral-700"
        aria-label={t('Copiar enlace de {name}', { name: label })}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          } catch {
            prompt(t('Copiá este enlace:'), url)
          }
        }}
      >
        {copied ? t('¡Copiado!') : t('Copiar')}
      </button>
    </li>
  )
}

export function ShortcutsCard() {
  const habits = useHabits()
  const list = (habits ?? []).filter((h) => !isOneOff(h))
  return (
    <Card>
      <SectionTitle>{t('Atajos')}</SectionTitle>
      <details>
        <summary className="cursor-pointer text-sm">{t('Marcá un hábito o dictá sin abrir la app primero.')}</summary>
        <div className="mt-2 space-y-2 text-sm text-ink-soft dark:text-neutral-400">
          <p>{t('Android o compu: mantené apretado el ícono de la app instalada y elegí «Dictar tareas», «Hábitos» o «Estadísticas».')}</p>
          <p>
            {t('iPhone: en la app Atajos creá uno con la acción «Abrir URL» y pegá un enlace de acá. Podés ponerlo en la pantalla de inicio o pedírselo a Siri. Se abre en Safari: iniciá sesión ahí también para que se sincronice.')}
          </p>
          <p>{t('Con un enlace de hábito, la app lo marca como hecho hoy apenas se abre (con «Deshacer»). También sirve como código QR pegado donde hacés el hábito.')}</p>
        </div>
        <ul className="mt-2 divide-y divide-line dark:divide-neutral-700">
          <CopyRow label={t('🎤 Dictar tareas')} path="/?dictar=1" />
          {list.map((h) => (
            <CopyRow key={h.id} label={`${h.emoji ? h.emoji + ' ' : ''}${t('Marcar {name}', { name: h.name })}`} path={`/marcar/${h.id}`} />
          ))}
        </ul>
      </details>
    </Card>
  )
}
