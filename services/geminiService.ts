
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { ProposalData, DiagnosisState, Task, ProductType } from "../types";
import { Language } from "../translations";

type EnvLike = Record<string, unknown> | undefined;

const getApiKey = (): string | undefined => {
  // IMPORTANT: Vite injects custom env vars only when accessed via
  // `import.meta.env.VITE_*` (static property access). Avoid computed access.
  const fromVite = import.meta.env.VITE_GEMINI_API_KEY;
  if (typeof fromVite === 'string' && fromVite.trim()) return fromVite.trim();

  // Backward-compatible fallback for older builds.
  const env = (process.env as EnvLike) || {};
  const key = (env as any).GEMINI_API_KEY || (env as any).API_KEY;
  return typeof key === 'string' && key.trim() ? key.trim() : undefined;
};

const getAi = (): GoogleGenAI | null => {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  try {
    return new GoogleGenAI({ apiKey });
  } catch {
    return null;
  }
};

// Required preferred order (falls back if a model isn't available for the API key/project).
const MODEL_FALLBACK_ORDER = [
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

const shouldTryNextModel = (err: unknown): boolean => {
  const message = (err as any)?.message;
  if (typeof message !== 'string') return true;
  // Common cases where retrying with another model can help.
  return (
    message.toLowerCase().includes('model') ||
    message.toLowerCase().includes('not found') ||
    message.toLowerCase().includes('invalid') ||
    message.toLowerCase().includes('permission') ||
    message.toLowerCase().includes('403') ||
    message.toLowerCase().includes('404')
  );
};

async function generateContentWithFallback(
  ai: GoogleGenAI,
  models: string[],
  request: Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'> & { model?: string }
) {
  let lastError: unknown;
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({ ...request, model } as any);
      return { response, modelUsed: model };
    } catch (e) {
      lastError = e;
      if (!shouldTryNextModel(e)) break;
    }
  }
  throw lastError;
}

function normalizeAnswers(answer: unknown): string[] {
  if (Array.isArray(answer)) return answer.map(x => String(x)).map(s => s.trim()).filter(Boolean);
  const str = typeof answer === 'string' ? answer : String(answer ?? '');
  const trimmed = str.trim();
  return trimmed ? [trimmed] : [];
}

function formatHistoryForPrompt(
  history: { question: string; answer: string[] }[],
  lang: Language
): string {
  const qLabel = lang === 'ca' ? 'Pregunta' : 'Pregunta';
  const aLabel = lang === 'ca' ? 'Respostes' : 'Respuestas';
  const noneLabel = lang === 'ca' ? '(sense resposta)' : '(sin respuesta)';

  return (history || [])
    .map(h => {
      const answers = normalizeAnswers((h as any)?.answer);
      const bullets = answers.length ? answers.map(a => `- ${a}`).join('\n') : `- ${noneLabel}`;
      return `${qLabel}: ${h.question}\n${aLabel}:\n${bullets}`;
    })
    .join('\n\n');
}

function detectAudience(diagnosis: DiagnosisState, history: { question: string; answer: string[] }[]): 'school' | 'family' | 'other' {
  const cat = String((diagnosis as any)?.category ?? '').toLowerCase();
  if (cat.includes('fam')) return 'family';
  if (cat.includes('cent') || cat.includes('esco') || cat.includes('coleg') || cat.includes('instit')) return 'school';

  const blob = (history || [])
    .flatMap(h => [h.question, ...(h.answer || [])])
    .join(' ')
    .toLowerCase();
  if (blob.includes('famil')) return 'family';
  if (blob.includes('centre') || blob.includes('escuela') || blob.includes('escola') || blob.includes('colegio') || blob.includes('institut')) return 'school';
  return 'other';
}

export interface DynamicQuestion {
  question: string;
  options: string[];
  isMultiSelect: boolean;
  isComplete: boolean;
  confidence: number;
  modelUsed?: string;
}

