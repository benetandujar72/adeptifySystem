
import { Question } from './types';

export const QUESTIONS_FLOW: Question[] = [
  {
    id: 1,
    text: "Quina part de la feina et treu més energia i temps actualment?",
    type: 'select',
    isMultiSelect: true,
    options: [
      { label: "Gestió d'aula (Notes, passar llista, rúbriques)", value: "aula" },
      { label: "Paperassa administrativa (Informes trimestrals, memòries)", value: "burocracia" },
      { label: "Coordinació (Reunions interminables, seguiment d'actes)", value: "reunions" },
      { label: "Relació amb les famílies (Cites, correus, avisos)", value: "familia" }
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
    text: "A quin email t'enviem l'anàlisi de viabilitat?",
    type: 'email',
    placeholder: "la-teva-direccio@centre.com"
  }
];

export const SYMPTOM_OPTIONS: Record<string, { label: string; value: string }[]> = {
  aula: [
    { label: "He de picar les notes a tres llocs diferents", value: "sincro_notes" },
    { label: "Tardo hores a fer rúbriques personalitzades", value: "rubriques" }
  ],
  burocracia: [
    { label: "Redactar els informes de final de trimestre és un malson", value: "informes" },
    { label: "La gestió de matrícules i papers em col·lapsa", value: "docs" }
  ],
  reunions: [
    { label: "Fem moltes reunions però no sabem mai què ha quedat pendent", value: "tracabilitat" },
    { label: "No tenim un lloc clar on veure les tasques del curs", value: "tasques" }
  ],
  familia: [
    { label: "Perdre el matí quadrant cites amb pares i mares", value: "cites" },
    { label: "Enviar circulars i saber si tothom les ha llegit", value: "newsletter" }
  ]
};

export const ADEPTIFY_INFO = {
  name: "Adeptify SLU",
  nif: "B46605585",
  address: "C/ Independència 3, 08290 Cerdanyola del Vallès, Barcelona",
  taxRate: 0.21
};
