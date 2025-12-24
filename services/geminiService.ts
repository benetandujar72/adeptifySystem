
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { ProposalData, DiagnosisState, Task, ProductType } from "../types";
import { Language } from "../translations";

type EnvLike = Record<string, unknown> | undefined;

const getApiKey = (): string | undefined => {
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
  
  const prompt = lang === 'ca'
    ? `ACTUA COM UN CONSULTOR SÈNIOR D'EFICIÈNCIA PER A ESCOLES.
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
  "items": [{"concept": string, "description": string, "price": number}],
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
  "items": [{"concept": string, "description": string, "price": number}],
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
