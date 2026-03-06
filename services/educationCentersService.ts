import { supabase } from './supabaseClient';
import type { CatEducationCenterFull } from '../types';

export type CatEducationCenter = {
  codi_centre: string;
  denominacio_completa: string;
  nom_municipi?: string | null;
  nom_comarca?: string | null;
  codi_postal?: string | null;
};

function normalizeSearchText(input: string): string {
  return (input || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizePostgrestOrToken(input: string): string {
  // `.or()` uses a comma-separated syntax; remove characters that can break parsing.
  // Keep unicode letters (including accents), numbers, and whitespace.
  return (input || '')
    .trim()
    .replace(/[%]/g, ' ')
    .replace(/[(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function searchCatEducationCenters(query: string, limit = 12): Promise<CatEducationCenter[]> {
  const qRaw = (query || '').trim();
  if (!supabase) return [];
  if (qRaw.length < 2) return [];

  // PostgREST filter strings inside `.or()` are not URL-encoded per-token here,
  // so avoid `%` and unsafe punctuation. Use `*` wildcards and a normalized fallback
  // so searches work with/without accents (e.g., "banús" vs "banus").
  const qNorm = normalizeSearchText(qRaw);
  const patterns = Array.from(
    new Set([
      sanitizePostgrestOrToken(qRaw),
      sanitizePostgrestOrToken(qNorm),
    ].filter((p) => p && p.length >= 2))
  );

  const orParts: string[] = [];
  for (const p of patterns) {
    // PostgREST uses `*` as wildcard for LIKE/ILIKE.
    const like = `*${p}*`;
    // Requirement: search across the full center name.
    orParts.push(`denominacio_completa.ilike.${like}`);
  }

  const { data, error } = await supabase
    .from('cat_education_centers')
    .select('codi_centre, denominacio_completa, nom_municipi, nom_comarca, codi_postal')
    .or(orParts.join(','))
    .order('denominacio_completa', { ascending: true })
    .limit(limit);

  if (error || !data) {
    if (import.meta?.env?.DEV) console.warn('searchCatEducationCenters error', error);
    return [];
  }
  return data as CatEducationCenter[];
}

const MAP_COLUMNS = [
  'codi_centre', 'denominacio_completa', 'nom_naturalesa', 'nom_titularitat',
  'adreca', 'codi_postal', 'telefon', 'nom_delegacio', 'nom_comarca', 'nom_municipi',
  'coordenades_geo_x', 'coordenades_geo_y', 'email_centre', 'estudis',
  'einf1c', 'einf2c', 'epri', 'eso', 'batx', 'aa01', 'cfpm', 'ppas',
  'aa03', 'cfps', 'ee', 'ife', 'pfi', 'pa01', 'cfam', 'pa02',
  'cfas', 'esdi', 'escm', 'escs', 'adr', 'crbc', 'idi', 'dane',
  'danp', 'dans', 'muse', 'musp', 'muss', 'tegm', 'tegs', 'estr', 'adults',
  'ai_opportunity_score', 'ai_reason_similarity', 'ai_custom_pitch',
  'ai_enriched_at', 'ai_enriched_by_ref', 'web_url',
].join(', ');

export async function fetchAllCentersForMap(): Promise<CatEducationCenterFull[]> {
  if (!supabase) return [];
  const allRows: CatEducationCenterFull[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('cat_education_centers')
      .select(MAP_COLUMNS)
      .not('coordenades_geo_y', 'is', null)
      .range(from, from + PAGE_SIZE - 1);

    if (error || !data) break;
    allRows.push(...(data as unknown as CatEducationCenterFull[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
}
