-- ===================================================================
-- Adeptify Systems — Migration 008
-- CRM enhancements: campaign linkage, regional import, notes table
-- ===================================================================

BEGIN;

-- 1. Link leads to campaigns (nullable so old leads keep working)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS campaign_id     uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS region          text DEFAULT 'Catalunya',
  ADD COLUMN IF NOT EXISTS pais            text DEFAULT 'ES-CT',
  ADD COLUMN IF NOT EXISTS codi_centre_ref text; -- soft ref to cat_education_centers.codi_centre

-- 2. Regional import support for cat_education_centers
ALTER TABLE public.cat_education_centers
  ADD COLUMN IF NOT EXISTS region text DEFAULT 'Catalunya',
  ADD COLUMN IF NOT EXISTS pais   text DEFAULT 'ES-CT',
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'generalitat_api';

-- 3. CRM notes table (user-authored, separate from system interactions)
CREATE TABLE IF NOT EXISTS public.crm_notes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    uuid        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  content    text        NOT NULL,
  created_by text        NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id
  ON public.leads(campaign_id) WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_region
  ON public.leads(region);

CREATE INDEX IF NOT EXISTS idx_leads_status_tenant
  ON public.leads(tenant_slug, status);

CREATE INDEX IF NOT EXISTS idx_crm_notes_lead_id
  ON public.crm_notes(lead_id);

CREATE INDEX IF NOT EXISTS idx_cat_centers_region
  ON public.cat_education_centers(region);

-- 5. RLS for crm_notes
ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'crm_notes'
      AND policyname = 'Service role full access on crm_notes'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Service role full access on crm_notes"
        ON public.crm_notes FOR ALL
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role')
    $pol$;
  END IF;
END $$;

-- 6. RPC for campaign stats (avoids N+1 queries)
CREATE OR REPLACE FUNCTION public.get_campaign_stats(p_tenant_slug text)
RETURNS TABLE (
  campaign_id uuid,
  lead_count  bigint,
  open_count  bigint,
  sent_count  bigint
) LANGUAGE sql STABLE AS $$
  SELECT
    l.campaign_id,
    COUNT(DISTINCT l.id)                                                        AS lead_count,
    COUNT(CASE WHEN li.metadata_json->>'opened_at' IS NOT NULL THEN 1 END)     AS open_count,
    COUNT(CASE WHEN li.interaction_type = 'bulk_email' THEN 1 END)             AS sent_count
  FROM public.leads l
  LEFT JOIN public.lead_interactions li ON li.lead_id = l.id
  WHERE l.tenant_slug = p_tenant_slug
    AND l.campaign_id IS NOT NULL
  GROUP BY l.campaign_id;
$$;

COMMIT;
