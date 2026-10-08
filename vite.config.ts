import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // El mapa se sirve desde `app.iclac.cl/mapa-fdi/`. Si la ruta cambia, cambia acá y en `netlify.toml`.
  base: '/mapa-fdi/',
  // Los archivos quedan en `dist/mapa-fdi/`, igual que sus URL: Netlify los sirve tal cual y no hace
  // falta una regla por carpeta (`assets`, `icons`, `data`, y lo que se agregue a `public/`).
  build: { outDir: 'dist/mapa-fdi' },
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    host: true
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs']
  }
})
