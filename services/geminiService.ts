
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { ProposalData, DiagnosisState, Task } from "../types";
import { ADEPTIFY_INFO } from "../constants";

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// BASE DE CONEIXEMENT INTERNA (SOURCE OF TRUTH)
const INTERNAL_KNOWLEDGE_BASE = `
DOCUMENTACIÓ OFICIAL ADEPTIFY SYSTEMS:

1. PRODUCTE: CHECKLISTS IA (AUDITORIA OPERACIONAL)
- Crea checklists amb intel·ligència artificial per auditar operacions.
- Activitats amb escales personalitzables per a sucursals o individus.
- Permet carregar imatges, comentaris, firmes i geolocalització precisa.
- Facilita seguiment detallat de processos en temps real.

2. PRODUCTE: VISIÓ COMPUTACIONAL (INSPECCIONS AUTOMATITZADES)
- Automatització d'inspeccions mitjançant reconeixement d'imatges.
- Extracció de text (OCR) i comptatge d'objectes automàticament.
- Geolocalització per assegurar el control total de l'operació.

3. PRODUCTE: FORMACIÓ (LMS LLEUGER & OFFLINE)
- App lleugera que no requereix ús d'email.
- Permet l'aprenentatge sense connexió a internet (offline).
- Centralitza capacitació i avaluació virtual o presencial.
- Integra resultats d'entrenament amb els checklists de control.

4. PRODUCTE: VEU DEL CLIENT (ENQUESTES DE SATISFACCIÓ)
- Creació d'enquestes de satisfacció i lealtat (NPS).
- Visibilitat de factors clau per millorar l'atenció i el producte.

5. PRODUCTE: DASHBOARD INTEGRAT
- Unificació de mètriques d'entrenament, resultats de checklists i feedback de clients.
- Tauler de control unificat per a la presa de decisions estratègiques.

FINANÇAMENT:
- Tots els projectes d'Adeptify són elegibles per als fons Next Generation EU de digitalització.
- Ajudem als centres a tramitar la subvenció per a que el cost sigui zero.
`;

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
  
  const prompt = `Ets el Consultor Senior d'Adeptify SLU. El teu objectiu és rescatar docents del caos burocràtic.
    
    LLENGUATGE: Molt simple, proper, com si parlessis amb un mestre cansat. Usa exemples com "picar dades a l'Excel", "perdre el matí quadrant horaris".
    
    TEMES A EXPLORAR:
    ${INTERNAL_KNOWLEDGE_BASE}

    RESTRICCIONS:
    - Fes almenys 6-7 preguntes abans de finalitzar (isComplete: true).
    - Pregunta si volen aprofitar els Fons Next Generation EU.
    
    HISTORIAL: ${historyStr}
    CONTEXT: ${currentDiagnosis.centerName}
    
    Respon en JSON:
    {
      "question": "Pregunta clara i propera",
      "options": ["Opció A", "Opció B", "Opció C", "Opció D"],
      "isMultiSelect": boolean,
      "isComplete": boolean,
      "confidence": 0-100
    }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json", temperature: 0.5 }
    });
    return JSON.parse(response.text || '{}') as DynamicQuestion;
  } catch (error) {
    return { 
      question: "Voleu que l'estratègia inclogui la gestió de fons NextGen per a que el cost del programari sigui subvencionat?", 
      options: ["Sí, és prioritari", "Ja els tenim", "Informeu-nos-en"], 
      isMultiSelect: false, 
      isComplete: history.length > 5, 
      confidence: 90 
    };
  }
}

export async function generateEducationalProposal(diagnosis: DiagnosisState): Promise<ProposalData> {
  const ai = getAi();
  const historyStr = (diagnosis.consultationHistory || []).map(h => `Q: ${h.question}\nA: ${h.answer}`).join('\n');
  
  const prompt = `Genera una PROPOSTA D'ENGINYERIA per al centre ${diagnosis.centerName} basada exclusivament en els productes oficials.
    
    DOCUMENTACIÓ INTERNA:
    ${INTERNAL_KNOWLEDGE_BASE}

    Dades del centre: ${historyStr}

    Respon amb un JSON que segueixi l'estructura de ProposalData.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const data = JSON.parse(response.text || '{}');
    const subtotal = (data.items || []).reduce((acc: number, item: any) => acc + (Number(item.price) || 0), 0);
    
    return {
      ...data,
      subtotal,
      iva: subtotal * ADEPTIFY_INFO.taxRate,
      totalInitial: subtotal * (1 + ADEPTIFY_INFO.taxRate)
    } as ProposalData;
  } catch (error) {
    return {
      diagnosis: "S'ha detectat una càrrega administrativa crítica.",
      solution: "Implementació d'un nucli digital unificat.",
      initialSetupFee: 1500,
      nextGenFundsInfo: "Elegible per fons NextGen.",
      items: [{ concept: "Setup Inicial", description: "Configuració", price: 1500 }],
      subscriptionPlans: [{ name: "Standard", monthlySoftwarePrice: 95, monthlyServerPrice: 35, features: ["Dashboard"] }],
      phases: [{ name: "Execució", startWeek: 1, durationWeeks: 4, description: "Desplegament" }],
      subtotal: 1500,
      iva: 315,
      totalInitial: 1815,
      implementationTime: "4 setmanes",
      roi: "Alt impacte"
    } as ProposalData;
  }
}

export async function analyzeTasksIntelligence(tasks: Task[]): Promise<string> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analitza aquestes tasques basant-te en la nostra capacitat d'automatització: ${INTERNAL_KNOWLEDGE_BASE}. Tasques: ${JSON.stringify(tasks)}`,
  });
  return response.text || "";
}

export function createAdeptifyChat(): Chat {
  const ai = getAi();
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: { 
        systemInstruction: `Ets el Consultor Senior d’Adeptify SLU. La teva font de veritat absoluta és la DOCUMENTACIÓ INTERNA següent:
        
        ${INTERNAL_KNOWLEDGE_BASE}
        
        REGRLES DE RESPOSTA:
        1. Si l'usuari pregunta per serveis, preus o funcionalitats, cerca PRIMER en la documentació interna anterior.
        2. Respon de manera experta, propera i professional.
        3. Si la informació NO és a la documentació interna, pots fer servir el teu coneixement general sobre gestió escolar, però comença la frase dient: "Com a complement al nostre sistema estàndard, també podries considerar..." o similar.
        4. No inventis funcionalitats que no estiguin a la llista de productes oficials.` 
    },
  });
}

export async function generateOfficialDocument(type: 'PGA' | 'MEMORIA', context: string, indicators: string, preview: boolean): Promise<string> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Redacta un document tipus ${type} basat en: ${context} i ${indicators}. Segueix la normativa formal però amb el to d'eficiència d'Adeptify.`,
  });
  return response.text || "";
}
