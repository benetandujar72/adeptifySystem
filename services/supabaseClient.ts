
import { createClient } from '@supabase/supabase-js';

// URL del projecte Adeptify a Supabase
const supabaseUrl = 'https://cqqifwjzljxtiphdcyyi.supabase.co';

/**
 * SEGURETAT: Utilitzem la clau 'anon' pública per al client frontend.
 * La clau 'service_role' (secret) NO s'ha d'exposar mai en el client.
 */
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxcWlmd2p6bGp4dGlwaGRjeXlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0NTYxMjUsImV4cCI6MjA4MjAzMjEyNX0.3IXdHciSW0haFqzk2amaxCdb3RnmBlxg32lnhiINfBQ';

// Intentem obtenir les claus de les variables d'entorn injectades per a major seguretat
const activeUrl = (process.env as any).SUPABASE_URL || supabaseUrl;
const activeKey = (process.env as any).SUPABASE_ANON_KEY || supabaseAnonKey;

export const supabase = (activeUrl && activeKey) 
  ? createClient(activeUrl, activeKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    }) 
  : null;

if (!supabase) {
  console.error("ALERTA CRÍTICA: No s'ha pogut inicialitzar el clúster de dades. Protocol de contingència local activat.");
} else {
  console.log("SISTEMA: Sincronització amb el Node Cloud de Supabase operativa.");
}
