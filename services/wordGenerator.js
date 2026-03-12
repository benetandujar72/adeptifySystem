const docx = require("docx");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Table, TableRow, TableCell, WidthType,
  ShadingType, PageBreak, Header, Footer, PageNumber,
  TableOfContents, LevelFormat, BorderStyle, ImageRun
} = docx;

async function fetchImageBuffer(prompt) {
  try {
    const apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      console.warn("[WordGenerator] GEMINI_API_KEY is not set. Skipping image generation.");
      return null;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "CRITICAL: NO DASHBOARDS. NO TEXT. " + prompt }] }]
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[WordGenerator] Gemini Image fetch failed (${res.status}): ${errText}`);
      return null;
    }

    const payload = await res.json();

    // El modelo gemini-3-pro-image-preview ahora suele devolver en formato de candidates -> parts -> inlineData -> data (base64)
    if (payload.candidates && payload.candidates.length > 0) {
      const parts = payload.candidates[0].content?.parts || [];
      const imagePart = parts.find(p => p.inlineData && p.inlineData.data);
      if (imagePart) {
        return Buffer.from(imagePart.inlineData.data, 'base64');
      }
    }

    // Alternative schema
    if (payload.predictions && payload.predictions.length > 0) {
      const b64 = payload.predictions[0].bytesBase64Encoded || payload.predictions[0].image?.imageBytes;
      if (b64) {
        return Buffer.from(b64, 'base64');
      }
    }

    console.warn(`[WordGenerator] Gemini API completed but returned unexpected image JSON structure.`);
    return null;

  } catch (e) {
    console.error(`[WordGenerator] Error fetching Gemini image:`, e);
    return null;
  }
}

class WordProposalGenerator {
  async generate(data, lang = 'ca') {
    // 1. BUILD ROBUST DATA MAPPING
    // Strategy comes from Gemini. Operations come from static expert templates.
    const company = data.company_name || 'Entidad';

    const d = {
      consultora: { nombre: "Adeptify Systems", logo_url: "https://adeptify.es/logo.png" },
      cliente: { nombre: company, contacto: data.contact_email || 'Dirección', sector: "General" },
      propuesta: { fecha: new Date().toLocaleDateString(), referencia: `PROP-${Math.floor(Math.random() * 10000)}`, version: "1.0", validez_dias: 30 },
      proyecto: {
        titulo: "Transformació Digital Integral",
        resumen: data.custom_pitch || "Proposta estratègica generada per a l'eficiència operativa.",
        alcance: "Digitalització, automatització de processos i implementació IA",
        inversion_total: data.estimated_budget_range || "A pressupostar"
      },
      diagnostico: data.proposal_data?.diagnostico || {
        entorno_actual: `Anàlisi automàtic del centre ${company}`,
        cuello_botella: `S'ha detectat que el principal coll d'ampolla és: ${data.main_bottleneck || "Processos manuals."}`,
        necesidades: (data.needs_detected || []).map((n, i) => ({ id: `N${i + 1}`, descripcion: n, impacto: "Alt", prioridad: "Alta" }))
      },
      solucion: data.proposal_data?.solucion || {
        vision_general: "Crear un ecosistema digital autònom i eficient.",
        componentes: {
          automatizacion: "Eliminació de tasques manuals.",
          plataforma: "Integració en processos diaris.",
          integraciones: "Connexió nativa.",
          ia: "Anàlisi predictiu i IA."
        },
        arquitectura: { capas: ["Frontend", "Backend"], tecnologias: ["AI", "Automations"], flujo_datos: "Datos centralizados y sincronizados." },
        diferenciadores: ["Tecnologia Adeptify", "Velocitat"]
      },
      // --- HARDCODED ROBUST EXPERT TEMPLATES ---
      metodologia: {
        enfoque: "Utilitzem metodologies àgils (Scrum/Kanban) per garantir lliuraments ràpids i adaptables. El nostre enfocament es centra en el ROI des del dia 1, minimitzant la interrupció operativa de l'equip actual.",
        fases: [
          { nombre: "Fase 1: Auditoria Tècnica", duracion: "1-2 setmanes", descripcion: "Analitzem cada procés manual al detall per mapar l'arquitectura de dades.", entregables: "Document d'Arquitectura i Mapatge" },
          { nombre: "Fase 2: Desenvolupament Core", duracion: "3-5 setmanes", descripcion: "Construcció dels fluxos d'automatització principals i models d'IA.", entregables: "Sistemes en sandbox" },
          { nombre: "Fase 3: Integració i QA", duracion: "1-2 setmanes", descripcion: "Connexió amb els sistemes actuals i proves d'estrès.", entregables: "UAT (User Acceptance Testing) firmat" },
          { nombre: "Fase 4: Desplegament i Formació", duracion: "1 setmana", descripcion: "Posada en producció i transferència de coneixement a l'equip.", entregables: "Sistemes en viu i manuals" }
        ]
      },
      cronograma: {
        duracion_total: "8-10 setmanes (Estimat)",
        fases: [
          { nombre: "Auditoria", duracion: "Setmana 1-2", actividades: ["Kickoff", "Mapatge"], entregables: ["Blueprint"] },
          { nombre: "Construcció", duracion: "Setmana 3-7", actividades: ["Codi", "IA Training"], entregables: ["Beta"] },
          { nombre: "Llançament", duracion: "Setmana 8-10", actividades: ["Formació", "Go-Live"], entregables: ["Producció"] }
        ]
      },
      equipo: [
        { rol: "Director de Projecte (PM)", nombre: "Equip Adeptify", dedicacion: "20%", experiencia: "Sènior (+10 anys)" },
        { rol: "Arquitecte Cloud/IA", nombre: "Equip Adeptify", dedicacion: "40%", experiencia: "Sènior" },
        { rol: "Enginyer d'Automatitzacions", nombre: "Equip Adeptify", dedicacion: "100%", experiencia: "Sènior" }
      ],
      economia: data.proposal_data?.economia || {
        rango_presupuesto: data.estimated_budget_range || "8.000€", moneda: "EUR",
        conceptos: (data.recommended_services || []).map(s => ({ descripcion: s, importe: 3000, porcentaje: 50 })),
        total: 6000, condiciones_pago: "50% a l'inici, 50% al lliurament i validació (Go-Live).",
        roi: { horas_ahorradas_semana: 20, coste_hora_estimado: 25, ahorro_anual_estimado: 24000, periodo_amortizacion_meses: 4, roi_porcentaje: 200 }
      },
      garantias: {
        periodo_garantia: "6 mesos d'acompanyament gratuït post-llançament.",
        sla: [
          { servicio: "Caiguda Crítica (S0)", tiempo_respuesta: "< 2h", tiempo_resolucion: "< 12h", disponibilidad: "99.9%" },
          { servicio: "Bug Funcional (S1)", tiempo_respuesta: "< 12h", tiempo_resolucion: "< 48h", disponibilidad: "99.0%" },
          { servicio: "Consultes/Dudas (S2)", tiempo_respuesta: "< 24h", tiempo_resolucion: "N/A", disponibilidad: "Horari Laboral" }
        ]
      },
      riesgos: [
        { riesgo: "Resistència al canvi per part del personal", probabilidad: "Alta", impacto: "Alt", mitigacion: "Pla de formació inclusiu i interfícies simplificades." },
        { riesgo: "Incompatibilitat amb APIs delegades", probabilidad: "Mitja", impacto: "Alt", mitigacion: "Estudi viabilitat previ i utilització de WebScraping si falla l'API." }
      ],
      casos_exito: data.proposal_data?.casos_exito || [
        { cliente: "Cas Confidencial", sector: "Servei", reto: "Processos manuals lents", solucion: "IA + Automatització", resultados: "Reducció 80% temps admin" }
      ],
      condiciones: {
        propiedad_intelectual: "El codi desenvolupat i els fluxos a mida seran propietat intel·lectual del client un cop abonat el 100% de la factura. Adeptify manté el dret de les llibreries core de base.",
        confidencialidad: "Estricta. Acord de confidencialitat (NDA) signat per defecte abans del kickoff.",
        supuestos: ["Accés remot a sistemes del client necessari.", "Llicències de tercers (ex: OpenAI) no incloses."],
        exclusiones: ["Canvis d'abast legislatiu posteriors a la firma."]
      },
      proximos_pasos: [
        { accion: "Revisió conjunta del document", responsable: "Ambdós", plazo: "Dies 1-3" },
        { accion: "Firma i abonament de l'inici", responsable: "Client", plazo: "Dies 4-6" },
        { accion: "Reunió Launch (Kickoff)", responsable: "Adeptify", plazo: "Dia 7" }
      ],
      personalizacion: { color_primary: "1E1B4B", color_secondary: "4338CA", color_accent: "818CF8" },
      image_prompt: data.image_prompt
    };

    // Dictionary mappings based on language
    const T = {
      es: {
        heroDesc: "Nos adaptamos a tu realidad. Como un camaleón digital, cada solución es única.",
        heroTitle1: "PROPUESTA DE SOLUCIONES DIGITALES",
        heroTitle2: "Y AUTOMATIZACIÓN DE PROCESOS",
        report_prepared: "Preparado para:",
        report_ref: "Referencia:",
        report_date: "Fecha:",
        report_version: "Versión:",
        header_prop: "Propuesta de Soluciones Digitales",
        footer_conf: "CONFIDENCIAL",
        footer_page: "Página",
        fallback_sol: "Solución adaptada en proceso de diseño operativo específico.",
        "1_title": "1. Resumen Ejecutivo",
        "alcance": "Alcance principal:",
        "2_title": "2. Contexto y Diagnóstico de Situación",
        "21_title": "2.1 Análisis del Entorno Actual",
        "22_title": "2.2 Diagnóstico de Procesos Actuales",
        "23_title": "2.3 Identificación de Necesidades",
        "th_id": "ID", "th_desc": "Descripción", "th_impact": "Impacto", "th_priority": "Prioridad",
        "3_title": "3. Solución Propuesta",
        "31_title": "3.1 Visión General de la Solución",
        "311_title": "3.1.1 Prototipo de Interfaz Propuesta",
        "32_title": "3.2 Componentes de la Solución",
        "321_title": "3.2.1 Automatización de Procesos (RPA/BPM)",
        "322_edu": "3.2.2 Plataforma Digital / Campus Virtual y SGA",
        "322_corp": "3.2.2 Plataforma Digital / Portal Web",
        "323_edu": "3.2.3 Integraciones (SGA, ERP)",
        "323_corp": "3.2.3 Integraciones y Conectividad",
        "324_title": "3.2.4 Inteligencia Artificial y Análisis de Datos",
        "33_title": "3.3 Arquitectura Técnica",
        "34_title": "3.4 Diferenciadores de la Solución",
        "4_title": "4. Metodología de Implementación",
        "41_title": "4.1 Enfoque Metodológico",
        "42_title": "4.2 Fases del Proyecto",
        "th_fase": "Fase", "th_duracion": "Duración", "th_entregables": "Entregables",
        "5_title": "5. Cronograma de Ejecución",
        "51_title": "5.1 Planificación Temporal",
        "th_inicio": "Inicio", "th_fin": "Fin",
        "52_title": "5.2 Hitos Clave",
        "6_title": "6. Equipo de Proyecto",
        "61_title": "6.1 Estructura del Equipo",
        "th_rol": "Rol", "th_name": "Nombre", "th_dedicacion": "Dedicación", "th_exp": "Experiencia",
        "7_title": "7. Propuesta Económica",
        "71_title": "7.1 Desglose de Inversión",
        "th_concepto": "Concepto", "th_importe": "Importe", "th_pct": "% del Total",
        "inv_total": "Inversión Total:",
        "72_title": "7.2 Condiciones de Pago",
        "73_edu": "7.3 Análisis de Retorno / Impacto Educativo (ROI)",
        "73_corp": "7.3 Análisis de Retorno de Inversión (ROI)",
        "proyeccion": "Proyección:",
        "8_title": "8. Garantías y Niveles de Servicio",
        "81_title": "8.1 Garantía de la Solución",
        "82_title": "8.2 Acuerdos de Nivel de Servicio (SLA)",
        "th_nivel": "Nivel", "th_resp": "Respuesta", "th_resolucion": "Resolución",
        "9_title": "9. Gestión de Riesgos",
        "th_riesgo": "Riesgo", "th_prob": "Probabilidad", "th_mit": "Mitigación",
        "10_title": "10. Casos de Éxito y Referencias",
        "11_title": "11. Condiciones Generales",
        "111_title": "11.1 Validez de la Propuesta",
        "validez_txt1": "Esta propuesta tiene una validez de",
        "validez_txt2": "días a partir de la fecha de emisión (",
        "112_title": "11.2 Propiedad Intelectual",
        "113_title": "11.3 Confidencialidad",
        "114_title": "11.4 Supuestos y Exclusiones",
        "12_title": "12. Próximos Pasos y Aceptación",
        "th_paso": "Paso", "th_accion": "Acción", "th_resp_paso": "Responsable", "th_fecha_lim": "Fecha Límite",
        "signed_txt": "FIRMADO Y ACEPTADO:",
        "por_txt": "Por", "firma_resp": "Firma responsable", "toc_title": "ÍNDICE DE CONTENIDOS"
      },
      ca: {
        heroDesc: "Ens adaptem a la teva realitat. Com un camaleó digital, cada solució és única.",
        heroTitle1: "PROPOSTA DE SOLUCIONS DIGITALS",
        heroTitle2: "I AUTOMATITZACIÓ DE PROCESSOS",
        report_prepared: "Preparat per a:",
        report_ref: "Referència:",
        report_date: "Data:",
        report_version: "Versió:",
        header_prop: "Proposta de Solucions Digitals",
        footer_conf: "CONFIDENCIAL",
        footer_page: "Pàgina",
        fallback_sol: "Solució adaptada en procés de disseny operatiu específic.",
        "1_title": "1. Resum Executiu",
        "alcance": "Abast principal:",
        "2_title": "2. Context i Diagnòstic de Situació",
        "21_title": "2.1 Anàlisi de l'Entorn Actual",
        "22_title": "2.2 Diagnòstic de Processos Actuals",
        "23_title": "2.3 Identificació de Necessitats",
        "th_id": "ID", "th_desc": "Descripció", "th_impact": "Impacte", "th_priority": "Prioritat",
        "3_title": "3. Solució Proposada",
        "31_title": "3.1 Visió General de la Solució",
        "311_title": "3.1.1 Prototip d'Interfície Proposat",
        "32_title": "3.2 Components de la Solució",
        "321_title": "3.2.1 Automatització de Processos (RPA/BPM)",
        "322_edu": "3.2.2 Plataforma Digital / Campus Virtual i SGA",
        "322_corp": "3.2.2 Plataforma Digital / Portal Web",
        "323_edu": "3.2.3 Integracions (SGA, ERP)",
        "323_corp": "3.2.3 Integracions i Connectivitat",
        "324_title": "3.2.4 Intel·ligència Artificial i Anàlisi de Dades",
        "33_title": "3.3 Arquitectura Tècnica",
        "34_title": "3.4 Diferenciadors de la Solució",
        "4_title": "4. Metodologia d'Implementació",
        "41_title": "4.1 Enfocament Metodològic",
        "42_title": "4.2 Fases del Projecte",
        "th_fase": "Fase", "th_duracion": "Duració", "th_entregables": "Entregables",
        "5_title": "5. Cronograma d'Execució",
        "51_title": "5.1 Planificació Temporal",
        "th_inicio": "Inici", "th_fin": "Fi",
        "52_title": "5.2 Fites Clau",
        "6_title": "6. Equip de Projecte",
        "61_title": "6.1 Estructura de l'Equip",
        "th_rol": "Rol", "th_name": "Nom", "th_dedicacion": "Dedicació", "th_exp": "Experiència",
        "7_title": "7. Proposta Econòmica",
        "71_title": "7.1 Desglossament d'Inversió",
        "th_concepto": "Concepte", "th_importe": "Import", "th_pct": "% del Total",
        "inv_total": "Inversió Total:",
        "72_title": "7.2 Condicions de Pagament",
        "73_edu": "7.3 Anàlisi de Retorn / Impacte Educatiu (ROI)",
        "73_corp": "7.3 Anàlisi de Retorn d'Inversió (ROI)",
        "proyeccion": "Projecció:",
        "8_title": "8. Garanties i Nivells de Servei",
        "81_title": "8.1 Garantia de la Solució",
        "82_title": "8.2 Acords de Nivell de Servei (SLA)",
        "th_nivel": "Nivell", "th_resp": "Resposta", "th_resolucion": "Resolució",
        "9_title": "9. Gestió de Riscos",
        "th_riesgo": "Risc", "th_prob": "Probabilitat", "th_mit": "Mitigació",
        "10_title": "10. Casos d'Èxit i Referències",
        "11_title": "11. Condicions Generals",
        "111_title": "11.1 Validesa de la Proposta",
        "validez_txt1": "Aquesta proposta té una validesa de",
        "validez_txt2": "dies a partir de la data d'emissió (",
        "112_title": "11.2 Propietat Intel·lectual",
        "113_title": "11.3 Confidencialitat",
        "114_title": "11.4 Supòsits i Exclusions",
        "12_title": "12. Propers Passos i Acceptació",
        "th_paso": "Pas", "th_accion": "Acció", "th_resp_paso": "Responsable", "th_fecha_lim": "Data Límit",
        "signed_txt": "SIGNAT I ACCEPTAT:",
        "por_txt": "Per", "firma_resp": "Signatura responsable", "toc_title": "ÍNDEX DE CONTINGUTS"
      },
      eu: {
        heroDesc: "Zure errealitatera egokitzen gara. Kamaleoi digital baten moduan, irtenbide bakoitza berezia da.",
        heroTitle1: "IRITENBIDE DIGITALEN PROPOSAMENA",
        heroTitle2: "ETA PROZESUEN AUTOMATIZAZIOA",
        report_prepared: "Honegatiko prestatua:",
        report_ref: "Erreferentzia:",
        report_date: "Data:",
        report_version: "Bertsioa:",
        header_prop: "Irtenbide Digitalen Proposamena",
        footer_conf: "KONFIDENTZIALA",
        footer_page: "Orrialdea",
        fallback_sol: "Egokitutako irtenbidea diseinu operatibo espezifikoaren prozesuan.",
        "1_title": "1. Laburpen Exekutiboa",
        "alcance": "Ibilbide nagusia:",
        "2_title": "2. Testuingurua eta Egoeraren Diagnostikoa",
        "21_title": "2.1 Egungo Ingurunearen Analisia",
        "22_title": "2.2 Egungo Prozesuen Diagnostikoa",
        "23_title": "2.3 Beharren Identifikazioa",
        "th_id": "ID", "th_desc": "Deskribapena", "th_impact": "Inpaktua", "th_priority": "Lehentasuna",
        "3_title": "3. Proposatutako Irtenbidea",
        "31_title": "3.1 Irtenbidearen Ikuspegi Orokorra",
        "311_title": "3.1.1 Proposatutako Interfazearen Prototipoa",
        "32_title": "3.2 Irtenbidearen Osagaiak",
        "321_title": "3.2.1 Prozesuen Automatizazioa (RPA/BPM)",
        "322_edu": "3.2.2 Plataforma Digitala / Kanpus Birtuala eta Kudeaketa Sistema",
        "322_corp": "3.2.2 Plataforma Digitala / Web Ataria",
        "323_edu": "3.2.3 Integrazioak (Kudeaketa Sistema, ERP)",
        "323_corp": "3.2.3 Integrazioak eta Konektagarritasuna",
        "324_title": "3.2.4 Adimen Artifiziala eta Datuen Analisia",
        "33_title": "3.3 Arkitektura Teknikoa",
        "34_title": "3.4 Irtenbidearen Bereizleak",
        "4_title": "4. Inplementazio Metodologia",
        "41_title": "4.1 Ikuspegi Metodologikoa",
        "42_title": "4.2 Proiektuaren Faseak",
        "th_fase": "Fasea", "th_duracion": "Iraupena", "th_entregables": "Lidergaiak",
        "5_title": "5. Egikaritze Kronograma",
        "51_title": "5.1 Denborazko Plangintza",
        "th_inicio": "Hasiera", "th_fin": "Amaiera",
        "52_title": "5.2 Mugarri Nagusiak",
        "6_title": "6. Proiektuko Taldea",
        "61_title": "6.1 Taldearen Egitura",
        "th_rol": "Funtzioa", "th_name": "Izena", "th_dedicacion": "Dedikazioa", "th_exp": "Esperientzia",
        "7_title": "7. Proposamen Ekonomikoa",
        "71_title": "7.1 Inbertsioaren Banakapena",
        "th_concepto": "Kontzeptua", "th_importe": "Zenbatekoa", "th_pct": "Osoko %",
        "inv_total": "Inbertsio Osoa:",
        "72_title": "7.2 Ordainketa Baldintzak",
        "73_edu": "7.3 Itzuleraren / Inpaktu Edukatiboaren Analisia (ROI)",
        "73_corp": "7.3 Inbertsioaren Itzuleraren Analisia (ROI)",
        "proyeccion": "Proiekzioa:",
        "8_title": "8. Bermeak eta Zerbitzu Mailak",
        "81_title": "8.1 Irtenbidearen Bermea",
        "82_title": "8.2 Zerbitzu Mailako Akordioak (SLA)",
        "th_nivel": "Maila", "th_resp": "Erantzukizuna", "th_resolucion": "Ebazpena",
        "9_title": "9. Arriskuen Kudeaketa",
        "th_riesgo": "Arriskua", "th_prob": "Probabilitatea", "th_mit": "Arintzea",
        "10_title": "10. Arrakasta Kasuak eta Erreferentziak",
        "11_title": "11. Baldintza Orokorrak",
        "111_title": "11.1 Proposamenaren Baliozkotasuna",
        "validez_txt1": "Proposamen honek baliozkotasuna du",
        "validez_txt2": "egunez igorpen datatik aurrera (",
        "112_title": "11.2 Jabetza Intelektuala",
        "113_title": "11.3 Konfidentzialtasuna",
        "114_title": "11.4 Suposizioak eta Salbuespenak",
        "12_title": "12. Hurrengo Urratsak eta Onarpena",
        "th_paso": "Urratsa", "th_accion": "Ekintza", "th_resp_paso": "Arduraduna", "th_fecha_lim": "Epea",
        "signed_txt": "SINATUA ETA ONARTUA:",
        "por_txt": "Egilea", "firma_resp": "Arduradunaren sinadura", "toc_title": "EDUKIEN AURKIBIDEA"
      },
      en: {
        heroDesc: "We adapt to your reality. Like a digital chameleon, every solution is unique.",
        heroTitle1: "DIGITAL SOLUTIONS PROPOSAL",
        heroTitle2: "AND PROCESS AUTOMATION",
        report_prepared: "Prepared for:",
        report_ref: "Reference:",
        report_date: "Date:",
        report_version: "Version:",
        header_prop: "Digital Solutions Proposal",
        footer_conf: "CONFIDENTIAL",
        footer_page: "Page",
        fallback_sol: "Tailored solution currently in specific operational design process.",
        "1_title": "1. Executive Summary",
        "alcance": "Main scope:",
        "2_title": "2. Context and Situation Diagnosis",
        "21_title": "2.1 Current Environment Analysis",
        "22_title": "2.2 Current Process Diagnosis",
        "23_title": "2.3 Needs Identification",
        "th_id": "ID", "th_desc": "Description", "th_impact": "Impact", "th_priority": "Priority",
        "3_title": "3. Proposed Solution",
        "31_title": "3.1 Solution Overview",
        "311_title": "3.1.1 Proposed Interface Prototype",
        "32_title": "3.2 Solution Components",
        "321_title": "3.2.1 Process Automation (RPA/BPM)",
        "322_edu": "3.2.2 Digital Platform / Virtual Campus & SIS",
        "322_corp": "3.2.2 Digital Platform / Web Portal",
        "323_edu": "3.2.3 Integrations (SIS, ERP)",
        "323_corp": "3.2.3 Integrations and Connectivity",
        "324_title": "3.2.4 Artificial Intelligence and Data Analytics",
        "33_title": "3.3 Technical Architecture",
        "34_title": "3.4 Solution Differentiators",
        "4_title": "4. Implementation Methodology",
        "41_title": "4.1 Methodological Approach",
        "42_title": "4.2 Project Phases",
        "th_fase": "Phase", "th_duracion": "Duration", "th_entregables": "Deliverables",
        "5_title": "5. Execution Timeline",
        "51_title": "5.1 Project Schedule",
        "th_inicio": "Start", "th_fin": "End",
        "52_title": "5.2 Key Milestones",
        "6_title": "6. Project Team",
        "61_title": "6.1 Team Structure",
        "th_rol": "Role", "th_name": "Name", "th_dedicacion": "Dedication", "th_exp": "Experience",
        "7_title": "7. Financial Proposal",
        "71_title": "7.1 Investment Breakdown",
        "th_concepto": "Item", "th_importe": "Amount", "th_pct": "% of Total",
        "inv_total": "Total Investment:",
        "72_title": "7.2 Payment Terms",
        "73_edu": "7.3 Return Analysis / Educational Impact (ROI)",
        "73_corp": "7.3 Return on Investment Analysis (ROI)",
        "proyeccion": "Projection:",
        "8_title": "8. Warranties and Service Levels",
        "81_title": "8.1 Solution Warranty",
        "82_title": "8.2 Service Level Agreements (SLA)",
        "th_nivel": "Level", "th_resp": "Response", "th_resolucion": "Resolution",
        "9_title": "9. Risk Management",
        "th_riesgo": "Risk", "th_prob": "Probability", "th_mit": "Mitigation",
        "10_title": "10. Success Cases and References",
        "11_title": "11. General Terms and Conditions",
        "111_title": "11.1 Proposal Validity",
        "validez_txt1": "This proposal is valid for",
        "validez_txt2": "days from the date of issue (",
        "112_title": "11.2 Intellectual Property",
        "113_title": "11.3 Confidentiality",
        "114_title": "11.4 Assumptions and Exclusions",
        "12_title": "12. Next Steps and Acceptance",
        "th_paso": "Step", "th_accion": "Action", "th_resp_paso": "Responsible", "th_fecha_lim": "Deadline",
        "signed_txt": "SIGNED AND ACCEPTED:",
        "por_txt": "By", "firma_resp": "Authorised signature", "toc_title": "TABLE OF CONTENTS"
      }
    };
    const t = T[lang] || T['ca'];

    const val = (v) => v || t.fallback_sol;
    const isEdu = d.cliente.sector === "educativo" || d.cliente.sector === "educació";

    // 2. COLORS
    const COLORS = {
      PRIMARY: (d.personalizacion.color_primary || "2F1C6A").replace('#', ''),
      SECONDARY: (d.personalizacion.color_secondary || "673DE6").replace('#', ''),
      ACCENT: (d.personalizacion.color_accent || "8C85FF").replace('#', ''),
      DARK: "333333",
      GRAY: "666666",
      LIGHT_BG: "F3F0FF",
      WHITE: "FFFFFF",
      BORDER: "E8E3FF"
    };

    // 3. HELPER FUNCTIONS
    const createHeading1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
    const createHeading2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
    const createHeading3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
    const createText = (text) => new Paragraph({ children: [new TextRun(text)] });
    const createBullet = (text) => new Paragraph({ children: [new TextRun(text)], bullet: { level: 0 } });

    const createTable = (headers, rows, widths) => {
      const tableRows = [
        new TableRow({
          children: headers.map((h, i) => new TableCell({
            width: { size: widths[i], type: WidthType.DXA },
            shading: { fill: COLORS.PRIMARY, type: ShadingType.CLEAR, color: "auto" },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ children: [new TextRun({ text: h, color: COLORS.WHITE, bold: true })] })]
          }))
        }),
        ...rows.map((r, rowIndex) => new TableRow({
          children: r.map((cellText, cellIndex) => new TableCell({
            width: { size: widths[cellIndex], type: WidthType.DXA },
            shading: { fill: rowIndex % 2 === 0 ? COLORS.WHITE : COLORS.LIGHT_BG, type: ShadingType.CLEAR, color: "auto" },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ text: cellText || "" })]
          }))
        }))
      ];
      return new Table({ width: { size: 9360, type: WidthType.DXA }, rows: tableRows });
    };

    const imgPrompt = d.image_prompt
      ? d.image_prompt + ` Corporate realistic, extremely high quality, clean modern app.`
      : `Modern SaaS dashboard UI for ${d.cliente.nombre || "Digital Transformation"}, app layout, clean modern interface analytics blue and purple colors`;

    const uiImageBuffer = await fetchImageBuffer(imgPrompt);

    // 4. BUILDING BODY SECTIONS
    const bodyContent = [];

    // 1. Resumen Ejecutivo
    bodyContent.push(createHeading1(t["1_title"]));
    bodyContent.push(createText(val(d.proyecto.resumen)));
    bodyContent.push(createText(`${t.alcance} ${val(d.proyecto.alcance)}`));

    // 2. Contexto y Diagnóstico
    bodyContent.push(createHeading1(t["2_title"]));
    bodyContent.push(createHeading2(t["21_title"]));
    bodyContent.push(createText(val(d.diagnostico.entorno_actual || d.diagnostico.entorno)));
    bodyContent.push(createHeading2(t["22_title"]));
    bodyContent.push(createText(val(d.diagnostico.cuello_botella || d.diagnostico.procesos)));
    bodyContent.push(createHeading2(t["23_title"]));
    if (d.diagnostico.necesidades && d.diagnostico.necesidades.length > 0) {
      bodyContent.push(createTable(
        [t.th_id, t.th_desc, t.th_impact, t.th_priority],
        d.diagnostico.necesidades.map(n => [n.id || "N1", n.descripcion, n.impacto, n.prioridad]),
        [1000, 4360, 2500, 1500]
      ));
    } else {
      bodyContent.push(createText(val(null)));
    }

    // 3. Solución Propuesta
    bodyContent.push(createHeading1(t["3_title"]));
    bodyContent.push(createHeading2(t["31_title"]));
    bodyContent.push(createText(val(d.solucion.vision_general || d.solucion.vision)));

    if (uiImageBuffer) {
      bodyContent.push(createHeading2(t["311_title"]));
      bodyContent.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: uiImageBuffer,
            transformation: { width: 500, height: 281 },
            type: "jpeg"
          })
        ]
      }));
    }

    bodyContent.push(createHeading2(t["32_title"]));
    bodyContent.push(createHeading3(t["321_title"]));
    bodyContent.push(createText(val(d.solucion.componentes.automatizacion)));
    bodyContent.push(createHeading3(isEdu ? t["322_edu"] : t["322_corp"]));
    bodyContent.push(createText(val(d.solucion.componentes.plataforma)));
    bodyContent.push(createHeading3(isEdu ? t["323_edu"] : t["323_corp"]));
    bodyContent.push(createText(val(d.solucion.componentes.integraciones)));
    bodyContent.push(createHeading3(t["324_title"]));
    bodyContent.push(createText(val(d.solucion.componentes.ia_datos)));

    bodyContent.push(createHeading2(t["33_title"]));
    bodyContent.push(createText(val(d.solucion.arquitectura)));

    bodyContent.push(createHeading2(t["34_title"]));
    if (d.solucion.diferenciadores && d.solucion.diferenciadores.length > 0) {
      d.solucion.diferenciadores.forEach(dif => {
        bodyContent.push(createBullet(`${dif.nombre}: ${dif.valor}`));
      });
    } else {
      bodyContent.push(createText(val(null)));
    }

    // 4. Metodología de Implementación
    bodyContent.push(createHeading1(t["4_title"]));
    bodyContent.push(createHeading2(t["41_title"]));
    bodyContent.push(createText(val(d.metodologia.enfoque)));
    bodyContent.push(createHeading2(t["42_title"]));
    if (d.metodologia.fases && d.metodologia.fases.length > 0) {
      bodyContent.push(createTable(
        [t.th_fase, t.th_duracion, t.th_desc, t.th_entregables],
        d.metodologia.fases.map(f => [f.nombre, f.duracion, f.descripcion, f.entregables]),
        [1500, 1500, 4000, 2360]
      ));
    } else {
      bodyContent.push(createText(val(null)));
    }

    // 5. Cronograma de Ejecución
    bodyContent.push(createHeading1(t["5_title"]));
    bodyContent.push(createHeading2(t["51_title"]));
    if (d.cronograma.fases && d.cronograma.fases.length > 0) {
      bodyContent.push(createTable(
        [t.th_fase, t.th_inicio, t.th_fin, t.th_entregables],
        d.cronograma.fases.map(f => [f.fase, f.inicio, f.fin, f.entregables]),
        [3000, 1500, 1500, 3360]
      ));
    } else {
      bodyContent.push(createText(val(null)));
    }
    bodyContent.push(createHeading2(t["52_title"]));
    bodyContent.push(createText(val(d.cronograma.hitos)));

    // 6. Equipo de Proyecto
    bodyContent.push(createHeading1(t["6_title"]));
    bodyContent.push(createHeading2(t["61_title"]));
    if (d.equipo && d.equipo.length > 0) {
      bodyContent.push(createTable(
        [t.th_rol, t.th_name, t.th_dedicacion, t.th_exp],
        d.equipo.map(e => [e.rol, e.nombre, e.dedicacion, e.experiencia]),
        [2500, 2500, 1500, 2860]
      ));
    } else {
      bodyContent.push(createText(val(null)));
    }

    // 7. Propuesta Económica
    bodyContent.push(createHeading1(t["7_title"]));
    bodyContent.push(createHeading2(t["71_title"]));
    if (d.economia.conceptos && d.economia.conceptos.length > 0) {
      bodyContent.push(createTable(
        [t.th_concepto, t.th_importe, t.th_pct],
        d.economia.conceptos.map(e => [e.concepto, e.importe, e.porcentaje]),
        [5000, 2500, 1860]
      ));
    } else {
      bodyContent.push(createText(val(null)));
    }
    bodyContent.push(createText(`${t.inv_total} ${val(d.proyecto.inversion_total)} ${val(d.propuesta.moneda)}`));

    bodyContent.push(createHeading2(t["72_title"]));
    bodyContent.push(createText(val(d.economia.condiciones_pago)));
    bodyContent.push(createHeading2(isEdu ? t["73_edu"] : t["73_corp"]));
    bodyContent.push(createText(`${t.proyeccion} ${val(d.proyecto.roi_proyectado)}`));
    bodyContent.push(createText(val(d.economia.roi_detalle)));

    // 8. Garantías y Niveles de Servicio
    bodyContent.push(createHeading1(t["8_title"]));
    bodyContent.push(createHeading2(t["81_title"]));
    bodyContent.push(createText(val(d.garantias.descripcion)));
    bodyContent.push(createHeading2(t["82_title"]));
    if (d.garantias.sla && d.garantias.sla.length > 0) {
      bodyContent.push(createTable(
        [t.th_nivel, t.th_desc, t.th_resp, t.th_resolucion],
        d.garantias.sla.map(s => [s.nivel, s.descripcion, s.tiempo_respuesta, s.tiempo_resolucion]),
        [1500, 4500, 1680, 1680]
      ));
    } else {
      bodyContent.push(createText(val(null)));
    }

    // 9. Gestión de Riesgos
    bodyContent.push(createHeading1(t["9_title"]));
    if (d.riesgos && d.riesgos.length > 0) {
      bodyContent.push(createTable(
        [t.th_riesgo, t.th_prob, t.th_impact, t.th_mit],
        d.riesgos.map(r => [r.riesgo, r.probabilidad, r.impacto, r.mitigacion]),
        [3500, 1500, 1500, 2860]
      ));
    } else {
      bodyContent.push(createText(val(null)));
    }

    // 10. Casos de Éxito y Referencias
    bodyContent.push(createHeading1(t["10_title"]));
    bodyContent.push(createText(isEdu ? val(d.casos_exito.educativo) : val(d.casos_exito.empresarial)));
    bodyContent.push(createText(val(d.casos_exito.certificaciones)));

    // 11. Condiciones Generales
    bodyContent.push(createHeading1(t["11_title"]));
    bodyContent.push(createHeading2(t["111_title"]));
    bodyContent.push(createText(`${t.validez_txt1} ${val(d.propuesta.validez_dias)} ${t.validez_txt2}${val(d.propuesta.fecha)}).`));
    bodyContent.push(createHeading2(t["112_title"]));
    bodyContent.push(createText(val(d.condiciones.propiedad_intelectual)));
    bodyContent.push(createHeading2(t["113_title"]));
    bodyContent.push(createText(val(d.condiciones.confidencialidad)));
    bodyContent.push(createHeading2(t["114_title"]));
    bodyContent.push(createText(val(d.condiciones.supuestos)));

    // 12. Próximos Pasos + Bloque de Firma
    bodyContent.push(new Paragraph({ children: [new PageBreak()] }));
    bodyContent.push(createHeading1(t["12_title"]));
    if (d.proximos_pasos && d.proximos_pasos.length > 0) {
      bodyContent.push(createTable(
        [t.th_paso, t.th_accion, t.th_resp_paso, t.th_fecha_lim],
        d.proximos_pasos.map(p => [p.paso?.toString(), p.accion, p.responsable, p.fecha_limite]),
        [800, 4500, 2060, 2000]
      ));
    } else {
      bodyContent.push(createText(val(null)));
    }

    bodyContent.push(new Paragraph({ spacing: { before: 800 }, children: [new TextRun(t.signed_txt)] }));

    const signatureTable = new Table({
      width: { size: 9360, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4680, type: WidthType.DXA },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              borders: { top: { style: BorderStyle.NIL }, left: { style: BorderStyle.NIL }, right: { style: BorderStyle.NIL }, bottom: { style: BorderStyle.NIL } },
              children: [
                new Paragraph({ spacing: { before: 1200 }, children: [new TextRun({ text: `${t.por_txt} ${val(d.consultora.nombre)}`, bold: true })] }),
                new Paragraph({ children: [new TextRun({ text: t.firma_resp, color: COLORS.GRAY })] })
              ]
            }),
            new TableCell({
              width: { size: 4680, type: WidthType.DXA },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              borders: { top: { style: BorderStyle.NIL }, left: { style: BorderStyle.NIL }, right: { style: BorderStyle.NIL }, bottom: { style: BorderStyle.NIL } },
              children: [
                new Paragraph({ spacing: { before: 1200 }, children: [new TextRun({ text: `${t.por_txt} ${val(d.cliente.nombre)}`, bold: true })] }),
                new Paragraph({ children: [new TextRun({ text: val(d.cliente.contacto_nombre), color: COLORS.GRAY })] }),
                new Paragraph({ children: [new TextRun({ text: val(d.cliente.contacto_cargo), color: COLORS.GRAY })] })
              ]
            })
          ]
        })
      ]
    });
    bodyContent.push(signatureTable);


    // 5. ASSEMBLE DOCUMENT
    const doc = new Document({
      styles: {
        paragraphStyles: [
          {
            id: "Normal",
            name: "Normal",
            run: { size: 22, font: "Arial", color: COLORS.DARK },
            paragraph: {
              alignment: AlignmentType.JUSTIFIED,
              spacing: { line: 276, before: 120, after: 120 },
              indent: { firstLine: 420 }
            }
          },
          {
            id: "Heading1",
            name: "Heading 1",
            run: { size: 32, bold: true, font: "Arial", color: COLORS.PRIMARY },
            paragraph: {
              alignment: AlignmentType.LEFT,
              spacing: { before: 400, after: 200 },
              outlineLevel: 0,
              border: { bottom: { color: COLORS.SECONDARY, size: 6, space: 1, style: BorderStyle.SINGLE } }
            }
          },
          {
            id: "Heading2",
            name: "Heading 2",
            run: { size: 26, bold: true, font: "Arial", color: COLORS.SECONDARY },
            paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 }
          },
          {
            id: "Heading3",
            name: "Heading 3",
            run: { size: 22, bold: true, font: "Arial", color: COLORS.ACCENT },
            paragraph: { spacing: { before: 120, after: 120 }, outlineLevel: 2 }
          }
        ]
      },
      sections: [
        // COVER PAGE
        {
          properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
          children: [
            // Note: Since docx.js image handling requires absolute local paths or array buffers, 
            // text-based logo is used here. A future iteration can embed the exact PNG if available.
            new Paragraph({
              spacing: { before: 2400 }, alignment: AlignmentType.CENTER, children: [
                new TextRun({ text: "adeptify", bold: true, size: 56, color: "00A0E3" }) // Blue
              ]
            }),
            new Paragraph({
              spacing: { before: 400 }, alignment: AlignmentType.CENTER, children: [
                new TextRun({ text: "ADEPTIFY", bold: true, size: 40, color: "111827" }) // Slate-900
              ]
            }),
            new Paragraph({
              spacing: { before: 200, after: 800 }, alignment: AlignmentType.CENTER, children: [
                new TextRun({ text: t.heroDesc || "Ens adaptem a la teva realitat. Com un camaleó digital, cada solució és única.", italics: true, size: 24, color: "4F46E5" }) // Indigo-600
              ]
            }),
            new Paragraph({
              border: { bottom: { color: "111827", size: 6, space: 1, style: BorderStyle.SINGLE } },
              spacing: { after: 1200 }, children: []
            }),
            new Paragraph({
              spacing: { before: 1200, after: 200 }, alignment: AlignmentType.CENTER, children: [
                new TextRun({ text: t.heroTitle1 || "PROPOSTA DE SOLUCIONS DIGITALS", bold: true, size: 48, color: "1E1B4B" }) // Indigo-950
              ]
            }),
            new Paragraph({
              spacing: { after: 1200 }, alignment: AlignmentType.CENTER, children: [
                new TextRun({ text: t.heroTitle2 || "I AUTOMATITZACIÓ DE PROCESSOS", bold: true, size: 36, color: "6366F1" }) // Indigo-500
              ]
            }),
            new Paragraph({
              border: { bottom: { color: "C7D2FE", size: 6, space: 1, style: BorderStyle.SINGLE } }, // Indigo-200
              spacing: { after: 1200 }, children: []
            }),
            new Paragraph({
              spacing: { before: 2000, after: 200 }, alignment: AlignmentType.CENTER, children: [
                new TextRun({ text: t.report_prepared || "Preparat per a:", size: 28, color: "64748B" }) // Slate-500
              ]
            }),
            new Paragraph({
              spacing: { after: 1200 }, alignment: AlignmentType.CENTER, children: [
                new TextRun({ text: val(d.cliente.nombre, "Institució"), bold: true, size: 40, color: "1E1B4B" })
              ]
            }),
            new Paragraph({
              spacing: { before: 1000 }, alignment: AlignmentType.CENTER, children: [
                new TextRun({ text: `${t.report_ref || "Referència:"} ${d.propuesta.referencia || "PROP-XXXX-XXXX"}`, size: 20, color: "64748B" }),
                new TextRun({ text: "", break: 1 }),
                new TextRun({ text: `${t.report_date || "Data:"} ${d.propuesta.fecha || new Date().toLocaleDateString()}`, size: 20, color: "64748B" }),
                new TextRun({ text: "", break: 1 }),
                new TextRun({ text: `${t.report_version || "Versió:"} ${d.propuesta.version || "1.0"}`, size: 20, color: "64748B" })
              ]
            }),
            new Paragraph({ children: [new PageBreak()] })
          ]
        },
        // CONTENT SECTIONS WITH HEADERS/FOOTERS
        {
          properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  border: { bottom: { color: COLORS.SECONDARY, size: 4, space: 1, style: BorderStyle.SINGLE } },
                  children: [
                    new TextRun({ text: val(d.consultora.nombre, "Adeptify Systems"), bold: true, color: COLORS.PRIMARY, size: 16 }),
                    new TextRun({ text: `\t\t${t.header_prop || "Propuesta de Soluciones Digitales"}`, italics: true, color: COLORS.GRAY, size: 16 })
                  ]
                })
              ]
            })
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  border: { top: { color: COLORS.SECONDARY, size: 4, space: 1, style: BorderStyle.SINGLE } },
                  children: [
                    new TextRun({ text: `${t.footer_conf || "CONFIDENCIAL"} | ${val(d.cliente.nombre)}`, color: COLORS.GRAY, size: 14 }),
                    new TextRun({ text: `\t\t${t.footer_page || "Página"} `, color: COLORS.GRAY, size: 14 }),
                    new TextRun({ children: [PageNumber.CURRENT], color: COLORS.GRAY, size: 14 })
                  ]
                })
              ]
            })
          },
          children: [
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("ÍNDICE DE CONTENIDOS")] }),
            new TableOfContents("Índice", { headingStyleRange: "1-3", hyperlink: true }),
            new Paragraph({ children: [new PageBreak()] }),
            ...bodyContent
          ]
        }
      ]
    });

    return await Packer.toBuffer(doc);
  }
}

module.exports = { WordProposalGenerator };
