
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { ProposalData, DiagnosisState, Task, ProductType } from "../types";

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const INTERNAL_KNOWLEDGE_BASE = `
CATÀLEG DE SOLUCIONS ADEPTIFY:

1. FORMACIÓ LLEUGERA (LMS)
- Objectiu: Eliminar l'ús d'emails per a formació. App offline.
- Preu Suggerit: 2.500€ Setup + 150€/mes.
- Components: Servidor Edge, App Claustre, Mòdul Seguiment Offline.

2. CHECKLISTS IA (AUDITORIA)
- Objectiu: Digitalitzar inspeccions d'aules, menjadors o seguretat.
- Preu Suggerit: 1.800€ Setup + 95€/mes.
- Components: Motor de Verificació Visual, Dashboard de Compliment, Exportador PDF Legal.

3. VISIÓ ARTIFICIAL (INSPECCIÓ AUTOMÀTICA)
- Objectiu: Comptatge d'alumnes, detecció de perills o OCR de documents.
- Preu Suggerit: 4.500€ Setup + 300€/mes per càmera/mòdul.
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
  
  const prompt = `Genera una PROPOSTA D'ENGINYERIA PROFESSIONAL d'alt nivell per al centre "${diagnosis.centerName}".
    Producte triat: ${diagnosis.selectedProduct}
    Historial de l'auditoria (RESPOSTES REALS):
    ${historyStr}

    DOCUMENTACIÓ DE REFERÈNCIA DE COSTOS:
    ${INTERNAL_KNOWLEDGE_BASE}

    REQUISITS CRÍTICS DEL JSON DE SORTIDA:
    1. diagnosis: NO pot estar buit. Redacta un paràgraf impactant que resumeixi els problemes detectats en l'historial (ex: "S'ha detectat un col·lapse en la comunicació de dades offline...").
    2. items: Mínim 5 conceptes detallats (Llicència, Setup, Infrastructura, Formació, Suport). Els preus han de sumar el total inicial realista.
    3. phases: Inclou 4 fases (Fase 1: Auditoria Tècnica, Fase 2: Implementació, Fase 3: Capacitació, Fase 4: Go-Live).
    4. nextGenFundsInfo: Detalla per què són aptes basant-te en les respostes.

    Respon en JSON estructural segons ProposalData. No afegeixis text fora del JSON.`;

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
        
        LA TEVA FONT PRIMÀRIA D'INFORMACIÓ ÉS EL CONTEXT DEL CLIENT:
        ${clientContext || 'No hi ha context previ del client encara.'}

        BASE DE CONEIXEMENT GENERAL D'ADEPTIFY:
        ${INTERNAL_KNOWLEDGE_BASE}

        INSTRUCCIONS:
        1. Respon SEMPRE basant-te en les dades del context del client si estan disponibles.
        2. Si pregunten pel seu projecte, cita detalls de la seva auditoria o la seva proposta.
        3. Manté un to professional, executiu i orientat a l'eficiència.
        4. No inventis dades que no estiguin al context del client, si no saps quelcom sobre el seu centre, demana-ho.
        5. Utilitza format visual (negretes, llistes) però sense mostrar símbols de Markdown complexos.` 
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