export async function getNextConsultantQuestion(
  history: { question: string; answer: string[] }[], 
  diagnosis: DiagnosisState,
  lang: Language = 'ca'
): Promise<DynamicQuestion> {
  const ai = getAi();
  if (!ai) {
    return {
      question: lang === 'ca'
        ? "Falta configuració del sistema. Pots tornar-ho a provar més tard?"
        : "Falta configuración del sistema. ¿Puedes volver a intentarlo más tarde?",
      options: [lang === 'ca' ? 'Reintentar' : 'Reintentar'],
      isMultiSelect: false,
      isComplete: false,
      confidence: 0,
    };
  }
  const historyStr = formatHistoryForPrompt(history, lang);
  const langName = lang === 'ca' ? 'CATALÀ' : 'CASTELLÀ';
  const audience = detectAudience(diagnosis, history);
  
  const prompt = lang === 'ca'
    ? (audience === 'family'
      ? `ACTUA COM UN CONSULTOR SÈNIOR D'EFICIÈNCIA I ORGANITZACIÓ PER A FAMÍLIES.
OBJECTIU: entendre què està generant tensió, desordre o manca de temps a casa per proposar una solució de "vida fàcil".

REGLES CRÍTIQUES:
- PARLA SEMPRE EN ${langName}.
- No facis servir llenguatge tècnic. Prohibit parlar de "API", "Base de dades", "Backend", "Workflow".
- Parla de "temps de qualitat", "rutines", "convivència", "organització".
- Fes servir exemples familiars: "discussions", "deures", "pantalles", "horaris", "tasques de casa".

HISTORIAL:
${historyStr}

Respon en aquest format JSON (i només JSON):
{
  "question": "Pregunta amable i humana en ${langName}",
  "options": ["Opció 1 en ${langName}", "Opció 2", "Altres..."],
  "isMultiSelect": boolean,
  "isComplete": boolean,
  "confidence": 0-100
}`
      : `ACTUA COM UN CONSULTOR SÈNIOR D'EFICIÈNCIA PER A ESCOLES.
OBJECTIU: entendre on perd temps el claustre per proposar una solució de "vida fàcil".

REGLES CRÍTIQUES:
- PARLA SEMPRE EN ${langName}.
- No facis servir llenguatge tècnic. Prohibit parlar de "API", "Base de dades", "Backend", "Workflow".
- Parla de "paperassa", "lladres de temps", "pau a la sala de profes", "seguiment d'alumnes".
- Fes servir exemples de l'escola: "reunions eternes", "correus de famílies", "Excels compartits".

HISTORIAL:
${historyStr}

Respon en aquest format JSON (i només JSON):
{
  "question": "Pregunta amable i humana en ${langName}",
  "options": ["Opció 1 en ${langName}", "Opció 2", "Altres..."],
  "isMultiSelect": boolean,
  "isComplete": boolean,
  "confidence": 0-100
}`)
    : (audience === 'family'
      ? `ACTÚA COMO UN CONSULTOR SÉNIOR DE EFICIENCIA Y ORGANIZACIÓN PARA FAMILIAS.
OBJETIVO: entender qué genera tensión, desorden o falta de tiempo en casa para proponer una solución de "vida fácil".

REGLAS CRÍTICAS:
- HABLA SIEMPRE EN ${langName}.
- No uses lenguaje técnico. Prohibido hablar de "API", "Base de datos", "Backend", "Workflow".
- Habla de "tiempo de calidad", "rutinas", "convivencia", "organización".
- Usa ejemplos familiares: "discusiones", "deberes", "pantallas", "horarios", "tareas de casa".

HISTORIAL:
${historyStr}

Responde en este formato JSON (y solo JSON):
{
  "question": "Pregunta amable y humana en ${langName}",
  "options": ["Opción 1 en ${langName}", "Opción 2", "Otros..."],
  "isMultiSelect": boolean,
  "isComplete": boolean,
  "confidence": 0-100
}`
      : `ACTÚA COMO UN CONSULTOR SÉNIOR DE EFICIENCIA PARA COLEGIOS.
OBJETIVO: entender dónde pierde tiempo el claustro para proponer una solución de "vida fácil".

REGLAS CRÍTICAS:
- HABLA SIEMPRE EN ${langName}.
- No uses lenguaje técnico. Prohibido hablar de "API", "Base de datos", "Backend", "Workflow".
- Habla de "papeleo", "ladrones de tiempo", "calma en la sala de profesores", "seguimiento del alumnado".
- Usa ejemplos del centro: "reuniones eternas", "correos de familias", "Excels compartidos".

HISTORIAL:
${historyStr}

Responde en este formato JSON (y solo JSON):
{
  "question": "Pregunta amable y humana en ${langName}",
  "options": ["Opción 1 en ${langName}", "Opción 2", "Otros..."],
  "isMultiSelect": boolean,
  "isComplete": boolean,
  "confidence": 0-100
}`);

  try {
      const { response, modelUsed } = await generateContentWithFallback(ai, MODEL_FALLBACK_ORDER, {
        contents: prompt,
        config: { responseMimeType: "application/json", temperature: 0.4 },
      });
    
    const data = JSON.parse(response.text || '{}');
    return {
      question: data.question || (lang === 'ca' ? "Com podem ajudar?" : "¿Cómo podemos ayudar?"),
      options: Array.isArray(data.options) ? data.options : ["Continuar", "Altres..."],
      isMultiSelect: !!data.isMultiSelect,
      isComplete: !!data.isComplete,
      confidence: data.confidence || 0,
      modelUsed
    };
  } catch (e) {
      console.error('Gemini error (getNextConsultantQuestion):', e);
    return {
      question: lang === 'ca' ? "Hi ha un petit problema. Continuem?" : "Hay un pequeño problema. ¿Continuamos?",
      options: ["Reintentar"],
      isMultiSelect: false,
      isComplete: false,
      confidence: 0
    };
  }
}

