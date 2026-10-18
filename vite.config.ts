import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH ustawia workflow GitHub Pages (np. /geopowtorki/); lokalnie '/'.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'GeoPowtórki – mapa fizyczna świata',
        short_name: 'GeoPowtórki',
        description: 'Nauka mapy fizycznej świata z powtórkami rozłożonymi w czasie.',
        lang: 'pl',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#eef2ee',
        theme_color: '#2b6a8a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // aplikacja + dane + glify + kafelki do zoomu 4 od razu (offline);
        // kafelki zoomu 5 – w miarę oglądania (CacheFirst)
        globPatterns: ['**/*.{js,css,html,svg,png,json,pbf}', 'tiles/hyp/{0,1,2,3,4}/**/*.webp'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/tiles/hyp/5/'),
            handler: 'CacheFirst',
            options: { cacheName: 'tiles-z5', expiration: { maxEntries: 1100 } },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'i.ytimg.com',
            handler: 'CacheFirst',
            options: { cacheName: 'yt-thumbs', expiration: { maxEntries: 100, maxAgeSeconds: 30 * 86400 } },
          },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 1500 },
});
