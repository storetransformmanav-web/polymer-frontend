/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The backend only allows CORS from its own deployed origins, so in dev (and
// `vite preview`) the browser talks to same-origin `/api` and Vite forwards it.
const apiProxy = {
  '/api': { target: 'https://polymeruk-api.vercel.app', changeOrigin: true },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: true,
  },
})
