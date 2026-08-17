import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
  'branding/random-reads-icon.svg',
  'branding/favicon.ico',
  'branding/apple-touch-icon.png'
],
      manifest: false,
      workbox: {
        globPatterns: [
        '**/*.{js,css,html,svg,png,ico,json,txt,xml}'
],
        navigateFallbackDenylist: [
        /^\/api\//,
        /^\/robots\.txt$/,
        /^\/sitemap\.xml$/
],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/gutendex\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'gutendex-api-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24
              }
            }
          }
        ]
      }
    })
  ]
});