export async function generateEducationalProposal(diagnosis: DiagnosisState, lang: Language = 'ca'): Promise<ProposalData> {
  const ai = getAi();
  if (!ai) {
    throw new Error(lang === 'ca'
      ? 'Falta configuració del sistema (API).'
      : 'Falta configuración del sistema (API).');
  }
  const historyStr = formatHistoryForPrompt(diagnosis.consultationHistory || [], lang);
  const langName = lang === 'ca' ? 'CATALÀ' : 'CASTELLÀ';
  
  const prompt = lang === 'ca'
    ? `ETS UN CONSULTOR ESTRATÈGIC SÈNIOR PER A CENTRES EDUCATIUS.
Objectiu: generar un INFORME FINAL I PRESSUPOST molt minuciós, exhaustiu, elegant i professional.

REGLES CRÍTIQUES:
- Escriu estrictament en ${langName}.
- Prohibit parlar d'API, backend, base de dades o detalls tècnics.
- To executiu, clar i orientat a direcció.
- Retorna NOMÉS JSON vàlid (sense Markdown, sense text extra).

COHERÈNCIA ECONÒMICA (OBLIGATÒRIA):
- "totalInitial" HA DE SER EXACTAMENT la suma de "items[].price".
- Per a cada partida: "items[].price" HA DE SER EXACTAMENT (items[].hours * items[].hourlyRate).
- La suma de "phases[].cost" HA DE SER EXACTAMENT igual a "totalInitial".
- "totals.initial" = "totalInitial".
- "totals.recurringMonthly" = "subscription.pricePerMonth".
- "totals.estimatedFirstYear" = totalInitial + (12 * subscription.pricePerMonth).
- Els "addons" són OPCIONALS i NO s'han d'incloure dins "totals" (són extres fora del paquet base).

POLÍTICA DE PREUS (TRIA'LS TU, PERÒ SIGUES CONSTANT):

MODALITAT DE LLIURAMENT (OBLIGATÒRIA):
- Per defecte, assumeix que el client vol una implementació accelerada (IA + revisió humana) per reduir costos i guanyar rapidesa.
- Has de pressupostar explicitament com a "Implementació accelerada (IA + revisió humana)" quan l'objectiu sigui RAPIDESA i REDUCCIÓ DE COSTOS.
- Aquesta modalitat prioritza: reutilització de components, configuració, plantilles, automatitzacions i iteracions ràpides; evita desenvolupament a mida innecessari.
- Només proposa "Desenvolupament estàndard" si el context indica integracions complexes, requisits legals específics o personalitzacions profundes.

POLÍTICA DE PREUS (TRIA'LS TU, PERÒ SIGUES CONSTANT):
- Implementació accelerada (IA + revisió humana): base inicial típica 2.900€–5.900€.
- Desenvolupament estàndard: base inicial típica 6.900€–12.900€ (només si cal).
- Tarifa hora orientativa (per a "items" amb hours/hourlyRate):
  - Accelerada: 55€–85€/h.
  - Estàndard: 85€–120€/h.
- Subscripció mensual de manteniment: 190€/mes–390€/mes segons seguiment (triar baixa per a accelerada).
- Inclou 3–5 "addons" amb preus creïbles: setup 0€–2.500€ i/o 29€–149€/mes.

CENTRE: "${diagnosis.centerName}".
HISTORIAL (preguntes i respostes):
${historyStr}

Genera un JSON que compleixi EXACTAMENT aquesta estructura (ProposalData):
{
  "diagnosis": string,
  "solution": string,
  "consultationRecap": [{
    "question": string,
    "answers": string[],
    "systemInterpretation": string,
    "systemResponse": string
  }],
  "solutionDetails": [{
    "title": string,
    "painPoint": string,
    "howItSolvesIt": string,
    "examples": string[]
  }],
  "items": [{"concept": string, "description": string, "hours": number, "hourlyRate": number, "price": number}],
  "totalInitial": number,
  "subscription": {
    "name": string,
    "pricePerMonth": number,
    "includes": string[],
    "sla": string
  },
  "addons": [{
    "name": string,
    "description": string,
    "setupPrice": number,
    "pricePerMonth": number
  }],
  "totals": {
    "initial": number,
    "recurringMonthly": number,
    "estimatedFirstYear": number
  },
  "nextGenFundsInfo": string,
  "implementationTime": string,
  "roi": string,
  "phases": [{
    "name": string,
    "startWeek": number,
    "durationWeeks": number,
    "description": string,
    "cost": number,
    "deliverables": string[],
    "successCriteria": string[]
  }],
  "meta": {"generatedAt": string}
}
Recomanacions:
- A "solution" inclou una secció final de "Crida a l'acció" amb pròxims passos.
- Pressupost: especifica què inclou / què no inclou.
- Pressupost (TRANSPARÈNCIA): a cada partida de "items" indica també "hours" i "hourlyRate" (€/h) perquè el client vegi el càlcul.
- Pressupost (CONTROL DE COST): prioritza el mínim viable i quick-wins en 2–4 setmanes si el cas ho permet.
- Fases: entregables i criteris d'èxit per fase.
- A la "subscription" descriu clarament manteniment, suport i millores.
- A "addons" proposa opcions extra amb més funcionalitats.`
    : `ERES UN CONSULTOR ESTRATÉGICO SÉNIOR PARA CENTROS EDUCATIVOS.
Objetivo: generar un INFORME FINAL Y PRESUPUESTO muy minucioso, exhaustivo, elegante y profesional.

REGLAS CRÍTICAS:
- Escribe estrictamente en ${langName}.
- Prohibido hablar de API, backend, base de datos o detalles técnicos.
- Tono ejecutivo, claro y orientado a dirección.
- Devuelve SOLO JSON válido (sin Markdown, sin texto extra).

COHERENCIA ECONÓMICA (OBLIGATORIA):
- "totalInitial" DEBE SER EXACTAMENTE la suma de "items[].price".
- Para cada partida: "items[].price" DEBE SER EXACTAMENTE (items[].hours * items[].hourlyRate).
- La suma de "phases[].cost" DEBE SER EXACTAMENTE igual a "totalInitial".
- "totals.initial" = "totalInitial".
- "totals.recurringMonthly" = "subscription.pricePerMonth".
- "totals.estimatedFirstYear" = totalInitial + (12 * subscription.pricePerMonth).
- Los "addons" son OPCIONALES y NO deben incluirse dentro de "totals" (son extras fuera del pack base).

POLÍTICA DE PRECIOS (ELÍGELOS TÚ, PERO SÉ CONSTANTE):

MODALIDAD DE ENTREGA (OBLIGATORIA):
- Por defecto, asume que el cliente quiere una implementación acelerada (IA + revisión humana) para reducir costes y ganar rapidez.
- Debes presupuestar explícitamente como "Implementación acelerada (IA + revisión humana)" cuando el objetivo sea RAPIDEZ y REDUCCIÓN DE COSTES.
- Esta modalidad prioriza: reutilización de componentes, configuración, plantillas, automatizaciones e iteraciones rápidas; evita desarrollo a medida innecesario.
- Solo propone "Desarrollo estándar" si el contexto indica integraciones complejas, requisitos legales específicos o personalizaciones profundas.

POLÍTICA DE PRECIOS (ELÍGELOS TÚ, PERO SÉ CONSTANTE):
- Implementación acelerada (IA + revisión humana): base inicial típica 2.900€–5.900€.
- Desarrollo estándar: base inicial típica 6.900€–12.900€ (solo si hace falta).
- Tarifa hora orientativa (para "items" con hours/hourlyRate):
  - Acelerada: 55€–85€/h.
  - Estándar: 85€–120€/h.
- Suscripción mensual de mantenimiento: 190€/mes–390€/mes según seguimiento (elige baja para acelerada).
- Incluye 3–5 "addons" con precios creíbles: alta 0€–2.500€ y/o 29€–149€/mes.

CENTRO: "${diagnosis.centerName}".
HISTORIAL (preguntas y respuestas):
${historyStr}

Genera un JSON que cumpla EXACTAMENTE esta estructura (ProposalData):
{
  "diagnosis": string,
  "solution": string,
  "consultationRecap": [{
    "question": string,
    "answers": string[],
    "systemInterpretation": string,
    "systemResponse": string
  }],
  "solutionDetails": [{
    "title": string,
    "painPoint": string,
    "howItSolvesIt": string,
    "examples": string[]
  }],
  "items": [{"concept": string, "description": string, "hours": number, "hourlyRate": number, "price": number}],
  "totalInitial": number,
  "subscription": {
    "name": string,
    "pricePerMonth": number,
    "includes": string[],
    "sla": string
  },
  "addons": [{
    "name": string,
    "description": string,
    "setupPrice": number,
    "pricePerMonth": number
  }],
  "totals": {
    "initial": number,
    "recurringMonthly": number,
    "estimatedFirstYear": number
  },
  "nextGenFundsInfo": string,
  "implementationTime": string,
  "roi": string,
  "phases": [{
    "name": string,
    "startWeek": number,
    "durationWeeks": number,
    "description": string,
    "cost": number,
    "deliverables": string[],
    "successCriteria": string[]
  }],
  "meta": {"generatedAt": string}
}

Recomendaciones:
- En "solution" incluye una sección final de "Llamada a la acción" con próximos pasos.
- Presupuesto: especifica qué incluye / qué no incluye.
- Presupuesto (TRANSPARENCIA): en cada partida de "items" indica también "hours" y "hourlyRate" (€/h) para que el cliente vea el cálculo.
- Presupuesto (CONTROL DE COSTES): prioriza el mínimo viable y quick-wins en 2–4 semanas si el caso lo permite.
- Fases: entregables y criterios de éxito por fase.
- En "subscription" describe claramente mantenimiento, soporte y mejoras.
- En "addons" propone extras con más funcionalidades.`;

  try {
    const { response, modelUsed } = await generateContentWithFallback(ai, MODEL_FALLBACK_ORDER, {
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const data = JSON.parse(response.text || '{}');
    return {
      ...data,
      meta: {
        ...(data?.meta || {}),
        modelUsed,
        generatedAt: data?.meta?.generatedAt || new Date().toISOString(),
      },
    } as ProposalData;
  } catch (e) {
    console.error('Gemini error (generateEducationalProposal):', e);
    throw new Error(lang === 'ca'
      ? "Error generant la proposta. (Revisa la clau/API i possibles restriccions de domini)"
      : "Error generando la propuesta. (Revisa la clave/API y posibles restricciones de dominio)");
  }
}

export type DafoResult = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  automationIdeas: Array<{ title: string; description: string; impact: 'low' | 'medium' | 'high'; effort: 'low' | 'medium' | 'high' }>;
  quickWins: string[];
  risksAndMitigations: Array<{ risk: string; mitigation: string }>;
  meta?: { modelUsed?: string; generatedAt?: string };
};

const compactCenterHistoryForPrompt = (
  histories: Array<{ question: string; answer: string[] }[]>,
  lang: Language,
) => {
  const rows: Array<{ q: string; a: string[] }> = [];
  for (const h of histories) {
    for (const item of h || []) {
      const q = String(item?.question ?? '').trim();
      const a = Array.isArray(item?.answer) ? item.answer.map(x => String(x).trim()).filter(Boolean) : [];
      if (!q || a.length === 0) continue;
      rows.push({ q, a });
    }
  }

  // Simple compression: group by question, merge unique answers.
  const grouped = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!grouped.has(r.q)) grouped.set(r.q, new Set());
    const set = grouped.get(r.q)!;
    for (const ans of r.a) {
      if (set.size >= 12) break;
      set.add(ans);
    }
  }

  const lines: string[] = [];
  for (const [q, answers] of grouped.entries()) {
    const list = Array.from(answers).slice(0, 10);
    const labelQ = lang === 'ca' ? 'P' : 'P';
    const labelA = lang === 'ca' ? 'R' : 'R';
    lines.push(`${labelQ}: ${q}`);
    lines.push(`${labelA}: ${list.join(' | ')}`);
  }
  return lines.slice(0, 220).join('\n');
};

