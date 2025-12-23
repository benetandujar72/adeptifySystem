
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { ProposalData, DiagnosisState, Task, ProductType } from "../types";
import { Language } from "../translations";

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json", temperature: 0.4 }
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
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const data = JSON.parse(response.text || '{}');
    return data;
  } catch (e) {
    throw new Error("Error generant la proposta.");
  }
}

export function createAdeptifyChat(clientContext: string = '', lang: Language = 'ca'): Chat {
  const ai = getAi();
  const langName = lang === 'ca' ? 'CATALÀ' : 'CASTELLÀ';
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: { 
        systemInstruction: `Ets l'ajudant personal d'Adeptify per a escoles. Parla sempre en ${langName}. Ets empàtic, educat i entens l'estrès d'un director escolar.` 
    },
  });
}

export async function generateOfficialDocument(type: 'PGA' | 'MEMORIA', context: string, indicators: string, preview: boolean, lang: Language = 'ca'): Promise<string> {
  const ai = getAi();
  const langName = lang === 'ca' ? 'CATALÀ' : 'CASTELLÀ';
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Ajuda'm a redactar un esborrany de ${type} escolar en ${langName}. Que soni oficial però fàcil de llegir. Context: ${context}. Dades: ${indicators}.`,
  });
  return response.text || "Generant...";
}

// Fix: Implementación de analyzeTasksIntelligence para TaskManager.tsx
export async function analyzeTasksIntelligence(tasks: Task[]): Promise<string> {
  const ai = getAi();
  const tasksStr = tasks.map(t => `- [${t.status}] ${t.title} (Responsable: ${t.assignee}, Plazo: ${t.deadline})`).join('\n');
  
  const prompt = `ACTÚA COMO UN CONSULTOR DE EFICIENCIA ESCOLAR.
    Analiza la siguiente lista de tareas y ofrece un consejo breve (máximo 20 palabras) para mejorar la productividad del claustro.
    Sé directo y práctico. Responde siempre en Catalán como idioma principal, pero con un tono que cualquiera entienda.
    
    TAREAS:
    ${tasksStr}
    
    Responde directamente con el consejo.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "No hi ha suggeriments en aquest moment.";
  } catch (e) {
    return "Error analitzant les tasques.";
  }
}
