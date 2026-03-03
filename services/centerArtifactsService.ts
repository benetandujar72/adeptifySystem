import { CenterArtifact, CenterArtifactType } from '../types';
import { normalizeCenterKey } from './centerInsightsService';
import { getRuntimeEnvString } from './runtimeEnv';

const BASE_URL = '/api/v1';

export const centerArtifactsService = {
  async listForCenter(centerName: string, tenantSlug?: string): Promise<CenterArtifact[]> {
    try {
      const resp = await fetch(`${BASE_URL}/documents/by-center?center_name=${encodeURIComponent(centerName)}`);
      if (resp.ok) {
        const data = await resp.json();
        const docs: any[] = Array.isArray(data) ? data : (data.documents || []);
        return docs.map((d: any) => ({
          id: String(d.id),
          tenantSlug: tenantSlug,
          centerKey: normalizeCenterKey(centerName),
          centerName: centerName,
          artifactType: (d.tipus === 'custom_proposal' ? 'custom_proposal' : d.tipus === 'report' ? 'report' : 'dafo') as CenterArtifactType,
          payload: d.payload,
          createdAt: d.created_at,
        } satisfies CenterArtifact));
      }
      return [];
    } catch (e: any) {
      console.error('Error loading center artifacts:', e.message);
      return [];
    }
  },

  async addArtifact(centerName: string, artifactType: CenterArtifactType, payload: any, tenantSlug?: string): Promise<CenterArtifact> {
    try {
      const req = {
        center_name: centerName,
        document: {
          tipus: artifactType,
          titol: `${artifactType.toUpperCase()} - ${centerName}`,
          contingut_html: "",
          fitxer_url: "",
          payload: payload,
          enviat: false
        }
      };

      const resp = await fetch(`${BASE_URL}/documents/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
      });

      if (!resp.ok) throw new Error("Error syncing document");

      const data = await resp.json();
      return {
        id: String(data.id),
        tenantSlug: tenantSlug,
        centerKey: normalizeCenterKey(centerName),
        centerName: centerName,
        artifactType: (data.tipus === 'custom_proposal' ? 'custom_proposal' : data.tipus === 'report' ? 'report' : 'dafo') as CenterArtifactType,
        payload: data.payload,
        createdAt: data.created_at,
      };
    } catch (e: any) {
      console.error('Error saving center artifact:', e.message);
      throw new Error(`Error al guardar en la base de datos: ${e.message}`);
    }
  },
};
