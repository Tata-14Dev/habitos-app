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
registerSW({ immediate: true })

// Ask the browser not to evict our IndexedDB data under storage pressure.
void navigator.storage?.persist?.()

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// Demo mode: fill the sample database first (one transaction, a few hundred ms) so the first
// paint already has the data instead of an empty screen that then jumps.
if (DEMO) {
  void import('./data/demo')
    .then((m) => m.loadDemoData(undefined, LANG))
    .catch(() => undefined)
    .finally(render)
} else {
  render()
}
