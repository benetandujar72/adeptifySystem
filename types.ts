
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
  DOC_GENERATOR = 'DOC_GENERATOR',
  LEAD_MANAGEMENT = 'LEAD_MANAGEMENT',
  INTERACTIVE_AUDIT = 'INTERACTIVE_AUDIT',
  AUTO_ONBOARDING = 'AUTO_ONBOARDING',
  DIGITAL_TWIN = 'DIGITAL_TWIN',
  CUSTOMER_SUCCESS = 'CUSTOMER_SUCCESS',
  NETWORK_EXPANSION = 'NETWORK_EXPANSION',
  CRM = 'CRM',
  CENTER_MAP = 'CENTER_MAP'
}

export interface CatEducationCenterFull {
  codi_centre: string;
  denominacio_completa: string;
  nom_naturalesa: string | null;
  nom_titularitat: string | null;
  adreca: string | null;
  codi_postal: string | null;
  telefon: string | null;
  nom_delegacio: string | null;
  nom_comarca: string | null;
  nom_municipi: string | null;
  coordenades_geo_x: number | null;
  coordenades_geo_y: number | null;
  email_centre: string | null;
  estudis: string | null;
  einf1c: boolean; einf2c: boolean; epri: boolean; eso: boolean;
  batx: boolean; aa01: boolean; cfpm: boolean; ppas: boolean;
  aa03: boolean; cfps: boolean; ee: boolean; ife: boolean;
  pfi: boolean; pa01: boolean; cfam: boolean; pa02: boolean;
  cfas: boolean; esdi: boolean; escm: boolean; escs: boolean;
  adr: boolean; crbc: boolean; idi: boolean; dane: boolean;
  danp: boolean; dans: boolean; muse: boolean; musp: boolean;
  muss: boolean; tegm: boolean; tegs: boolean; estr: boolean;
  adults: boolean;
  // AI enrichment columns (nullable, from migration 007)
  ai_opportunity_score: number | null;
  ai_reason_similarity: string | null;
  ai_custom_pitch: string | null;
  ai_enriched_at: string | null;
  ai_enriched_by_ref: string | null;
  web_url: string | null;
  region?: string | null;
  pais?: string | null;
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
    aiUsage?: {
      promptTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
      costEur?: number;
    };
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

export interface ProjectExample {
  id: string;
  title_ca: string;
  title_es: string;
  title_eu: string;
  description_ca: string;
  description_es: string;
  description_eu: string;
  metrics: {
    hours: string;
    deployment: string;
    ai_cost: string;
    maintenance: string;
    dev_cost?: string;
    ownership_cost?: string;
  };
  category?: string;
  image_url?: string;
  repo_url?: string;
}
