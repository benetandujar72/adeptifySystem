
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
      "isComplete": boolean (True si ja pots modelar l'estalvi del 40%),
      "confidence": 0-100
    }`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { responseMimeType: "application/json", temperature: 0.3 }
  });
  
  try {
    const data = JSON.parse(response.text || '{}');
    return {
      question: data.question || "MÒDUL 1: AUDITORIA EN CURS\n\nError de sincronització. ¿Podria repetir l'últim punt?",
      options: data.options || ["Continuar", "Reintentar", "Altres..."],
      isMultiSelect: !!data.isMultiSelect,
      isComplete: !!data.isComplete,
      confidence: data.confidence || 0
    };
  } catch (e) {
    return {
      question: "MÒDUL 1: AUDITORIA EN CURS\n\nEl sistema ha detectat una anomalia en la trama de dades. ¿Com procedim amb l'auditoria?",
      options: ["Reintentar diagnòstic", "Altres..."],
      isMultiSelect: false,
      isComplete: false,
      confidence: 0
    };
  }
}

export async function generateEducationalProposal(diagnosis: DiagnosisState): Promise<ProposalData> {
  const ai = getAi();
  const historyStr = (diagnosis.consultationHistory || []).map(h => `Q: ${h.question}\nA: ${h.answer}`).join('\n');
  
  const prompt = `GENERA UN INFORME ESTRATÈGIC D'ENGINYERIA DE PROCESSOS (Estructura de 10 pàgines).
    CENTRE: "${diagnosis.centerName}"
    IDÈNTITAT: Adeptify Systems - Consultoria d'Alta Jerarquia.
    LLENGUA: CATALÀ PROFESSIONAL.

    CONTINGUT OBLIGATORI (Mínim 2500 paraules de densitat conceptual):
    1. Diagnòstic de "Fugues de Temps" basat en respostes: ${historyStr}
    2. Justificació tècnica de la reducció del 40% de càrrega burocràtica.
    3. Arquitectura de sistemes proposada (Edge Computing, IA generativa local).
    4. Pressupost detallat segons catàleg Adeptify.
    5. Full de ruta de 4 fases.

    Respon en JSON estructural segons ProposalData en CATALÀ. Sigues exhaustiu en els camps 'diagnosis' i 'solution'.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });

  try {
    const data = JSON.parse(response.text || '{}');
    // Garantim valors per defecte per evitar crashes de 'map'
    return {
      diagnosis: data.diagnosis || "Diagnòstic en procés de validació.",
      solution: data.solution || "Solució tècnica pendent d'arquitectura final.",
      items: data.items || [],
      totalInitial: data.totalInitial || 0,
      nextGenFundsInfo: data.nextGenFundsInfo || "Informació no disponible.",
      implementationTime: data.implementationTime || "Pendent",
      roi: data.roi || "Pendent",
      phases: data.phases || []
    };
  } catch (e) {
    throw new Error("Error en el processament de la proposta executiva.");
  }
}

export function createAdeptifyChat(clientContext: string = ''): Chat {
  const ai = getAi();
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: { 
        systemInstruction: `Ets l'Enginyer Cap de Sistemes i Consultor Estratègic d'Adeptify Systems.
        
        PROTOCOLO DE INVISIBILIDAD:
        - No saludis. Ves directe al gra.
        - Tota la comunicació és en CATALÀ.
        - Finalitza cada interacció amb: "CONFIRMACIÓ REQUERIDA: He registrat la teva consulta. ¿Procedim a la següent fase del diagnòstic?"
        
        CONTEXT DEL CLIENT:
        ${clientContext}

        REGLA D'OR: No inventis dades. Sigues tècnic, executiu i orientat a l'eficiència operativa del 40%.` 
    },
  });
}

export async function analyzeTasksIntelligence(tasks: Task[]): Promise<string> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Com a Enginyer d'Adeptify, analitza aquestes tasques i suggereix optimitzacions per reduir el temps un 40% en CATALÀ: ${JSON.stringify(tasks)}`,
  });
  return response.text || "";
}

export async function generateOfficialDocument(type: 'PGA' | 'MEMORIA', context: string, indicators: string, preview: boolean): Promise<string> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `REDACTOR ESTRATÈGIC ADEPTIFY: Redacta ${type} oficial en CATALÀ per al centre educatiu. Context: ${context}. Indicadors: ${indicators}. Densitat acadèmica alta.`,
  });
  return response.text || "";
}
