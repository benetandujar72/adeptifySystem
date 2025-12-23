
import { Question } from './types';

export const QUESTIONS_FLOW: Question[] = [
  {
    id: 1,
    text: "Quina tasca et fa sentir que perds més el temps al centre?",
    type: 'select',
    isMultiSelect: true,
    options: [
      { label: "Gestió d'aula (passar llista, posar notes, fer rúbriques)", value: "aula" },
      { label: "Paperassa administrativa (informes de final de trimestre, memòries)", value: "burocracia" },
      { label: "Reunions i coordinació (actes de reunió que ningú llegeix)", value: "reunions" },
      { label: "Comunicació amb famílies (avisos, circulars, cites de tutoria)", value: "familia" },
      { label: "Control d'instal·lacions (inventaris, manteniment, neteja)", value: "manteniment" }
    ]
  },
  {
    id: 7,
    text: "Com es diu el vostre centre educatiu?",
    type: 'text',
    placeholder: "Ex: Escola Els Pins o Institut Sant Jordi"
  },
  {
    id: 8,
    text: "A quin correu t'enviem l'informe de millora i la guia de fons NextGen?",
    type: 'email',
    placeholder: "la-teva-direccio@centre.com"
  }
];

export const SYMPTOM_OPTIONS: Record<string, { label: string; value: string }[]> = {
  aula: [
    { label: "Escric les mateixes notes a tres llocs diferents", value: "sincro_notes" },
    { label: "Tardo hores a fer les rúbriques de cada alumne", value: "rubriques" }
  ],
  burocracia: [
    { label: "Fer els informes trimestrals és un malson que m'emporto a casa", value: "informes" },
    { label: "La gestió de matrícules i papers em col·lapsa", value: "docs" }
  ],
  reunions: [
    { label: "Fem moltes reunions però no sabem mai què ha quedat pendent", value: "tracabilitat" },
    { label: "No tenim un lloc central per veure les tasques del curs", value: "tasques" }
  ],
  familia: [
    { label: "Perdo hores quadrant cites de tutoria amb pares i mares", value: "cites" },
    { label: "Enviar circulars i no saber si tothom les ha llegit", value: "newsletter" }
  ]
};

export const ADEPTIFY_INFO = {
  name: "Adeptify SLU",
  nif: "B46605585",
  address: "C/ Independència 3, 08290 Cerdanyola del Vallès, Barcelona",
  taxRate: 0.21
};
