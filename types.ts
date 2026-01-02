
export enum Phase {
  LANDING = 'LANDING',
  REGISTER = 'REGISTER',
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
  tenantSlug?: string;
  centerName: string;
  contactEmail: string;
  contactName?: string;
  consultationHistory: { question: string; answer: string[] }[];
  category?: string;
  intakeMode?: 'discovery' | 'clear_need';
}

export interface Consultation extends DiagnosisState {
  id: string;
  date: string;
  proposal: ProposalData;
}

export interface BudgetItem {
  concept: string;
  description: string;
  hours?: number;
  hourlyRate?: number;
  price: number;
}

export interface ImplementationPhase {
  name: string;
  startWeek: number;
  durationWeeks: number;
  description: string;
  cost?: number;
  deliverables?: string[];
  successCriteria?: string[];
}

export interface ConsultationRecapItem {
  question: string;
  answers: string[];
  systemInterpretation: string;
  systemResponse: string;
}

export interface SolutionDetailPoint {
  title: string;
  painPoint: string;
  howItSolvesIt: string;
  examples: string[];
}

export interface SubscriptionPlan {
  name: string;
  pricePerMonth: number;
  includes: string[];
  sla: string;
}

export interface AddOn {
  name: string;
  description: string;
  setupPrice?: number;
  pricePerMonth?: number;
}

export interface ProposalTotals {
  initial: number;
  recurringMonthly: number;
  estimatedFirstYear: number;
}

export interface ProposalData {
  diagnosis: string;
  solution: string;
  consultationRecap?: ConsultationRecapItem[];
  solutionDetails?: SolutionDetailPoint[];
  items: BudgetItem[];
  totalInitial: number;
  subscription?: SubscriptionPlan;
  addons?: AddOn[];
  totals?: ProposalTotals;
  nextGenFundsInfo: string;
  implementationTime: string;
  roi: string;
  phases: ImplementationPhase[];
  meta?: {
    modelUsed?: string;
    generatedAt?: string;
  };
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export type CenterArtifactType = 'dafo' | 'report' | 'custom_proposal';

export type CenterReportSection = {
  category: string;
  summary: string;
  evidence: string[];
  recommendations: string[];
  suggestedKpis: string[];
  quickWins: string[];
};

export type CenterReport = {
  executiveSummary: string;
  consensus: string[];
  divergences: string[];
  priorities: string[];
  quickWins: string[];
  nextSteps: string[];
  sections?: CenterReportSection[];
  performanceMetrics?: string[];
  openQuestions?: string[];
  meta?: { modelUsed?: string; generatedAt?: string };
};

export interface CenterArtifact {
  id: string;
  tenantSlug?: string;
  centerKey: string;
  centerName?: string;
  artifactType: CenterArtifactType;
  payload: any;
  createdAt: string;
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
