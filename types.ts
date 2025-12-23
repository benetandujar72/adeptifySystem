
export enum Phase {
  LANDING = 'LANDING',
  DIAGNOSIS = 'DIAGNOSIS',
  DYNAMIC_DIAGNOSIS = 'DYNAMIC_DIAGNOSIS',
  PROPOSAL = 'PROPOSAL',
  ACTION = 'ACTION',
  DASHBOARD = 'DASHBOARD',
  ADMIN = 'ADMIN',
  LOGIN = 'LOGIN',
  DOC_GENERATOR = 'DOC_GENERATOR'
}

export type ProductType = 'LMS' | 'AUDIT' | 'VISION' | 'DEEP_AUDIT';

export interface DB_Center {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface DB_Project {
  id: string;
  center_id: string;
  product_type: ProductType;
  status: 'draft' | 'active' | 'completed';
  audit_context: any;
  proposal_data: ProposalData;
}

export interface Question {
  id: number;
  text: string;
  type: 'select' | 'text' | 'email' | 'textarea';
  isMultiSelect?: boolean;
  options?: { label: string; value: string }[];
  placeholder?: string;
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
  phases: ImplementationPhase[];
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

export interface NotificationPrefs {
  push: boolean;
  email: boolean;
  dailySummary: boolean;
  weeklySummary: boolean;
}