export async function generateCenterDAFO(centerName: string, histories: Array<{ question: string; answer: string[] }[]>, lang: Language = 'ca'): Promise<DafoResult> {
  const ai = getAi();
  if (!ai) {
    throw new Error(lang === 'ca'
      ? 'Falta configuració del sistema (API).'
      : 'Falta configuración del sistema (API).');
  }

  const langName = lang === 'ca' ? 'CATALÀ' : 'CASTELLÀ';
  const compact = compactCenterHistoryForPrompt(histories, lang);
  const prompt = lang === 'ca'
    ? `ETS UN CONSULTOR SÈNIOR D'INNOVACIÓ EDUCATIVA.
Objectiu: generar un DAFO complet del centre i propostes d'automatització a mida.

REGLES:
- Escriu estrictament en ${langName}.
- Retorna NOMÉS JSON vàlid (sense Markdown, sense text extra).
- Sigues pràctic i orientat a direcció (prioritza impacte i rapidesa).

CENTRE: "${centerName}".
RESUM DE RESPOSTES AGREGADES (de diferents usuaris del mateix centre):
${compact}

Retorna EXACTAMENT aquest JSON:
{
  "summary": string,
  "strengths": string[],
  "weaknesses": string[],
  "opportunities": string[],
  "threats": string[],
  "automationIdeas": [{"title": string, "description": string, "impact": "low"|"medium"|"high", "effort": "low"|"medium"|"high"}],
  "quickWins": string[],
  "risksAndMitigations": [{"risk": string, "mitigation": string}],
  "meta": {"generatedAt": string}
}`
    : `ERES UN CONSULTOR SÉNIOR DE INNOVACIÓN EDUCATIVA.
Objetivo: generar un DAFO completo del centro y propuestas de automatización a medida.

REGLAS:
- Escribe estrictamente en ${langName}.
- Devuelve SOLO JSON válido (sin Markdown, sin texto extra).
- Sé práctico y orientado a dirección (prioriza impacto y rapidez).

CENTRO: "${centerName}".
RESUMEN DE RESPUESTAS AGREGADAS (de distintos usuarios del mismo centro):
${compact}

Devuelve EXACTAMENTE este JSON:
{
  "summary": string,
  "strengths": string[],
  "weaknesses": string[],
  "opportunities": string[],
  "threats": string[],
  "automationIdeas": [{"title": string, "description": string, "impact": "low"|"medium"|"high", "effort": "low"|"medium"|"high"}],
  "quickWins": string[],
  "risksAndMitigations": [{"risk": string, "mitigation": string}],
  "meta": {"generatedAt": string}
}`;

  const { response, modelUsed } = await generateContentWithFallback(ai, MODEL_FALLBACK_ORDER, {
    contents: prompt,
    config: { responseMimeType: 'application/json', temperature: 0.4 },
  });

  const data = JSON.parse(response.text || '{}');
  return {
    summary: data.summary || '',
    strengths: Array.isArray(data.strengths) ? data.strengths : [],
    weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : [],
    opportunities: Array.isArray(data.opportunities) ? data.opportunities : [],
    threats: Array.isArray(data.threats) ? data.threats : [],
    automationIdeas: Array.isArray(data.automationIdeas) ? data.automationIdeas : [],
    quickWins: Array.isArray(data.quickWins) ? data.quickWins : [],
    risksAndMitigations: Array.isArray(data.risksAndMitigations) ? data.risksAndMitigations : [],
    meta: {
      ...(data?.meta || {}),
      modelUsed,
      generatedAt: data?.meta?.generatedAt || new Date().toISOString(),
    },
  };
}

