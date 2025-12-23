
import { Question } from './types';

export const QUESTIONS_FLOW: Question[] = [
  {
    id: 1,
    text: "Quina és la barrera principal que impedeix el creixement del vostre centre avui?",
    type: 'select',
    isMultiSelect: true,
    options: [
      { label: "Burocràcia asfixiant (Informes, memòries, circulars)", value: "burocracia" },
      { label: "Desconnexió amb les famílies (Cites, avisos, satisfacció)", value: "familia" },
      { label: "Caos en la gestió acadèmica (Notes, rúbriques, horaris)", value: "aula" },
      { label: "Manteniment d'instal·lacions (Incidències, inventari)", value: "manteniment" }
    ]
  },
  {
    id: 2,
    text: "Quants docents i alumnes gestiona el centre actualment?",
    type: 'select',
    options: [
      { label: "Petit (Menys de 30 docents / 300 alumnes)", value: "small" },
      { label: "Mitjà (30-80 docents / 300-800 alumnes)", value: "medium" },
      { label: "Gran (Més de 80 docents / +800 alumnes)", value: "large" }
    ]
  },
  {
    id: 3,
    text: "Quina és la inversió anual estimada que destineu a programari de gestió?",
    type: 'select',
    options: [
      { label: "Molt baixa (Menys de 2.000€/any)", value: "low" },
      { label: "Estàndard (2.000€ - 8.000€/any)", value: "mid" },
      { label: "Alta (Més de 8.000€/any)", value: "high" },
      { label: "Volem finançament 100% NextGen", value: "nextgen_target" }
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
    text: "A quin correu oficial t'enviem l'estratègia i el certificat de seguretat?",
    type: 'email',
    placeholder: "direccio@centre.com"
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
  ]
};

export const ADEPTIFY_INFO = {
  name: "Adeptify Systems SLU",
  nif: "B46605585",
  address: "C/ Independència 3, 08290 Cerdanyola del Vallès, Barcelona",
  phone: "+34 690831770",
  taxRate: 0.21
};
