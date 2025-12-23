-- Adeptify Systems - Supabase schema (idempotent)
-- Creates the tables used by services/consultationService.ts:
--  - public.consultations
--  - public.chat_messages
--
-- Notes:
-- - This project uses the Supabase anon key from the browser.
-- - To keep things working with no auth/RLS setup, RLS is left DISABLED.

begin;

create table if not exists public.consultations (
  id text primary key,
  center_name text not null,
  contact_email text,
  product_type text,
  audit_history jsonb not null default '[]'::jsonb,
  proposal_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists consultations_created_at_idx
  on public.consultations (created_at desc);

create index if not exists consultations_center_name_idx
  on public.consultations (center_name);

alter table public.consultations disable row level security;


create table if not exists public.chat_messages (
  id bigserial primary key,
  center_id text not null,
  role text not null check (role in ('user', 'model')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_center_id_created_at_idx
  on public.chat_messages (center_id, created_at);

alter table public.chat_messages disable row level security;

commit;
