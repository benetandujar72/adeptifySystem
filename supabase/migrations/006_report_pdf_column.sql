-- Add PDF column to report_downloads (alongside existing docx_base64)
ALTER TABLE public.report_downloads
  ADD COLUMN IF NOT EXISTS pdf_base64 text;
