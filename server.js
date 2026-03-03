require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');
const docx = require('docx');

// Multi-agent system
const { orchestrate } = require('./multi-agent/orchestrator');
const { generateDocxBuffer } = require('./multi-agent/generate_docx');

// In-memory job store for SSE progress streaming
const reportJobs = new Map(); // jobId -> { status, events[], result, error }

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

app.post('/api/v1/documents/sync', async (req, res) => {
  try {
    const { center_name, document: doc, tenant_slug } = req.body;
    if (!center_name || !doc) return res.status(400).json({ error: "Missing center_name or document" });

    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("Supabase admin client not initialized");

    const centerKey = center_name.toLowerCase().trim()
      .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const tenantSlug = tenant_slug || req.headers['x-tenant-slug'] || 'default';

    // 1. INSERT a center_artifacts (historial immutable)
    const { data: artifact, error: artifactError } = await supabase.from('center_artifacts').insert({
      tenant_slug: tenantSlug,
      center_key: centerKey,
      center_name,
      artifact_type: doc.tipus,
      payload_json: doc.payload || doc
    }).select().single();

    if (artifactError) throw artifactError;

    // 2. UPSERT a center_insights_v2 si és dafo o custom_proposal
    if (['dafo', 'custom_proposal'].includes(doc.tipus)) {
      const { error: upsertError } = await supabase.from('center_insights_v2').upsert({
        tenant_slug: tenantSlug,
        center_key: centerKey,
        center_name,
        dafo_json: doc.tipus === 'dafo' ? (doc.payload || doc) : undefined,
        dafo_generated_at: doc.tipus === 'dafo' ? new Date().toISOString() : undefined,
        custom_proposal_json: doc.tipus === 'custom_proposal' ? (doc.payload || doc) : undefined,
        custom_generated_at: doc.tipus === 'custom_proposal' ? new Date().toISOString() : undefined,
      }, { onConflict: 'tenant_slug,center_key' });
      if (upsertError) console.error("[Sync] Error upserting center_insights_v2:", upsertError);
    }

    // 3. Retornar format que espera centerArtifactsService
    res.json({
      id: artifact.id,
      tenant_slug: tenantSlug,
      center_key: centerKey,
      center_name,
      tipus: artifact.artifact_type,
      payload: artifact.payload_json,
      created_at: artifact.created_at
    });
  } catch (e) {
    console.error("[Documents Sync Error]", e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/documents/by-center', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("Supabase admin client not initialized");

    const tenantSlug = req.query.tenant_slug || 'default';
    let query = supabase.from('center_artifacts')
      .select('*')
      .eq('tenant_slug', tenantSlug)
      .order('created_at', { ascending: false });

    if (req.query.center_name) {
      const centerKey = req.query.center_name.toLowerCase().trim()
        .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      query = query.eq('center_key', centerKey);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({
      documents: data.map(a => ({
        id: a.id,
        tenant_slug: a.tenant_slug,
        center_key: a.center_key,
        center_name: a.center_name,
        tipus: a.artifact_type,
        payload: a.payload_json,
        created_at: a.created_at
      }))
    });
  } catch (e) {
    console.error("[Documents By-Center Error]", e);
    res.status(500).json({ error: e.message });
  }
});

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
Eres un consultor sénior especializado en transformación digital, automatización e implementación de IA.

REGLA CRÍTICA - IMAGEN Y ABSTRACCIÓN:
- El 'image_prompt' DEBE generar imágenes METAFÓRICAS ABSTRACTAS en 3D ISOMÉTRICO (luces de neón, engranajes digitales, nodos conectados).
- ESTÁ ESTRICTAMENTE PROHIBIDO pedir "Pantallas", "Screens", "Laptops", "Gráficos" o "Dashboards" con texto. La imagen debe ser un render fotorealista artístico de flujos de datos y conexiones.

REGLA CRÍTICA - ESTRATEGIA:
- Infiere presupuestos realistas y ROI detallado. 
- Analiza la URL y el contexto a fondo (busca en google si es necesario).

Genera EXACTAMENTE este formato JSON (sin Markdown fuera de él):
{
  "company_name": "Nombre exacto",
  "contact_email": "Email inferido/extraído",
  "recommended_solution": "Breve descripción",
  "needs_detected": ["Necesidad 1", "Necesidad 2"],
  "recommended_services": ["Solución 1", "Solución 2"],
  "main_bottleneck": "El mayor problema operativo",
  "estimated_budget_range": "Ej: 6.000€ - 12.000€",
  "custom_pitch": "Resumen ejecutivo muy denso e hiper-personalizado",
  "image_prompt": "El prompt visual en INGLÉS bajo las reglas descritas arriba.",
  "proposal_data": {
    "diagnostico": {
      "resumen_ejecutivo": "Diagnóstico de alto nivel...",
      "entorno_actual": "Descripción densa...",
      "cuello_botella": "Explicación detallada...",
      "necesidades": [ {"id":"N1","descripcion":"...","impacto":"Alto","prioridad":"Alta"} ]
    },
    "solucion": {
      "vision_general": "Visión de la solución...",
      "componentes": {
        "automatizacion": "Valor aportado...",
        "plataforma": "Valor aportado...",
        "integraciones": "Sistemas a conectar...",
        "ia": "Impacto de IA..."
      },
      "arquitectura": {
        "capas": ["Frontend", "Backend..."],
        "tecnologias": ["n8n", "OpenAI API", "PostgreSQL"],
        "flujo_datos": "Explicación de cómo fluyen los datos..."
      },
      "diferenciadores": ["Tecnología IA Nativa", "Velocidad de implantación"]
    },
    "economia": {
      "rango_presupuesto": "8.000€",
      "conceptos": [ {"descripcion": "Automatización Core", "importe": 3500, "porcentaje": 45} ],
      "total": 8000,
      "roi": {
        "horas_ahorradas_semana": 15,
        "ahorro_anual_estimado": 19500,
        "periodo_amortizacion_meses": 5,
        "roi_porcentaje": 144
      }
    },
    "casos_exito": [ 
      {"cliente": "Entidad Similar", "sector": "Mismo Sector", "reto": "Reto común", "solucion": "Solución", "resultados": "ROI obtenido"} 
    ]
  }
}

IDIOMA DE RESPUESTA PARA EL CONTENIDO DEL JSON Y LA PROPUESTA (MUY IMPORTANTE, SIEMPRE DEBE SER ESTE, EXCEPTO CLAVES JSON QUE VAN EN EL JSON EXACTO): ${targetLang}.
Usa a fondo la herramienta "googleSearch" para investigar la URL proporcionada y el nombre de la entidad, su historia y lo que hacen.
TEXTO OBTENIDO DEL SCRAPER INICIAL: ${text}
`;

    // Utiliza un modelo estándar moderno, flash 2.5 soporte tool calling
    console.info(`[automation] Calling Gemini for URL analysis...`);
    const result = await callGemini(prompt, "gemini-2.5-flash");
    console.info(`[automation] Strategic Data generated successfully.`);
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
  const { referenceCenterName, location } = req.body;
  const prompt = `Ets un estrateg d'expansió per a consultores educatives.
Centre de referència: "${referenceCenterName || 'centre educatiu'}" a "${location || 'Catalunya'}".
Identifica 5 centres educatius similars de la mateixa zona.
Retorna EXACTAMENT aquest JSON sense markdown:
{
  "expansion_nodes": [
    { "name": "...", "location": "Municipi, Comarca", "type": "concertat|privat|públic",
      "estimated_students": 500, "digital_maturity": "baix|mig|alt",
      "opportunity_score": 8, "pitch": "Per què és un bon candidat.",
      "contact_approach": "Com contactar-los." }
  ]
}`;
  try {
    const result = await callGemini(prompt, "gemini-2.5-flash");
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

// ─── Multi-Agent Full Report ──────────────────────────────────────────────────
// Flow: POST /start → returns jobId → GET /stream/:jobId (EventSource) → SSE events

async function runFullReportJob(jobId, datosCliente) {
  const job = reportJobs.get(jobId);
  const push = (type, payload) => { if (job) job.events.push({ type, ...payload }); };

  try {
    push('progress', { agent: 'ORQUESTADOR', message: 'Sistema multi-agent iniciat (14 agents)', fase: 0 });

    const doc = await orchestrate(datosCliente, (agentId, message, fase) => {
      push('progress', { agent: agentId, message, fase });
    });

    push('progress', { agent: 'DOCX', message: 'Generant document Word...', fase: 5 });

    // Store raw doc for download even if DOCX generation fails
    const clientName = datosCliente?.cliente?.nombre || 'Client';
    const rawJsonBase64 = Buffer.from(JSON.stringify(doc, null, 2), 'utf-8').toString('base64');

    let docxBase64 = null;
    try {
      const buffer = await generateDocxBuffer(doc, datosCliente);
      docxBase64 = buffer.toString('base64');
      console.log(`[MultiAgent] DOCX OK — ${Math.round(buffer.length / 1024)} KB`);
    } catch (docxErr) {
      console.error('[MultiAgent] DOCX generation failed:', docxErr.message);
      push('progress', { agent: 'DOCX', message: `Advertència DOCX: ${docxErr.message} — el JSON es pot descarregar igualment`, fase: 5 });
    }

    job.status = 'done';
    job.result = { doc, docxBase64, rawJsonBase64, clientName };

    // Send email with the generated report
    try {
      const host = process.env.SMTP_HOST;
      const emailTo = datosCliente?.cliente?.email || process.env.CONTACT_TO;
      if (host && emailTo) {
        const transporter = nodemailer.createTransport({ host, port: Number(process.env.SMTP_PORT || 587), secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });

        let attachments = [];
        if (docxBase64) {
          attachments.push({ filename: `Informe_${clientName.replace(/\s+/g, '_')}.docx`, content: docxBase64, encoding: 'base64' });
        }

        const htmlBody = `<div style="font-family:sans-serif;">Hola,<br><br>S'ha completat la generació del teu informe personalitzat iteratiu amb IA sobre: <strong>${clientName}</strong>.<br><br>Trobaràs l'informe generat adjunt en aquest missatge.<br><br>Salutacions,<br>Equip Adeptify</div>`;

        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: emailTo,
          subject: `El teu informe personalitzat de ${clientName} està llest`,
          html: htmlBody,
          attachments
        });
        console.log(`[MultiAgent] Email enviat correctament a ${emailTo}`);
        push('progress', { agent: 'ORQUESTADOR', message: `Informe enviat correctament a ${emailTo}`, fase: 5 });
      }
    } catch (emailErr) {
      console.error('[MultiAgent] Fallada al enviar email:', emailErr.message);
      push('progress', { agent: 'ORQUESTADOR', message: `No s'ha pogut enviar per email: ${emailErr.message}`, fase: 5 });
    }

    // Don't send 'doc' in complete event — it's large and can overload SSE
    push('complete', { docxBase64, rawJsonBase64, clientName });
  } catch (e) {
    console.error('[MultiAgent] Error:', e.message);
    if (reportJobs.get(jobId)) {
      reportJobs.get(jobId).status = 'error';
      reportJobs.get(jobId).error = e.message;
    }
    push('error', { message: e.message });
  }
}

