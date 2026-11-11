import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Run: npx pwa-assets-generator — regenerates the PNG icons in public/ from icon.svg.
// The balance-ring mark (chosen 11 Nov 2026) already has its own margin on the 512 canvas, so
// no extra padding: the ring's outer edge is at 68% of the radius, inside Android's 80% maskable
// safe zone, and iOS rounds the corners itself. Apple and maskable icons sit on the app
// background (#08090A) so no white edge shows.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    apple: { sizes: [180], padding: 0, resizeOptions: { background: '#08090A' } },
    maskable: { sizes: [512], padding: 0, resizeOptions: { background: '#08090A' } },
  },
  images: ['public/icon.svg'],
})
