-- Migration: Add Magic Link Token for Zero-Friction Audits

alter table public.leads
add column if not exists magic_link_token uuid default gen_random_uuid();

-- Create an index to quickly look up leads by their magic link token
create index if not exists leads_magic_link_idx on public.leads(magic_link_token);

-- Add a column to track if the automated audit email was sent
alter table public.leads
add column if not exists audit_email_sent boolean default false;
