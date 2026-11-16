import { useRef, useState } from 'react'
import { exportBackup, downloadFile, importBackup } from '../../data/backup'
import { updateSettings } from '../../data/repo'
import { loadExample } from '../../data/seed'
import { syncConfigured } from '../../data/supabase'
import { signIn, signOut, signUp, syncNow } from '../../data/sync'
import { todayISO } from '../../domain/dates'
import { Button, Card, cx, Field, inputCls, SectionTitle } from '../components'
import { usePendingChanges, useSettings, useSyncState } from '../hooks'
import { getThemePref, setThemePref, type ThemePref } from '../theme'
import { RemindersCard } from './RemindersCard'

export function SettingsScreen() {
  const settings = useSettings()
  const [theme, setTheme] = useState<ThemePref>(getThemePref())
  const [msg, setMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-4">
      <h1 className="pt-2 text-2xl font-semibold">Ajustes</h1>

      <AccountCard />
      <RemindersCard />

      <Card>
        <SectionTitle>Apariencia</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['system', 'Automático'],
              ['light', 'Claro'],
              ['dark', 'Oscuro'],
            ] as const
          ).map(([v, label]) => (
            <Button
              key={v}
              variant={theme === v ? 'primary' : 'soft'}
              onClick={() => {
                setThemePref(v)
                setTheme(v)
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        <label className="mt-3 flex min-h-11 items-center justify-between gap-3">
          <span>La semana empieza el lunes</span>
          <input
            type="checkbox"
            className="size-5 accent-progress"
            checked={settings.weekStartsMonday}
            onChange={(e) => void updateSettings({ weekStartsMonday: e.target.checked })}
          />
        </label>
      </Card>

      <Card>
        <SectionTitle>Datos</SectionTitle>
        <div className="space-y-2">
          <Button
            className="w-full"
            onClick={async () => {
              const data = await exportBackup()
              downloadFile(`habitos-${todayISO()}.json`, JSON.stringify(data, null, 2))
            }}
          >
            ⬇️ Exportar respaldo (JSON)
          </Button>
          <Button className="w-full" onClick={() => fileRef.current?.click()}>
            ⬆️ Importar respaldo
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              try {
                const n = await importBackup(JSON.parse(await file.text()))
                setMsg(`✅ Se importaron ${n} registros.`)
              } catch (err) {
                setMsg(`⚠️ ${(err as Error).message}`)
              }
            }}
          />
          <Button
            className="w-full"
            onClick={async () => setMsg((await loadExample()) ? '✅ Ejemplo cargado: plan SOC Level 1 con etapas y el hábito "Estudiar SOC".' : 'El ejemplo ya estaba cargado.')}
          >
            🧪 Cargar ejemplo
          </Button>
          {msg && <p className="text-sm">{msg}</p>}
        </div>
      </Card>
    </div>
  )
}

function AccountCard() {
  const sync = useSyncState()
  const pending = usePendingChanges()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!syncConfigured) {
    return (
      <Card>
        <SectionTitle>Cuenta y sincronización</SectionTitle>
        <p className="text-sm text-ink-soft dark:text-neutral-400">
          La sincronización no está configurada todavía (faltan las claves de Supabase en <code>.env.local</code>). Todo se
          guarda en este dispositivo.
        </p>
      </Card>
    )
  }

  if (sync.status !== 'signedOut') {
    const label: Record<string, string> = {
      idle: '✅ Sincronizado',
      syncing: '🔄 Sincronizando…',
      offline: '📴 Sin conexión: se sube cuando vuelva internet',
      error: `⚠️ Error: ${sync.error ?? ''}`,
    }
    return (
      <Card>
        <SectionTitle>Cuenta y sincronización</SectionTitle>
        <p className="text-base">{sync.email}</p>
        <p className="mt-1 text-sm">{label[sync.status] ?? ''}</p>
        <p className="text-xs text-ink-soft dark:text-neutral-400">
          {pending > 0 ? `${pending} cambios sin subir · ` : ''}
          {sync.lastSyncAt ? `Última vez: ${new Date(sync.lastSyncAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : ''}
        </p>
        <div className="mt-3 flex gap-2">
          <Button className="flex-1" onClick={() => void syncNow()}>
            Sincronizar ahora
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              if (!confirm('¿Cerrar sesión? Se borra la copia local de este dispositivo (tus datos quedan en la nube).')) return
              const err = await signOut()
              if (err) alert(err)
            }}
          >
            Salir
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <SectionTitle>Cuenta y sincronización</SectionTitle>
      <p className="mb-3 text-sm text-ink-soft dark:text-neutral-400">
        Entrá con la misma cuenta en el teléfono y en la compu para tener todo sincronizado. Solo la primera vez en cada
        dispositivo, sin mails de confirmación.
      </p>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Button variant={mode === 'in' ? 'primary' : 'soft'} onClick={() => setMode('in')}>
          Iniciar sesión
        </Button>
        <Button variant={mode === 'up' ? 'primary' : 'soft'} onClick={() => setMode('up')}>
          Crear cuenta
        </Button>
      </div>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError(await (mode === 'in' ? signIn : signUp)(email.trim(), password))
          setBusy(false)
        }}
      >
        <Field label="Mail">
          <input type="email" autoComplete="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Contraseña" hint={mode === 'up' ? 'Mínimo 6 caracteres. El iPhone te ofrece guardarla en el llavero.' : undefined}>
          <input
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </Field>
        {error && <p className={cx('text-sm text-red-700 dark:text-red-300')}>{error}</p>}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy ? '…' : mode === 'in' ? 'Entrar' : 'Crear cuenta'}
        </Button>
      </form>
    </Card>
  )
}
