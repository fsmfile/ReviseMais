import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH permite publicar em subpasta (ex.: GitHub Pages: /revisemais/)
// Versão exibida no app: commit publicado pela Vercel (ou "dev") + data do build.
const versao = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7);
const dataBuild = new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  define: {
    __VERSAO__: JSON.stringify(versao),
    __DATA_BUILD__: JSON.stringify(dataBuild),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // O registro é feito em src/main.tsx (recarrega o app sozinho quando sai versão nova).
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'EstudeMais — Estudos para Concursos',
        short_name: 'EstudeMais',
        description: 'Organize matérias, revisões espaçadas e editais verticalizados.',
        lang: 'pt-BR',
        theme_color: '#1f3a5f',
        background_color: '#f6f7fb',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // inclui o worker do pdf.js (.mjs) no cache do app instalado
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
