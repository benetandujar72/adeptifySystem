import { supabase } from './supabaseClient';

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
