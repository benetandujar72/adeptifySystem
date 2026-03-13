-- ===================================================================
-- Adeptify Systems — Migration 010
-- VIKOR multi-criteria matching scores on education centers
-- ===================================================================

BEGIN;

-- Add VIKOR-specific columns to cat_education_centers
ALTER TABLE public.cat_education_centers
  ADD COLUMN IF NOT EXISTS vikor_s REAL,
  ADD COLUMN IF NOT EXISTS vikor_r REAL,
  ADD COLUMN IF NOT EXISTS vikor_q REAL,
  ADD COLUMN IF NOT EXISTS vikor_rank INTEGER,
  ADD COLUMN IF NOT EXISTS vikor_computed_at TIMESTAMPTZ;

-- Index on vikor_q for efficient sorting
CREATE INDEX IF NOT EXISTS idx_centers_vikor_q
  ON public.cat_education_centers(vikor_q) WHERE vikor_q IS NOT NULL;

-- Update the unified clients view to include VIKOR scores
CREATE OR REPLACE VIEW public.v_unified_clients AS
SELECT
  l.id                 AS lead_id,
  l.tenant_slug,
  l.email,
  l.full_name,
  l.company_name,
  l.phone,
  l.status             AS lead_status,
  l.source,
  l.tags,
  l.ai_needs_analysis,
  l.codi_centre_ref,
  l.campaign_id,
  l.region,
  l.pais,
  l.open_count,
  l.click_count,
  l.conversion_score,
  l.last_contacted_at,
  l.nurturing_stage,
  l.created_at         AS lead_created_at,
  l.updated_at         AS lead_updated_at,
  c.denominacio_completa AS center_name,
  c.nom_naturalesa     AS center_type,
  c.nom_municipi       AS center_municipi,
  c.nom_comarca        AS center_comarca,
  c.adreca             AS center_address,
  c.codi_postal        AS center_postal,
  c.telefon            AS center_phone,
  c.email_centre       AS center_email,
  c.web_url            AS center_web,
  c.coordenades_geo_x  AS center_lon,
  c.coordenades_geo_y  AS center_lat,
  c.ai_opportunity_score,
  c.ai_custom_pitch,
  c.ai_reason_similarity,
  c.vikor_s,
  c.vikor_r,
  c.vikor_q,
  c.vikor_rank,
  (SELECT COUNT(*)::int FROM public.lead_interactions li WHERE li.lead_id = l.id)
    AS interaction_count,
  (SELECT COUNT(*)::int FROM public.consultations con
   WHERE con.contact_email IS NOT NULL AND lower(trim(con.contact_email)) = lower(trim(l.email)))
    AS consultation_count,
  (SELECT MAX(li.created_at) FROM public.lead_interactions li WHERE li.lead_id = l.id)
    AS last_interaction_at,
  COALESCE(c.denominacio_completa, l.company_name, l.email) AS display_name
FROM public.leads l
LEFT JOIN public.cat_education_centers c ON c.codi_centre = l.codi_centre_ref;

GRANT SELECT ON public.v_unified_clients TO anon, authenticated;

COMMIT;
