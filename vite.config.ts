/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The backend only allows CORS from its own deployed origins, so in dev (and
// `vite preview`) the browser talks to same-origin `/api` and Vite forwards it.
const apiProxy = {
  '/api': { target: 'https://polymeruk-api.vercel.app', changeOrigin: true },
}

// Sharing the dev server with other people: `npm run dev:share` (or `preview:share`) listens on
// every network interface instead of only localhost, so a colleague on the same Wi-Fi / network
// can open http://<your-ip>:5173. A public tunnel (ngrok, Cloudflare, localtunnel) reaches the
// server under its own host name, which Vite refuses unless it is listed here — so the common
// tunnel domains are allowed. IP addresses and `localhost` are always allowed by Vite.
const sharedHosts = [
  '.ngrok-free.app',
  '.ngrok-free.dev',
  '.ngrok.io',
  '.trycloudflare.com',
  '.loca.lt',
]

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: { proxy: apiProxy, allowedHosts: sharedHosts },
  preview: { proxy: apiProxy, allowedHosts: sharedHosts },
  // Never ship source maps to production: they publish the original source
  // (comments, structure, endpoints) to anyone who opens dev tools.
  build: { sourcemap: false },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: true,
  },
})
