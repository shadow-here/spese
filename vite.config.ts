/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt': a new version waits until the user taps "Reload" (UpdatePrompt.tsx), so an
      // update never reloads the page mid-entry. Registration happens in code, not an injected script.
      registerType: 'prompt',
      injectRegister: false,
      // Our own service worker (src/sw.ts) so it can handle reminder pushes; Workbox still
      // injects the precache list into it.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['icon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Spese',
        short_name: 'Spese',
        description: 'Salary-first expense tracker: how much can I still spend this pay cycle?',
        theme_color: '#08090A',
        background_color: '#08090A',
        display: 'standalone',
        start_url: '/',
        // PNGs generated from public/icon.svg by `npx pwa-assets-generator` (see pwa-assets.config.ts).
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Only precache the Latin Inter subsets (₹ is in latin-ext); others load on demand.
        globIgnores: ['**/inter-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 15000,
    // The PWA plugin's virtual module doesn't exist under Vitest; tests use a stub.
    alias: { 'virtual:pwa-register/react': '/src/test/pwaRegisterStub.ts' },
  },
})
