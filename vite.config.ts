import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Prefer real environment variables (e.g., Cloud Build / Docker build args)
    // and fall back to Vite .env files for local dev.
    const geminiApiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
    const supabaseUrl = process.env.SUPABASE_URL || env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // NOTE: This is a frontend-only app. We compile-time inject selected env vars
        // to avoid relying on Node's `process` in the browser runtime.
        'process.env': JSON.stringify({
          API_KEY: geminiApiKey,
          GEMINI_API_KEY: geminiApiKey,
          SUPABASE_URL: supabaseUrl,
          SUPABASE_ANON_KEY: supabaseAnonKey,
        }),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
