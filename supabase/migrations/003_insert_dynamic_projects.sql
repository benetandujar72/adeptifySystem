-- Migration to insert dynamic project examples: Assistatut and MatchCare

INSERT INTO public.project_examples (
  id,
  title_ca, title_es, title_eu,
  description_ca, description_es, description_eu,
  hours, deployment, ai_cost, maintenance,
  dev_cost, ownership_cost,
  category, image_url, repo_url
) VALUES (
  gen_random_uuid(),
  'Assistatut: Copilot IA per a la Gestió de Tuteles',
  'Assistatut: Copiloto IA para la Gestión de Tutelas',
  'Assistatut: IA Kopilotua Tutoretza Kudeaketarako',
  'Aplicació MVP multi-tenant per a fundacions tutelars. Backend segur amb Supabase i Frontend React PWA. IA generativa integrada via WebSockets per a l''anàlisi de documentació legal i generació d''informes.',
  'Aplicación MVP multi-tenant para fundaciones tutelares. Backend seguro con Supabase y Frontend React PWA. IA generativa integrada vía WebSockets para el análisis de documentación legal y generación de informes.',
  'MVP multi-tenant aplikazioa fundazio tutelarrentzat. Backend segurua Supabase-rekin eta Frontend React PWA. IA sortzailea WebSockets bidez integratuta dokumentazio legala aztertzeko eta txostenak sortzeko.',
  '+2.000 h. estalviades l''any 1',
  '4 setmanes',
  '~35€/mes',
  '250€/mes',
  '4.500 €',
  'Inclòs',
  'LegalTech / AI',
  '/assistatut.png',
  null
),
(
  gen_random_uuid(),
  'MatchCare: Plataforma de Matching per a Cures',
  'MatchCare: Plataforma de Matching para Cuidados',
  'MatchCare: Zaintza Matching Plataforma',
  'Portal B2B2C que emparella famílies amb cuidadors professionals. Algorisme de matching basat en perfils psicosocials. Avaluacions ADEC amb formularis condicionals segons escales Barthel/Zarit.',
  'Portal B2B2C que empareja familias con cuidadores profesionales. Algoritmo de matching basado en perfiles psicosocials. Evaluaciones ADEC con formularios condicionales según escalas Barthel/Zarit.',
  'B2B2C ataria familiak eta zaintzaile profesionalak lotzeko. Matching algoritmoa profil psikosozialen bidez. ADEC ebaluazioak galdetegi baldintzatuekin Barthel/Zarit eskala arabera.',
  '+50h/mes en gestió HR',
  '6 setmanes',
  '~15€/mes',
  '300€/mes',
  '6.200 €',
  'Inclòs',
  'HealthTech',
  '/matchcare.png',
  null
);
