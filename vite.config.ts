import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => {
  // Cloud Build/Docker sometimes won't propagate Vite's env loading as expected.
  // Force-inline the VITE_* values from process.env at build time (only when present).
  const defineViteEnv: Record<string, string> = {};
  if (command === 'build') {
    const defineIfPresent = (key: string) => {
      const value = process.env[key];
      if (typeof value === 'string' && value.length > 0) {
        defineViteEnv[`import.meta.env.${key}`] = JSON.stringify(value);
      }
    };

    defineIfPresent('VITE_GEMINI_API_KEY');
    defineIfPresent('VITE_SUPABASE_URL');
    defineIfPresent('VITE_SUPABASE_ANON_KEY');
    defineIfPresent('VITE_SB_PUBLISHABLE_KEY');
  }

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: Object.keys(defineViteEnv).length ? defineViteEnv : undefined,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
