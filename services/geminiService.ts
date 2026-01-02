
import { ProposalData, DiagnosisState, Task, ProductType } from "../types";
import { Language } from "../translations";

type GenerateContentConfig = {
  responseMimeType?: string;
  temperature?: number;
};

type GenerateContentRequest = {
  contents: unknown;
  config?: GenerateContentConfig;
};

type GenerateContentResponseLike = {
  text?: string;
  raw?: unknown;
};

const toGeminiContents = (contents: unknown) => {
  if (Array.isArray(contents)) return contents;
  const text = typeof contents === 'string' ? contents : String(contents ?? '');
  return [{ role: 'user', parts: [{ text }] }];
};

const extractTextFromGeminiResponse = (raw: any): string => {
  const parts = raw?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    return parts.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('');
  }
  const text = raw?.candidates?.[0]?.content?.text;
  return typeof text === 'string' ? text : '';
};

async function generateContentViaProxy(model: string, request: GenerateContentRequest): Promise<GenerateContentResponseLike> {
  const url = `/api-proxy/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body = {
    contents: toGeminiContents(request.contents),
    generationConfig: request.config || undefined,
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const raw = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = typeof raw?.error?.message === 'string' ? raw.error.message : `Gemini proxy error (${resp.status})`;
    const err: any = new Error(msg);
    err.status = resp.status;
    err.raw = raw;
    throw err;
  }

  return {
    raw,
    text: extractTextFromGeminiResponse(raw),
  };
}

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
  models: string[],
  request: GenerateContentRequest
) {
  let lastError: unknown;
  for (const model of models) {
    try {
      const response = await generateContentViaProxy(model, request);
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
  const qLabel = lang === 'eu' ? 'Galdera' : 'Pregunta';
  const aLabel = lang === 'ca' ? 'Respostes' : lang === 'eu' ? 'Erantzunak' : 'Respuestas';
  const noneLabel = lang === 'ca' ? '(sense resposta)' : lang === 'eu' ? '(erantzunik gabe)' : '(sin respuesta)';

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
  const historyStr = formatHistoryForPrompt(history, lang);
  const langName = lang === 'ca' ? 'CATALÀ' : lang === 'eu' ? 'EUSKARA' : 'CASTELLÀ';
  const audience = detectAudience(diagnosis, history);
  const intakeMode = (diagnosis as any)?.intakeMode === 'clear_need' ? 'clear_need' : 'discovery';
  
  const prompt = intakeMode === 'clear_need'
    ? (lang === 'ca'
      ? `ETS UN CONSULTOR SÈNIOR D'ANÀLISI DE REQUISITS PER A PROJECTES DE PROGRAMACIÓ EN CENTRES EDUCATIUS.
OBJECTIU: obtenir informació suficient per passar-la a l'equip de programació i fer un pressupost realista.

REGLLES CRÍTIQUES:
- PARLA SEMPRE EN ${langName}.
- Fes preguntes de consultor: concretes, orientades a decisió i a reduir riscos.
- Pots parlar de "pantalles", "rols", "permisos", "notificacions", "integracions" i "dades" (sense entrar en tecnicismes innecessaris).
- Prioritza entendre: fluxos (pas a pas), actors (qui fa què), dades necessàries, comunicacions (emails), casos especials, privacitat (menors) i criteris d'èxit.

HISTORIAL:
${historyStr}

QUAN MARCAR "isComplete":
- Només marca isComplete=true quan ja tinguis: rols/usuaris, flux principal, regles de guàrdies, sistema de fitxatge (mètode), comunicacions (a qui/quan/què), dades d'alumnat (mínim necessari) i restriccions/termini.

Respon en aquest format JSON (i només JSON):
{
  "question": "Pregunta de consultor en ${langName}",
  "options": ["Opció 1 en ${langName}", "Opció 2", "Opció 3", "Altres..."],
  "isMultiSelect": boolean,
  "isComplete": boolean,
  "confidence": 0-100
}`
      : lang === 'eu'
        ? `HEZKUNTZA-ZENTROETAKO PROGRAMAZIO PROIEKTUETARAKO ESKAKIZUN-ANALISIKO AHOLKULARI SENIORRA ZARA.
HELBURUA: programazio-taldeari pasatzeko eta aurrekontu errealista egiteko behar den informazioa biltzea.

ARAU KRITIKOAK:
- BETI ${langName}-N HITZ EGIN.
- Aholkulari galderak egin: zehatzak, erabakiak hartzera bideratuak eta arriskuak murrizteko.
- "pantailak", "rolak", "baimenak", "jakinarazpenak", "integrazioak" eta "datuak" aipa ditzakezu (teknizismo gehiegirik gabe).
- Lehentasunak: fluxuak (pausoz pauso), aktoreak (nork zer egiten duen), datu beharrezkoak, komunikazioak (emailak), kasu bereziak, pribatutasuna (adingabeak) eta arrakasta-irizpideak.

HISTORIALA:
${historyStr}

NOIZ MARKATU "isComplete":
- isComplete=true bakarrik markatu honakoa baduzu: rolak/erabiltzaileak, fluxu nagusia, guardien arauak, fitxaketa-sistema (modua), komunikazioak (nori/noiz/zer), ikasleen datuak (beharrezko minimoa) eta murrizketak/epea.

Erantzun JSON formatu honetan (eta JSON bakarrik):
{
  "question": "Aholkulari-galdera ${langName}-n",
  "options": ["1. aukera ${langName}-n", "2. aukera", "3. aukera", "Besteak..."],
  "isMultiSelect": boolean,
  "isComplete": boolean,
  "confidence": 0-100
}`
        : `ERES UN CONSULTOR SÉNIOR DE ANÁLISIS DE REQUISITOS PARA PROYECTOS DE PROGRAMACIÓN EN CENTROS EDUCATIVOS.
OBJETIVO: obtener información suficiente para pasarla al equipo de programación y hacer un presupuesto realista.

REGLAS CRÍTICAS:
- HABLA SIEMPRE EN ${langName}.
- Haz preguntas de consultor: concretas, orientadas a decidir y a reducir riesgos.
- Puedes hablar de "pantallas", "roles", "permisos", "notificaciones", "integraciones" y "datos" (sin tecnicismos innecesarios).
- Prioriza entender: flujos (paso a paso), actores (quién hace qué), datos necesarios, comunicaciones (emails), casos especiales, privacidad (menores) y criterios de éxito.

HISTORIAL:
${historyStr}

CUÁNDO MARCAR "isComplete":
- Solo marca isComplete=true cuando ya tengas: roles/usuarios, flujo principal, reglas de guardias, sistema de fichaje (método), comunicaciones (a quién/cuándo/qué), datos del alumnado (mínimo necesario) y restricciones/plazo.

Responde en este formato JSON (y solo JSON):
{
  "question": "Pregunta de consultor en ${langName}",
  "options": ["Opción 1 en ${langName}", "Opción 2", "Opción 3", "Otros..."],
  "isMultiSelect": boolean,
  "isComplete": boolean,
  "confidence": 0-100
}`)
      : lang === 'ca'
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
      : audience === 'family'
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
  }`;

  try {
    const { response, modelUsed } = await generateContentWithFallback(MODEL_FALLBACK_ORDER, {
      contents: prompt,
      config: { responseMimeType: "application/json", temperature: 0.4 },
    });
    
    const data = JSON.parse(response.text || '{}');
    return {
      question: data.question || (lang === 'ca' ? "Com podem ajudar?" : lang === 'eu' ? "Nola lagun dezakegu?" : "¿Cómo podemos ayudar?"),
      options: Array.isArray(data.options) ? data.options : ["Continuar", "Altres..."],
      isMultiSelect: !!data.isMultiSelect,
      isComplete: !!data.isComplete,
      confidence: data.confidence || 0,
      modelUsed
    };
  } catch (e) {
      console.error('Gemini error (getNextConsultantQuestion):', e);
    return {
      question: lang === 'ca'
        ? "Hi ha un petit problema. Continuem?"
        : lang === 'eu'
          ? "Ara ara arazo txiki bat dago. Jarraitu?"
          : "Hay un pequeño problema. ¿Continuamos?",
      options: [lang === 'eu' ? 'Berriro saiatu' : "Reintentar"],
      isMultiSelect: false,
      isComplete: false,
      confidence: 0
    };
  }
}

