require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');
const docx = require('docx');

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Table, TableRow, TableCell, WidthType,
  ShadingType, PageBreak, Header, Footer, PageNumber,
  TableOfContents
} = docx;

const PORT = Number(process.env.PORT || 2705);
const STARTUP_TS = Date.now();

const app = express();
app.use(express.json({ limit: '15mb' }));

// --- CONFIGURACIÓ DE BRANDING ADEPTIFY.ES ---
const COLORS = {
  PRIMARY: "1B3A5C",
  SECONDARY: "2E75B6",
  ACCENT: "4A90D9",
  DARK: "1A1A1A",
  GRAY: "666666",
  LIGHT_BG: "E8F0FE",
  BORDER: "B0C4DE"
};

// --- DB CLIENT ---
let cachedSupabase = null;
const getSupabaseAdmin = () => {
  if (cachedSupabase) return cachedSupabase;
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  cachedSupabase = createClient(url, key);
  return cachedSupabase;
};

// --- GEMINI RESILIENT CALLER ---
async function callGemini(prompt, modelId = "gemini-2.5-flash") {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }],
      generationConfig: { temperature: 0.3 }
    })
  });

  const data = await response.json();
  if (data.error) {
    console.error(`[Gemini API Error]`, data.error);
    throw new Error(data.error.message);
  }

  const rawText = data.candidates[0].content.parts[0].text;
  let cleanText = rawText.trim();

  if (cleanText.startsWith("```json")) {
    cleanText = cleanText.substring(7);
  } else if (cleanText.startsWith("```")) {
    cleanText = cleanText.substring(3);
  }

  if (cleanText.endsWith("```")) {
    cleanText = cleanText.substring(0, cleanText.length - 3);
  }

  cleanText = cleanText.trim();

  // Si sigue fallando y no era markdown, podemos aislar de { a }
  if (!cleanText.startsWith("{")) {
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    }
  }

  try {
    return JSON.parse(cleanText);
  } catch (err) {
    console.error("[JSON Parse Error] Raw text:", rawText);
    throw new Error("Gemini returned invalid JSON structure.");
  }
}

// --- CLASSE GENERADORA DE DOCX (MIGRADA AL SERVEI) ---
const { WordProposalGenerator } = require('./services/wordGenerator.js');

// --- ENDPOINTS ---

