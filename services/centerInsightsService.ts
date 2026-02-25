import { supabase } from './supabaseClient';
import type { ProposalData } from '../types';
import type { DafoResult } from './geminiService';

type CenterInsightRow = {
  center_key: string;
  tenant_slug?: string | null;
  center_name: string | null;
  dafo_json: any | null;
  dafo_generated_at: string | null;
  custom_proposal_json: any | null;
  custom_generated_at: string | null;
  updated_at: string | null;
};

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

const INSIGHTS_TABLE_V2 = 'center_insights_v2';
const INSIGHTS_TABLE_V1 = 'center_insights';

export const normalizeCenterKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

export const centerInsightsService = {
  async get(centerNameOrKey: string, tenantSlug?: string): Promise<CenterInsight | null> {
    const centerKey = normalizeCenterKey(centerNameOrKey);

    if (!supabase) {
      console.error('La conexión a la base de datos no está disponible.');
      return null;
    }

    try {
      // Prefer tenant-scoped table if present.
      if (tenantSlug) {
        const { data, error } = await supabase
          .from(INSIGHTS_TABLE_V2)
          .select('*')
          .eq('tenant_slug', tenantSlug)
          .eq('center_key', centerKey)
          .limit(1);

        if (!error && Array.isArray(data) && data.length > 0) {
          const row = data[0] as CenterInsightRow;
          return {
            tenantSlug: row.tenant_slug ?? tenantSlug,
            centerKey: row.center_key,
            centerName: row.center_name ?? undefined,
            dafo: (row.dafo_json as DafoResult) ?? undefined,
            dafoGeneratedAt: row.dafo_generated_at ?? undefined,
            customProposal: (row.custom_proposal_json as ProposalData) ?? undefined,
            customGeneratedAt: row.custom_generated_at ?? undefined,
            updatedAt: row.updated_at ?? undefined,
          };
        }
      }

      // Fallback to V1
      const { data, error } = await supabase
        .from(INSIGHTS_TABLE_V1)
        .select('*')
        .eq('center_key', centerKey)
        .limit(1);

      if (!error && Array.isArray(data) && data.length > 0) {
        const row = data[0] as CenterInsightRow;
        return {
          centerKey: row.center_key,
          centerName: row.center_name ?? undefined,
          dafo: (row.dafo_json as DafoResult) ?? undefined,
          dafoGeneratedAt: row.dafo_generated_at ?? undefined,
          customProposal: (row.custom_proposal_json as ProposalData) ?? undefined,
          customGeneratedAt: row.custom_generated_at ?? undefined,
          updatedAt: row.updated_at ?? undefined,
        };
      }
    } catch (e) {
      console.error('Error loading center insights:', e);
    }

    return null;
  },

  async upsertDafo(centerName: string, dafo: DafoResult, tenantSlug?: string): Promise<void> {
    const centerKey = normalizeCenterKey(centerName);

    if (!supabase) {
      throw new Error('Base de datos no disponible. No se pudo guardar el DAFO.');
    }

    if (tenantSlug) {
      const { error } = await supabase
        .from(INSIGHTS_TABLE_V2)
        .upsert(
          {
            tenant_slug: tenantSlug,
            center_key: centerKey,
            center_name: centerName,
            dafo_json: dafo as any,
            dafo_generated_at: dafo?.meta?.generatedAt ?? new Date().toISOString(),
          },
          { onConflict: 'tenant_slug,center_key' }
        );

      if (error) throw new Error(`Error al guardar DAFO en V2: ${error.message}`);
      return;
    }

    const { error } = await supabase
      .from(INSIGHTS_TABLE_V1)
      .upsert(
        {
          center_key: centerKey,
          center_name: centerName,
          dafo_json: dafo as any,
          dafo_generated_at: dafo?.meta?.generatedAt ?? new Date().toISOString(),
        },
        { onConflict: 'center_key' }
      );

    if (error) throw new Error(`Error al guardar DAFO en V1: ${error.message}`);
  },

  async upsertCustomProposal(centerName: string, proposal: ProposalData, tenantSlug?: string): Promise<void> {
    const centerKey = normalizeCenterKey(centerName);

    if (!supabase) {
      throw new Error('Base de datos no disponible. No se pudo guardar la propuesta.');
    }

    if (tenantSlug) {
      const { error } = await supabase
        .from(INSIGHTS_TABLE_V2)
        .upsert(
          {
            tenant_slug: tenantSlug,
            center_key: centerKey,
            center_name: centerName,
            custom_proposal_json: proposal as any,
            custom_generated_at: proposal?.meta?.generatedAt ?? new Date().toISOString(),
          },
          { onConflict: 'tenant_slug,center_key' }
        );

      if (error) throw new Error(`Error al guardar Propuesta en V2: ${error.message}`);
      return;
    }

    const { error } = await supabase
      .from(INSIGHTS_TABLE_V1)
      .upsert(
        {
          center_key: centerKey,
          center_name: centerName,
          custom_proposal_json: proposal as any,
          custom_generated_at: proposal?.meta?.generatedAt ?? new Date().toISOString(),
        },
        { onConflict: 'center_key' }
      );

    if (error) throw new Error(`Error al guardar Propuesta en V1: ${error.message}`);
  },
};
