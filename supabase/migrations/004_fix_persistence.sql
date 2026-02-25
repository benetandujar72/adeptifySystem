-- ===================================================================
-- Adeptify Systems · Migració 004
-- Taules: center_insights, center_insights_v2, center_artifacts, chat_messages
-- Propòsit: Persistència real al núvol per a l'Admin UI
-- ===================================================================

begin;

-- 1. Center Insights (V1 - Compatibilitat)
create table if not exists public.center_insights (
    center_key           text        primary key,
    center_name          text,
    dafo_json            jsonb       default '{}'::jsonb,
    dafo_generated_at    timestamptz,
    custom_proposal_json jsonb       default '{}'::jsonb,
    custom_generated_at  timestamptz,
    updated_at           timestamptz default now(),
    created_at           timestamptz default now()
);

-- 2. Center Insights (V2 - Tenant scoped)
create table if not exists public.center_insights_v2 (
    tenant_slug          text        not null,
    center_key           text        not null,
    center_name          text,
    dafo_json            jsonb       default '{}'::jsonb,
    dafo_generated_at    timestamptz,
    custom_proposal_json jsonb       default '{}'::jsonb,
    custom_generated_at  timestamptz,
    updated_at           timestamptz default now(),
    created_at           timestamptz default now(),
    primary key (tenant_slug, center_key)
);

-- 3. Center Artifacts (Històric per a la Base de Coneixement)
create table if not exists public.center_artifacts (
    id                   bigserial   primary key,
    tenant_slug          text,
    center_key           text        not null,
    center_name          text,
    artifact_type        text        not null, -- 'dafo', 'report', 'custom_proposal'
    payload_json         jsonb       not null default '{}'::jsonb,
    created_at           timestamptz default now()
);

-- 4. Chat Messages (Històric de xats de centre)
create table if not exists public.chat_messages (
    id                   bigserial   primary key,
    center_id            text        not null, -- tenantSlug::centerName
    role                 text        not null, -- 'user' | 'model'
    content              text        not null,
    created_at           timestamptz default now()
);

-- 5. AI Usage Logs
create table if not exists public.ai_usage_logs (
    id                   text        primary key,
    created_at           timestamptz not null,
    provider             text        not null,
    model                text        not null,
    purpose              text        not null,
    prompt_tokens        int,
    output_tokens        int,
    total_tokens         int,
    cost_eur             numeric
);

-- 6. Índexos per a rendiment
create index if not exists center_artifacts_center_key_idx on public.center_artifacts (center_key);
create index if not exists center_artifacts_tenant_slug_idx on public.center_artifacts (tenant_slug);
create index if not exists chat_messages_center_id_idx on public.chat_messages (center_id);
create index if not exists ai_usage_logs_created_at_idx on public.ai_usage_logs (created_at desc);

-- 7. Desactivar RLS temporalment per a desenvolupament ràpid (seguint el patró anterior)
alter table public.center_insights disable row level security;
alter table public.center_insights_v2 disable row level security;
alter table public.center_artifacts disable row level security;
alter table public.chat_messages disable row level security;
alter table public.ai_usage_logs disable row level security;

commit;
