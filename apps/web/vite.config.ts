import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',

      // Genera el SW con la lista completa de assets del build
      workbox: {
        // Cachear todos los tipos de archivos que genera Vite + wa-sqlite WASM
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,mjs}'],

        // wa-sqlite.wasm pesa ~1MB — subir el límite (default es 2MB)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,

        // WASM: CacheFirst con 1 año de vida (no cambia entre sesiones)
        runtimeCaching: [
          {
            urlPattern: /\.wasm(\?.*)?$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasm-cache-v1',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /\.mjs(\?.*)?$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'esm-cache-v1',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },

      manifest: {
        name: 'MercadoPro',
        short_name: 'MercadoPro',
        description: 'Sistema de gestión para mayoristas de mercados',
        start_url: '/',
        display: 'standalone',
        background_color: '#020617',
        theme_color: '#10b981',
        orientation: 'portrait',
        icons: [
          {
            src: '/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: '/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],

  server: {
    host: true, // accesible desde celular en la misma WiFi
  },

  optimizeDeps: {
    exclude: ['wa-sqlite'],
  },
})
