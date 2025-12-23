
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { ProposalData, DiagnosisState, Task } from "../types";
import { ADEPTIFY_INFO } from "../constants";

// Inicialización del cliente de IA usando la variable de entorno API_KEY
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
  
  const prompt = `Ets el Consultor Senior d'Adeptify SLU. El teu objectiu és ajudar a docents a recuperar el seu temps.
    
    Llenguatge: Proper, empàtic, sense tecnicismes buits. Usa exemples com "perdre el matí corregint", "picar notes al Drive", "reunions que podrien ser un mail".
    
    HISTORIAL: ${historyStr}
    CONTEXT: ${currentDiagnosis.centerName} | Àrees d'interès: ${currentDiagnosis.categories?.join(', ')}
    
    RESTRICCIONS:
    1. Fes preguntes sobre eines reals (Moodle, Clickedu, Excel, Teams).
    2. Sigues exhaustiu. No acabis fins que tinguis 4-5 interaccions.
    3. Si el centre és públic o concertat, pregunta pel seu nivell de digitalització per als fons NextGen.
    
    Respon en JSON:
    {
      "question": "Pregunta clara amb exemple real",
      "options": ["Opció A", "Opció B", "Opció C", "Opció D"],
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
    // Acceso a .text como propiedad según las guías
    return JSON.parse(response.text || '{}') as DynamicQuestion;
  } catch (error) {
    return { 
      question: "Per acabar, com gestioneu actualment la comunicació interna entre l'equip docent?", 
      options: ["WhatsApp (caòtic)", "Email (col·lapsat)", "Teams / Slack", "Presencial / Post-its"], 
      isMultiSelect: false, 
      isComplete: history.length > 3, 
      confidence: 85 
    };
  }
}

export async function generateEducationalProposal(diagnosis: DiagnosisState): Promise<ProposalData> {
  const ai = getAi();
  const historyStr = (diagnosis.consultationHistory || []).map(h => `Q: ${h.question}\nA: ${h.answer}`).join('\n');
  
  const prompt = `Genera una PROPOSTA D'EFICIÈNCIA TÈCNICA per al centre ${diagnosis.centerName}.
    Dades: ${historyStr}

    IMPORTANT: Inclou una secció sobre FONS NEXT GENERATION EU (Estratègia Digital de Centre).
    Distingeix si poden rebre subvencions per a software o equipament segons la seva realitat.

    JSON OBLIGATORI:
    {
      "diagnosis": "Resum de la situació actual (ex: saturació en informes trimestrals)",
      "solution": "Què farem (ex: automatitzar el traspàs de dades a Alexia)",
      "initialSetupFee": 2500,
      "nextGenFundsInfo": "Explicació de com poden finançar això amb fons NextGen",
      "items": [{"concept": "Configuració Automatització", "description": "Detall", "price": 1200}],
      "subscriptionPlans": [{"name": "Professional", "monthlySoftwarePrice": 90, "monthlyServerPrice": 30, "features": ["Suport Premium", "Fons NextGen inclòs"]}],
      "phases": [{"name": "Anàlisi", "startWeek": 1, "durationWeeks": 1, "description": "Audit dades"}],
      "implementationTime": "3 setmanes",
      "roi": "15 hores/mes estalviades per docent"
    }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    // Acceso a .text como propiedad
    const data = JSON.parse(response.text || '{}');
    const subtotal = (data.items || []).reduce((acc: number, item: any) => acc + (Number(item.price) || 0), 0) || 1500;
    
    return {
      ...data,
      subtotal,
      iva: subtotal * ADEPTIFY_INFO.taxRate,
      totalInitial: subtotal * (1 + ADEPTIFY_INFO.taxRate),
      diagnosis: data.diagnosis || "Situació de col·lapse administratiu detectada.",
      solution: data.solution || "Centralització intel·ligent de processos d'aula.",
      nextGenFundsInfo: data.nextGenFundsInfo || "Aquest projecte és 100% elegible per a la línia de digitalització de centres dels fons Next Generation EU.",
      items: data.items || [{ concept: "Setup Inicial", description: "Configuració de sistemes", price: subtotal }],
      subscriptionPlans: data.subscriptionPlans || [{ name: "Standard", monthlySoftwarePrice: 150, monthlyServerPrice: 50, features: ["Dashboard", "Suport"] }],
      phases: data.phases || [{ name: "Desplegament", startWeek: 1, durationWeeks: 4, description: "Execució" }]
    } as ProposalData;
  } catch (error) {
    return {
      diagnosis: "Diagnòstic completat.",
      solution: "Projecte d'eficiència operativa educatiu.",
      initialSetupFee: 1500,
      nextGenFundsInfo: "Possibilitat de subvenció via Fons NextGen fins al 100%.",
      items: [{ concept: "Projecte Tècnic", description: "Configuració completa", price: 1500 }],
      subscriptionPlans: [{ name: "Pla Educatiu", monthlySoftwarePrice: 150, monthlyServerPrice: 50, features: ["Suport", "Cloud"] }],
      phases: [{ name: "Fase 1", startWeek: 1, durationWeeks: 4, description: "Implementació" }],
      subtotal: 1500,
      iva: 315,
      totalInitial: 1815,
      implementationTime: "4 setmanes",
      roi: "Alt impacte"
    } as ProposalData;
  }
}

// Analiza tareas escolares y proporciona recomendaciones de eficiencia
export async function analyzeTasksIntelligence(tasks: Task[]): Promise<string> {
  const ai = getAi();
  const tasksStr = tasks.map(t => `- ${t.title} (Responsable: ${t.assignee}, Estat: ${t.status})`).join('\n');
  const prompt = `Analitza aquestes tasques de gestió escolar i dóna un consell d'eficiència breu i motivador per a l'equip:\n${tasksStr}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "L'organització és la base de la llibertat docent.";
  } catch (error) {
    return "Prioritza les tasques crítiques per optimitzar el rendiment del centre.";
  }
}

// Genera documentos oficiales (PGA o Memoria) basados en el contexto del centro
export async function generateOfficialDocument(type: 'PGA' | 'MEMORIA', context: string, indicators: string, preview: boolean): Promise<string> {
  const ai = getAi();
  const prompt = `Ets un expert en documentació educativa oficial. Genera un esborrany de ${type}.
    Context Pedagògic: ${context}
    Indicadors de Rendiment: ${indicators}
    ${preview ? 'Genera només una previsualització professional resumida.' : 'Genera el document complet seguint l\'estructura normativa formal.'}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
    });
    return response.text || "Generant el document...";
  } catch (error) {
    return "No s'ha pogut generar el document oficial. Revisa les dades de context.";
  }
}

export function createAdeptifyChat(): Chat {
  const ai = getAi();
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: { 
        systemInstruction: 'Ets el Consultor Senior d’Adeptify SLU. Parla com un col·lega expert que entén el dia a dia de l’escola. Ajuda al docent a sentir-se escoltat. No usis IA, usa "Sistemes intel·ligents".' 
    },
  });
}
