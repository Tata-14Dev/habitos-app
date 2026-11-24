import { useEffect, useState } from 'react'
import { disablePush, enablePush, isIOS, pushSupport, thisDeviceSubscribed } from '../../data/push'
import { updateSettings } from '../../data/repo'
import { syncConfigured } from '../../data/supabase'
import { Button, Card, inputCls, SectionTitle } from '../components'
import { useSettings, useSyncState } from '../hooks'
import { t } from '../i18n'

const REASONS: Record<string, string> = {
  'no-key': t('Falta configurar la clave de notificaciones (VITE_VAPID_PUBLIC_KEY). Ver README.'),
  'ios-not-installed':
    t('En iPhone las notificaciones solo funcionan con la app instalada: en Safari tocá Compartir → "Agregar a pantalla de inicio" y abrila desde el ícono.'),
  unsupported: t('Este navegador no soporta notificaciones push.'),
  denied: t('Las notificaciones están bloqueadas. Habilitalas en Ajustes del sistema → Notificaciones → Hábitos.'),
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
      <SectionTitle>{t('Recordatorio de la mañana')}</SectionTitle>
      <p className="mb-3 text-sm text-ink-soft dark:text-neutral-400">
        {t('Una notificación por día con tus tareas, lo que toca de cada plan y los hábitos.')}
      </p>
      <label className="flex min-h-11 items-center justify-between gap-3">
        <span>{t('Hora')}</span>
        <input
          type="time"
          className={inputCls + ' max-w-32'}
          value={settings.reminderTime}
          onChange={(e) => e.target.value && void updateSettings({ reminderTime: e.target.value })}
        />
      </label>

      {!signedIn ? (
        <p className="mt-3 text-sm">{t('Iniciá sesión arriba para activar los recordatorios (los manda el servidor).')}</p>
      ) : !support.ok ? (
        <p className="mt-3 text-sm">{REASONS[support.reason]}</p>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-sm">
            {settings.reminderEnabled
              ? here
                ? t('✅ Activado en este dispositivo, todos los días a las {time}.', { time: settings.reminderTime })
                : t('Activado en tu cuenta, pero no en este dispositivo.')
              : t('Desactivado.')}
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
                setMsg(err ? REASONS[err] ?? err : t('✅ Listo. Mañana a las {time} te llega el primero.', { time: settings.reminderTime }))
                setHere(await thisDeviceSubscribed())
              }}
            >
              {t('🔔 Activar en este dispositivo')}
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={async () => {
                await disablePush()
                setHere(false)
                setMsg(t('Recordatorios desactivados.'))
              }}
            >
              {t('Desactivar')}
            </Button>
          )}
        </div>
      )}
      {signedIn && support.ok && (
        <label className="mt-3 flex min-h-11 items-center justify-between gap-3 border-t border-line pt-3 dark:border-neutral-700">
          <span>
            {t('Resumen semanal')}
            <span className="block text-xs text-ink-soft dark:text-neutral-400">{t('Los domingos a las 20: hábitos, planes y peso de la semana.')}</span>
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
      {isIOS() && <p className="mt-2 text-xs text-ink-soft dark:text-neutral-400">{t('Requiere iOS 16.4 o posterior.')}</p>}
    </Card>
  )
}
