-- Migration: Advanced CRM Tracking System

-- 1. Extend Leads with engagement metrics
alter table public.leads
add column if not exists last_contacted_at timestamptz,
add column if not exists open_count integer default 0,
add column if not exists click_count integer default 0,
add column if not exists conversion_score integer default 0;

-- 2. Detail Interaction Table
alter table public.lead_interactions
add column if not exists metadata_json jsonb default '{}'::jsonb,
add column if not exists user_agent text,
add column if not exists ip_address text;

-- 3. Create a dedicated table for PDF Proposal Snapshots (to know exactly what was sent)
create table if not exists public.lead_proposals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  proposal_data jsonb not null,
  pdf_url text,
  created_at timestamptz default now()
);
