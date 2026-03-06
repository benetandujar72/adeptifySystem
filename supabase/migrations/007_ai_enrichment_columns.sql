-- ===================================================================
-- Adeptify Systems - Migration 007
-- Add AI enrichment columns to cat_education_centers
-- Purpose: Persist network-prospecting AI data back to the centers table
-- ===================================================================

BEGIN;

-- 1. Add AI enrichment columns
ALTER TABLE public.cat_education_centers
  ADD COLUMN IF NOT EXISTS ai_opportunity_score    smallint,
  ADD COLUMN IF NOT EXISTS ai_reason_similarity    text,
  ADD COLUMN IF NOT EXISTS ai_custom_pitch         text,
  ADD COLUMN IF NOT EXISTS ai_enriched_at          timestamptz,
  ADD COLUMN IF NOT EXISTS ai_enriched_by_ref      text;

-- 2. Add website URL column (for Task 2 scraping)
ALTER TABLE public.cat_education_centers
  ADD COLUMN IF NOT EXISTS web_url                 text;

-- 3. Index for quick queries on enriched centers
CREATE INDEX IF NOT EXISTS idx_cat_centers_ai_score
  ON public.cat_education_centers (ai_opportunity_score DESC NULLS LAST)
  WHERE ai_opportunity_score IS NOT NULL;

-- 4. RLS policy: allow service_role to UPDATE (server-side writes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cat_education_centers'
      AND policyname = 'Service role full access on cat_education_centers'
  ) THEN
    EXECUTE 'CREATE POLICY "Service role full access on cat_education_centers"
      ON public.cat_education_centers
      FOR ALL
      USING (auth.role() = ''service_role'')
      WITH CHECK (auth.role() = ''service_role'')';
  END IF;
END $$;

COMMIT;
