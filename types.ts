
export enum Phase {
  LANDING = 'LANDING',
  DIAGNOSIS = 'DIAGNOSIS',
  DYNAMIC_DIAGNOSIS = 'DYNAMIC_DIAGNOSIS',
  PROPOSAL = 'PROPOSAL',
  ACTION = 'ACTION',
  DASHBOARD = 'DASHBOARD',
  ADMIN = 'ADMIN',
  DOC_GENERATOR = 'DOC_GENERATOR'
}

export type ProductType = 'LMS' | 'AUDIT' | 'VISION' | 'DEEP_AUDIT';

// Interfaz para el flujo de preguntas de la auditoría
export interface Question {
  id: number;
  text: string;
  type: 'select' | 'text' | 'email' | 'textarea';
  isMultiSelect?: boolean;
  options?: { label: string; value: string }[];
  placeholder?: string;
}

// Interfaz para las preferencias de notificación del usuario
export interface NotificationPrefs {
  push: boolean;
  email: boolean;
  dailySummary: boolean;
  weeklySummary: boolean;
}

export interface DiagnosisState {
  selectedProduct?: ProductType;
  centerName: string;
  contactEmail: string;
  consultationHistory: { question: string; answer: string }[];
  category?: string;
}

export interface Consultation extends DiagnosisState {
  id: string;
  date: string;
  proposal: ProposalData;
}

export interface BudgetItem {
  concept: string;
  description: string;
  price: number;
}

export interface SubscriptionPlan {
  name: string;
  monthlySoftwarePrice: number;
  monthlyServerPrice: number;
  features: string[];
}

export interface ImplementationPhase {
  name: string;
  startWeek: number;
  durationWeeks: number;
  description: string;
}

export interface ProposalData {
  diagnosis: string;
  solution: string;
  items: BudgetItem[];
  totalInitial: number;
  nextGenFundsInfo: string;
  implementationTime: string;
  roi: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export interface Task {
  id: string;
  title: string;
  assignee: string;
  deadline: string;
  status: 'pendent' | 'en_proces' | 'completada';
}
