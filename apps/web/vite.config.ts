import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'

// Plugin que inyecta el hash de build en sw.js para versioning de caché
function swVersionPlugin(): Plugin {
  let buildHash = 'dev'

  return {
    name: 'sw-version',
    buildStart() {
      const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as { version: string }
      buildHash = createHash('sha1')
        .update(`${pkg.version}-${Date.now()}`)
        .digest('hex')
        .slice(0, 8)
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generateBundle(_options: unknown, bundle: Record<string, any>) {
      const swChunk = bundle['sw.js']
      if (swChunk && swChunk.type === 'asset' && typeof swChunk.source === 'string') {
        swChunk.source = swChunk.source.replace(
          /self\.__APP_VERSION__\s*\?\?\s*'dev'/,
          `'${buildHash}'`
        )
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), swVersionPlugin()],
  server: {
    host: true, // expone en red local → accesible desde celular en misma WiFi
  },
  optimizeDeps: {
    // wa-sqlite carga su WASM dinámicamente — excluir del pre-bundling de Vite
    exclude: ['wa-sqlite'],
  },
})