export async function generateCenterCustomProposal(centerName: string, histories: Array<{ question: string; answer: string[] }[]>, dafo: DafoResult, lang: Language = 'ca'): Promise<ProposalData> {
  const aggregatedHistory: { question: string; answer: string[] }[] = [];
  for (const h of histories) {
    for (const item of h || []) aggregatedHistory.push(item);
  }

  const diagnosis: DiagnosisState = {
    centerName,
    contactEmail: '',
    contactName: '',
    consultationHistory: aggregatedHistory,
    category: 'CENTRO',
  };

  // Reuse the standard proposal generator, but add DAFO context by appending it into the history as a synthetic item.
  const dafoText = JSON.stringify({
    summary: dafo.summary,
    strengths: dafo.strengths,
    weaknesses: dafo.weaknesses,
    opportunities: dafo.opportunities,
    threats: dafo.threats,
    automationIdeas: dafo.automationIdeas,
  });
  diagnosis.consultationHistory = [
    ...diagnosis.consultationHistory,
    { question: lang === 'ca' ? 'DAFO agregat del centre (intern)' : 'DAFO agregado del centro (interno)', answer: [dafoText] },
  ];

  return generateEducationalProposal(diagnosis, lang);
}

export function createAdeptifyChat(clientContext: string = '', lang: Language = 'ca'): Chat {
  const ai = getAi();
  if (!ai) {
    // Minimal shim so the UI can still operate and show a helpful message.
    return {
      sendMessage: async () => ({
        text: lang === 'ca'
          ? 'El xat no està configurat (API).'
          : 'El chat no está configurado (API).',
      }),
    } as unknown as Chat;
  }
  const langName = lang === 'ca' ? 'CATALÀ' : 'CASTELLÀ';
  for (const model of MODEL_FALLBACK_ORDER) {
    try {
      return ai.chats.create({
        model,
        config: {
          systemInstruction: `Ets l'ajudant personal d'Adeptify per a escoles. Parla sempre en ${langName}. Ets empàtic, educat i entens l'estrès d'un director escolar.`,
        },
      });
    } catch {
      // Try next model
    }
  }
  return {
    sendMessage: async () => ({
      text: lang === 'ca'
        ? 'El xat no està configurat (API).'
        : 'El chat no está configurado (API).',
    }),
  } as unknown as Chat;
}

