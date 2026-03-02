import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // expone en red local → accesible desde celular en misma WiFi
  },
  optimizeDeps: {
    // wa-sqlite carga su WASM dinámicamente — excluir del pre-bundling de Vite
    exclude: ['wa-sqlite'],
  },
})
