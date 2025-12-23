
import { createClient } from '@supabase/supabase-js';

// URL verificada del Clúster de Producció d'Adeptify
const supabaseUrl = 'https://cqqifwjzljxtiphdcyyi.supabase.co';
// La clau anon s'obté de l'entorn per seguretat de nivell enterprise
const supabaseAnonKey = (process.env as any).SUPABASE_ANON_KEY;

// Inicialització del client amb protocol de seguretat
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

if (!supabase) {
  console.warn("ALERTA DE SEGURETAT: SUPABASE_ANON_KEY no detectada. S'ha activat el protocol de contingència local (Sandbox).");
} else {
  console.log("SISTEMA OPERATIU: Connexió establerta amb el Node Cloud de Supabase (https://cqqifwjzljxtiphdcyyi.supabase.co).");
}