export async function generateEducationalProposal(diagnosis: DiagnosisState, lang: Language = 'ca'): Promise<ProposalData> {
  const historyStr = formatHistoryForPrompt(diagnosis.consultationHistory || [], lang);
  const langName = lang === 'ca' ? 'CATALÀ' : lang === 'eu' ? 'EUSKARA' : 'CASTELLÀ';
  const intakeMode = (diagnosis as any)?.intakeMode === 'clear_need' ? 'clear_need' : 'discovery';
  const programmingSummaryNoteCa = intakeMode === 'clear_need'
    ? `\n- A "solution" inclou també una secció "Resumen para programación" (títol exactament així), amb 6–10 punts molt concrets per a l'equip de programació: rols, pantalles, fluxos, dades, notificacions, integracions, permisos i criteris d'acceptació.`
    : '';
  const programmingSummaryNoteEs = intakeMode === 'clear_need'
    ? `\n- En "solution" incluye también una sección "Resumen para programación" (título exactamente así), con 6–10 puntos muy concretos para el equipo de programación: roles, pantallas, flujos, datos, notificaciones, integraciones, permisos y criterios de aceptación.`
    : '';
  
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
- A "addons" proposa opcions extra amb més funcionalitats.${programmingSummaryNoteCa}`
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
- En "addons" propone extras con más funcionalidades.${programmingSummaryNoteEs}`;

  try {
    const { response, modelUsed } = await generateContentWithFallback(MODEL_FALLBACK_ORDER, {
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

export type CenterReport = {
  executiveSummary: string;
  consensus: string[];
  divergences: string[];
  priorities: string[];
  quickWins: string[];
  nextSteps: string[];
  sections?: Array<{
    category: string;
    summary: string;
    evidence: string[];
    recommendations: string[];
    suggestedKpis: string[];
    quickWins: string[];
  }>;
  performanceMetrics?: string[];
  openQuestions?: string[];
  meta?: { modelUsed?: string; generatedAt?: string };
};

function safeJsonParse(text: string | undefined): any {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    // Best-effort recovery: extract first JSON object.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return {};
      }
    }
    return {};
  }
}

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

const compactCenterHistoryWithCountsForPrompt = (
  histories: Array<{ question: string; answer: string[] }[]>,
  lang: Language,
) => {
  // Build per-question answer frequencies (normalized).
  const grouped = new Map<string, Map<string, number>>();
  for (const h of histories) {
    for (const item of h || []) {
      const q = String(item?.question ?? '').trim();
      const answers = Array.isArray(item?.answer)
        ? item.answer.map(x => String(x).trim()).filter(Boolean)
        : [];
      if (!q || answers.length === 0) continue;
      if (!grouped.has(q)) grouped.set(q, new Map());
      const freq = grouped.get(q)!;
      for (const a of answers) {
        const key = a.toLowerCase();
        freq.set(key, (freq.get(key) || 0) + 1);
      }
    }
  }

  const lines: string[] = [];
  for (const [q, freq] of grouped.entries()) {
    const top = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([ans, count]) => `${ans} (${count})`);

    const labelQ = lang === 'ca' ? 'P' : 'P';
    const labelA = lang === 'ca' ? 'R' : 'R';
    lines.push(`${labelQ}: ${q}`);
    lines.push(`${labelA}: ${top.join(' | ')}`);
  }
  return lines.slice(0, 240).join('\n');
};

