
import { createClient } from '@supabase/supabase-js';

// URL proporcionada por el cliente
const supabaseUrl = 'https://cqqifwjzljxtiphdcyyi.supabase.co';
// La clave anon se obtiene del entorno para mantener la seguridad
const supabaseAnonKey = (process.env as any).SUPABASE_ANON_KEY;

// Inicialización segura del cliente
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

if (!supabase) {
  console.warn("ADVERTÈNCIA: SUPABASE_ANON_KEY no trobada. El sistema està operant en mode de contingència LocalStorage.");
} else {
  console.log("CONEXIÓ ESTABLERTA: Adeptify Systems està connectat al clúster de producció.");
}