app.post('/api/automation/capture', async (req, res) => {
  const { url, lang } = req.body;
  const targetLang = lang === 'es' ? 'CASTELLANO' : (lang === 'eu' ? 'EUSKERA' : 'CATALÀ');
  try {
    console.info(`[automation] Scraping URL: ${url}`);

    // Attempt basic fallback scrape
    let text = "";
    try {
      const fetchResp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      const html = await fetchResp.text();
      const $ = cheerio.load(html);
      text = $('body').text().replace(/\s+/g, ' ').substring(0, 15000);
    } catch (e) {
      text = `Error scraping ${url}. El asistente debe buscar información en internet sobre esta entidad.`;
    }

    const prompt = `
Eres un consultor sénior especializado en transformación digital, automatización de procesos e implementación de IA para empresas e instituciones. Trabajas para Adeptify Systems.

REGLA CRÍTICA — PROHIBICIÓN ABSOLUTA DE PLACEHOLDERS:
NUNCA incluyas "Pendiente de definir", "A completar", "TBD", "N/A" o variantes entre corchetes.
CADA sección DEBE contener contenido real, concreto y profesional.
INFIERE contenido razonable basándote en el contexto del cliente y BÚSCALO CON GOOGLE SEARCH (la herramienta está activada) si necesitas datos específicos de la escuela/empresa.

REGLAS DE SECCIONES (Aplica esto al generar proposal_data):
- 3.3 Arquitectura: Genera diagrama textual real (ej. Web -> CRM -> Automations).
- 5.1 Temporal: Mínimo 6 fases reales. Proyecto estándar PYME: 8 semanas, Edu: 10-12 semanas.
- 7.1 Inversión: Desglose concreto de importes. Si no hay datos, infiere (PYME: 3k-8k, Edu: 6k-15k).
- 7.3 ROI: Calcula ROI con horas ahorradas y periodo de amortización.
- 8.2 SLA: Genera tabla real 3 niveles (Crítico <4h, Estándar <24h, Consultas).
- 9 Riesgos: 5 riesgos estándar adaptados con mitigaciones reales.
- 10 Casos de Éxito: Inventa o infiere 2 casos hiperrealistas similares a la entidad analizada (ej. "Escuela X: Reducción 60% tiempo matrícula").
- 11.1 Validez: 30 días.
- 11.4 Supuestos: 3 supuestos, 4 exclusiones.
- 12 Pasos: 5 acciones con responsables y fechas (Semanas 1-4).
- Firma: Usa "Responsable autoritzat" y "Direcció" si no sabes nombres exactos. NUNCA en blanco.

Genera un JSON EXACTO a esta estructura y aplica estas reglas a los datos de "proposal_data":
{
  "company_name": "Nombre de la empresa extraido o investigado",
  "contact_email": "Email extraido",
  "recommended_solution": "Breve descripción de la solución",
  "needs_detected": ["Necesidad 1", "Necesidad 2"],
  "recommended_services": ["Servicio 1", "Servicio 2"],
  "main_bottleneck": "Cuello de botella",
  "estimated_budget_range": "Estimacion",
  "custom_pitch": "Pitch hiper realista en un parrafo",
  "proposal_data": {
    "consultora": { "nombre": "Adeptify Systems" },
    "cliente": { "nombre": "...", "tipo": "...", "sector": "...", "contacto_nombre": "Responsable autorizado", "contacto_cargo": "Dirección" },
    "propuesta": { "referencia": "PROP-9403", "fecha": "2026-03-02", "version": "1.0", "validez_dias": 30 },
    "diagnostico": { "resumen_ejecutivo": "...", "entorno_actual": "...", "cuello_botella": "...", "necesidades": [ {"id":"N1","descripcion":"...","impacto":"Alto","prioridad":"Alta"} ] },
    "solucion": { "vision_general": "...", "componentes": { "automatizacion": "...", "plataforma": "...", "integraciones": "...", "ia": "..." }, "arquitectura": { "capas": ["Frontend", "Backend..."], "integraciones_externas": ["..."], "tecnologias": ["n8n", "OpenAI API", "PostgreSQL"], "flujo_datos": "..." }, "diferenciadores": ["IA nativa"] },
    "cronograma": { "duracion_total": "10 semanas", "fases": [ {"nombre": "...", "duracion": "Semana 1-2", "actividades": ["..."], "entregables": ["..."]} ] },
    "equipo": [ {"rol": "Consultor IT", "nombre": "Equipo Adeptify", "dedicacion": "Alta", "experiencia": "Experto"} ],
    "economia": { "rango_presupuesto": "...", "moneda": "EUR", "conceptos": [ {"descripcion": "...", "importe": 3500, "porcentaje": 45} ], "total": 8000, "condiciones_pago": "50% inicio + 50% entrega", "roi": { "horas_ahorradas_semana": 15, "coste_hora_estimado": 25, "ahorro_anual_estimado": 19500, "periodo_amortizacion_meses": 5, "roi_porcentaje": 144 } },
    "garantias": { "periodo_garantia": "6 meses", "sla": [ {"servicio": "Soporte", "tiempo_respuesta": "< 4h", "tiempo_resolucion": "< 24h", "disponibilidad": "99.5%"} ] },
    "riesgos": [ {"riesgo": "...", "probabilidad": "Media", "impacto": "Alto", "mitigacion": "..."} ],
    "casos_exito": [ {"cliente": "...", "sector": "...", "reto": "...", "solucion": "...", "resultados": "..."} ],
    "condiciones": { "propiedad_intelectual": "...", "confidencialidad": "...", "supuestos": ["..."], "exclusiones": ["..."] },
    "proximos_pasos": [ {"accion": "...", "responsable": "...", "plazo": "..."} ]
  }
}

IDIOMA DE RESPUESTA PARA EL CONTENIDO DEL JSON Y LA PROPUESTA (MUY IMPORTANTE, SIEMPRE DEBE SER ESTE, EXCEPTO CLAVES JSON QUE VAN EN EL JSON EXACTO): ${targetLang}.
Usa a fondo la herramienta "googleSearch" para investigar la URL proporcionada y el nombre de la entidad, su historia y lo que hacen.
TEXTO OBTENIDO DEL SCRAPER INICIAL: ${text}
`;

    // Utiliza un modelo estándar moderno, flash 2.5 soporte tool calling
    console.info(`[automation] Calling Gemini for URL analysis...`);
    const result = await callGemini(prompt, "gemini-2.5-flash");
    res.json(result);
  } catch (e) {
    console.error("[Capture Error Trace]", e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/automation/digital-twin', async (req, res) => {
  try {
    const result = await callGemini("Actua com a motor de Digital Twin educatiu. Genera prediccions d'estrès operatiu (JSON: stress_level, critical_department, predictions[]).");
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/automation/migrate-data', async (req, res) => {
  try {
    const result = await callGemini(`Estructura les dades: ${req.body.rawData} en JSON (mapped_staff[], migration_summary).`);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/automation/network-prospecting', async (req, res) => {
  try {
    const result = await callGemini(`Estratègia d'expansió des de ${req.body.referenceCenterName} (JSON: expansion_nodes[]).`);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/leads/send-proposal', async (req, res) => {
  const { leadId, email, subject, body, pdfBase64, docxBase64, proposalData } = req.body;
  try {
    const host = process.env.SMTP_HOST;
    if (!host) throw new Error("SMTP No Configurat");
    const transporter = nodemailer.createTransport({ host, port: Number(process.env.SMTP_PORT || 587), secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });

    const supabase = getSupabaseAdmin();
    let interactionId = crypto.randomUUID();
    if (supabase && leadId) await supabase.from('lead_interactions').insert({ id: interactionId, lead_id: leadId, interaction_type: 'proposal_sent', content_summary: subject, payload_json: proposalData });

    const html = `<div style="font-family:sans-serif;">${body.replace(/\n/g, '<br>')}<br><br><img src="https://consultor.adeptify.es/api/crm/track/${interactionId}.png" width="1" height="1"/></div>`;

    let attachments = [];
    if (docxBase64) {
      attachments.push({ filename: 'Proposta_Adeptify.docx', content: docxBase64, encoding: 'base64' });
    } else if (pdfBase64) {
      attachments.push({ filename: 'Proposta_Adeptify.pdf', content: pdfBase64, encoding: 'base64' });
    }

    await transporter.sendMail({ from: process.env.SMTP_USER, to: email, subject, html, attachments });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/crm/track/:id.png', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (supabase) await supabase.from('lead_interactions').update({ metadata_json: { opened_at: new Date().toISOString() } }).eq('id', req.params.id);
  } catch (e) { }
  res.writeHead(200, { 'Content-Type': 'image/gif' }).end(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
});

app.post('/api/automation/generate-docx', async (req, res) => {
  try {
    const generator = new WordProposalGenerator();
    const buffer = await generator.generate(req.body.leadData, req.body.lang || 'ca');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').send(buffer);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: "API Not Found" });
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, () => console.log(`Adeptify 2.0 on ${PORT}`));