export async function generateOfficialDocument(type: 'PGA' | 'MEMORIA', context: string, indicators: string, preview: boolean, lang: Language = 'ca'): Promise<string> {
  const ai = getAi();
  if (!ai) {
    return lang === 'ca'
      ? 'Falta configuració del sistema (API).'
      : 'Falta configuración del sistema (API).';
  }
  const langName = lang === 'ca' ? 'CATALÀ' : 'CASTELLÀ';
  const { response } = await generateContentWithFallback(ai, MODEL_FALLBACK_ORDER, {
    contents: `Ajuda'm a redactar un esborrany de ${type} escolar en ${langName}. Que soni oficial però fàcil de llegir. Context: ${context}. Dades: ${indicators}.`,
  });
  return response.text || "Generant...";
}

// Fix: Implementación de analyzeTasksIntelligence para TaskManager.tsx
export async function analyzeTasksIntelligence(tasks: Task[], lang: Language = 'ca'): Promise<string> {
  const ai = getAi();
  if (!ai) {
    return lang === 'ca' ? 'Sistema no configurat.' : 'Sistema no configurado.';
  }
  const tasksStr = tasks.map(t => `- [${t.status}] ${t.title} (Responsable: ${t.assignee}, Plazo: ${t.deadline})`).join('\n');

  const langName = lang === 'ca' ? 'CATALÀ' : 'CASTELLÀ';
  const prompt = `ACTUA COM UN CONSULTOR D'EFICIÈNCIA ESCOLAR.
Analitza la següent llista de tasques i dona un consell breu (màxim 20 paraules) per millorar la productivitat del claustre.
Sigues directe i pràctic.
\n\nREGLES:
- Respon sempre en ${langName}.
- Només una frase.
\n\nTASQUES:
${tasksStr}
\n\nRespon directament amb el consell.`;

  try {
    const { response } = await generateContentWithFallback(ai, MODEL_FALLBACK_ORDER, {
      contents: prompt,
    });
    return response.text || "No hi ha suggeriments en aquest moment.";
  } catch (e) {
    console.error('Gemini error (analyzeTasksIntelligence):', e);
    return lang === 'ca' ? 'Error analitzant les tasques.' : 'Error analizando las tareas.';
  }
}
