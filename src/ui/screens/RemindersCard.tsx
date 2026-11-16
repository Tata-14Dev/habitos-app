import { updateSettings } from '../../data/repo'
import { Card, inputCls, SectionTitle } from '../components'
import { useSettings } from '../hooks'

/** Morning reminder settings. Push delivery is wired in the notifications step. */
export function RemindersCard() {
  const settings = useSettings()
  return (
    <Card>
      <SectionTitle>Recordatorio de la mañana</SectionTitle>
      <label className="flex min-h-11 items-center justify-between gap-3">
        <span>Hora</span>
        <input
          type="time"
          className={inputCls + ' max-w-32'}
          value={settings.reminderTime}
          onChange={(e) => e.target.value && void updateSettings({ reminderTime: e.target.value })}
        />
      </label>
      <p className="mt-2 text-xs text-ink-soft dark:text-neutral-400">Las notificaciones push se activan en el próximo paso.</p>
    </Card>
  )
}
