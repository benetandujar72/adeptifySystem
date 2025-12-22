
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
  
  const prompt = `Ets el Consultor Senior d'Eficiència d'Adeptify SLU.
    
    OBJECTIU: Has de realitzar una auditoria profunda per detectar ineficiències crítiques. 
    FILOSOFIA: No et conformis amb respostes superficials. Si el client diu que usa "Excel", pregunta pel volum de dades o qui ho gestiona.
    
    HISTORIAL ACTUAL:
    ${historyStr}
    
    CONTEXT: ${currentDiagnosis.centerName} | Àrees: ${currentDiagnosis.category}
    
    RESTRICCIONS:
    1. No finalitzis (isComplete: true) fins que no tinguis almenys 3-4 interaccions de qualitat.
    2. Proporciona respostes tancades (options) però que obliguin a decidir sobre la complexitat.
    3. Si ja tens prou informació per dissenyar una solució tècnica, marca isComplete: true.
    
    Respon OBLIGATÒRIAMENT en JSON:
    {
      "question": "Pregunta incisiva i professional",
      "options": ["Opció A", "Opció B", "Opció C", "Opció D"],
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
        temperature: 0.3
      }
    });
    return JSON.parse(response.text || '{}') as DynamicQuestion;
  } catch (error) {
    return { 
      question: "Per acabar de perfilar la proposta, quin és el repte més gran que voleu resoldre aquest trimestre?", 
      options: ["Reducció de burocràcia", "Millora de la comunicació", "Automatització de notes", "Seguretat de dades"], 
      isMultiSelect: false, 
      isComplete: history.length > 2, 
      confidence: 80 
    };
  }
}

export async function generateEducationalProposal(diagnosis: DiagnosisState): Promise<ProposalData> {
  const ai = getAi();
  const historyStr = (diagnosis.consultationHistory || []).map(h => `Q: ${h.question}\nA: ${h.answer}`).join('\n');
  
  const prompt = `Genera un PRESSUPOST TÈCNIC detallat per Adeptify SLU.
    Client: ${diagnosis.centerName} | Àrees: ${diagnosis.category}
    Dades recollides: ${historyStr}

    ESTRUCTURA DEL JSON:
    {
      "diagnosis": "Resum professional de la situació actual detectada",
      "solution": "Descripció tècnica de la solució a implementar",
      "initialSetupFee": número (entre 1200 i 4500),
      "miniAppSuggestion": {
        "name": "Nom seductor de la solució",
        "features": ["funció 1", "funció 2", "funció 3"],
        "implementationTime": "X setmanes"
      },
      "items": [
        {"concept": "Enginyeria de Dades", "description": "Detall del servei", "price": número},
        {"concept": "Configuració de Sistemes", "description": "Detall", "price": número}
      ],
      "subscriptionPlans": [
        {"name": "Standard", "monthlySoftwarePrice": 120, "monthlyServerPrice": 40, "features": ["Feature A", "Feature B"], "isRecommended": true}
      ],
      "phases": [
        {"name": "Fase 1", "startWeek": 1, "durationWeeks": 2, "description": "Acció inicial"}
      ],
      "implementationTime": "4-6 setmanes",
      "roi": "Estimació de temps estalviat"
    }

    REGLA: Sigues extremadament detallat en els conceptes. No usis la paraula 'IA'. Respon només el JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const data = JSON.parse(response.text || '{}');
    
    // Garantir valors per defecte per evitar crash de renderitzat
    const subtotal = (data.items || []).reduce((acc: number, item: any) => acc + (Number(item.price) || 0), 0) || 1200;
    const iva = subtotal * ADEPTIFY_INFO.taxRate;
    
    return {
      diagnosis: data.diagnosis || "S'ha detectat una fragmentació operativa que requereix intervenció immediata.",
      solution: data.solution || "Implementació d'un nucli de dades centralitzat.",
      initialSetupFee: data.initialSetupFee || subtotal,
      miniAppSuggestion: data.miniAppSuggestion || { name: "Adeptify Core Platform", features: ["Automatització", "Traçabilitat"], implementationTime: "4 setmanes" },
      items: data.items || [{ concept: "Setup Inicial", description: "Configuració base del sistema", price: subtotal }],
      subscriptionPlans: data.subscriptionPlans || [{ name: "Standard", monthlySoftwarePrice: 150, monthlyServerPrice: 50, features: ["Suport 24/7", "Cloud"] }],
      phases: data.phases || [{ name: "Audit & Setup", startWeek: 1, durationWeeks: 2, description: "Desplegament inicial" }],
      subtotal,
      iva,
      totalInitial: subtotal + iva,
      implementationTime: data.implementationTime || "4 setmanes",
      roi: data.roi || "30% estalvi de temps"
    } as ProposalData;
  } catch (error) {
    console.error("Critical Gemini Error:", error);
    // Fallback absolut per evitar pàgina en blanc
    return {
      diagnosis: "Diagnòstic preliminar completat amb èxit.",
      solution: "Optimització integral de processos i sistemes.",
      initialSetupFee: 1500,
      items: [{ concept: "Implementació Tècnica", description: "Configuració completa", price: 1500 }],
      subscriptionPlans: [{ name: "Standard", monthlySoftwarePrice: 150, monthlyServerPrice: 50, features: ["Dashboard", "Suport"] }],
      phases: [{ name: "Implementació", startWeek: 1, durationWeeks: 4, description: "Execució" }],
      subtotal: 1500,
      iva: 315,
      totalInitial: 1815,
      implementationTime: "4 setmanes",
      roi: "Alt impacte operacional"
    } as ProposalData;
  }
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