export async function generateCenterDAFO(centerName: string, histories: Array<{ question: string; answer: string[] }[]>, lang: Language = 'ca'): Promise<DafoResult> {
  const langName = lang === 'ca' ? 'CATALÀ' : lang === 'eu' ? 'EUSKARA' : 'CASTELLÀ';
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

  const { response, modelUsed } = await generateContentWithFallback(MODEL_FALLBACK_ORDER, {
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

  const balanceText = compactCenterHistoryWithCountsForPrompt(histories, lang);
  diagnosis.consultationHistory = [
    ...diagnosis.consultationHistory,
    { question: lang === 'ca' ? 'Resum agregat amb freqüències (intern)' : 'Resumen agregado con frecuencias (interno)', answer: [balanceText] },
    { question: lang === 'ca' ? 'DAFO agregat del centre (intern)' : 'DAFO agregado del centro (interno)', answer: [dafoText] },
  ];

  return generateEducationalProposal(diagnosis, lang);
}

export async function generateCenterReport(centerName: string, histories: Array<{ question: string; answer: string[] }[]>, lang: Language = 'ca'): Promise<CenterReport> {
  const langName = lang === 'ca' ? 'CATALÀ' : lang === 'eu' ? 'EUSKARA' : 'CASTELLÀ';
  const compact = compactCenterHistoryWithCountsForPrompt(histories, lang);
  const prompt = lang === 'ca'
    ? `ETS UN CONSULTOR SÈNIOR D'EFICIÈNCIA I TRANSFORMACIÓ DIGITAL PER A CENTRES EDUCATIUS.
Objectiu: generar un INFORME el més profund, exhaustiu i detallat possible, però accionable.

REGLES CRÍTIQUES:
- Escriu estrictament en ${langName}.
- Retorna NOMÉS JSON vàlid (sense Markdown, sense text extra).
- Basa't en EVIDÈNCIA del resum (freqüències). No inventis dades.
- CATEGORITZA EN FUNCIÓ DE LES RESPOSTES (el significat del que diuen), no només pel text de les preguntes.
- Identifica consens i divergències (on hi ha desacord o respostes múltiples).
- Proposa mètriques (KPIs) mesurables i com recollir-les.

CENTRE: "${centerName}".
RESUM AGREGAT (amb freqüències aproximades):
${compact}

Retorna EXACTAMENT aquest JSON:
{
  "executiveSummary": string,
  "consensus": string[],
  "divergences": string[],
  "priorities": string[],
  "quickWins": string[],
  "sections": [
    {
      "category": string,
      "summary": string,
      "evidence": string[],
      "recommendations": string[],
      "suggestedKpis": string[],
      "quickWins": string[]
    }
  ],
  "performanceMetrics": string[],
  "openQuestions": string[],
  "nextSteps": string[],
  "meta": {"generatedAt": string}
}`
    : `ERES UN CONSULTOR SÉNIOR DE EFICIENCIA PARA CENTROS EDUCATIVOS.
Objetivo: generar un INFORME lo más profundo, exhaustivo y detallado posible, pero accionable.

REGLAS CRÍTICAS:
- Escribe estrictamente en ${langName}.
- Devuelve SOLO JSON válido (sin Markdown, sin texto extra).
- Basado en EVIDENCIA del resumen (frecuencias). No inventes datos.
- CATEGORIZA EN FUNCIÓN DE LAS RESPUESTAS (el significado), no solo por el texto de las preguntas.
- Identifica consenso y divergencias.
- Propón métricas (KPIs) medibles y cómo recogerlas.

CENTRO: "${centerName}".
RESUMEN AGREGADO (con frecuencias aproximadas):
${compact}

Devuelve EXACTAMENTE este JSON:
{
  "executiveSummary": string,
  "consensus": string[],
  "divergences": string[],
  "priorities": string[],
  "quickWins": string[],
  "sections": [
    {
      "category": string,
      "summary": string,
      "evidence": string[],
      "recommendations": string[],
      "suggestedKpis": string[],
      "quickWins": string[]
    }
  ],
  "performanceMetrics": string[],
  "openQuestions": string[],
  "nextSteps": string[],
  "meta": {"generatedAt": string}
}`;

  const { response, modelUsed } = await generateContentWithFallback(MODEL_FALLBACK_ORDER, {
    contents: prompt,
    config: { responseMimeType: 'application/json', temperature: 0.25 },
  });

  const data = safeJsonParse(response.text);
  return {
    executiveSummary: data.executiveSummary || '',
    consensus: Array.isArray(data.consensus) ? data.consensus : [],
    divergences: Array.isArray(data.divergences) ? data.divergences : [],
    priorities: Array.isArray(data.priorities) ? data.priorities : [],
    quickWins: Array.isArray(data.quickWins) ? data.quickWins : [],
    sections: Array.isArray(data.sections)
      ? data.sections.map((s: any) => ({
          category: String(s?.category ?? ''),
          summary: String(s?.summary ?? ''),
          evidence: Array.isArray(s?.evidence) ? s.evidence.map((x: any) => String(x)) : [],
          recommendations: Array.isArray(s?.recommendations) ? s.recommendations.map((x: any) => String(x)) : [],
          suggestedKpis: Array.isArray(s?.suggestedKpis) ? s.suggestedKpis.map((x: any) => String(x)) : [],
          quickWins: Array.isArray(s?.quickWins) ? s.quickWins.map((x: any) => String(x)) : [],
        })).filter((s: any) => s.category || s.summary)
      : [],
    performanceMetrics: Array.isArray(data.performanceMetrics)
      ? data.performanceMetrics.map((x: any) => String(x))
      : [],
    openQuestions: Array.isArray(data.openQuestions)
      ? data.openQuestions.map((x: any) => String(x))
      : [],
    nextSteps: Array.isArray(data.nextSteps) ? data.nextSteps : [],
    meta: {
      ...(data?.meta || {}),
      modelUsed,
      generatedAt: data?.meta?.generatedAt || new Date().toISOString(),
    },
  };
}

export function createAdeptifyChat(clientContext: string = '', lang: Language = 'ca') {
  const langName = lang === 'ca' ? 'CATALÀ' : lang === 'eu' ? 'EUSKARA' : 'CASTELLÀ';
  const systemInstruction = `Ets l'ajudant personal d'Adeptify per a escoles. Parla sempre en ${langName}. Ets empàtic, educat i entens l'estrès d'un director escolar.`;

  const history: Array<{ role: 'user' | 'model'; text: string }> = [];

  return {
    sendMessage: async ({ message }: { message: string }) => {
      history.push({ role: 'user', text: String(message ?? '') });
      const contextBlock = clientContext ? `CONTEXT CLIENT:\n${clientContext}\n\n` : '';
      const convo = history
        .slice(-14)
        .map(m => (m.role === 'user' ? `USUARI: ${m.text}` : `ASSISTENT: ${m.text}`))
        .join('\n');

      const prompt = `${systemInstruction}\n\n${contextBlock}${convo}\nASSISTENT:`;
      const { response } = await generateContentWithFallback(MODEL_FALLBACK_ORDER, {
        contents: prompt,
        config: { temperature: 0.35 },
      });

      const text = response.text || '';
      history.push({ role: 'model', text });
      return { text };
    },
  };
}

export async function generateOfficialDocument(type: 'PGA' | 'MEMORIA', context: string, indicators: string, preview: boolean, lang: Language = 'ca'): Promise<string> {
  const langName = lang === 'ca' ? 'CATALÀ' : lang === 'eu' ? 'EUSKARA' : 'CASTELLÀ';
  const { response } = await generateContentWithFallback(MODEL_FALLBACK_ORDER, {
    contents: `Ajuda'm a redactar un esborrany de ${type} escolar en ${langName}. Que soni oficial però fàcil de llegir. Context: ${context}. Dades: ${indicators}.`,
  });
  return response.text || "Generant...";
}

// Fix: Implementación de analyzeTasksIntelligence para TaskManager.tsx
export async function analyzeTasksIntelligence(tasks: Task[], lang: Language = 'ca'): Promise<string> {
  const tasksStr = tasks.map(t => `- [${t.status}] ${t.title} (Responsable: ${t.assignee}, Plazo: ${t.deadline})`).join('\n');

  const langName = lang === 'ca' ? 'CATALÀ' : lang === 'eu' ? 'EUSKARA' : 'CASTELLÀ';
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
    const { response } = await generateContentWithFallback(MODEL_FALLBACK_ORDER, {
      contents: prompt,
    });
    return response.text || "No hi ha suggeriments en aquest moment.";
  } catch (e) {
    console.error('Gemini error (analyzeTasksIntelligence):', e);
    return lang === 'ca' ? 'Error analitzant les tasques.' : 'Error analizando las tareas.';
  }
}
