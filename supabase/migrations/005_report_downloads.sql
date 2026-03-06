-- Persist generated report downloads so they survive Cloud Run instance changes
CREATE TABLE IF NOT EXISTS public.report_downloads (
  job_id uuid PRIMARY KEY,
  client_name text,
  docx_base64 text,
  raw_json_base64 text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_downloads_created_idx
  ON public.report_downloads(created_at);

-- RLS: allow service role full access
ALTER TABLE public.report_downloads ENABLE ROW LEVEL SECURITY;
