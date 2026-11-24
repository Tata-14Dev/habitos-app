import { lazy, Suspense, type ComponentType } from 'react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { cx } from './components'
import { useSettings, useSyncState } from './hooks'
import { TodayScreen } from './screens/TodayScreen'

// "Hoy" ships in the main bundle; every other screen (and Recharts, the food dictionary…) is
// loaded on first visit. The service worker precaches all chunks, so offline still works.
const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })))
const HabitsScreen = named(() => import('./screens/HabitsScreen'), 'HabitsScreen')
const MonthScreen = named(() => import('./screens/MonthScreen'), 'MonthScreen')
const PlansScreen = named(() => import('./screens/PlansScreen'), 'PlansScreen')
const PlanDetailScreen = named(() => import('./screens/PlanDetailScreen'), 'PlanDetailScreen')
const HealthScreen = named(() => import('./screens/HealthScreen'), 'HealthScreen')
const SettingsScreen = named(() => import('./screens/SettingsScreen'), 'SettingsScreen')

const TABS = [
  { to: '/', label: 'Hoy', icon: '☀️', end: true },
  { to: '/habitos', label: 'Hábitos', icon: '✅', end: false },
  { to: '/planes', label: 'Planes', icon: '📚', end: false },
  { to: '/ajustes', label: 'Ajustes', icon: '⚙️', end: false },
]

const HEALTH_TAB = { to: '/salud', label: 'Salud', icon: '🍎', end: false }

export default function App() {
  const { healthEnabled } = useSettings()
  const tabs = healthEnabled ? [...TABS.slice(0, 3), HEALTH_TAB, TABS[3]] : TABS
  return (
    <BrowserRouter>
      <div className="mx-auto min-h-dvh max-w-xl px-4 pb-28 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <SyncBadge />
        <Suspense fallback={<p className="py-16 text-center text-ink-soft">Cargando…</p>}>
        <Routes>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/habitos" element={<HabitsScreen />} />
          <Route path="/habitos/mes/:year/:month" element={<MonthScreen />} />
          <Route path="/planes" element={<PlansScreen />} />
          <Route path="/planes/:id" element={<PlanDetailScreen />} />
          <Route path="/salud" element={<HealthScreen />} />
          <Route path="/ajustes" element={<SettingsScreen />} />
          <Route path="*" element={<TodayScreen />} />
        </Routes>
        </Suspense>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/95">
        <ul className={cx('mx-auto grid max-w-xl', tabs.length === 5 ? 'grid-cols-5' : 'grid-cols-4')}>
          {tabs.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  cx(
                    'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs',
                    isActive ? 'font-semibold text-ink dark:text-neutral-100' : 'text-ink-soft dark:text-neutral-400',
                  )
                }
              >
                <span className="text-xl leading-none">{t.icon}</span>
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </BrowserRouter>
  )
}

/** Small top-right indicator, only when something needs attention. */
function SyncBadge() {
  const s = useSyncState()
  const text = s.status === 'offline' ? '📴 Sin conexión' : s.status === 'error' ? '⚠️ Error al sincronizar' : s.status === 'syncing' ? '🔄' : null
  if (!text) return null
  return (
    <NavLink to="/ajustes" className="fixed right-3 top-[max(0.5rem,env(safe-area-inset-top))] z-30 rounded-full bg-white px-3 py-1 text-xs shadow dark:bg-neutral-800">
      {text}
    </NavLink>
  )
}
