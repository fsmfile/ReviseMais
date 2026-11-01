import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH permite publicar em subpasta (ex.: GitHub Pages: /revisemais/)
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'ReviseMais — Estudos para Concursos',
        short_name: 'ReviseMais',
        description: 'Organize matérias, revisões espaçadas e editais verticalizados.',
        lang: 'pt-BR',
        theme_color: '#1f3a5f',
        background_color: '#f6f7fb',
        display: 'standalone',
        start_url: '.',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: { maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 },
    }),
  ],
});
