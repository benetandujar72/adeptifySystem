-- Production schema updates for Adeptify System
-- Apply this in Supabase SQL Editor (Database -> SQL) in your production project.
-- Safe to re-run (uses IF NOT EXISTS where possible).

-- 1) Extend consultations to store registration identity.
alter table if exists public.consultations
  add column if not exists contact_name text;

alter table if exists public.consultations
  add column if not exists center_key text;

-- Multi-tenant (route-based): store tenant slug for scoping.
alter table if exists public.consultations
  add column if not exists tenant_slug text;

-- Backfill center_key for existing rows.
-- Normalize: trim + collapse whitespace + lowercase.
update public.consultations
set center_key = lower(trim(regexp_replace(center_name, '\\s+', ' ', 'g')))
where center_key is null and center_name is not null;

create index if not exists consultations_center_key_idx
  on public.consultations(center_key);

create index if not exists consultations_tenant_slug_idx
  on public.consultations(tenant_slug);

create index if not exists consultations_tenant_center_key_idx
  on public.consultations(tenant_slug, center_key);

-- 2) Center-level insights (DAFO + custom proposal) aggregated from multiple consultations.
create table if not exists public.center_insights (
  center_key text primary key,
  center_name text,
  dafo_json jsonb,
  dafo_generated_at timestamptz,
  custom_proposal_json jsonb,
  custom_generated_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists center_insights_center_name_idx
  on public.center_insights(center_name);

-- Optional (recommended): keep updated_at current on upserts/updates.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_center_insights_updated_at on public.center_insights;
create trigger trg_center_insights_updated_at
before update on public.center_insights
for each row execute procedure public.set_updated_at();

-- 3) Tenant-scoped insights (recommended for real multi-tenant):
-- Separate table with composite primary key to avoid collisions across tenants.
create table if not exists public.center_insights_v2 (
  tenant_slug text not null,
  center_key text not null,
  center_name text,
  dafo_json jsonb,
  dafo_generated_at timestamptz,
  custom_proposal_json jsonb,
  custom_generated_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (tenant_slug, center_key)
);

create index if not exists center_insights_v2_center_name_idx
  on public.center_insights_v2(center_name);

create index if not exists center_insights_v2_tenant_slug_idx
  on public.center_insights_v2(tenant_slug);

drop trigger if exists trg_center_insights_v2_updated_at on public.center_insights_v2;
create trigger trg_center_insights_v2_updated_at
before update on public.center_insights_v2
for each row execute procedure public.set_updated_at();

-- SECURITY NOTE:
-- This app uses the Supabase anon key from the browser.
-- If you enable RLS, you must create appropriate policies; otherwise reads/writes will fail.
-- For a public demo, you can keep RLS disabled, but for real production you should add auth
-- and lock down policies to admins only.
