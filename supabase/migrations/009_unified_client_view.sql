-- ===================================================================
-- Adeptify Systems — Migration 009
-- Unified client view: bridges leads, centers, and consultations
-- ===================================================================

BEGIN;

-- 1. Index on leads.codi_centre_ref for efficient joins
CREATE INDEX IF NOT EXISTS idx_leads_codi_centre_ref
  ON public.leads(codi_centre_ref) WHERE codi_centre_ref IS NOT NULL;

-- 2. Index on consultations.contact_email for cross-referencing
CREATE INDEX IF NOT EXISTS idx_consultations_contact_email
  ON public.consultations(contact_email) WHERE contact_email IS NOT NULL;

-- 3. Backfill: link existing leads to centers by matching email
UPDATE public.leads l
SET codi_centre_ref = c.codi_centre
FROM public.cat_education_centers c
WHERE l.codi_centre_ref IS NULL
  AND l.email IS NOT NULL
  AND c.email_centre IS NOT NULL
  AND lower(trim(l.email)) = lower(trim(c.email_centre));

-- 4. Unified client view
--    Returns one row per lead, enriched with center + consultation data.
--    This is the single source of truth for the "Clients & Centres" tab.
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
  -- Center fields (NULL if no linked center)
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
  -- Aggregates
  (SELECT COUNT(*)::int FROM public.lead_interactions li WHERE li.lead_id = l.id)
    AS interaction_count,
  (SELECT COUNT(*)::int FROM public.consultations con
   WHERE con.contact_email IS NOT NULL AND lower(trim(con.contact_email)) = lower(trim(l.email)))
    AS consultation_count,
  (SELECT MAX(li.created_at) FROM public.lead_interactions li WHERE li.lead_id = l.id)
    AS last_interaction_at,
  -- Display name: prefer center name, fallback to company_name, then email
  COALESCE(c.denominacio_completa, l.company_name, l.email) AS display_name
FROM public.leads l
LEFT JOIN public.cat_education_centers c ON c.codi_centre = l.codi_centre_ref;

-- 5. RLS: view inherits from base tables (both have RLS disabled), but grant read
GRANT SELECT ON public.v_unified_clients TO anon, authenticated;

COMMIT;
