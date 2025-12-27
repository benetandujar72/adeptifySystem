import { supabase } from './supabaseClient';

export type CatEducationCenter = {
  codi_centre: string;
  denominacio_completa: string;
  nom_municipi?: string | null;
  nom_comarca?: string | null;
  codi_postal?: string | null;
};

export async function searchCatEducationCenters(query: string, limit = 12): Promise<CatEducationCenter[]> {
  const q = (query || '').trim();
  if (!supabase) return [];
  if (q.length < 2) return [];

  const pattern = `%${q}%`;

  const { data, error } = await supabase
    .from('cat_education_centers')
    .select('codi_centre, denominacio_completa, nom_municipi, nom_comarca, codi_postal')
    .or(`denominacio_completa.ilike.${pattern},nom_municipi.ilike.${pattern},nom_comarca.ilike.${pattern}`)
    .order('denominacio_completa', { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return data as CatEducationCenter[];
}
