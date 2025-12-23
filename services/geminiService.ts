
// Implementación del servicio de Gemini para Adeptify
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { ProposalData, DiagnosisState, Task, ProductType } from "../types";

// Inicialización del cliente de GenAI usando la variable de entorno API_KEY
const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Se define la interfaz DynamicQuestion para el flujo del consultor dinámico
export interface DynamicQuestion {
  question: string;
  options: string[];
  isMultiSelect: boolean;
  isComplete: boolean;
  confidence: number;
}

const INTERNAL_KNOWLEDGE_BASE = `
CATÁLOGO DE AYUDA ADEPTIFY:

1. ORGANIZADOR ESCOLAR (LMS)
- Para qué sirve: Que los profesores no pierdan horas buscando materiales o apuntando notas en mil sitios.
- Precio: 2.500€ Inicio + 150€/mes.
- Tiempo ganado: 15h al mes para que el profesor pueda estar con sus alumnos.

2. ASISTENTE ANTI-PAPELEO (IA COMPLIANCE)
- Para qué sirve: Redactar actas, memorias y documentos oficiales en minutos.
- Precio: 1.800€ Inicio + 95€/mes.
- Tiempo ganado: Reduce un 40% el tiempo que pasas sentado frente al ordenador haciendo informes.

3. VIGILANTE AMIGO (AI VISION)
- Para qué sirve: Ver quién entra al centro y avisar de cualquier imprevisto de seguridad sin complicaciones.
- Precio: 4.500€ Inicio + 300€/mes.

Ayudas: Estas soluciones pueden ser financiadas al 100% por los fondos NextGen (hasta 12.000€).
`;

// Se actualiza el tipo de retorno para usar la interfaz DynamicQuestion recién definida
export async function getNextConsultantQuestion(
  history: { question: string; answer: string }[], 
  diagnosis: DiagnosisState
): Promise<DynamicQuestion> {
  const ai = getAi();
  const historyStr = history.map(h => `Pregunta: ${h.question}\nRespuesta: ${h.answer}`).join('\n');
  
  const prompt = `ACTÚA COMO UN CONSULTOR AMABLE QUE QUIERE AYUDAR A UN DIRECTOR DE ESCUELA.
    OBJETIVO: Entender dónde le duele el día a día para proponerle una solución de Adeptify.

    REGLAS DE ORO:
    - No uses lenguaje técnico. Prohibido hablar de "API", "JSON", "Mapeo", "Sincronización".
    - Habla de "personas", "tiempo", "alumnos", "papeleo", "estrés".
    - Usa ejemplos como: "el lío de las notas", "las circulares que nadie lee", "las actas de claustro eternas".
    - Tus preguntas deben sonar como una charla de café entre dos profesionales que se respetan.

    CONTESTA SIEMPRE EN CASTELLANO.

    HISTORIAL DE LA CHARLA:
    ${historyStr}

    Responde en este formato JSON:
    {
      "question": "Tu pregunta amable aquí",
      "options": ["Opción 1 sencilla", "Opción 2 sencilla", "...", "Otras..."],
      "isMultiSelect": boolean,
      "isComplete": boolean (pon true si ya has entendido qué les pasa),
      "confidence": 0-100
    }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json", temperature: 0.4 }
    });
    
    // Extracción del texto de la respuesta directamente de la propiedad .text
    const data = JSON.parse(response.text || '{}');
    return {
      question: data.question || "¿Cómo podemos ayudarle a organizar mejor el tiempo de su claustro hoy?",
      options: Array.isArray(data.options) ? data.options : ["Seguir hablando", "Otras..."],
      isMultiSelect: !!data.isMultiSelect,
      isComplete: !!data.isComplete,
      confidence: data.confidence || 0
    };
  } catch (e) {
    return {
      question: "Perdone, la conexión ha tenido un pequeño tropiezo. ¿En qué estábamos?",
      options: ["Reintentar", "Otras..."],
      isMultiSelect: false,
      isComplete: false,
      confidence: 0
    };
  }
}

// Generación de la propuesta educativa estructurada
export async function generateEducationalProposal(diagnosis: DiagnosisState): Promise<ProposalData> {
  const ai = getAi();
  const historyStr = (diagnosis.consultationHistory || []).map(h => `Pregunta: ${h.question}\nRespuesta: ${h.answer}`).join('\n');
  
  const prompt = `ERES UN CONSULTOR ESTRATÉGICO PARA COLEGIOS.
    Dibuja un plan para ayudar al centro "${diagnosis.centerName}".
    USA LENGUAJE HUMANO Y CERCANO.

    Explícales:
    1. Qué "ladrones de tiempo" has detectado en sus respuestas: ${historyStr}
    2. Cómo les vamos a ayudar a que el tutor no se sienta solo ante el papeleo.
    3. Cómo vamos a asegurar que si un padre manda un mensaje, se convierta en una tarea clara para el responsable.
    4. Un presupuesto claro que un director pueda presentar a su consejo escolar.

    CONTESTA SIEMPRE EN CASTELLANO en formato JSON ProposalData.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    // Extracción del texto de la respuesta directamente de la propiedad .text
    const data = JSON.parse(response.text || '{}');
    return {
      diagnosis: data.diagnosis || "Hemos detectado que el papeleo les está quitando tiempo de calidad con los alumnos.",
      solution: data.solution || "Proponemos un sistema que se encarga de los documentos por usted.",
      items: Array.isArray(data.items) ? data.items : [],
      totalInitial: Number(data.totalInitial) || 0,
      nextGenFundsInfo: data.nextGenFundsInfo || "Este proyecto encaja perfectamente en las subvenciones europeas.",
      implementationTime: data.implementationTime || "En pocas semanas",
      roi: data.roi || "40% de tiempo recuperado",
      phases: Array.isArray(data.phases) ? data.phases : []
    };
  } catch (e) {
    throw new Error("No hemos podido preparar el plan. Por favor, inténtelo de nuevo.");
  }
}

// Creación de una sesión de chat para el asistente de Adeptify
export function createAdeptifyChat(clientContext: string = ''): Chat {
  const ai = getAi();
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: { 
        systemInstruction: `Eres tu ayudante personal de Adeptify. No eres un ingeniero. Eres un facilitador. Hablas siempre en castellano. Eres educado, empático y vas directo a resolver problemas reales de las escuelas: papeleo, falta de comunicación, olvidos de tareas.` 
    },
  });
}

// Análisis inteligente de tareas pendientes
export async function analyzeTasksIntelligence(tasks: Task[]): Promise<string> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Como ayudante de Adeptify, mira esta lista de tareas y dime cómo podríamos hacerlas más rápido o delegarlas en castellano: ${JSON.stringify(tasks)}`,
  });
  return response.text || "Parece que tenéis mucho trabajo, vamos a ver cómo podemos simplificarlo.";
}

// Generación de borradores de documentos oficiales
export async function generateOfficialDocument(type: 'PGA' | 'MEMORIA', context: string, indicators: string, preview: boolean): Promise<string> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Ayúdame a redactar un borrador de ${type} escolar en castellano. Que suene profesional pero natural. Contexto: ${context}. Datos: ${indicators}.`,
  });
  return response.text || "Preparando el borrador del documento oficial...";
}
