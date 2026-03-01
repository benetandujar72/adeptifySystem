-- Migration: Leads, Campaigns and Automation System
-- Integrates with existing tenant and center structure

-- 1) Campaigns Table
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  description text,
  status text not null default 'active', -- active, paused, completed
  goal text,
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Leads Table
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  email text not null,
  full_name text,
  phone text,
  company_name text,
  center_key text, -- Optional link to existing education centers
  source text, -- web, linkedin, manual, etc.
  status text not null default 'new', -- new, qualified, proposal_sent, closed, lost
  ai_needs_analysis jsonb, -- Results from Phase 2 (Gemini analysis)
  tags text[],
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_slug, email)
);

create index if not exists leads_tenant_email_idx on public.leads(tenant_slug, email);
create index if not exists leads_status_idx on public.leads(status);

-- 3) Lead Interactions & History
create table if not exists public.lead_interactions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  interaction_type text not null, -- email_sent, ai_analysis, proposal_generated, meeting, etc.
  content_summary text,
  payload_json jsonb, -- Full data (e.g. the actual AI prompt/response or email body)
  created_at timestamptz not null default now()
);

-- 4) Automated Tasks / Queue (Optional but recommended for reliability)
create table if not exists public.automation_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  lead_id uuid references public.leads(id),
  task_type text not null, -- send_proposal, analyze_needs
  status text not null default 'pending', -- pending, processing, completed, failed
  retry_count integer default 0,
  last_error text,
  scheduled_for timestamptz default now(),
  created_at timestamptz not null default now()
);

-- Update triggers for updated_at
drop trigger if exists trg_campaigns_updated_at on public.campaigns;
create trigger trg_campaigns_updated_at
before update on public.campaigns
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at
before update on public.leads
for each row execute procedure public.set_updated_at();
