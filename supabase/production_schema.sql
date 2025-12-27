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

-- 4) Center artifacts history (DAFO / reports / custom proposals).
-- Stores immutable snapshots so the admin can view/download previous versions.
create extension if not exists pgcrypto;

create table if not exists public.center_artifacts (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text,
  center_key text not null,
  center_name text,
  artifact_type text not null,
  payload_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists center_artifacts_tenant_center_created_idx
  on public.center_artifacts(tenant_slug, center_key, created_at desc);

create index if not exists center_artifacts_type_idx
  on public.center_artifacts(artifact_type);

-- SECURITY NOTE:
-- This app uses the Supabase anon key from the browser.
-- If you enable RLS, you must create appropriate policies; otherwise reads/writes will fail.
-- For a public demo, you can keep RLS disabled, but for real production you should add auth
-- and lock down policies to admins only.

-- 5) Catalog: Centres educatius de Catalunya (TOTCAT).
-- Source CSV: totcat-centres-educatius.csv (semicolon-delimited).
-- Purpose: allow type-ahead center selection from DB.

create extension if not exists pg_trgm;

create table if not exists public.cat_education_centers (
  codi_centre text primary key,
  denominacio_completa text not null,
  codi_naturalesa text,
  nom_naturalesa text,
  codi_titularitat text,
  nom_titularitat text,
  adreca text,
  codi_postal text,
  telefon text,
  codi_delegacio text,
  nom_delegacio text,
  codi_comarca text,
  nom_comarca text,
  codi_municipi text,
  nom_municipi text,
  codi_districte_municipal text,
  nom_dm text,
  codi_localitat text,
  nom_localitat text,
  coordenades_utm_x integer,
  coordenades_utm_y integer,
  coordenades_geo_x double precision,
  coordenades_geo_y double precision,
  email_centre text,
  estudis text,
  einf1c boolean not null default false,
  einf2c boolean not null default false,
  epri boolean not null default false,
  eso boolean not null default false,
  batx boolean not null default false,
  aa01 boolean not null default false,
  cfpm boolean not null default false,
  ppas boolean not null default false,
  aa03 boolean not null default false,
  cfps boolean not null default false,
  ee boolean not null default false,
  ife boolean not null default false,
  pfi boolean not null default false,
  pa01 boolean not null default false,
  cfam boolean not null default false,
  pa02 boolean not null default false,
  cfas boolean not null default false,
  esdi boolean not null default false,
  escm boolean not null default false,
  escs boolean not null default false,
  adr boolean not null default false,
  crbc boolean not null default false,
  idi boolean not null default false,
  dane boolean not null default false,
  danp boolean not null default false,
  dans boolean not null default false,
  muse boolean not null default false,
  musp boolean not null default false,
  muss boolean not null default false,
  tegm boolean not null default false,
  tegs boolean not null default false,
  estr boolean not null default false,
  adults boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists cat_education_centers_name_trgm_idx
  on public.cat_education_centers using gin (denominacio_completa gin_trgm_ops);

create index if not exists cat_education_centers_muni_trgm_idx
  on public.cat_education_centers using gin (nom_municipi gin_trgm_ops);

create index if not exists cat_education_centers_comarca_idx
  on public.cat_education_centers(nom_comarca);

drop trigger if exists trg_cat_education_centers_updated_at on public.cat_education_centers;
create trigger trg_cat_education_centers_updated_at
before update on public.cat_education_centers
for each row execute procedure public.set_updated_at();
