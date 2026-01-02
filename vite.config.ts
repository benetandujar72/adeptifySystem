import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        // Dev-only: keep GEMINI_API_KEY on the Vite server, never in the browser.
        '/api-proxy': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/api-proxy/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
              if (!apiKey) return;
              const url = new URL(proxyReq.path, 'https://generativelanguage.googleapis.com');
              if (!url.searchParams.has('key')) url.searchParams.set('key', apiKey);
              proxyReq.path = url.pathname + url.search;
            });
          },
        },
      },
    },
    plugins: [react()],
    // Dev-only runtime env.js (no secrets)
    configureServer: (server) => {
      server.middlewares.use('/env.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        const safeEnv = {
          SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
          SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
          SB_PUBLISHABLE_KEY: process.env.SB_PUBLISHABLE_KEY || process.env.VITE_SB_PUBLISHABLE_KEY || '',
        };
        res.statusCode = 200;
        res.end(`// Dev runtime config; do not commit.\nwindow.__ADEPTIFY_ENV__ = ${JSON.stringify(safeEnv)};\n`);
      });
    },
    define: undefined,
    build: {
      // Keep vendor-prefixed properties that Safari/iOS Safari require (e.g. -webkit-backdrop-filter).
      cssTarget: ['safari9'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
