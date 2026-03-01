import type { ProposalData } from '../types';
import type { DafoResult } from './geminiService';
import { getRuntimeEnvString } from './runtimeEnv';

export type CenterInsight = {
  centerKey: string;
  tenantSlug?: string;
  centerName?: string;
  dafo?: DafoResult;
  dafoGeneratedAt?: string;
  customProposal?: ProposalData;
  customGeneratedAt?: string;
  updatedAt?: string;
};

export const normalizeCenterKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

const BASE_URL = '/api/v1';

export const centerInsightsService = {
  async get(centerNameOrKey: string, tenantSlug?: string): Promise<CenterInsight | null> {
    try {
      const resp = await fetch(`${BASE_URL}/documents/by-center?center_name=${encodeURIComponent(centerNameOrKey)}`);
      if (resp.ok) {
        const data = await resp.json();
        const dafoDoc = data.find((d: any) => d.tipus === 'dafo');
        const proposalDoc = data.find((d: any) => d.tipus === 'custom_proposal' || d.tipus === 'proposal');

        if (dafoDoc || proposalDoc) {
          return {
            centerKey: normalizeCenterKey(centerNameOrKey),
            centerName: centerNameOrKey,
            tenantSlug: tenantSlug,
            dafo: dafoDoc?.payload,
            dafoGeneratedAt: dafoDoc?.created_at,
            customProposal: proposalDoc?.payload,
            customGeneratedAt: proposalDoc?.created_at,
            updatedAt: (dafoDoc || proposalDoc)?.created_at
          };
        }
      }
    } catch (e) {
      console.error('Error loading center insights:', e);
    }
    return null;
  },

  async upsertDafo(centerName: string, dafo: DafoResult, tenantSlug?: string): Promise<void> {
    try {
      const req = {
        center_name: centerName,
        document: {
          tipus: 'dafo',
          titol: `DAFO - ${centerName}`,
          contingut_html: "",
          fitxer_url: "",
          payload: dafo,
          enviat: false
        }
      };
      const resp = await fetch(`${BASE_URL}/documents/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
      });
      if (!resp.ok) throw new Error("Error backend");
    } catch (e: any) {
      throw new Error(`Error al guardar DAFO en API: ${e.message}`);
    }
  },

  async upsertCustomProposal(centerName: string, proposal: ProposalData, tenantSlug?: string): Promise<void> {
    try {
      const req = {
        center_name: centerName,
        document: {
          tipus: 'custom_proposal',
          titol: `Propuesta - ${centerName}`,
          contingut_html: "",
          fitxer_url: "",
          payload: proposal,
          enviat: false
        }
      };
      const resp = await fetch(`${BASE_URL}/documents/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
      });
      if (!resp.ok) throw new Error("Error backend");
    } catch (e: any) {
      throw new Error(`Error al guardar Propuesta en API: ${e.message}`);
    }
  },
};
