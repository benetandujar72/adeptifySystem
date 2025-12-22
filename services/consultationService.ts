
import { Consultation, DiagnosisState, ProposalData, ChatMessage } from '../types';

const STORAGE_KEY = 'adeptify_consultations_v1';
const CHAT_STORAGE_KEY = 'adeptify_chat_history_v1';

export const consultationService = {
  saveConsultation: (diagnosis: DiagnosisState, proposal: ProposalData): Consultation => {
    const consultations = consultationService.getAll();
    const newConsultation: Consultation = {
      ...diagnosis,
      id: `CONS-${Date.now()}`,
      date: new Date().toISOString(),
      proposal
    };
    consultations.push(newConsultation);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consultations));
    return newConsultation;
  },

  updateConsultation: (id: string, updates: Partial<Consultation>): Consultation | null => {
    const consultations = consultationService.getAll();
    const index = consultations.findIndex(c => c.id === id);
    if (index === -1) return null;
    
    const updated = { ...consultations[index], ...updates };
    consultations[index] = updated;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consultations));
    return updated;
  },

  getAll: (): Consultation[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  delete: (id: string) => {
    const consultations = consultationService.getAll().filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consultations));
  },

  // Serveis de Xat Persistent per Usuari/Centre
  saveChatMessage: (centerId: string, message: ChatMessage) => {
    const allChats = consultationService.getAllChats();
    // Normalitzem l'ID per evitar problemes amb caràcters especials
    const key = centerId.toLowerCase().replace(/\s+/g, '_');
    if (!allChats[key]) allChats[key] = [];
    allChats[key].push(message);
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(allChats));
  },

  getChatHistory: (centerId: string): ChatMessage[] => {
    const allChats = consultationService.getAllChats();
    const key = centerId.toLowerCase().replace(/\s+/g, '_');
    return allChats[key] || [];
  },

  getAllChats: (): Record<string, ChatMessage[]> => {
    const data = localStorage.getItem(CHAT_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  }
};
