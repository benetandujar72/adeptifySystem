import { supabase } from './supabaseClient';
import { CenterArtifact, CenterArtifactType } from '../types';
import { normalizeCenterKey } from './centerInsightsService';

const LOCAL_ARTIFACTS_KEY = 'adeptify_center_artifacts_v1';

type StoredArtifact = {
  id: string;
  tenantSlug?: string;
  centerKey: string;
  centerName?: string;
  artifactType: CenterArtifactType;
  payload: any;
  createdAt: string;
};

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const toLocalKey = (tenantSlug: string | undefined, centerKey: string) => `${(tenantSlug || 'global').toLowerCase()}::${centerKey}`;

export const centerArtifactsService = {
  async listForCenter(centerName: string, tenantSlug?: string): Promise<CenterArtifact[]> {
    const centerKey = normalizeCenterKey(centerName);

    if (supabase) {
      try {
        let query = supabase
          .from('center_artifacts')
          .select('*')
          .eq('center_key', centerKey)
          .order('created_at', { ascending: false });

        if (tenantSlug) query = query.eq('tenant_slug', tenantSlug);

        const { data, error } = await query;
        if (!error && data) {
          return data.map((row: any) => ({
            id: String(row.id),
            tenantSlug: row.tenant_slug ?? undefined,
            centerKey: row.center_key,
            centerName: row.center_name ?? undefined,
            artifactType: row.artifact_type as CenterArtifactType,
            payload: row.payload_json,
            createdAt: row.created_at,
          } satisfies CenterArtifact));
        }
      } catch (e) {
        console.error('Error loading center artifacts:', e);
      }
    }

    const store = safeParse<Record<string, StoredArtifact[]>>(localStorage.getItem(LOCAL_ARTIFACTS_KEY), {});
    const key = toLocalKey(tenantSlug, centerKey);
    const list = Array.isArray(store[key]) ? store[key] : [];
    return list as CenterArtifact[];
  },

  async addArtifact(centerName: string, artifactType: CenterArtifactType, payload: any, tenantSlug?: string): Promise<CenterArtifact> {
    const centerKey = normalizeCenterKey(centerName);
    const createdAt = new Date().toISOString();

    const fallback: CenterArtifact = {
      id: `ART-${Date.now()}`,
      tenantSlug,
      centerKey,
      centerName,
      artifactType,
      payload,
      createdAt,
    };

    if (supabase) {
      try {
        const row = {
          tenant_slug: tenantSlug ?? null,
          center_key: centerKey,
          center_name: centerName,
          artifact_type: artifactType,
          payload_json: payload,
        };

        const { data, error } = await supabase
          .from('center_artifacts')
          .insert([row])
          .select('*')
          .single();

        if (!error && data) {
          return {
            id: String(data.id),
            tenantSlug: data.tenant_slug ?? undefined,
            centerKey: data.center_key,
            centerName: data.center_name ?? undefined,
            artifactType: data.artifact_type as CenterArtifactType,
            payload: data.payload_json,
            createdAt: data.created_at,
          };
        }
      } catch (e) {
        console.error('Error saving center artifact:', e);
      }
    }

    const store = safeParse<Record<string, StoredArtifact[]>>(localStorage.getItem(LOCAL_ARTIFACTS_KEY), {});
    const key = toLocalKey(tenantSlug, centerKey);
    const next = [fallback, ...(store[key] || [])];
    store[key] = next;
    localStorage.setItem(LOCAL_ARTIFACTS_KEY, JSON.stringify(store));
    return fallback;
  },
};
