type RuntimeEnv = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SB_PUBLISHABLE_KEY?: string;
};

declare global {
  interface Window {
    __ADEPTIFY_ENV__?: RuntimeEnv;
  }
}

export function getRuntimeEnv(): RuntimeEnv {
  if (typeof window === 'undefined') return {};
  const env = (window as any).__ADEPTIFY_ENV__;
  return env && typeof env === 'object' ? (env as RuntimeEnv) : {};
}

export function getRuntimeEnvString(key: keyof RuntimeEnv): string | undefined {
  const value = getRuntimeEnv()[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
