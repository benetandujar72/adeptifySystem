
import { createClient } from '@supabase/supabase-js';

// URL verificada del Clúster de Producció d'Adeptify
const supabaseUrl = 'https://cqqifwjzljxtiphdcyyi.supabase.co';

// Clau anon pública proporcionada pel client
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxcWlmd2p6bGp4dGlwaGRjeXlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0NTYxMjUsImV4cCI6MjA4MjAzMjEyNX0.3IXdHciSW0haFqzk2amaxCdb3RnmBlxg32lnhiINfBQ';

// Inicialització del client amb protocol de seguretat.
// Es prioritza la clau d'entorn si existeix, altrament s'utilitza la fixa per a desplegament ràpid.
const activeKey = (process.env as any).SUPABASE_ANON_KEY || supabaseAnonKey;

export const supabase = (supabaseUrl && activeKey) 
  ? createClient(supabaseUrl, activeKey) 
  : null;

if (!supabase) {
  console.warn("ALERTA DE SEGURETAT: No s'ha pogut inicialitzar el client de dades. Protocol de sandbox actiu.");
} else {
  console.log("SISTEMA OPERATIU: Connexió encriptada amb el Node Cloud de Supabase.");
}
