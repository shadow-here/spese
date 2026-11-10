import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Run: npx pwa-assets-generator — regenerates the PNG icons in public/ from icon.svg.
// Apple and maskable icons sit on the app background (#08090A) so iOS/Android masks show no white edge.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    apple: { sizes: [180], padding: 0.15, resizeOptions: { background: '#08090A' } },
    maskable: { sizes: [512], padding: 0.3, resizeOptions: { background: '#08090A' } },
  },
  images: ['public/icon.svg'],
})