// 1) Start a new multi-agent job
app.post('/api/automation/full-report/start', express.json({ limit: '2mb' }), async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY no configurada' });
  }
  const { url, lang, datosCliente: clienteRaw } = req.body || {};

  // Build datosCliente from either explicit object or URL analysis result
  const datosCliente = clienteRaw || {
    cliente: {
      nombre: req.body?.company_name || 'Client',
      tipo: req.body?.client_type || 'empresa',
      sector: req.body?.sector || 'General',
      web: url || '',
      email: req.body?.contact_email || req.body?.email || process.env.CONTACT_TO
    },
    sistemas_existentes: req.body?.systems || [],
    proposta: {
      idioma: lang || 'ca',
      tipus_projecte: req.body?.recommended_solution || 'Transformacio digital',
      pressupost_orientatiu: req.body?.estimated_budget_range || '8000-15000',
      termini_desitjat: '3-4 mesos',
    },
    contexto_inicial: req.body?.analysis || {},
  };

  const jobId = crypto.randomUUID();
  reportJobs.set(jobId, { status: 'running', events: [], result: null, error: null });

  // Run async (don't await)
  runFullReportJob(jobId, datosCliente);

  // Clean up job after 30 min
  setTimeout(() => reportJobs.delete(jobId), 30 * 60 * 1000);

  res.json({
    jobId,
    message: "S'ha iniciat la creació de l'informe detallat amb IA. Rebràs un correu electrònic amb l'informe completat un cop finalitzi el procés. Mentrestant, pots continuar treballant."
  });
});

