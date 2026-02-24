-- ===================================================================
-- Adeptify Systems · Migració 001
-- Taula: public.project_examples
-- Propòsit: Exemples de projectes mostrats a ConsultorLanding
-- ===================================================================
-- Idempotent: es pot executar múltiples cops sense errors.
-- Executar via Supabase SQL Editor o psql:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -1 -f supabase/migrations/001_project_examples.sql

begin;

-- ── Taula principal ─────────────────────────────────────────────────
create table if not exists public.project_examples (
  id              text        primary key,

  -- Títols multiidioma
  title_ca        text        not null default '',
  title_es        text        not null default '',
  title_eu        text        not null default '',

  -- Descripcions multiidioma
  description_ca  text        not null default '',
  description_es  text        not null default '',
  description_eu  text        not null default '',

  -- Mètriques visibles al card
  hours           text        not null default '',
  deployment      text        not null default '',
  ai_cost         text        not null default '',
  maintenance     text        not null default '',

  -- Mètriques econòmiques (opcionals - s'afegeixen aquí directament)
  dev_cost        text,                       -- "4.200 €" · null → "Consultar"
  ownership_cost  text,                       -- "Inclòs" · null → "Inclòs"

  -- Metadades
  category        text,
  image_url       text,
  repo_url        text,
  created_at      timestamptz not null default now()
);

-- ── Afegir columnes si ja existia la taula sense elles ─────────────
-- (ALTER ADD COLUMN IF NOT EXISTS requereix PG ≥ 9.6; Supabase OK)
alter table public.project_examples
  add column if not exists dev_cost       text,
  add column if not exists ownership_cost text;

-- ── Índexos ─────────────────────────────────────────────────────────
create index if not exists project_examples_category_idx
  on public.project_examples (category);

create index if not exists project_examples_created_at_idx
  on public.project_examples (created_at desc);

-- ── RLS (desactivat, igual que les altres taules del projecte) ──────
alter table public.project_examples disable row level security;

-- ── Dades de demostració (upsert → idempotent) ──────────────────────
insert into public.project_examples (
  id, title_ca, title_es, title_eu,
  description_ca, description_es, description_eu,
  hours, deployment, ai_cost, maintenance,
  dev_cost, ownership_cost, category, image_url
) values
(
  'gestio-informes-centreMX',
  'Generador d''actes de reunió amb IA',
  'Generador de actas de reunión con IA',
  'Bilera-aktaren sortzailea IA-rekin',
  'Sistema que transcriu i resumeix automàticament les reunions d''equip i genera documents formals en minuts.',
  'Sistema que transcribe y resume automáticamente las reuniones de equipo y genera documentos formales en minutos.',
  'Talde-bilerak automatikoki transkribatu eta laburbiltzen dituen sistema, dokumentu formalak minututan sortuz.',
  '28 hores', '2 setmanes', '< 8 €/mes', '45 €/mes',
  '2.380 €', 'Inclòs',
  'automatitzacio', null
),
(
  'portal-families-escolarES',
  'Portal de comunicació amb famílies',
  'Portal de comunicación con familias',
  'Familien komunikazio ataria',
  'Dashboard centralitzat per a comunicacions entre centre i famílies: avisos, absències, tutories i circulars.',
  'Dashboard centralizado para comunicaciones entre centro y familias: avisos, ausencias, tutorías y circulares.',
  'Ikastegien eta familien arteko komunikaziorako aginte-mahaia: abisuak, absentziak, tutoretza eta zirkularrak.',
  '40 hores', '3 setmanes', '< 12 €/mes', '60 €/mes',
  '3.400 €', 'Inclòs',
  'comunicacio', null
),
(
  'dashboard-kpi-educatiu',
  'Panel de qualitat educativa KPI',
  'Panel de calidad educativa KPI',
  'KPI hezkuntza-kalitate panela',
  'Sistema d''indicadors en temps real per a direcció: ràtio alumne/docent, assistència, rendiment acadèmic i alertes.',
  'Sistema de indicadores en tiempo real para dirección: ratio alumno/docente, asistencia, rendimiento académico y alertas.',
  'Zuzendaritzarako denbora errealeko adierazleen sistema: ikasle/irakasle ratioa, asistentzia, errendimendu akademikoa eta alertak.',
  '52 hores', '4 setmanes', '< 20 €/mes', '90 €/mes',
  '4.420 €', 'Inclòs',
  'analítica', null
)
on conflict (id) do update set
  dev_cost       = excluded.dev_cost,
  ownership_cost = excluded.ownership_cost;

commit;
