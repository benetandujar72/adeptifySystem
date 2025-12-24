
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

const CHAT_MODEL_CANDIDATES = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
];

const PRO_MODEL_CANDIDATES = [
  'gemini-2.0-pro',
  'gemini-1.5-pro',
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
      return await ai.models.generateContent({ ...request, model } as any);
    } catch (e) {
      lastError = e;
      if (!shouldTryNextModel(e)) break;
    }
  }
  throw lastError;
}

export interface DynamicQuestion {
  question: string;
  options: string[];
  isMultiSelect: boolean;
  isComplete: boolean;
  confidence: number;
}

export async function getNextConsultantQuestion(
  history: { question: string; answer: string }[], 
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
  const historyStr = history.map(h => `Pregunta: ${h.question}\nResposta: ${h.answer}`).join('\n');
  const langName = lang === 'ca' ? 'CATALÀ' : 'CASTELLÀ';
  
  const prompt = `ACTUA COM UN CONSULTOR SENIOR D'EFICIÈNCIA PER A ESCOLES.
    OBJECTIU: Entendre on perd temps el claustre per proposar una solució de "vida fàcil".

    REGLES CRÍTIQUES:
    - PARLA SEMPRE EN ${langName}.
    - No facis servir llenguatge tècnic. Prohibit parlar de "API", "Base de dades", "Backend", "Workflow".
    - Parla de "papeleo", "lladres de temps", "pau a la sala de profes", "seguiment d'alumnes".
    - Fes servir exemples de l'escola: "reunions eternes", "correus de pares", "Excels compartits".

    HISTORIAL:
    ${historyStr}

    Respon en aquest format JSON:
    {
      "question": "Pregunta amable i humana en ${langName}",
      "options": ["Opció 1 en ${langName}", "Opció 2", "Altres..."],
      "isMultiSelect": boolean,
      "isComplete": boolean,
      "confidence": 0-100
    }`;

  try {
      const response = await generateContentWithFallback(ai, CHAT_MODEL_CANDIDATES, {
        contents: prompt,
        config: { responseMimeType: "application/json", temperature: 0.4 },
      });
    
    const data = JSON.parse(response.text || '{}');
    return {
      question: data.question || (lang === 'ca' ? "Com podem ajudar?" : "¿Cómo podemos ayudar?"),
      options: Array.isArray(data.options) ? data.options : ["Continuar", "Altres..."],
      isMultiSelect: !!data.isMultiSelect,
      isComplete: !!data.isComplete,
      confidence: data.confidence || 0
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
  const historyStr = (diagnosis.consultationHistory || []).map(h => `Pregunta: ${h.question}\nResposta: ${h.answer}`).join('\n');
  const langName = lang === 'ca' ? 'CATALÀ' : 'CASTELLÀ';
  
  const prompt = `ETS UN CONSULTOR ESTRATÈGIC PER A CENTRES EDUCATIUS.
    Prepara un pla per a "${diagnosis.centerName}".
    LLENGUATGE EN ${langName}, HUMÀ I PROPER.

    Estructura la proposta:
    1. Quins "lladres de temps" has detectat: ${historyStr}
    2. Com farem que les reunions de claustre es converteixin en tasques automàtiques.
    3. Com eliminarem la paperassa burocràtica.
    4. Un pressupost clar en ${langName}.

    Respon en format JSON ProposalData.`;

  try {
    const response = await generateContentWithFallback(ai, PRO_MODEL_CANDIDATES, {
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const data = JSON.parse(response.text || '{}');
    return data;
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
  return ai.chats.create({
    model: CHAT_MODEL_CANDIDATES[0],
    config: { 
        systemInstruction: `Ets l'ajudant personal d'Adeptify per a escoles. Parla sempre en ${langName}. Ets empàtic, educat i entens l'estrès d'un director escolar.` 
    },
  });
}

export async function generateOfficialDocument(type: 'PGA' | 'MEMORIA', context: string, indicators: string, preview: boolean, lang: Language = 'ca'): Promise<string> {
  const ai = getAi();
  if (!ai) {
    return lang === 'ca'
      ? 'Falta configuració del sistema (API).'
      : 'Falta configuración del sistema (API).';
  }
  const langName = lang === 'ca' ? 'CATALÀ' : 'CASTELLÀ';
  const response = await generateContentWithFallback(ai, PRO_MODEL_CANDIDATES, {
    contents: `Ajuda'm a redactar un esborrany de ${type} escolar en ${langName}. Que soni oficial però fàcil de llegir. Context: ${context}. Dades: ${indicators}.`,
  });
  return response.text || "Generant...";
}

// Fix: Implementación de analyzeTasksIntelligence para TaskManager.tsx
export async function analyzeTasksIntelligence(tasks: Task[]): Promise<string> {
  const ai = getAi();
  if (!ai) {
    return "Sistema no configurat.";
  }
  const tasksStr = tasks.map(t => `- [${t.status}] ${t.title} (Responsable: ${t.assignee}, Plazo: ${t.deadline})`).join('\n');
  
  const prompt = `ACTÚA COMO UN CONSULTOR DE EFICIENCIA ESCOLAR.
    Analiza la siguiente lista de tareas y ofrece un consejo breve (máximo 20 palabras) para mejorar la productividad del claustro.
    Sé directo y práctico. Responde siempre en Catalán como idioma principal, pero con un tono que cualquiera entienda.
    
    TAREAS:
    ${tasksStr}
    
    Responde directamente con el consejo.`;

  try {
    const response = await generateContentWithFallback(ai, CHAT_MODEL_CANDIDATES, {
      contents: prompt,
    });
    return response.text || "No hi ha suggeriments en aquest moment.";
  } catch (e) {
    console.error('Gemini error (analyzeTasksIntelligence):', e);
    return "Error analitzant les tasques.";
  }
}