// 2) SSE stream for job progress — use with EventSource(url) on the frontend
app.get('/api/automation/full-report/stream/:jobId', (req, res) => {
  const { jobId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  let cursor = 0;
  const interval = setInterval(() => {
    const job = reportJobs.get(jobId);
    if (!job) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Job no trobat' })}\n\n`);
      clearInterval(interval);
      res.end();
      return;
    }

    // Drain new events
    while (cursor < job.events.length) {
      const ev = job.events[cursor++];
      const { type, ...data } = ev;
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    }

    if (job.status === 'done' || job.status === 'error') {
      clearInterval(interval);
      res.end();
    }
  }, 300);

  req.on('close', () => clearInterval(interval));
});

// Health check (Cloud Run / load balancers)
app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));
app.get('/health', (_req, res) => res.status(200).json({ ok: true }));
app.get('/readyz', (_req, res) => res.status(200).json({ ok: true }));

// Runtime browser config — served dynamically so Cloud Run env vars reach the SPA.
// MUST be registered BEFORE express.static, otherwise dist/env.js (empty placeholder) wins.
app.get('/env.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const safeEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
    SB_PUBLISHABLE_KEY: process.env.SB_PUBLISHABLE_KEY || process.env.VITE_SB_PUBLISHABLE_KEY || '',
  };
  res.send(`// Generated at request time; do not commit.\nwindow.__ADEPTIFY_ENV__ = ${JSON.stringify(safeEnv)};\n`);
});

const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: "API Not Found" });
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, () => console.log(`Adeptify 2.0 on ${PORT}`));
