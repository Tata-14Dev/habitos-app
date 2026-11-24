import { useEffect, useState } from 'react'
import { disablePush, enablePush, isIOS, pushSupport, thisDeviceSubscribed } from '../../data/push'
import { updateSettings } from '../../data/repo'
import { syncConfigured } from '../../data/supabase'
import { Button, Card, inputCls, SectionTitle } from '../components'
import { useSettings, useSyncState } from '../hooks'

const REASONS: Record<string, string> = {
  'no-key': 'Falta configurar la clave de notificaciones (VITE_VAPID_PUBLIC_KEY). Ver README.',
  'ios-not-installed':
    'En iPhone las notificaciones solo funcionan con la app instalada: en Safari tocá Compartir → "Agregar a pantalla de inicio" y abrila desde el ícono.',
  unsupported: 'Este navegador no soporta notificaciones push.',
  denied: 'Las notificaciones están bloqueadas. Habilitalas en Ajustes del sistema → Notificaciones → Hábitos.',
}

export function RemindersCard() {
  const settings = useSettings()
  const sync = useSyncState()
  const [here, setHere] = useState<boolean | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const support = pushSupport()
  const signedIn = syncConfigured && sync.status !== 'signedOut' && sync.status !== 'disabled'

  useEffect(() => {
    void thisDeviceSubscribed().then(setHere)
  }, [settings.reminderEnabled])

  return (
    <Card>
      <SectionTitle>Recordatorio de la mañana</SectionTitle>
      <p className="mb-3 text-sm text-ink-soft dark:text-neutral-400">
        Una notificación por día con tus tareas, lo que toca de cada plan y los hábitos.
      </p>
      <label className="flex min-h-11 items-center justify-between gap-3">
        <span>Hora</span>
        <input
          type="time"
          className={inputCls + ' max-w-32'}
          value={settings.reminderTime}
          onChange={(e) => e.target.value && void updateSettings({ reminderTime: e.target.value })}
        />
      </label>

      {!signedIn ? (
        <p className="mt-3 text-sm">Iniciá sesión arriba para activar los recordatorios (los manda el servidor).</p>
      ) : !support.ok ? (
        <p className="mt-3 text-sm">{REASONS[support.reason]}</p>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-sm">
            {settings.reminderEnabled
              ? here
                ? `✅ Activado en este dispositivo, todos los días a las ${settings.reminderTime}.`
                : `Activado en tu cuenta, pero no en este dispositivo.`
              : 'Desactivado.'}
          </p>
          {!here ? (
            <Button
              variant="primary"
              className="w-full"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                const err = await enablePush()
                setBusy(false)
                setMsg(err ? REASONS[err] ?? err : '✅ Listo. Mañana a las ' + settings.reminderTime + ' te llega el primero.')
                setHere(await thisDeviceSubscribed())
              }}
            >
              🔔 Activar en este dispositivo
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={async () => {
                await disablePush()
                setHere(false)
                setMsg('Recordatorios desactivados.')
              }}
            >
              Desactivar
            </Button>
          )}
        </div>
      )}
      {signedIn && support.ok && (
        <label className="mt-3 flex min-h-11 items-center justify-between gap-3 border-t border-line pt-3 dark:border-neutral-700">
          <span>
            Resumen semanal
            <span className="block text-xs text-ink-soft dark:text-neutral-400">Los domingos a las 20: hábitos, planes y peso de la semana.</span>
          </span>
          <input
            type="checkbox"
            className="size-5 accent-progress"
            checked={settings.weeklySummary ?? settings.reminderEnabled}
            onChange={(e) => void updateSettings({ weeklySummary: e.target.checked })}
          />
        </label>
      )}
      {msg && <p className="mt-2 text-sm">{msg}</p>}
      {isIOS() && <p className="mt-2 text-xs text-ink-soft">Requiere iOS 16.4 o posterior.</p>}
    </Card>
  )
}
