
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { ProposalData, DiagnosisState, Task, ProductType } from "../types";

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const INTERNAL_KNOWLEDGE_BASE = `
CATÀLEG DE SOLUCIONS TÈCNIQUES ADEPTIFY:

1. SISTEMA ACADÈMIC (LMS)
- Objectiu: Optimització de formació interna i claustre. Aplicació offline-first.
- Preu: 2.500€ Setup + 150€/mes.
- Estalvi estimat: 15h/mes per docent en gestió de materials.

2. MOTOR D'AUDITORIA (IA COMPLIANCE)
- Objectiu: Digitalització d'inspeccions i auditories de qualitat.
- Preu: 1.800€ Setup + 95€/mes.
- Estalvi estimat: 40% de reducció en temps de redacció d'informes.

3. INTEL·LIGÈNCIA VISUAL (AI VISION)
- Objectiu: Monitorització de seguretat, fluxos d'alumnes i OCR documental.
- Preu: 4.500€ Setup + 300€/mes/mòdul.
- Estalvi estimat: Automatització total de registres manuals.

Subvencions: Elegible per fons NextGen EU (fins a 12.000€).
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
  
  const prompt = `ETS L'ENGINYER CAP DE SISTEMES D'ADEPTIFY.
    OBJETIU: Realitzar un diagnòstic dinàmic per a la solució ${diagnosis.selectedProduct}.

    PROTOCOLO DE INTEGRIDAD:
    - Respon SEMPRE en CATALÀ.
    - Surt directament amb el títol: "MÒDUL 1: AUDITORIA EN CURS".
    - No saludis. No expliquis el teu procés.
    - Fes una pregunta tècnica, intel·ligent i provocativa.
    - Màxim 9 opcions + "Altres...".

    CONTEXT TÈCNIC:
    ${INTERNAL_KNOWLEDGE_BASE}

    HISTORIAL:
    ${historyStr}

    Respon en JSON estructural en CATALÀ:
    {
      "question": "MÒDUL 1: AUDITORIA EN CURS\\n\\n[La teva pregunta aquí en català]",
      "options": ["Opció 1", "Opció 2", "...", "Altres..."],
      "isMultiSelect": boolean,
      "isComplete": boolean,
      "confidence": 0-100
    }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json", temperature: 0.3 }
    });
    
    const data = JSON.parse(response.text || '{}');
    return {
      question: data.question || "MÒDUL 1: AUDITORIA EN CURS\n\n¿Podria especificar com gestionen actualment les dades crítiques?",
      options: Array.isArray(data.options) ? data.options : ["Continuar", "Altres..."],
      isMultiSelect: !!data.isMultiSelect,
      isComplete: !!data.isComplete,
      confidence: data.confidence || 0
    };
  } catch (e) {
    return {
      question: "MÒDUL 1: AUDITORIA EN CURS\n\nEl sistema requereix una validació addicional de la seva infraestructura. ¿Com desitja procedir?",
      options: ["Reintentar anàlisi", "Altres..."],
      isMultiSelect: false,
      isComplete: false,
      confidence: 0
    };
  }
}

export async function generateEducationalProposal(diagnosis: DiagnosisState): Promise<ProposalData> {
  const ai = getAi();
  const historyStr = (diagnosis.consultationHistory || []).map(h => `Q: ${h.question}\nA: ${h.answer}`).join('\n');
  
  const prompt = `GENERA UN INFORME ESTRATÈGIC D'ENGINYERIA DE PROCESSOS.
    CENTRE: "${diagnosis.centerName}"
    LLENGUA: CATALÀ PROFESSIONAL.

    Respon en JSON estructural segons ProposalData en CATALÀ. Sigues exhaustiu en els camps 'diagnosis' i 'solution'.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const data = JSON.parse(response.text || '{}');
    return {
      diagnosis: data.diagnosis || "Anàlisi operativa en curs.",
      solution: data.solution || "Arquitectura de sistemes personalitzada pendent de detall.",
      items: Array.isArray(data.items) ? data.items : [],
      totalInitial: Number(data.totalInitial) || 0,
      nextGenFundsInfo: data.nextGenFundsInfo || "Informació sobre subvencions no disponible.",
      implementationTime: data.implementationTime || "A determinar",
      roi: data.roi || "40% estimat",
      phases: Array.isArray(data.phases) ? data.phases : []
    };
  } catch (e) {
    throw new Error("Error en la generació de la proposta estratègica.");
  }
}

export function createAdeptifyChat(clientContext: string = ''): Chat {
  const ai = getAi();
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: { 
        systemInstruction: `Ets l'Enginyer Cap d'Adeptify Systems. Respon SEMPRE en CATALÀ. Sigues tècnic i executiu. Context: ${clientContext}` 
    },
  });
}

export async function analyzeTasksIntelligence(tasks: Task[]): Promise<string> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analitza aquestes tasques educatives i suggereix optimitzacions en CATALÀ: ${JSON.stringify(tasks)}`,
  });
  return response.text || "No s'han detectat colls d'ampolla crítics en aquest moment.";
}

export async function generateOfficialDocument(type: 'PGA' | 'MEMORIA', context: string, indicators: string, preview: boolean): Promise<string> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Genera ${type} oficial en CATALÀ. Context: ${context}. Indicadors: ${indicators}.`,
  });
  return response.text || "Generant document oficial...";
}
