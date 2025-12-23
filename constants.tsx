
import { Question } from './types';
import { Language } from './translations';

export const getQuestionsFlow = (lang: Language): Question[] => {
  const isCa = lang === 'ca';
  return [
    {
      id: 1,
      text: isCa 
        ? "Quina és la tasca que més energia li roba al seu equip i que li agradaria fer desaparèixer demà mateix?" 
        : "¿Cuál es la tarea que más energía le roba a su equipo y que le gustaría hacer desaparecer mañana mismo?",
      type: 'select',
      isMultiSelect: true,
      options: [
        { label: isCa ? "Passar hores redactant informes, memòries i actes de reunions" : "Pasar horas redactando informes, memorias y actas de reuniones", value: "paperassa" },
        { label: isCa ? "Haver de perseguir les famílies perquè responguin o llegeixin els avisos" : "Tener que perseguir a las familias para que respondan o lean los avisos", value: "comunicacio" },
        { label: isCa ? "El caos de decidir coses a les reunions i que després ningú sàpiga qui ha de fer què" : "El caos de decidir cosas en las reuniones y que después nadie sepa quién hace qué", value: "seguiment" },
        { label: isCa ? "Gestionar el dia a dia (menjador, absències, incidències) amb mil papers" : "Gestionar el día a día (comedor, ausencias, incidencias) con mil papeles", value: "burocracia" }
      ]
    },
    {
      id: 2,
      text: isCa 
        ? "Si poguéssim regalar 5 hores a la setmana a cada docent, on creu que es notaria més el canvi?" 
        : "Si pudiéramos regalar 5 horas a la semana a cada docente, ¿dónde cree que se notaría más el cambio?",
      type: 'select',
      options: [
        { label: isCa ? "En una atenció més personalitzada als alumnes que més ho necessiten" : "En una atención más personalizada a los alumnos que más lo necesitan", value: "alumnes" },
        { label: isCa ? "En preparar projectes educatius més creatius i motivadors" : "En preparar proyectos educativos más creativos y motivadores", value: "creativitat" },
        { label: isCa ? "En reduir l'estrès i millorar l'ambient a la sala de professors" : "En reducir el estrés y mejorar el ambiente en la sala de profesores", value: "bienestar" }
      ]
    },
    {
      id: 3,
      text: isCa 
        ? "Com gestionen avui quan una decisió d'un claustre s'ha de convertir en una acció real?" 
        : "¿Cómo gestionan hoy cuando una decisión de un claustro debe convertirse en una acción real?",
      type: 'select',
      options: [
        { label: isCa ? "Confiem en la memòria i la bona voluntat de cadascú" : "Confiamos en la memoria y la buena voluntad de cada uno", value: "memoria" },
        { label: isCa ? "Ho anotem en llibretes o actes que sovint queden en un calaix" : "Lo anotamos en libretas o actas que a menudo quedan en un cajón", value: "actes" },
        { label: isCa ? "Fem servir un sistema que ens avisa automàticament" : "Usamos un sistema que nos avisa automáticamente", value: "automatitzacio" }
      ]
    },
    {
      id: 7,
      text: isCa ? "Com es diu la seva escola o institut?" : "¿Cómo se llama su escuela o instituto?",
      type: 'text',
      placeholder: isCa ? "Ex: Escola Renaixença" : "Ej: Colegio Cervantes"
    },
    {
      id: 8,
      text: isCa ? "A quin correu li podem enviar aquest pla personalitzat?" : "¿A qué correo le podemos enviar este plan personalizado?",
      type: 'email',
      placeholder: isCa ? "direccio@escola.cat" : "direccion@colegio.es"
    }
  ];
};

export const ADEPTIFY_INFO = {
  name: "Adeptify - El teu Ajut Digital",
  nif: "B46605585",
  address: "C/ Independencia 3, 08290 Cerdanyola del Vallès, Barcelona",
  phone: "+34 690831770",
  taxRate: 0.21
};
