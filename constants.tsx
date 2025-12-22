
import { Question } from './types';

export const QUESTIONS_FLOW: Question[] = [
  {
    id: 1,
    text: "En quina àrea detectes el major caos avui?",
    type: 'select',
    isMultiSelect: true,
    options: [
      { label: "Gestió Acadèmica i Aula (Notes, Assistència)", value: "aula" },
      { label: "Operacions del Centre (Informes, Burocràcia)", value: "burocracia" },
      { label: "Eficiència en Reunions i Traçabilitat", value: "reunions" },
      { label: "Relació amb Famílies (Comunicació, Cites)", value: "familia" }
    ]
  },
  {
    id: 7,
    text: "Nom oficial del Centre Educatiu:",
    type: 'text',
    placeholder: "Ex: Escola Adeptify"
  },
  {
    id: 8,
    text: "Email corporatiu per a la Proposta:",
    type: 'email',
    placeholder: "direccio@centre.com"
  }
];

export const SYMPTOM_OPTIONS: Record<string, { label: string; value: string }[]> = {
  aula: [
    { label: "Sincronització manual de notes entre plataformes", value: "sincro_notes" },
    { label: "Exclés de temps en creació de rúbriques i feedback", value: "rubriques" }
  ],
  burocracia: [
    { label: "Redacció manual d'informes trimestrals", value: "informes" },
    { label: "Gestió documental de matrícules", value: "docs" }
  ],
  reunions: [
    { label: "Falta de traçabilitat en decisions", value: "tracabilitat" },
    { label: "Gestió de tasques derivades", value: "tasques" }
  ],
  familia: [
    { label: "Cites amb famílies i justificacions", value: "cites" },
    { label: "Newsletter i comunicacions", value: "newsletter" }
  ]
};

export const ADEPTIFY_INFO = {
  name: "Adeptify SLU",
  nif: "B46605585",
  address: "C/ Independència 3, 08290 Cerdanyola del Vallès, Barcelona",
  taxRate: 0.21
};
