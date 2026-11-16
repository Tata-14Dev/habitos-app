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
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Hábitos',
        short_name: 'Hábitos',
        description: 'Hábitos y planes de estudio con reprogramación en tiempo real',
        lang: 'es-AR',
        theme_color: '#93C47D',
        background_color: '#EFEFEF',
        display: 'standalone',
        start_url: '/',
        icons: [],
      },
    }),
  ],
  server: { host: true },
})
