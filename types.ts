
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

export type DiagnosisMode = 'QUICK' | 'DEEP';

export interface DiagnosisState {
  mode?: DiagnosisMode;
  category: string; // Es manté com a string per compatibilitat, però guardarà una llista separada per comes
  categories?: string[]; 
  symptom: string;
  volume: string;
  platform: string;
  wantsMiniApp: boolean;
  centerName: string;
  contactEmail: string;
  specificDetails?: string;
  pedagogicGoals?: string;
  techStack?: string;
  teamSize?: string;
  digitalLevel?: string;
  priorityArea?: string;
  consultationHistory?: { question: string; answer: string }[];
}

export interface Consultation extends DiagnosisState {
  id: string;
  date: string;
  proposal?: ProposalData;
  selectedPlanName?: string;
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
  isRecommended?: boolean;
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
  initialSetupFee: number;
  miniAppSuggestion?: {
    name: string;
    features: string[];
    implementationTime: string;
  };
  items: BudgetItem[];
  subscriptionPlans: SubscriptionPlan[];
  phases: ImplementationPhase[];
  subtotal: number;
  iva: number;
  totalInitial: number;
  implementationTime: string;
  roi: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export interface Question {
  id: number;
  text: string;
  type: 'select' | 'text' | 'email' | 'textarea';
  isMultiSelect?: boolean;
  options?: { label: string; value: string }[];
  placeholder?: string;
}

export interface Task {
  id: string;
  title: string;
  assignee: string;
  deadline: string;
  status: 'pendent' | 'en_proces' | 'completada';
}

export interface NotificationPrefs {
  push: boolean;
  email: boolean;
  dailySummary: boolean;
  weeklySummary: boolean;
}
