
import { createClient } from '@supabase/supabase-js';

/**
 * CONFIGURACIÓN DE NODO CLOUD - ADEPTIFY SYSTEMS
 * 
 * El sistema prioriza las variables de entorno inyectadas durante la compilación/despliegue.
 * Si no se detectan, el sistema activa el protocolo de contingencia (LocalStorage).
 */

const supabaseUrl =
  ((import.meta as any)?.env?.VITE_SUPABASE_URL as string | undefined) ||
  (process.env as any).SUPABASE_URL ||
  'https://cqqifwjzljxtiphdcyyi.supabase.co';

const supabaseAnonKey =
  ((import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  (process.env as any).SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxcWlmd2p6bGp4dGlwaGRjeXlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0NTYxMjUsImV4cCI6MjA4MjAzMjEyNX0.3IXdHciSW0haFqzk2amaxCdb3RnmBlxg32lnhiINfBQ';

let supabaseInstance = null;

try {
  if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('https://')) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    });
    console.info("SISTEMA: Conexión establecida con el clúster de datos en la nube.");
  } else {
    throw new Error("Configuración de URL inválida.");
  }
} catch (error) {
  console.warn("ALERTA: Cloud no disponible. Activando persistencia local de emergencia.");
}

export const supabase = supabaseInstance;
