import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/routes/**', 'src/middleware/**'],
      exclude: ['src/**/*.test.ts', 'src/__tests__/**'],
    },
  },
})
