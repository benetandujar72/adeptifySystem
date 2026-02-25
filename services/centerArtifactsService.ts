import { supabase } from './supabaseClient';
import { CenterArtifact, CenterArtifactType } from '../types';
import { normalizeCenterKey } from './centerInsightsService';

export const centerArtifactsService = {
  async listForCenter(centerName: string, tenantSlug?: string): Promise<CenterArtifact[]> {
    if (!supabase) {
      console.error('La conexión a la base de datos no está disponible.');
      return [];
    }

    try {
      let query = supabase
        .from('center_artifacts')
        .select('*')
        .order('created_at', { ascending: false });

      if (centerName) {
        const centerKey = normalizeCenterKey(centerName);
        query = query.eq('center_key', centerKey);
      }

      if (tenantSlug) query = query.eq('tenant_slug', tenantSlug);

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
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
      return [];
    } catch (e: any) {
      console.error('Error loading center artifacts:', e.message);
      return [];
    }
  },

  async addArtifact(centerName: string, artifactType: CenterArtifactType, payload: any, tenantSlug?: string): Promise<CenterArtifact> {
    if (!supabase) {
      throw new Error('Base de datos no disponible. No se pudo guardar el documento.');
    }

    const centerKey = normalizeCenterKey(centerName);

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

      if (error) throw error;

      if (data) {
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
      throw new Error('Fallo al recuperar los datos insertados.');
    } catch (e: any) {
      console.error('Error saving center artifact:', e.message);
      throw new Error(`Error al guardar en la base de datos: ${e.message}`);
    }
  },
};
