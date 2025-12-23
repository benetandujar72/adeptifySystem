
import { Question } from './types';

export const QUESTIONS_FLOW: Question[] = [
  {
    id: 1,
    text: "¿Cuál es esa tarea que más energía le roba a su equipo y que le gustaría hacer desaparecer?",
    type: 'select',
    isMultiSelect: true,
    options: [
      { label: "Pasar horas redactando informes y actas de reuniones", value: "burocracia" },
      { label: "Tener que perseguir a las familias para que respondan un mensaje", value: "familia" },
      { label: "El caos de que se deciden cosas en las reuniones y luego nadie las hace", value: "seguimiento" },
      { label: "Gestionar el día a día (comedor, ausencias, incidencias) con mil papeles", value: "gestion" }
    ]
  },
  {
    id: 2,
    text: "Si pudiéramos regalarle 5 horas a la semana a cada docente, ¿en qué cree que se notarían más?",
    type: 'select',
    options: [
      { label: "En una atención más personalizada a los alumnos que les cuesta seguir el ritmo", value: "alumnos" },
      { label: "En preparar proyectos educativos más creativos y motivadores", value: "creatividad" },
      { label: "En reducir el estrés y mejorar el ambiente en la sala de profesores", value: "bienestar" }
    ]
  },
  {
    id: 3,
    text: "¿Cómo gestionan hoy cuando un correo de un padre requiere una acción de un tutor?",
    type: 'select',
    options: [
      { label: "Confiamos en la memoria y en que el tutor lea el correo a tiempo", value: "memoria" },
      { label: "Lo anotamos en libretas o post-its que a veces se pierden", value: "postit" },
      { label: "Usamos Excel o herramientas que nos llevan más tiempo mantener que usar", value: "excel" },
      { label: "Buscamos una solución que convierta el mensaje en tarea automáticamente", value: "automatizar" }
    ]
  },
  {
    id: 7,
    text: "¿Cómo se llama su escuela o instituto?",
    type: 'text',
    placeholder: "Ej: Colegio Nuestra Señora de la Esperanza"
  },
  {
    id: 8,
    text: "¿A qué correo podemos enviarle este plan personalizado para su equipo?",
    type: 'email',
    placeholder: "direccion@colegio.com"
  }
];

export const ADEPTIFY_INFO = {
  name: "Adeptify - Tu Ayudante Digital",
  nif: "B46605585",
  address: "C/ Independencia 3, 08290 Cerdanyola del Vallès, Barcelona",
  phone: "+34 690831770",
  taxRate: 0.21
};
