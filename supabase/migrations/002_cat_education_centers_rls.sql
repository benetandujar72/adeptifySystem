-- Ensure RLS is enabled for the public.cat_education_centers table
DO $$ 
BEGIN
  -- We use a DO block to ensure this doesn't fail if the table hasn't been created yet
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cat_education_centers') THEN
    EXECUTE 'ALTER TABLE public.cat_education_centers ENABLE ROW LEVEL SECURITY';
    
    -- Recreate policy to be idempotent
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'cat_education_centers' 
        AND policyname = 'Enable public read access for cat_education_centers'
    ) THEN
        EXECUTE 'DROP POLICY "Enable public read access for cat_education_centers" ON public.cat_education_centers';
    END IF;

    -- Create read-only policy
    EXECUTE 'CREATE POLICY "Enable public read access for cat_education_centers" ON public.cat_education_centers FOR SELECT USING (true)';
  END IF;
END $$;
