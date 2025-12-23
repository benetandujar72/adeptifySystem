
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { ProposalData, DiagnosisState, Task, ProductType } from "../types";

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const INTERNAL_KNOWLEDGE_BASE = `
CATÀLEG DE SOLUCIONS ADEPTIFY:

1. FORMACIÓ LLEUGERA (LMS)
- Objectiu: Eliminar l'ús d'emails per a formació. App offline.
- Preu: 2.500€ Setup + 150€/mes.
- Diferenciador: No requereix correu de l'alumne, ideal per a personal operatiu o alumnes joves.

2. CHECKLISTS IA (AUDITORIA)
- Objectiu: Digitalitzar inspeccions d'aules, menjadors o seguretat.
- Preu: 1.800€ Setup + 95€/mes.
- Diferenciador: Geolocalització i evidència fotogràfica amb IA.

3. VISIÓ ARTIFICIAL (INSPECCIÓ AUTOMÀTICA)
- Objectiu: Comptatge d'alumnes, detecció de perills o OCR de documents.
- Preu: 4.500€ Setup + 300€/mes per càmera/mòdul.
- Diferenciador: Reducció del 90% del temps d'inspecció manual.

Tots els projectes són elegibles per fons NEXT GENERATION EU (Ajudes de 2.000€ a 12.000€).
`;

export interface DynamicQuestion {
  question: string;
  options: string[];
  isMultiSelect: boolean;
  isComplete: boolean;
  confidence: number;
}

export async function getNextConsultantQuestion(
  history: { question: string; answer: string }[], 
  diagnosis: DiagnosisState
): Promise<DynamicQuestion> {
  const ai = getAi();
  const historyStr = history.map(h => `Q: ${h.question}\nA: ${h.answer}`).join('\n');
  
  const prompt = `Ets el Consultor Especialista d'Adeptify per a la solució: ${diagnosis.selectedProduct}.
    
    CONTEXT DE PRODUCTE:
    ${INTERNAL_KNOWLEDGE_BASE}

    REGLA DE GENERACIÓ:
    - Si el producte és LMS, pregunta sobre mètodes d'entrenament actuals i problemes de connexió.
    - Si és CHECKLISTS, pregunta sobre processos de revisió manual i pèrdua de dades.
    - Si és VISION, pregunta sobre necessitats de seguretat o volum de dades visuals.
    - NO facis preguntes genèriques. Sigues extremadament específic i tècnic.

    HISTORIAL ACTUAL:
    ${historyStr}

    Respon NOMÉS amb un JSON vàlid:
    {
      "question": "Pregunta intel·ligent i provocativa",
      "options": ["Opció A", "Opció B", "Opció C", "Opció D"],
      "isMultiSelect": boolean,
      "isComplete": boolean (True només si ja tens prou info per fer un pressupost),
      "confidence": 0-100
    }`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { responseMimeType: "application/json", temperature: 0.7 }
  });
  
  return JSON.parse(response.text || '{}') as DynamicQuestion;
}

export async function generateEducationalProposal(diagnosis: DiagnosisState): Promise<ProposalData> {
  const ai = getAi();
  const historyStr = (diagnosis.consultationHistory || []).map(h => `Q: ${h.question}\nA: ${h.answer}`).join('\n');
  
  const prompt = `Genera una PROPOSTA D'ENGINYERIA PROFESSIONAL per a ${diagnosis.centerName}.
    Producte triat: ${diagnosis.selectedProduct}
    Historial de l'auditoria: ${historyStr}

    DOCUMENTACIÓ DE REFERÈNCIA:
    ${INTERNAL_KNOWLEDGE_BASE}

    El pressupost ha de ser realista, sense zeros. Desglossa els conceptes tècnics.
    Avalua la susceptibilitat de Fons NextGen basant-te en les respostes.

    Respon en JSON estructural segons ProposalData.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });

  return JSON.parse(response.text || '{}') as ProposalData;
}

export function createAdeptifyChat(): Chat {
  const ai = getAi();
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: { 
        systemInstruction: `Ets el suport tècnic sènior d'Adeptify. Coneixes al detall: ${INTERNAL_KNOWLEDGE_BASE}.` 
    },
  });
}

export async function analyzeTasksIntelligence(tasks: Task[]): Promise<string> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analitza tasques: ${JSON.stringify(tasks)}`,
  });
  return response.text || "";
}

export async function generateOfficialDocument(type: 'PGA' | 'MEMORIA', context: string, indicators: string, preview: boolean): Promise<string> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Redacta ${type} oficial per a centre educatiu.`,
  });
  return response.text || "";
}
