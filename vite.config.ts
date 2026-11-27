import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'] },
      manifest: {
        name: 'Hábitos',
        short_name: 'Hábitos',
        description: 'Hábitos, tareas y planes de estudio con reprogramación en tiempo real',
        lang: 'es-AR',
        theme_color: '#EFEFEF',
        background_color: '#EFEFEF',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Long-press the installed app icon (Android, desktop Chrome/Edge).
        shortcuts: [
          { name: 'Dictar tareas', short_name: 'Dictar', url: '/?dictar=1', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Hábitos', url: '/habitos', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Estadísticas', url: '/habitos/estadisticas', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { host: true },
  preview: { host: true },
})
