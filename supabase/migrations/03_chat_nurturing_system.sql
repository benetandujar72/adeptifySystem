-- Migration: Chat Nurturing System

create table if not exists public.lead_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  channel text not null, -- whatsapp, linkedin, email_chat
  role text not null, -- user, assistant
  content text not null,
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lead_messages_lead_id_idx on public.lead_messages(lead_id);

-- Add a column to leads to track the current "Nurturing Stage"
alter table public.leads
add column if not exists nurturing_stage text default 'initial_contact'; 
-- Stages: initial_contact, engaged, objection_handling, ready_for_meeting, closed
