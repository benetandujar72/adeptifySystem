
import { Question } from './types';
import { Language } from './translations';

export const getQuestionsFlow = (lang: Language): Question[] => {
  const pick = (ca: string, es: string, eu: string) => (lang === 'ca' ? ca : lang === 'eu' ? eu : es);
  return [
    {
      id: 1,
      text: pick(
        "Quina és la tasca que més energia li roba al seu equip i que li agradaria fer desaparèixer demà mateix?",
        "¿Cuál es la tarea que más energía le roba a su equipo y que le gustaría hacer desaparecer mañana mismo?",
        "Zein da zure taldeari energia gehien kentzen dion zeregina, eta bihar bertan desagerrarazi nahiko zenukeena?"
      ),
      type: 'select',
      isMultiSelect: true,
      options: [
        { label: pick(
          "Passar hores redactant informes, memòries i actes de reunions",
          "Pasar horas redactando informes, memorias y actas de reuniones",
          "Orduak ematea txostenak, memoriak eta bileren aktak idazten"
        ), value: "paperassa" },
        { label: pick(
          "Haver de perseguir les famílies perquè responguin o llegeixin els avisos",
          "Tener que perseguir a las familias para que respondan o lean los avisos",
          "Familiei atzetik ibili behar izatea erantzun edo oharrak irakur ditzaten"
        ), value: "comunicacio" },
        { label: pick(
          "El caos de decidir coses a les reunions i que després ningú sàpiga qui ha de fer què",
          "El caos de decidir cosas en las reuniones y que después nadie sepa quién hace qué",
          "Bileretan erabakitakoaren kaosa, eta gero inork ez jakitea nork egin behar duen zer"
        ), value: "seguiment" },
        { label: pick(
          "Gestionar el dia a dia (menjador, absències, incidències) amb mil papers",
          "Gestionar el día a día (comedor, ausencias, incidencias) con mil papeles",
          "Egunerokoa (jantokia, absentziak, gorabeherak) mila paperrekin kudeatzea"
        ), value: "burocracia" }
      ]
    },
    {
      id: 2,
      text: pick(
        "Si poguéssim regalar 5 hores a la setmana a cada docent, on creu que es notaria més el canvi?",
        "Si pudiéramos regalar 5 horas a la semana a cada docente, ¿dónde cree que se notaría más el cambio?",
        "Astean 5 ordu oparitu ahal bagenizkio irakasle bakoitzari, non nabarituko litzateke aldaketa gehien?"
      ),
      type: 'select',
      options: [
        { label: pick(
          "En una atenció més personalitzada als alumnes que més ho necessiten",
          "En una atención más personalizada a los alumnos que más lo necesitan",
          "Laguntza gehien behar duten ikasleei arreta pertsonalizatuagoa ematean"
        ), value: "alumnes" },
        { label: pick(
          "En preparar projectes educatius més creatius i motivadors",
          "En preparar proyectos educativos más creativos y motivadores",
          "Hezkuntza-proiektu sortzaileago eta motibatzaileagoak prestatzean"
        ), value: "creativitat" },
        { label: pick(
          "En reduir l'estrès i millorar l'ambient a la sala de professors",
          "En reducir el estrés y mejorar el ambiente en la sala de profesores",
          "Estresa murriztu eta irakasle-gelan giroa hobetzean"
        ), value: "bienestar" }
      ]
    },
    {
      id: 3,
      text: pick(
        "Com gestionen avui quan una decisió d'un claustre s'ha de convertir en una acció real?",
        "¿Cómo gestionan hoy cuando una decisión de un claustro debe convertirse en una acción real?",
        "Nola kudeatzen duzue gaur egun klaustroko erabaki bat ekintza erreal bihurtu behar denean?"
      ),
      type: 'select',
      options: [
        { label: pick(
          "Confiem en la memòria i la bona voluntat de cadascú",
          "Confiamos en la memoria y la buena voluntad de cada uno",
          "Norberaren memorian eta borondate onean fidatzen gara"
        ), value: "memoria" },
        { label: pick(
          "Ho anotem en llibretes o actes que sovint queden en un calaix",
          "Lo anotamos en libretas o actas que a menudo quedan en un cajón",
          "Koadernoetan edo akta batzuetan idazten dugu, eta askotan tiraderan geratzen dira"
        ), value: "actes" },
        { label: pick(
          "Fem servir un sistema que ens avisa automàticament",
          "Usamos un sistema que nos avisa automáticamente",
          "Automatikoki ohartarazten gaituen sistema bat erabiltzen dugu"
        ), value: "automatitzacio" }
      ]
    },
    {
      id: 7,
      text: pick(
        "Com es diu la seva escola o institut?",
        "¿Cómo se llama su escuela o instituto?",
        "Zein da zure eskola edo institutuaren izena?"
      ),
      type: 'text',
      placeholder: pick(
        "Ex: Escola Renaixença",
        "Ej: Colegio Cervantes",
        "Adib.: Zubia Ikastola"
      )
    },
    {
      id: 8,
      text: pick(
        "A quin correu li podem enviar aquest pla personalitzat?",
        "¿A qué correo le podemos enviar este plan personalizado?",
        "Zein helbidetara bidal diezazukegu plan pertsonalizatu hau?"
      ),
      type: 'email',
      placeholder: pick(
        "direccio@escola.cat",
        "direccion@colegio.es",
        "zuzendaritza@ikastetxea.eus"
      )
    }
  ];
};

export const ADEPTIFY_INFO = {
  name: "Adeptify - El teu Ajut Digital",
  nif: "B46605585",
  address: "C/ Independencia 3, 08290 Cerdanyola del Vallès, Barcelona",
  phone: "+34 690831770",
  email: "info@adeptify.es",
  taxRate: 0.21
};
