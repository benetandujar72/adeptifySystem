
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { ProposalData, DiagnosisState, Task } from "../types";
import { ADEPTIFY_INFO } from "../constants";

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface DynamicQuestion {
  question: string;
  options: string[];
  isMultiSelect: boolean;
  isComplete: boolean;
  confidence: number;
}

export async function getNextConsultantQuestion(history: { question: string; answer: string }[], currentDiagnosis: DiagnosisState): Promise<DynamicQuestion> {
  const ai = getAi();
  const historyStr = history.map(h => `Q: ${h.question}\nA: ${h.answer}`).join('\n');
  
  // Prompt optimitzat per evitar bucles i forçar la presa de decisions
  const prompt = `Ets el Consultor Senior d'Eficiència d'Adeptify SLU. El teu client està esgotat.
    
    FILOSOFIA: "Cero fricció". No preguntis coses generals. Sigues incisiu.
    RESTRICCIÓ: Prohibit usar la paraula 'IA'. Usa 'Sistemes Intel·ligents'.
    
    HISTORIAL ACTUAL (NO REPETEIXIS TEMES):
    ${historyStr}
    
    CONTEXT INICIAL: ${currentDiagnosis.centerName} | Àrees: ${currentDiagnosis.category}
    
    INSTRUCCIONS:
    1. Analitza l'historial. Si ja saps quines eines usen i quina és la seva queixa principal, marca isComplete: true IMMEDIATAMENT.
    2. Si realment et falta una dada crítica (com el volum d'alumnes o el programari de gestió), pregunta-ho ARA.
    3. Si l'historial té més de 3 preguntes, has de marcar isComplete: true obligatòriament i finalitzar el diagnòstic.
    4. Proporciona de 4 a 6 opcions de resposta molt concretes per estalviar temps.
    
    Respon OBLIGATÒRIAMENT en JSON:
    {
      "question": "...",
      "options": ["...", "..."],
      "isMultiSelect": boolean,
      "isComplete": boolean,
      "confidence": 0-100
    }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        temperature: 0.2 // Reduïm creativitat per evitar bucles
      }
    });
    const data = JSON.parse(response.text || '{}');
    
    // Forçat de seguretat: si portem més de 4 preguntes, finalitzem
    if (history.length >= 4) {
      data.isComplete = true;
    }
    
    return data as DynamicQuestion;
  } catch (error) {
    return { 
      question: "Per acabar, quin volum d'alumnes gestioneu aproximadament?", 
      options: ["Menys de 200", "200 - 500", "500 - 1000", "Més de 1000"], 
      isMultiSelect: false, 
      isComplete: history.length > 2, 
      confidence: 90 
    };
  }
}

export async function generateEducationalProposal(diagnosis: DiagnosisState): Promise<ProposalData> {
  const ai = getAi();
  const historyStr = (diagnosis.consultationHistory || []).map(h => `Q: ${h.question}\nA: ${h.answer}`).join('\n');
  
  const prompt = `Genera un PRESSUPOST TÈCNIC COMERCIAL per Adeptify SLU.
    Client: ${diagnosis.centerName} | Email: ${diagnosis.contactEmail}
    Diagnòstic: ${historyStr}

    REQUISITS ECONÒMICS (Sigues realista però seductor):
    1. InitialSetupFee: Pagament únic d'enginyeria (1200€ - 3800€).
    2. SubscriptionPlans: 
       - Quota Mensual de Programari: Amortització del desenvolupament (90€ - 250€/mes).
       - Manteniment de Servidor dedicat: (30€ - 80€/mes).
    3. Phases: Defineix 4 fases que es puguin solapar (Ex: Setmana 2 a 4, Setmana 3 a 5).
    4. Prohibida la paraula 'IA'. Usa 'Arquitectura de Sistemes Intel·ligents'.

    Respon en JSON amb l'estructura de ProposalData definida.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });

  const data = JSON.parse(response.text || '{}');
  const subtotal = (data.items || []).reduce((acc: number, item: any) => acc + (item.price || 0), 0);
  const iva = subtotal * ADEPTIFY_INFO.taxRate;
  const totalInitial = subtotal + iva;

  return { ...data, subtotal, iva, totalInitial } as ProposalData;
}

export async function analyzeTasksIntelligence(tasks: Task[]): Promise<string> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Com a consultor expert, dóna un consell breu per optimitzar aquestes tasques educatives usant sistemes intel·ligents: ${JSON.stringify(tasks)}`,
  });
  return response.text || "";
}

export function createAdeptifyChat(): Chat {
  const ai = getAi();
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: { 
        systemInstruction: 'Ets el Consultor Senior d’Adeptify SLU. Mai usis la paraula IA. Parla de Sistemes Intel·ligents i Eficiència Operativa. Sigues breu, empàtic i seductor professionalment.' 
    },
  });
}

export async function generateOfficialDocument(type: 'PGA' | 'MEMORIA', context: string, indicators: string, preview: boolean): Promise<string> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Redacta un document oficial tipus ${type} basat en aquest context: ${context} i aquests indicadors: ${indicators}. Prohibit usar la paraula IA.`,
  });
  return response.text || "";
}
