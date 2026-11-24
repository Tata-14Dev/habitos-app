import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import { DEMO } from './data/demoFlag'
import { startSync } from './data/sync'
import App from './ui/App'
import { LANG } from './ui/i18n'
import { initTheme } from './ui/theme'

initTheme()
startSync()
if (DEMO) void import('./data/demo').then((m) => m.loadDemoData(undefined, LANG))
registerSW({ immediate: true })

// Ask the browser not to evict our IndexedDB data under storage pressure.
void navigator.storage?.persist?.()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
