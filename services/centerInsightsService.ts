import { supabase } from './supabaseClient';
import type { ProposalData } from '../types';
import type { DafoResult } from './geminiService';

type CenterInsightRow = {
  center_key: string;
  center_name: string | null;
  dafo_json: any | null;
  dafo_generated_at: string | null;
  custom_proposal_json: any | null;
  custom_generated_at: string | null;
  updated_at: string | null;
};

export type CenterInsight = {
  centerKey: string;
  centerName?: string;
  dafo?: DafoResult;
  dafoGeneratedAt?: string;
  customProposal?: ProposalData;
  customGeneratedAt?: string;
  updatedAt?: string;
};

const LOCAL_KEY = 'adeptify_center_insights_cache';

export const normalizeCenterKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

const readLocalCache = (): Record<string, CenterInsight> => {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    if (!raw || typeof raw !== 'object') return {};
    return raw;
  } catch {
    return {};
  }
};

const writeLocalCache = (next: Record<string, CenterInsight>) => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
};

export const centerInsightsService = {
  async get(centerNameOrKey: string): Promise<CenterInsight | null> {
    const centerKey = normalizeCenterKey(centerNameOrKey);

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('center_insights')
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
      } catch {
        // fall back to local
      }
    }

    const cache = readLocalCache();
    return cache[centerKey] ?? null;
  },

  async upsertDafo(centerName: string, dafo: DafoResult): Promise<void> {
    const centerKey = normalizeCenterKey(centerName);

    if (supabase) {
      const { error } = await supabase
        .from('center_insights')
        .upsert(
          {
            center_key: centerKey,
            center_name: centerName,
            dafo_json: dafo as any,
            dafo_generated_at: dafo?.meta?.generatedAt ?? new Date().toISOString(),
          },
          { onConflict: 'center_key' }
        );

      if (!error) return;
      // If Supabase rejects (RLS/missing table), fall back to local.
    }

    const cache = readLocalCache();
    cache[centerKey] = {
      ...(cache[centerKey] || { centerKey }),
      centerKey,
      centerName,
      dafo,
      dafoGeneratedAt: dafo?.meta?.generatedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeLocalCache(cache);
  },

  async upsertCustomProposal(centerName: string, proposal: ProposalData): Promise<void> {
    const centerKey = normalizeCenterKey(centerName);

    if (supabase) {
      const { error } = await supabase
        .from('center_insights')
        .upsert(
          {
            center_key: centerKey,
            center_name: centerName,
            custom_proposal_json: proposal as any,
            custom_generated_at: proposal?.meta?.generatedAt ?? new Date().toISOString(),
          },
          { onConflict: 'center_key' }
        );

      if (!error) return;
      // fall back to local
    }

    const cache = readLocalCache();
    cache[centerKey] = {
      ...(cache[centerKey] || { centerKey }),
      centerKey,
      centerName,
      customProposal: proposal,
      customGeneratedAt: proposal?.meta?.generatedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeLocalCache(cache);
  },
};
