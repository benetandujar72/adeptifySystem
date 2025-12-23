
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { ProposalData, DiagnosisState, Task, ProductType } from "../types";

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const INTERNAL_KNOWLEDGE_BASE = `
CATÀLEG DE SOLUCIONS ADEPTIFY:

1. FORMACIÓ LLEUGERA (LMS)
- Objectiu: Eliminar l'ús d'emails per a formació. Aplicació fora de línia.
- Preu Suggerit: 2.500€ Configuració Inicial + 150€/mes.
- Components: Servidor Edge, Aplicació Claustre, Mòdul Seguiment Fora de Línia.

2. LLISTES DE VERIFICACIÓ IA (AUDITORIA)
- Objectiu: Digitalitzar inspeccions d'aules, menjadors o seguretat.
- Preu Suggerit: 1.800€ Configuració Inicial + 95€/mes.
- Components: Motor de Verificació Visual, Tauler de Compliment, Exportador PDF Legal.

3. VISIÓ ARTIFICIAL (INSPECCIÓ AUTOMÀTICA)
- Objectiu: Comptatge d'alumnes, detecció de perills o OCR de documents.
- Preu Suggerit: 4.500€ Configuració Inicial + 300€/mes per càmera/mòdul.
- Components: Unitat de Processament Local (NPU), Integració CCTV, Alertes en Temps Real.

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
    
    IMPORTANT: TOTA LA TEVA RESPOSTA HA D'ESTAR EN CATALÀ.

    CONTEXT DE PRODUCTE:
    ${INTERNAL_KNOWLEDGE_BASE}

    REGLA DE GENERACIÓ:
    - Si el producte és LMS, pregunta sobre mètodes d'entrenament actuals i problemes de connexió.
    - Si és AUDITORIA, pregunta sobre processos de revisió manual i pèrdua de dades.
    - Si és VISION, pregunta sobre necessitats de seguretat o volum de dades visuals.
    - NO facis preguntes genèriques. Sigues extremadament específic i tècnic.

    HISTORIAL ACTUAL:
    ${historyStr}

    Respon NOMÉS amb un JSON vàlid en CATALÀ:
    {
      "question": "Pregunta intel·ligent i provocativa en català",
      "options": ["Opció A en català", "Opció B en català", "Opció C en català", "Opció D en català"],
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
  
  const prompt = `Genera una PROPOSTA D'ENGINYERIA PROFESSIONAL d'alt nivell per al centre "${diagnosis.centerName}".
    TOTA LA PROPOSTA HA D'ESTAR REDACTADA EN CATALÀ PROFESSIONAL.
    
    Producte triat: ${diagnosis.selectedProduct}
    Historial de l'auditoria (RESPOSTES REALS):
    ${historyStr}

    DOCUMENTACIÓ DE REFERÈNCIA DE COSTOS:
    ${INTERNAL_KNOWLEDGE_BASE}

    REQUISITS CRÍTICS DEL JSON DE SORTIDA (EN CATALÀ):
    1. diagnosis: Paràgraf impactant sobre els problemes detectats.
    2. items: Mínim 5 conceptes (Llicència, Configuració, Infraestructura, Formació, Suport).
    3. phases: 4 fases (Fase 1: Auditoria Tècnica, Fase 2: Implementació, Fase 3: Capacitació, Fase 4: Posada en Marxa).
    4. nextGenFundsInfo: Detalls sobre elegibilitat NextGen.

    Respon en JSON estructural segons ProposalData en CATALÀ. No afegeixis text fora del JSON.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });

  return JSON.parse(response.text || '{}') as ProposalData;
}

export function createAdeptifyChat(clientContext: string = ''): Chat {
  const ai = getAi();
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: { 
        systemInstruction: `Ets el suport tècnic sènior i consultor personalitzat d'Adeptify. 
        
        IMPORTANT: RESPON SEMPRE EN CATALÀ.

        LA TEVA FONT PRIMÀRIA D'INFORMACIÓ ÉS EL CONTEXT DEL CLIENT:
        ${clientContext || 'No hi ha context previ del client encara.'}

        BASE DE CONEIXEMENT GENERAL D'ADEPTIFY:
        ${INTERNAL_KNOWLEDGE_BASE}

        INSTRUCCIONS:
        1. Respon SEMPRE en català basant-te en les dades del context del client.
        2. Si pregunten pel seu projecte, cita detalls de la seva auditoria o la seva proposta.
        3. Manté un to professional, executiu i orientat a l'eficiència.
        4. No inventis dades.
        5. Utilitza format visual (negretes, llistes).` 
    },
  });
}

export async function analyzeTasksIntelligence(tasks: Task[]): Promise<string> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analitza tasques en català: ${JSON.stringify(tasks)}`,
  });
  return response.text || "";
}

export async function generateOfficialDocument(type: 'PGA' | 'MEMORIA', context: string, indicators: string, preview: boolean): Promise<string> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Redacta ${type} oficial en català per a centre educatiu basant-te en el context: ${context} i els indicadors: ${indicators}.`,
  });
  return response.text || "";
}
