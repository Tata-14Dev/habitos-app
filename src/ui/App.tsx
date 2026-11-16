import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { cx } from './components'
import { useSyncState } from './hooks'
import { HabitsScreen } from './screens/HabitsScreen'
import { MonthScreen } from './screens/MonthScreen'
import { PlanDetailScreen } from './screens/PlanDetailScreen'
import { PlansScreen } from './screens/PlansScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { TodayScreen } from './screens/TodayScreen'

const TABS = [
  { to: '/', label: 'Hoy', icon: '☀️', end: true },
  { to: '/habitos', label: 'Hábitos', icon: '✅', end: false },
  { to: '/planes', label: 'Planes', icon: '📚', end: false },
  { to: '/ajustes', label: 'Ajustes', icon: '⚙️', end: false },
]

export default function App() {
  return (
    <BrowserRouter>
      <div className="mx-auto min-h-dvh max-w-xl px-4 pb-28 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <SyncBadge />
        <Routes>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/habitos" element={<HabitsScreen />} />
          <Route path="/habitos/mes/:year/:month" element={<MonthScreen />} />
          <Route path="/planes" element={<PlansScreen />} />
          <Route path="/planes/:id" element={<PlanDetailScreen />} />
          <Route path="/ajustes" element={<SettingsScreen />} />
          <Route path="*" element={<TodayScreen />} />
        </Routes>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/95">
        <ul className="mx-auto grid max-w-xl grid-cols-4">
          {TABS.map((t) => (
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
