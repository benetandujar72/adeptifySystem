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
const { generatePdfBuffer, generateBrochurePdfBuffer } = require('./multi-agent/generate_pdf');
const { MongoClient } = require('mongodb');

// --- MongoDB cached client ---
let cachedMongo = null;
async function getMongoDb() {
  if (cachedMongo) return cachedMongo;
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  try {
    const client = new MongoClient(uri);
    await client.connect();
    cachedMongo = client.db(process.env.MONGODB_DB || 'centros_educativos_cat');
    console.log('[MongoDB] Connected to', cachedMongo.databaseName);
    return cachedMongo;
  } catch (e) {
    console.warn('[MongoDB] Connection failed:', e.message);
    return null;
  }
}

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

// -- Study group labels for email personalization --
const STUDY_GROUP_SUMMARIES = [
  { label: 'Infantil', fields: ['einf1c', 'einf2c'] },
  { label: 'Primària', fields: ['epri'] },
  { label: 'ESO', fields: ['eso'] },
  { label: 'Batxillerat', fields: ['batx'] },
  { label: 'FP Grau Mitjà', fields: ['cfpm', 'cfam'] },
  { label: 'FP Grau Superior', fields: ['cfps', 'cfas'] },
  { label: 'Educació Especial', fields: ['ee'] },
  { label: 'Adults', fields: ['adults'] },
  { label: 'Arts i Disseny', fields: ['esdi', 'escm', 'escs', 'dane', 'danp', 'dans', 'muse', 'musp', 'muss'] },
  { label: 'Esportiu', fields: ['tegm', 'tegs', 'estr'] },
  { label: 'Idiomes', fields: ['idi'] },
];

function getStudyLabels(center) {
  return STUDY_GROUP_SUMMARIES
    .filter(g => g.fields.some(f => center[f]))
    .map(g => g.label);
}

// Detect email language from pais code
function detectEmailLang(pais) {
  if (!pais || pais === 'ES-CT') return 'ca';
  if (pais === 'ES-PV' || pais === 'ES-NC') return 'eu';
  return 'es'; // ES-MD, ES-AN, ES-VC, and all others → Spanish
}

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

// --- CLAUDE CALLER (mismo modelo que agentes multi-agent) ---
async function callClaude(prompt, modelId = "claude-sonnet-4-6") {
  const anthropicKey = (process.env.ANTHROPIC_API_KEY || '').trim();

  // Si no hay clave Anthropic, usar Gemini como fallback
  if (!anthropicKey) {
    console.warn("[callClaude] No ANTHROPIC_API_KEY — using Gemini fallback");
    return callGeminiFallback(prompt);
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: AbortSignal.timeout(50000)
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[Claude API Error] ${response.status}:`, errBody);
      if (response.status === 400 || response.status === 404 || response.status === 401) {
        console.warn(`[Claude] Fallback a Gemini per error ${response.status}`);
        return callGeminiFallback(prompt);
      }
      throw new Error(`Claude API error ${response.status}: ${errBody.substring(0, 200)}`);
    }

    const data = await response.json();
    const rawText = data.content?.find(c => c.type === 'text')?.text || '';
    if (!rawText.trim()) throw new Error("Claude returned empty text");

    return extractJSON(rawText);
  } catch (err) {
    if (err.name === 'TimeoutError') {
      console.warn("[Claude] Timeout reached, falling back to Gemini.");
      return callGeminiFallback(prompt);
    }
    throw err;
  }
}

/**
 * Helper robusto para extraer JSON de una cadena de texto.
 */
function extractJSON(text) {
  let cleanText = text.trim();
  const firstBrace = cleanText.indexOf('{');
  const firstBracket = cleanText.indexOf('[');
  let start = -1;
  if (firstBrace !== -1 && firstBracket !== -1) start = Math.min(firstBrace, firstBracket);
  else if (firstBrace !== -1) start = firstBrace;
  else if (firstBracket !== -1) start = firstBracket;

  if (start !== -1) {
    const end = Math.max(cleanText.lastIndexOf('}'), cleanText.lastIndexOf(']'));
    if (end !== -1) cleanText = cleanText.substring(start, end + 1);
  }

  try {
    return JSON.parse(cleanText);
  } catch (err) {
    console.error("[JSON Parse Error] Raw text:", text.substring(0, 1000));
    throw new Error("Invalid JSON structure returned by LLM.");
  }
}

// --- GEMINI FALLBACK (solo si no hay Anthropic API key) ---
async function callGeminiFallback(prompt, modelId = "gemini-2.0-flash") {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error("Missing both ANTHROPIC_API_KEY and GEMINI_API_KEY");

  // Models en ordre de preferència — si el primer falla proba el seguent
  const modelsToTry = [
    modelId,
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
  ].filter((v, i, a) => a.indexOf(v) === i); // deduplica
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 8192 }
        }),
        signal: AbortSignal.timeout(45000)
      });

      const data = await response.json();
      if (data.error) {
        console.warn(`[Gemini Error] ${model}:`, data.error.message);
        lastError = new Error(data.error.message);
        continue;
      }
      if (!data.candidates?.length) { lastError = new Error(`${model} returned no candidates`); continue; }

      const candidate = data.candidates[0];
      if (!candidate.content?.parts) { lastError = new Error(`finishReason: ${candidate.finishReason}`); continue; }

      const textPart = candidate.content.parts.find(p => typeof p.text === 'string' && p.text.trim().length > 0);
      if (!textPart) { lastError = new Error("Gemini: no text part in response"); continue; }

      return extractJSON(textPart.text);
    } catch (fetchErr) {
      console.error(`[Gemini Fetch Error] ${model}:`, fetchErr.message);
      lastError = fetchErr;
    }
  }
  throw lastError || new Error("All Gemini fallback attempts failed");
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

    console.info(`[automation] Calling Claude for URL analysis...`);
    const result = await callClaude(prompt);
    console.info(`[automation] Strategic Data generated successfully.`);

    let dbLead = null;
    try {
      const supabase = getSupabaseAdmin();
      if (supabase && result.company_name) {
        const contactEmail = result.contact_email || `contacto@${new URL(url).hostname.replace('www.', '')}`;
        const { data } = await supabase.from('leads').upsert({
          tenant_slug: req.body.tenantSlug || 'default',
          email: contactEmail,
          company_name: result.company_name,
          source: url,
          ai_needs_analysis: result,
          status: 'new'
        }, { onConflict: 'tenant_slug,email' }).select().single();
        dbLead = data;
      }
    } catch (dbErr) {
      console.error("[Capture DB Error]", dbErr);
    }

    res.json({ ...result, dbLead });
  } catch (e) {
    console.error("[Capture Error Trace]", e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/crm/leads', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("Supabase admin client not initialized");

    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .order('updated_at', { ascending: false });
    if (leadsError) throw leadsError;

    const { data: interactionsData, error: interError } = await supabase
      .from('lead_interactions')
      .select('*')
      .order('created_at', { ascending: false });
    if (interError) throw interError;

    res.json({ leads: leadsData || [], interactions: interactionsData || [] });
  } catch (e) {
    console.error("[CRM Leads Error]", e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/automation/digital-twin', async (req, res) => {
  try {
    const prompt = `Actua com a motor de Digital Twin educatiu. 
    Analitza aquestes dades: ${JSON.stringify(req.body.context || {})}
    Genera prediccions d'estrès operatiu.
    Retorna EXACTAMENT aquest JSON:
    {
      "stress_level": 0-100,
      "critical_department": "Nombre",
      "predictions": [
        { "risk_title": "...", "description": "...", "suggested_action": "..." }
      ]
    }`;
    const result = await callClaude(prompt);
    res.json(result);
  } catch (e) {
    console.error("[DigitalTwin Error Trace]", e);
    res.status(500).json({ error: e.message || "Error intern en generar Digital Twin" });
  }
});

app.post('/api/automation/migrate-data', async (req, res) => {
  try {
    const result = await callClaude(`Estructura les dades: ${req.body.rawData} en JSON (mapped_staff[], migration_summary).`);
    res.json(result);
  } catch (e) {
    console.error("[MigrateData Error Trace]", e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/automation/network-prospecting', async (req, res) => {
  const { referenceCenterName, location, realCenters } = req.body;

  let prompt;
  if (Array.isArray(realCenters) && realCenters.length > 0) {
    // Enrich real centers with AI-generated pitches
    const centersJson = JSON.stringify(realCenters.slice(0, 20).map(c => ({
      name: c.denominacio_completa, type: c.nom_naturalesa,
      municipi: c.nom_municipi, comarca: c.nom_comarca, distance_km: c._distance
    })));
    prompt = `Ets un estrateg d'expansió per a consultores educatives.
Centre de referència: "${referenceCenterName || 'centre educatiu'}".
Aquests són centres reals propers: ${centersJson}
Per a cadascun, genera opportunity_score (1-10), reason_for_similarity i custom_referral_pitch.
Retorna EXACTAMENT JSON: { "expansion_nodes": [{ "target_name": "...", "opportunity_score": 8, "reason_for_similarity": "...", "custom_referral_pitch": "..." }] }`;
  } else {
    prompt = `Ets un estrateg d'expansió per a consultores educatives.
Centre de referència: "${referenceCenterName || 'centre educatiu'}" a "${location || 'Catalunya'}".
Identifica 5 centres educatius similars de la mateixa zona.
Retorna EXACTAMENT aquest JSON:
{ "expansion_nodes": [{ "target_name": "Nom", "location": "Municipi, Comarca", "type": "concertat|privat|públic", "estimated_students": 500, "digital_maturity": "baix|mig|alt", "opportunity_score": 8, "reason_for_similarity": "Per què s'assembla.", "custom_referral_pitch": "Com contactar-los." }] }`;
  }

  try {
    const result = await callClaude(prompt);
    res.json(result);
  } catch (e) {
    console.error("[NetworkProspecting Error Trace]", e);
    res.status(500).json({ error: e.message || "Error intern en prospecció de xarxa" });
  }
});

// -- Refresh education centers from Generalitat API --
app.post('/api/admin/centers/refresh', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("Supabase admin not configured");

    const API_BASE = 'https://analisi.transparenciacatalunya.cat/resource/kvmv-ahh4.json';
    const PAGE_SIZE = 5000;
    let offset = 0;
    let allRows = [];

    while (true) {
      const url = `${API_BASE}?$limit=${PAGE_SIZE}&$offset=${offset}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!resp.ok) throw new Error(`API Generalitat error: ${resp.status}`);
      const rows = await resp.json();
      if (!Array.isArray(rows) || rows.length === 0) break;
      allRows.push(...rows);
      if (rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    console.log(`[Centers Refresh] Fetched ${allRows.length} rows from API`);

    const mapped = allRows
      .filter(r => r.codi_centre && r.denominaci_completa)
      .map(r => ({
        codi_centre: String(r.codi_centre).trim(),
        denominacio_completa: String(r.denominaci_completa || '').trim(),
        nom_naturalesa: (r.nom_naturalesa || '').trim() || null,
        adreca: (r.adre_a || '').trim() || null,
        nom_municipi: (r.nom_municipi || '').trim() || null,
        codi_postal: (r.codi_postal || '').trim() || null,
        telefon: (r.tel_fon || '').trim() || null,
        coordenades_geo_x: r.coordenades_geo_x ? parseFloat(r.coordenades_geo_x) : null,
        coordenades_geo_y: r.coordenades_geo_y ? parseFloat(r.coordenades_geo_y) : null,
        email_centre: (r.correu_electr_nic || '').trim() || null,
      }));

    const BATCH_SIZE = 500;
    let upserted = 0;
    for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
      const batch = mapped.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('cat_education_centers')
        .upsert(batch, { onConflict: 'codi_centre' });
      if (error) throw error;
      upserted += batch.length;
    }

    console.log(`[Centers Refresh] Upserted ${upserted} records`);
    res.json({ success: true, fetched: allRows.length, upserted });
  } catch (e) {
    console.error("[Centers Refresh Error]", e);
    res.status(500).json({ error: e.message || "Error refreshing centers" });
  }
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
    }
    if (pdfBase64) {
      attachments.push({ filename: 'Proposta_Adeptify.pdf', content: pdfBase64, encoding: 'base64' });
    }

    await transporter.sendMail({ from: '"Adeptify" <hola@adeptify.es>', to: email, subject, html, attachments });
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

// -- Fetch MongoDB profiles for a list of center codes --
async function fetchMongoProfiles(codiList) {
  const db = await getMongoDb();
  if (!db || !codiList.length) return {};
  try {
    const docs = await db.collection('institutions')
      .find({ codi_centre: { $in: codiList }, status: 'processed' })
      .project({ codi_centre: 1, needs: 1, profile: 1, message: 1, sentiment: 1, social_media: 1, website: 1, website_score: 1, web_status: 1, nivells_educatius: 1, estudis_decodificats: 1 })
      .toArray();
    const byCode = {};
    for (const d of docs) byCode[d.codi_centre] = d;
    console.log(`[MongoDB] Fetched ${docs.length} profiles for ${codiList.length} codes`);
    return byCode;
  } catch (e) {
    console.warn('[MongoDB] fetchMongoProfiles failed:', e.message);
    return {};
  }
}

// -- MongoDB exploration endpoints --
app.get('/api/mongo/stats', async (req, res) => {
  const db = await getMongoDb();
  if (!db) return res.status(503).json({ error: 'MongoDB not configured' });
  try {
    const total = await db.collection('institutions').countDocuments();
    const processed = await db.collection('institutions').countDocuments({ status: 'processed' });
    const withNeeds = await db.collection('institutions').countDocuments({ needs: { $ne: null } });
    res.json({ total, processed, withNeeds });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/mongo/center/:codi', async (req, res) => {
  const db = await getMongoDb();
  if (!db) return res.status(503).json({ error: 'MongoDB not configured' });
  try {
    const doc = await db.collection('institutions').findOne({ codi_centre: req.params.codi });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// -- Personalized intro builder (Tier 1: template, Tier 2: + AI pitch) --
function buildTemplatePersonalizedIntro(c, mongoProfile) {
  const name = c.centerName || 'el vostre centre';
  const type = (c.nom_naturalesa || '').toLowerCase();
  const municipi = c.nom_municipi || '';
  const comarca = c.nom_comarca || '';
  const studies = getStudyLabels(c);

  // Opening line tailored to center type
  let opening = '';
  if (type.includes('públic')) {
    opening = `Sabem que gestionar un centre p&uacute;blic com <strong>${name}</strong> implica fer molt amb recursos limitats, temps escassos i una normativa que no para de canviar. Cada hora que el vostre equip dedica a tasques administratives repetitives &eacute;s una hora menys per a l'alumnat.`;
  } else if (type.includes('concertat')) {
    opening = `A <strong>${name}</strong>, com a centre concertat, entenem que heu de compaginar les exig&egrave;ncies administratives amb la identitat pr&ograve;pia del vostre projecte educatiu. Mantenir l'excel&middot;l&egrave;ncia pedag&ograve;gica mentre es gestionen processos dispersos &eacute;s un repte diari.`;
  } else if (type.includes('privat')) {
    opening = `A <strong>${name}</strong>, l'excel&middot;l&egrave;ncia i la diferenciaci&oacute; s&oacute;n part del vostre ADN. Sabem que busqueu eines que estiguin a l'altura del vostre projecte, no solucions gen&egrave;riques que obliguin a adaptar-vos a elles.`;
  } else {
    opening = `A <strong>${name}</strong>, cada dia gestioneu reptes educatius que mereixen una resposta a mida. Sabem que el temps del vostre equip &eacute;s limitat i que les eines gen&egrave;riques sovint creen m&eacute;s fricci&oacute; de la que resolen.`;
  }

  // Study-specific line
  let studyLine = '';
  if (studies.length > 0) {
    const studyStr = studies.join(', ');
    if (studies.length >= 3) {
      studyLine = `Amb una oferta tan diversa com <strong>${studyStr}</strong>, la complexitat de coordinaci&oacute;, seguiment i gesti&oacute; de dades &eacute;s considerable &mdash; i sabem que cap eina est&agrave;ndard cobreix tota aquesta realitat.`;
    } else {
      studyLine = `Amb oferta en <strong>${studyStr}</strong>, entenem els reptes espec&iacute;fics de coordinaci&oacute; i seguiment que aix&ograve; comporta.`;
    }
  }

  // Location connection
  let locationLine = '';
  if (municipi && comarca) {
    locationLine = `Treballem amb centres de <strong>${comarca}</strong> i coneixem la realitat educativa de ${municipi}.`;
  } else if (comarca) {
    locationLine = `Coneixem la realitat dels centres educatius de <strong>${comarca}</strong>.`;
  }

  // AI enrichment pitch (Tier 2)
  let aiLine = '';
  if (c.ai_custom_pitch) {
    aiLine = c.ai_custom_pitch;
  }

  // MongoDB enrichment: needs, digital maturity, pain point
  let mongoLine = '';
  if (mongoProfile) {
    const needs = mongoProfile.needs;
    const profile = mongoProfile.profile;
    if (needs?.dolor_principal) {
      mongoLine = needs.dolor_principal;
    } else if (needs?.necesidades_principales?.length) {
      mongoLine = needs.necesidades_principales[0];
    }
    // Add digital maturity insight from profile
    if (profile?.tecnologia_uso && !profile.tecnologia_uso.includes('no pot ser avaluat')) {
      const techSnippet = profile.tecnologia_uso.length > 200 ? profile.tecnologia_uso.substring(0, 200) + '...' : profile.tecnologia_uso;
      mongoLine = mongoLine ? `${mongoLine} A m&eacute;s, ${techSnippet.charAt(0).toLowerCase()}${techSnippet.slice(1)}` : techSnippet;
    }
  }

  return `
  <div style="padding:40px 40px 24px;">
    <h1 style="font-size:22px;color:#1a1a2e;margin:0 0 20px;line-height:1.3;font-weight:700;">${opening}</h1>
    ${studyLine ? `<p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 12px;">${studyLine}</p>` : ''}
    ${locationLine ? `<p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 12px;">${locationLine}</p>` : ''}
    ${mongoLine ? `<p style="font-size:14px;color:#2E75B6;line-height:1.7;margin:0 0 12px;border-left:3px solid #2E75B6;padding-left:12px;"><strong>Hem detectat:</strong> ${mongoLine}</p>` : ''}
    ${aiLine ? `<p style="font-size:14px;color:#673DE6;line-height:1.7;margin:0 0 12px;font-style:italic;border-left:3px solid #673DE6;padding-left:12px;">${aiLine}</p>` : ''}
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0;">
      Per aix&ograve;, el que proposem no &eacute;s afegir una altra app. <strong>El que proposem &eacute;s definir la soluci&oacute; adequada per al vostre context concret.</strong>
    </p>
  </div>`;
}

// -- Spanish personalized intro builder --
function buildTemplatePersonalizedIntroEs(c, mongoProfile) {
  const name = c.centerName || 'vuestro centro';
  const type = (c.nom_naturalesa || '').toLowerCase();
  const municipi = c.nom_municipi || '';
  const comarca = c.nom_comarca || c.region || '';
  const studies = getStudyLabels(c);

  let opening = '';
  if (type.includes('públic') || type.includes('public') || type.includes('público')) {
    opening = `Sabemos que gestionar un centro p&uacute;blico como <strong>${name}</strong> implica hacer mucho con recursos limitados, tiempo escaso y una normativa que no para de cambiar. Cada hora que vuestro equipo dedica a tareas administrativas repetitivas es una hora menos para el alumnado.`;
  } else if (type.includes('concertat') || type.includes('concertado') || type.includes('concert')) {
    opening = `En <strong>${name}</strong>, como centro concertado, entendemos que deb&eacute;is compaginar las exigencias administrativas con la identidad propia de vuestro proyecto educativo. Mantener la excelencia pedag&oacute;gica mientras se gestionan procesos dispersos es un reto diario.`;
  } else if (type.includes('privat') || type.includes('privado') || type.includes('priv')) {
    opening = `En <strong>${name}</strong>, la excelencia y la diferenciaci&oacute;n son parte de vuestro ADN. Sabemos que buscáis herramientas que estén a la altura de vuestro proyecto, no soluciones gen&eacute;ricas que os obliguen a adaptaros a ellas.`;
  } else {
    opening = `En <strong>${name}</strong>, cada d&iacute;a gestion&aacute;is retos educativos que merecen una respuesta a medida. Sabemos que el tiempo de vuestro equipo es limitado y que las herramientas gen&eacute;ricas a menudo crean m&aacute;s fricci&oacute;n de la que resuelven.`;
  }

  let studyLine = '';
  if (studies.length > 0) {
    const studyStr = studies.join(', ');
    if (studies.length >= 3) {
      studyLine = `Con una oferta tan diversa como <strong>${studyStr}</strong>, la complejidad de coordinaci&oacute;n, seguimiento y gesti&oacute;n de datos es considerable &mdash; y sabemos que ninguna herramienta est&aacute;ndar cubre toda esta realidad.`;
    } else {
      studyLine = `Con oferta en <strong>${studyStr}</strong>, entendemos los retos espec&iacute;ficos de coordinaci&oacute;n y seguimiento que esto conlleva.`;
    }
  }

  let locationLine = '';
  if (municipi && comarca) {
    locationLine = `Trabajamos con centros de <strong>${comarca}</strong> y conocemos la realidad educativa de ${municipi}.`;
  } else if (comarca) {
    locationLine = `Conocemos la realidad de los centros educativos de <strong>${comarca}</strong>.`;
  }

  let aiLine = c.ai_custom_pitch || '';
  let mongoLine = '';
  if (mongoProfile) {
    const needs = mongoProfile.needs;
    const profile = mongoProfile.profile;
    if (needs?.dolor_principal) mongoLine = needs.dolor_principal;
    else if (needs?.necesidades_principales?.length) mongoLine = needs.necesidades_principales[0];
    if (profile?.tecnologia_uso && !profile.tecnologia_uso.includes('no pot ser avaluat')) {
      const techSnippet = profile.tecnologia_uso.length > 200 ? profile.tecnologia_uso.substring(0, 200) + '...' : profile.tecnologia_uso;
      mongoLine = mongoLine ? `${mongoLine} Adem&aacute;s, ${techSnippet.charAt(0).toLowerCase()}${techSnippet.slice(1)}` : techSnippet;
    }
  }

  return `
  <div style="padding:40px 40px 24px;">
    <h1 style="font-size:22px;color:#1a1a2e;margin:0 0 20px;line-height:1.3;font-weight:700;">${opening}</h1>
    ${studyLine ? `<p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 12px;">${studyLine}</p>` : ''}
    ${locationLine ? `<p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 12px;">${locationLine}</p>` : ''}
    ${mongoLine ? `<p style="font-size:14px;color:#2E75B6;line-height:1.7;margin:0 0 12px;border-left:3px solid #2E75B6;padding-left:12px;"><strong>Hemos detectado:</strong> ${mongoLine}</p>` : ''}
    ${aiLine ? `<p style="font-size:14px;color:#673DE6;line-height:1.7;margin:0 0 12px;font-style:italic;border-left:3px solid #673DE6;padding-left:12px;">${aiLine}</p>` : ''}
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0;">
      Por eso, lo que proponemos no es a&ntilde;adir otra app. <strong>Lo que proponemos es definir la soluci&oacute;n adecuada para vuestro contexto concreto.</strong>
    </p>
  </div>`;
}

// -- Basque personalized intro builder --
function buildTemplatePersonalizedIntroEu(c, mongoProfile) {
  const name = c.centerName || 'zuen ikastetxea';
  const type = (c.nom_naturalesa || '').toLowerCase();
  const municipi = c.nom_municipi || '';
  const comarca = c.nom_comarca || c.region || '';
  const studies = getStudyLabels(c);

  let opening = '';
  if (type.includes('públic') || type.includes('public') || type.includes('público')) {
    opening = `<strong>${name}</strong> bezalako ikastetxe publiko bat kudeatzeak baliabide mugatuekin, denbora gutxirekin eta etengabe aldatzen den arautegiarekin asko egitea eskatzen du. Zuen taldeak zeregin administratibo errepikakorretara dedikatzen duen ordu bakoitza ikasleentzako ordu bat gutxiago da.`;
  } else if (type.includes('concertat') || type.includes('concertado') || type.includes('concert')) {
    opening = `<strong>${name}</strong> bezala, itunpeko ikastetxe gisa, badakigu eskakizun administratiboak zuen hezkuntza-proiektuaren identitate propioarekin bateratzen duzuela. Prozesuen arteko kudeaketa sakabanatuta dagoenean pedagogia-bikaintasuna mantentzea egunero erronka bat da.`;
  } else if (type.includes('privat') || type.includes('privado') || type.includes('priv')) {
    opening = `<strong>${name}</strong> ikastetxean, bikaintasuna eta desberdintasuna zuen DNAren parte dira. Badakigu zuen proiektuaren mailan dauden tresnak bilatzen dituzuela, ez zuentzat egokitu beharko zenituzketen soluzio generikoak.`;
  } else {
    opening = `<strong>${name}</strong> ikastetxean, egunero hezkuntzako erronkei aurre egiten diozue, eta horiek erantzun pertsonalizatu bat merezi dute. Badakigu zuen taldearen denbora mugatua dela eta tresna generikoek askotan konpontzen dutena baino marruskadura gehiago sortzen dutela.`;
  }

  let studyLine = '';
  if (studies.length > 0) {
    const studyStr = studies.join(', ');
    if (studies.length >= 3) {
      studyLine = `<strong>${studyStr}</strong> bezalako eskaintza anitzarekin, koordinazio, jarraipena eta datuen kudeaketaren konplexutasuna handia da &mdash; eta badakigu tresna estandarrak ez direla gai errealitate osoa estaltzeko.`;
    } else {
      studyLine = `<strong>${studyStr}</strong> eskaintza duenez, koordinazio eta jarraipen erronka espezifikoak ulertzen ditugu.`;
    }
  }

  let locationLine = '';
  if (comarca) {
    locationLine = `<strong>${comarca}</strong> eskualdeko ikastetxeekin lan egiten dugu${municipi ? ` eta ${municipi}ko hezkuntza-errealitatea ezagutzen dugu` : ''}.`;
  }

  let aiLine = c.ai_custom_pitch || '';
  let mongoLine = '';
  if (mongoProfile) {
    const needs = mongoProfile.needs;
    const profile = mongoProfile.profile;
    if (needs?.dolor_principal) mongoLine = needs.dolor_principal;
    else if (needs?.necesidades_principales?.length) mongoLine = needs.necesidades_principales[0];
    if (profile?.tecnologia_uso && !profile.tecnologia_uso.includes('no pot ser avaluat')) {
      const techSnippet = profile.tecnologia_uso.length > 200 ? profile.tecnologia_uso.substring(0, 200) + '...' : profile.tecnologia_uso;
      mongoLine = mongoLine ? `${mongoLine} Gainera, ${techSnippet.charAt(0).toLowerCase()}${techSnippet.slice(1)}` : techSnippet;
    }
  }

  return `
  <div style="padding:40px 40px 24px;">
    <h1 style="font-size:22px;color:#1a1a2e;margin:0 0 20px;line-height:1.3;font-weight:700;">${opening}</h1>
    ${studyLine ? `<p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 12px;">${studyLine}</p>` : ''}
    ${locationLine ? `<p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 12px;">${locationLine}</p>` : ''}
    ${mongoLine ? `<p style="font-size:14px;color:#2E75B6;line-height:1.7;margin:0 0 12px;border-left:3px solid #2E75B6;padding-left:12px;"><strong>Hautemandakoa:</strong> ${mongoLine}</p>` : ''}
    ${aiLine ? `<p style="font-size:14px;color:#673DE6;line-height:1.7;margin:0 0 12px;font-style:italic;border-left:3px solid #673DE6;padding-left:12px;">${aiLine}</p>` : ''}
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0;">
      Horregatik, ez dugu beste aplikazio bat gehitzen proposatzen. <strong>Zuen testuinguru zehatzarentzako egokia den irtenbidea definitzea proposatzen dugu.</strong>
    </p>
  </div>`;
}

// -- AI batch intro generator for Tier 3 (centers with lead data) --
async function generateAIIntros(centersWithLeads, lang = 'ca') {
  const BATCH_SIZE = 10;
  const results = {};
  const langLabel = lang === 'eu' ? 'EUSKERA (BASQUE)' : lang === 'es' ? 'CASTELLANO' : 'CATALÀ';
  const expertCtx = lang === 'eu'
    ? 'hezkuntza-sektoreko komunikazio-aditu bat zara Euskal Herrian'
    : lang === 'es'
      ? 'eres un experto en comunicación para el sector educativo en España'
      : 'ets un expert en comunicació per al sector educatiu a Catalunya';
  const returnLabel = lang === 'eu' ? 'sarrera-paragrafoa' : lang === 'es' ? 'párrafo introductorio' : 'paràgraf introductori';

  for (let i = 0; i < centersWithLeads.length; i += BATCH_SIZE) {
    const batch = centersWithLeads.slice(i, i + BATCH_SIZE);
    const centersCtx = batch.map((item, idx) => {
      const c = item.centerData;
      const lead = item.leadData;
      const mongo = item.mongoProfile;
      const studies = getStudyLabels(c);
      const needs = lead?.ai_needs_analysis;
      const mongoNeeds = mongo?.needs;
      const mongoProfile = mongo?.profile;
      return `
CENTRE ${idx + 1} [ID: ${item.codi}]:
- Nom: ${c.centerName}
- Tipus: ${c.nom_naturalesa || 'No especificat'}
- Municipi: ${c.nom_municipi || c.region || ''}, Comarca/Regió: ${c.nom_comarca || c.region || ''}
- Estudis: ${studies.join(', ') || 'Diversos'}
${c.ai_reason_similarity ? `- Per què encaixa: ${c.ai_reason_similarity}` : ''}
${needs?.needs_detected?.length ? `- Necessitats detectades: ${needs.needs_detected.join(', ')}` : ''}
${needs?.main_bottleneck ? `- Principal coll d'ampolla: ${needs.main_bottleneck}` : ''}
${needs?.recommended_solution ? `- Solució recomanada: ${needs.recommended_solution}` : ''}
${mongoNeeds?.dolor_principal ? `- Dolor principal (anàlisi web): ${mongoNeeds.dolor_principal}` : ''}
${mongoNeeds?.necesidades_principales?.length ? `- Necessitats (anàlisi web): ${mongoNeeds.necesidades_principales.join('; ')}` : ''}
${mongoNeeds?.urgencia ? `- Urgència: ${mongoNeeds.urgencia}` : ''}
${mongoProfile?.retos_identificados?.length ? `- Reptes: ${mongoProfile.retos_identificados.join('; ')}` : ''}
${mongoProfile?.contexto_socioeconomico ? `- Context socioeconòmic: ${mongoProfile.contexto_socioeconomico}` : ''}`;
    }).join('\n---\n');

    const prompt = `Ets/Eres ${expertCtx}. Genera un ${returnLabel} personalitzat per a cada centre (3-4 frases, 60-80 paraules) per a un email d'Adeptify (consultoria digital educativa).

REGLES IMPORTANTS:
- Idioma: ${langLabel}
- Demostra que coneixes la realitat específica d'aquell centre i els seus reptes
- Fes referència a les necessitats detectades i al tipus d'estudis
- To professional, empàtic, sense pressió comercial
- NO salutació ni signatura — només el paràgraf
- Cada intro ha de ser ÚNICA — no repeteixis frases entre centres
- Menciona el nom del centre naturalment
- Mostra comprensió dels reptes reals: temps, resistències al canvi, normativa, coordinació d'equips

CENTRES:
${centersCtx}

Retorna EXACTAMENT aquest JSON:
{"intros":{"[codi_1]":"paràgraf...","[codi_2]":"paràgraf..."}}`;

    try {
      const raw = await callGeminiFallback(prompt);
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const intros = parsed.intros || parsed;
      for (const [codi, text] of Object.entries(intros)) {
        if (typeof text === 'string' && text.length > 20) results[codi] = text;
      }
    } catch (err) {
      console.warn(`[BulkEmail AI] Batch ${i}-${i + BATCH_SIZE} (lang=${lang}) failed:`, err.message);
    }
  }
  return results;
}

// -- Build full HTML email in Spanish --
function buildBulkEmailHtmlEs(introHtml) {
  const BASE = 'https://consultor.adeptify.es';
  const sc = (name) => `${BASE}/screenshots/${name}`;
  const numCircle = (n) => `<div style="width:32px;height:32px;border-radius:50%;background:#673DE6;color:#fff;font-weight:700;font-size:14px;display:inline-flex;align-items:center;justify-content:center;margin-right:12px;flex-shrink:0;">${n}</div>`;

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#333;">
<div style="max-width:680px;margin:0 auto;background:#ffffff;">

  <!-- HEADER -->
  <div style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <img src="cid:adeptify-logo" alt="Adeptify" style="height:48px;margin-bottom:8px;" />
    <p style="color:#a0a0c0;font-size:12px;margin:0;letter-spacing:1px;">Consultor&iacute;a y soluciones digitales ad hoc para centros educativos</p>
  </div>

  <!-- PERSONALIZED INTRO -->
  ${introHtml}

  <div style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e8e8f0;margin:0;" /></div>

  <!-- PAIN POINTS -->
  <div style="padding:32px 40px;">
    <h2 style="font-size:16px;color:#673DE6;text-transform:uppercase;letter-spacing:2px;margin:0 0 24px;font-weight:700;">&iquest;Os suenan alguna de estas situaciones?</h2>
    <div style="display:flex;align-items:flex-start;margin-bottom:20px;">
      ${numCircle(1)}
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0;">Las incidencias, las solicitudes internas o los seguimientos importantes llegan por demasiados canales y cuesta mantener el control.</p>
    </div>
    <div style="display:flex;align-items:flex-start;margin-bottom:20px;">
      ${numCircle(2)}
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0;">Hay datos, formularios, hojas y documentos &uacute;tiles, pero no funcionan como un sistema coherente y eso dificulta la toma de decisiones.</p>
    </div>
    <div style="display:flex;align-items:flex-start;margin-bottom:0;">
      ${numCircle(3)}
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0;">Hay procesos relevantes que dependen demasiado de personas concretas, de parches temporales o de una dedicaci&oacute;n manual que ya no es sostenible.</p>
    </div>
  </div>

  <div style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e8e8f0;margin:0;" /></div>

  <!-- METHODOLOGY -->
  <div style="padding:32px 40px;">
    <h2 style="font-size:16px;color:#673DE6;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;font-weight:700;">&iquest;Qu&eacute; hace Adeptify cuando detecta esta realidad?</h2>
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 24px;">No ofrece un cat&aacute;logo cerrado. Escucha, analiza y define la mejor respuesta para el centro. Despu&eacute;s la construye y la ajusta hasta que encaja en el d&iacute;a a d&iacute;a.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="width:33%;padding:16px;background:#f7f5ff;border-radius:12px 0 0 12px;vertical-align:top;border-right:2px solid #fff;">
          <p style="font-size:28px;color:#673DE6;margin:0 0 4px;font-weight:800;">1.</p>
          <p style="font-size:13px;font-weight:700;color:#1a1a2e;margin:0 0 6px;">Analizar</p>
          <p style="font-size:12px;color:#777;margin:0;line-height:1.5;">Entender antes de decidir. Procesos, roles, objetivos, l&iacute;mites y oportunidades reales.</p>
        </td>
        <td style="width:33%;padding:16px;background:#f7f5ff;vertical-align:top;border-right:2px solid #fff;">
          <p style="font-size:28px;color:#673DE6;margin:0 0 4px;font-weight:800;">2.</p>
          <p style="font-size:13px;font-weight:700;color:#1a1a2e;margin:0 0 6px;">Definir</p>
          <p style="font-size:12px;color:#777;margin:0;line-height:1.5;">Dise&ntilde;ar la respuesta adecuada. Flujos, datos, automatizaciones y experiencia de uso.</p>
        </td>
        <td style="width:33%;padding:16px;background:#f7f5ff;border-radius:0 12px 12px 0;vertical-align:top;">
          <p style="font-size:28px;color:#673DE6;margin:0 0 4px;font-weight:800;">3.</p>
          <p style="font-size:13px;font-weight:700;color:#1a1a2e;margin:0 0 6px;">Construir e implantar</p>
          <p style="font-size:12px;color:#777;margin:0;line-height:1.5;">Desarrollar, probar, formar y acompa&ntilde;ar hasta que la soluci&oacute;n funciona de verdad.</p>
        </td>
      </tr>
    </table>
  </div>

  <div style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e8e8f0;margin:0;" /></div>

  <!-- CASE STUDIES -->
  <div style="padding:32px 40px;">
    <p style="font-size:13px;color:#999;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 8px;font-weight:700;">Las aplicaciones ya creadas no son el producto. Son la prueba del modelo.</p>
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 28px;">Algunos centros han necesitado resolver operativa IT. Otros, seguimiento tutorial, evaluaci&oacute;n, comunicaci&oacute;n o gesti&oacute;n de datos. Las soluciones desarrolladas hasta ahora demuestran una capacidad: <strong>adaptar tecnolog&iacute;a a necesidades singulares.</strong></p>
    <div style="background:#f9f9fc;border:1px solid #e8e8f0;border-radius:12px;padding:24px;margin-bottom:20px;">
      <p style="font-size:11px;color:#673DE6;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px;font-weight:700;">Caso real 1</p>
      <h3 style="font-size:16px;color:#1a1a2e;margin:0 0 8px;font-weight:700;">Centralizar incidencias y seguimiento t&eacute;cnico</h3>
      <p style="font-size:13px;color:#777;margin:0 0 16px;line-height:1.5;">Cuando el centro necesita orden, trazabilidad y rapidez de respuesta en su operativa IT.</p>
      <div style="text-align:center;"><img src="${sc('media__1772879559317.png')}" alt="Dashboard" style="max-width:100%;height:auto;border-radius:8px;border:1px solid #e0e0e0;" /></div>
    </div>
    <div style="background:#f9f9fc;border:1px solid #e8e8f0;border-radius:12px;padding:24px;margin-bottom:20px;">
      <p style="font-size:11px;color:#673DE6;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px;font-weight:700;">Caso real 2</p>
      <h3 style="font-size:16px;color:#1a1a2e;margin:0 0 8px;font-weight:700;">Escalar tutor&iacute;as, entrevistas y comunicaci&oacute;n con familias</h3>
      <p style="font-size:13px;color:#777;margin:0 0 16px;line-height:1.5;">Cuando hay que sostener un seguimiento tutorial exigente sin perder calidad ni claridad.</p>
      <div style="text-align:center;">
        <img src="${sc('media__1772879594564.png')}" alt="Horarios" style="max-width:48%;height:auto;border-radius:8px;border:1px solid #e0e0e0;display:inline-block;margin:4px;" />
        <img src="${sc('media__1772879618029.png')}" alt="Importaciones" style="max-width:48%;height:auto;border-radius:8px;border:1px solid #e0e0e0;display:inline-block;margin:4px;" />
      </div>
    </div>
    <div style="background:#f9f9fc;border:1px solid #e8e8f0;border-radius:12px;padding:24px;">
      <p style="font-size:11px;color:#673DE6;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px;font-weight:700;">Caso real 3</p>
      <h3 style="font-size:16px;color:#1a1a2e;margin:0 0 8px;font-weight:700;">Convertir datos y evaluaci&oacute;n en informaci&oacute;n accionable</h3>
      <p style="font-size:13px;color:#777;margin:0 0 16px;line-height:1.5;">Cuando el equipo directivo o pedag&oacute;gico necesita entender mejor qu&eacute; est&aacute; pasando para decidir con m&aacute;s criterio.</p>
      <div style="text-align:center;"><img src="${sc('media__1772879694256.png')}" alt="Análisis IA" style="max-width:100%;height:auto;border-radius:8px;border:1px solid #e0e0e0;" /></div>
    </div>
  </div>

  <div style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e8e8f0;margin:0;" /></div>

  <!-- CTA -->
  <div style="padding:32px 40px;text-align:center;">
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 24px;">Si mientras le&iacute;s este correo ya os han venido a la cabeza dos o tres procesos que hoy os restan tiempo y energ&iacute;a, probablemente ya hay una <strong>oportunidad clara de mejora</strong>.</p>
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 24px;">Adeptify os puede ayudar a analizarlos, priorizarlos y convertirlos en una soluci&oacute;n realista, &uacute;til y asumible para vuestro centro o servicio.</p>
    <a href="${BASE}" style="display:inline-block;background:#673DE6;color:#ffffff;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.5px;">Hablemos en 20 minutos</a>
    <p style="font-size:12px;color:#999;margin:16px 0 0;">Tambi&eacute;n pod&eacute;is responder directamente este correo o escribirnos a <a href="mailto:hola@adeptify.es" style="color:#673DE6;text-decoration:none;">hola@adeptify.es</a></p>
  </div>

  <!-- FOOTER -->
  <div style="background:#1a1a2e;padding:28px 40px;text-align:center;">
    <p style="color:#a0a0c0;font-size:12px;margin:0 0 4px;font-weight:600;">Adeptify Systems</p>
    <p style="color:#777;font-size:11px;margin:0 0 4px;">
      <a href="https://adeptify.es" style="color:#a0a0c0;text-decoration:none;">adeptify.es</a> &middot;
      <a href="${BASE}" style="color:#a0a0c0;text-decoration:none;">consultor.adeptify.es</a>
    </p>
    <p style="color:#777;font-size:11px;margin:0 0 12px;">hola@adeptify.es &middot; Tel: 690831770 &middot; C. Independencia 3, Local 2, Cerdanyola del Vall&egrave;s, 08290 Barcelona</p>
    <p style="color:#555;font-size:9px;margin:0;line-height:1.4;text-align:justify;">
      Este mensaje y sus archivos adjuntos van dirigidos exclusivamente a su destinatario y pueden contener informaci&oacute;n confidencial. De acuerdo con el Reglamento (UE) 2016/679 (RGPD), le informamos de que sus datos personales solo se utilizar&aacute;n para mantener la relaci&oacute;n empresarial, t&eacute;cnica o comercial con la propia instituci&oacute;n, y no se utilizar&aacute;n para otras entidades. Puede ejercer sus derechos de acceso, rectificaci&oacute;n, cancelaci&oacute;n y oposici&oacute;n dirigi&eacute;ndose a hola@adeptify.es o consultando nuestra pol&iacute;tica de privacidad en adeptify.es.
    </p>
  </div>

</div>
</body></html>`;
}

// -- Build full HTML email in Basque --
function buildBulkEmailHtmlEu(introHtml) {
  const BASE = 'https://consultor.adeptify.es';
  const sc = (name) => `${BASE}/screenshots/${name}`;
  const numCircle = (n) => `<div style="width:32px;height:32px;border-radius:50%;background:#673DE6;color:#fff;font-weight:700;font-size:14px;display:inline-flex;align-items:center;justify-content:center;margin-right:12px;flex-shrink:0;">${n}</div>`;

  return `<!DOCTYPE html>
<html lang="eu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#333;">
<div style="max-width:680px;margin:0 auto;background:#ffffff;">

  <!-- HEADER -->
  <div style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <img src="cid:adeptify-logo" alt="Adeptify" style="height:48px;margin-bottom:8px;" />
    <p style="color:#a0a0c0;font-size:12px;margin:0;letter-spacing:1px;">Hezkuntza-zentroentzako kontsultoría eta soluzio digitalak</p>
  </div>

  <!-- PERSONALIZED INTRO -->
  ${introHtml}

  <div style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e8e8f0;margin:0;" /></div>

  <!-- PAIN POINTS -->
  <div style="padding:32px 40px;">
    <h2 style="font-size:16px;color:#673DE6;text-transform:uppercase;letter-spacing:2px;margin:0 0 24px;font-weight:700;">Egoera hauetakoren bat ezaguna egiten zaizue?</h2>
    <div style="display:flex;align-items:flex-start;margin-bottom:20px;">
      ${numCircle(1)}
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0;">Gorabeherak, barne-eskaerak edo garrantzitsuak diren jarraipenak kanal askotatik iristen dira eta kontrola mantentzea kostatzen zaio.</p>
    </div>
    <div style="display:flex;align-items:flex-start;margin-bottom:20px;">
      ${numCircle(2)}
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0;">Datuak, formularioak, orriak eta dokumentu erabilgarriak badaude, baina sistema koherente gisa ez dute funtzionatzen eta horrek erabakiak hartzea zailtzen du.</p>
    </div>
    <div style="display:flex;align-items:flex-start;margin-bottom:0;">
      ${numCircle(3)}
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0;">Badira pertsona zehatzen mende, aldi baterako konponbideen mende edo jada iraunkorra ez den eskuzko dedikazioaren mende dauden prozesu garrantzitsuak.</p>
    </div>
  </div>

  <div style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e8e8f0;margin:0;" /></div>

  <!-- METHODOLOGY -->
  <div style="padding:32px 40px;">
    <h2 style="font-size:16px;color:#673DE6;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;font-weight:700;">Zer egiten du Adeptifyk errealitate hori detektatzen duenean?</h2>
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 24px;">Ez du katalogo itxi bat eskaintzen. Entzuten du, aztertzen du eta zentrorako erantzun onena definitzen du. Gero eraikitzen du eta eguneroko bizitzan txertatzen den arte egokitzen du.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="width:33%;padding:16px;background:#f7f5ff;border-radius:12px 0 0 12px;vertical-align:top;border-right:2px solid #fff;">
          <p style="font-size:28px;color:#673DE6;margin:0 0 4px;font-weight:800;">1.</p>
          <p style="font-size:13px;font-weight:700;color:#1a1a2e;margin:0 0 6px;">Aztertu</p>
          <p style="font-size:12px;color:#777;margin:0;line-height:1.5;">Erabaki aurretik ulertu. Prozesuak, rolak, helburuak, mugak eta benetako aukerak.</p>
        </td>
        <td style="width:33%;padding:16px;background:#f7f5ff;vertical-align:top;border-right:2px solid #fff;">
          <p style="font-size:28px;color:#673DE6;margin:0 0 4px;font-weight:800;">2.</p>
          <p style="font-size:13px;font-weight:700;color:#1a1a2e;margin:0 0 6px;">Definitu</p>
          <p style="font-size:12px;color:#777;margin:0;line-height:1.5;">Erantzun egokia diseinatu. Fluxuak, datuak, automatizazioak eta erabilera-esperientzia.</p>
        </td>
        <td style="width:33%;padding:16px;background:#f7f5ff;border-radius:0 12px 12px 0;vertical-align:top;">
          <p style="font-size:28px;color:#673DE6;margin:0 0 4px;font-weight:800;">3.</p>
          <p style="font-size:13px;font-weight:700;color:#1a1a2e;margin:0 0 6px;">Eraiki eta ezarri</p>
          <p style="font-size:12px;color:#777;margin:0;line-height:1.5;">Garatu, probatu, prestatu eta lagundu irtenbideak benetan funtzionatu arte.</p>
        </td>
      </tr>
    </table>
  </div>

  <div style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e8e8f0;margin:0;" /></div>

  <!-- CASE STUDIES -->
  <div style="padding:32px 40px;">
    <p style="font-size:13px;color:#999;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 8px;font-weight:700;">Jadanik sortutako aplikazioak ez dira produktua. Ereduaren froga dira.</p>
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 28px;">Zenbait zentrok IT operatiba konpondu behar izan dute. Beste batzuek tutoretza-jarraipena, ebaluazioa, komunikazioa edo datuen kudeaketa. Orain arte garatutako irtenbideek gaitasun bat frogatzen dute: <strong>teknologia behar singularretara egokitzea.</strong></p>
    <div style="background:#f9f9fc;border:1px solid #e8e8f0;border-radius:12px;padding:24px;margin-bottom:20px;">
      <p style="font-size:11px;color:#673DE6;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px;font-weight:700;">Benetako kasua 1</p>
      <h3 style="font-size:16px;color:#1a1a2e;margin:0 0 8px;font-weight:700;">IT gorabeherak eta jarraipen teknikoa zentralizatu</h3>
      <p style="font-size:13px;color:#777;margin:0 0 16px;line-height:1.5;">Zentroak bere IT operatiban ordena, trazabilitatea eta erantzun-azkartasuna behar duenean.</p>
      <div style="text-align:center;"><img src="${sc('media__1772879559317.png')}" alt="Dashboard" style="max-width:100%;height:auto;border-radius:8px;border:1px solid #e0e0e0;" /></div>
    </div>
    <div style="background:#f9f9fc;border:1px solid #e8e8f0;border-radius:12px;padding:24px;margin-bottom:20px;">
      <p style="font-size:11px;color:#673DE6;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px;font-weight:700;">Benetako kasua 2</p>
      <h3 style="font-size:16px;color:#1a1a2e;margin:0 0 8px;font-weight:700;">Tutoretzak, elkarrizketak eta familien komunikazioa eskalatu</h3>
      <p style="font-size:13px;color:#777;margin:0 0 16px;line-height:1.5;">Tutoretza-jarraipen zorrotza kalitatea eta argitasuna galdu gabe mantendu behar denean.</p>
      <div style="text-align:center;">
        <img src="${sc('media__1772879594564.png')}" alt="Ordutegiak" style="max-width:48%;height:auto;border-radius:8px;border:1px solid #e0e0e0;display:inline-block;margin:4px;" />
        <img src="${sc('media__1772879618029.png')}" alt="Inportazioak" style="max-width:48%;height:auto;border-radius:8px;border:1px solid #e0e0e0;display:inline-block;margin:4px;" />
      </div>
    </div>
    <div style="background:#f9f9fc;border:1px solid #e8e8f0;border-radius:12px;padding:24px;">
      <p style="font-size:11px;color:#673DE6;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px;font-weight:700;">Benetako kasua 3</p>
      <h3 style="font-size:16px;color:#1a1a2e;margin:0 0 8px;font-weight:700;">Datuak eta ebaluazioa informazio ekingarri bihurtu</h3>
      <p style="font-size:13px;color:#777;margin:0 0 16px;line-height:1.5;">Zuzendaritza- edo pedagogia-taldeak irizpide gehiagorekin erabakitzeko zer gertatzen den hobeto ulertu behar duenean.</p>
      <div style="text-align:center;"><img src="${sc('media__1772879694256.png')}" alt="AA analisia" style="max-width:100%;height:auto;border-radius:8px;border:1px solid #e0e0e0;" /></div>
    </div>
  </div>

  <div style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e8e8f0;margin:0;" /></div>

  <!-- CTA -->
  <div style="padding:32px 40px;text-align:center;">
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 24px;">Mezu hau irakurtzen ari zareten bitartean gaur denbora eta energia kentzen dizkizuten bi edo hiru prozesu bururatu bazaizkizue, ziurrenik jadanik badago <strong>hobekuntza-aukera argi bat</strong>.</p>
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 24px;">Adeptifyk lagundu diezaizueke aztertzen, lehentasunak ezartzen eta zuen zentroarentzat errealistiko, erabilgarri eta bideragarri den irtenbide batean bihurtzen.</p>
    <a href="${BASE}" style="display:inline-block;background:#673DE6;color:#ffffff;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.5px;">20 minututan hitz egin dezagun</a>
    <p style="font-size:12px;color:#999;margin:16px 0 0;">Mezu honi zuzenean erantzun dezakezue edo <a href="mailto:hola@adeptify.es" style="color:#673DE6;text-decoration:none;">hola@adeptify.es</a> helbidera idatzi.</p>
  </div>

  <!-- FOOTER -->
  <div style="background:#1a1a2e;padding:28px 40px;text-align:center;">
    <p style="color:#a0a0c0;font-size:12px;margin:0 0 4px;font-weight:600;">Adeptify Systems</p>
    <p style="color:#777;font-size:11px;margin:0 0 4px;">
      <a href="https://adeptify.es" style="color:#a0a0c0;text-decoration:none;">adeptify.es</a> &middot;
      <a href="${BASE}" style="color:#a0a0c0;text-decoration:none;">consultor.adeptify.es</a>
    </p>
    <p style="color:#777;font-size:11px;margin:0 0 12px;">hola@adeptify.es &middot; Tel: 690831770 &middot; C. Independ&egrave;ncia 3, Local 2, Cerdanyola del Vall&egrave;s, 08290 Barcelona</p>
    <p style="color:#555;font-size:9px;margin:0;line-height:1.4;text-align:justify;">
      Mezu hau eta haren eranskinak soilik bere hartzaileari zuzenduta daude eta informazio konfidentziala eduki dezakete. (UE) 2016/679 Erregelamendua (DBAO) betez, jakinarazten dizuegu zuen datu pertsonalak erakunde berarekin negozioa, teknikoa edo merkataritzakoa den harremana mantentzeko soilik erabiliko direla. Zuen eskubideak erabil ditzakezue hola@adeptify.es helbidera idatziz edo adeptify.es-en gure pribatutasun-politika kontsultatuz.
    </p>
  </div>

</div>
</body></html>`;
}

// -- Build full HTML email with personalized intro + static body --
function buildBulkEmailHtml(introHtml) {
  const BASE = 'https://consultor.adeptify.es';
  const sc = (name) => `${BASE}/screenshots/${name}`;
  const numCircle = (n) => `<div style="width:32px;height:32px;border-radius:50%;background:#673DE6;color:#fff;font-weight:700;font-size:14px;display:inline-flex;align-items:center;justify-content:center;margin-right:12px;flex-shrink:0;">${n}</div>`;

  return `<!DOCTYPE html>
<html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#333;">
<div style="max-width:680px;margin:0 auto;background:#ffffff;">

  <!-- HEADER -->
  <div style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <img src="cid:adeptify-logo" alt="Adeptify" style="height:48px;margin-bottom:8px;" />
    <p style="color:#a0a0c0;font-size:12px;margin:0;letter-spacing:1px;">Consultoria i solucions digitals ad hoc per a centres educatius</p>
  </div>

  <!-- PERSONALIZED INTRO -->
  ${introHtml}

  <div style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e8e8f0;margin:0;" /></div>

  <!-- PAIN POINTS -->
  <div style="padding:32px 40px;">
    <h2 style="font-size:16px;color:#673DE6;text-transform:uppercase;letter-spacing:2px;margin:0 0 24px;font-weight:700;">Us sona alguna d'aquestes situacions?</h2>
    <div style="display:flex;align-items:flex-start;margin-bottom:20px;">
      ${numCircle(1)}
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0;">Les incid&egrave;ncies, les demandes internes o els seguiments importants arriben per massa canals i costa mantenir-ne el control.</p>
    </div>
    <div style="display:flex;align-items:flex-start;margin-bottom:20px;">
      ${numCircle(2)}
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0;">Hi ha dades, formularis, fulls i documents &uacute;tils, per&ograve; no treballen com un sistema coherent i aix&ograve; dificulta la presa de decisions.</p>
    </div>
    <div style="display:flex;align-items:flex-start;margin-bottom:0;">
      ${numCircle(3)}
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0;">Hi ha processos rellevants que depenen massa de persones concretes, de peda&ccedil;os temporals o d'una dedicaci&oacute; manual que ja no &eacute;s sostenible.</p>
    </div>
  </div>

  <div style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e8e8f0;margin:0;" /></div>

  <!-- METHODOLOGY -->
  <div style="padding:32px 40px;">
    <h2 style="font-size:16px;color:#673DE6;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;font-weight:700;">Qu&egrave; fa Adeptify quan detecta aquesta realitat?</h2>
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 24px;">No ofereix un cat&agrave;leg tancat. Escolta, analitza i defineix la millor resposta per al centre. Despr&eacute;s la construeix i l'ajusta fins que encaixa en el dia a dia.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="width:33%;padding:16px;background:#f7f5ff;border-radius:12px 0 0 12px;vertical-align:top;border-right:2px solid #fff;">
          <p style="font-size:28px;color:#673DE6;margin:0 0 4px;font-weight:800;">1.</p>
          <p style="font-size:13px;font-weight:700;color:#1a1a2e;margin:0 0 6px;">Analitzar</p>
          <p style="font-size:12px;color:#777;margin:0;line-height:1.5;">Entendre abans de decidir. Processos, rols, objectius, l&iacute;mits i oportunitats reals.</p>
        </td>
        <td style="width:33%;padding:16px;background:#f7f5ff;vertical-align:top;border-right:2px solid #fff;">
          <p style="font-size:28px;color:#673DE6;margin:0 0 4px;font-weight:800;">2.</p>
          <p style="font-size:13px;font-weight:700;color:#1a1a2e;margin:0 0 6px;">Definir</p>
          <p style="font-size:12px;color:#777;margin:0;line-height:1.5;">Dissenyar la resposta adequada. Fluxos, dades, automatitzacions i experi&egrave;ncia d'&uacute;s.</p>
        </td>
        <td style="width:33%;padding:16px;background:#f7f5ff;border-radius:0 12px 12px 0;vertical-align:top;">
          <p style="font-size:28px;color:#673DE6;margin:0 0 4px;font-weight:800;">3.</p>
          <p style="font-size:13px;font-weight:700;color:#1a1a2e;margin:0 0 6px;">Construir i implantar</p>
          <p style="font-size:12px;color:#777;margin:0;line-height:1.5;">Fer que funcioni de veritat. Desenvolupament, ajust i adopci&oacute; progressiva.</p>
        </td>
      </tr>
    </table>
  </div>

  <div style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e8e8f0;margin:0;" /></div>

  <!-- CASE STUDIES -->
  <div style="padding:32px 40px;">
    <p style="font-size:13px;color:#999;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 8px;font-weight:700;">Les aplicacions ja creades no s&oacute;n el producte. S&oacute;n la prova del model.</p>
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 28px;">Alguns centres han necessitat resoldre operativa IT. Altres, seguiment tutorial, avaluaci&oacute;, comunicaci&oacute; o gesti&oacute; de dades. Les solucions desenvolupades fins ara demostren una capacitat: <strong>adaptar tecnologia a necessitats singulars.</strong></p>
    <div style="background:#f9f9fc;border:1px solid #e8e8f0;border-radius:12px;padding:24px;margin-bottom:20px;">
      <p style="font-size:11px;color:#673DE6;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px;font-weight:700;">Cas real 1</p>
      <h3 style="font-size:16px;color:#1a1a2e;margin:0 0 8px;font-weight:700;">Centralitzar incid&egrave;ncies i seguiment t&egrave;cnic</h3>
      <p style="font-size:13px;color:#777;margin:0 0 16px;line-height:1.5;">Quan el centre necessita ordre, tra&ccedil;abilitat i rapidesa de resposta en la seva operativa IT.</p>
      <div style="text-align:center;"><img src="${sc('media__1772879559317.png')}" alt="Dashboard" style="max-width:100%;height:auto;border-radius:8px;border:1px solid #e0e0e0;" /></div>
    </div>
    <div style="background:#f9f9fc;border:1px solid #e8e8f0;border-radius:12px;padding:24px;margin-bottom:20px;">
      <p style="font-size:11px;color:#673DE6;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px;font-weight:700;">Cas real 2</p>
      <h3 style="font-size:16px;color:#1a1a2e;margin:0 0 8px;font-weight:700;">Escalar tutories, entrevistes i comunicaci&oacute; amb fam&iacute;lies</h3>
      <p style="font-size:13px;color:#777;margin:0 0 16px;line-height:1.5;">Quan cal sostenir un seguiment tutorial exigent sense perdre qualitat ni claredat.</p>
      <div style="text-align:center;">
        <img src="${sc('media__1772879594564.png')}" alt="Horaris" style="max-width:48%;height:auto;border-radius:8px;border:1px solid #e0e0e0;display:inline-block;margin:4px;" />
        <img src="${sc('media__1772879618029.png')}" alt="Importacions" style="max-width:48%;height:auto;border-radius:8px;border:1px solid #e0e0e0;display:inline-block;margin:4px;" />
      </div>
    </div>
    <div style="background:#f9f9fc;border:1px solid #e8e8f0;border-radius:12px;padding:24px;">
      <p style="font-size:11px;color:#673DE6;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px;font-weight:700;">Cas real 3</p>
      <h3 style="font-size:16px;color:#1a1a2e;margin:0 0 8px;font-weight:700;">Convertir dades i avaluaci&oacute; en informaci&oacute; accionable</h3>
      <p style="font-size:13px;color:#777;margin:0 0 16px;line-height:1.5;">Quan l'equip directiu o pedag&ograve;gic necessita entendre millor qu&egrave; est&agrave; passant per decidir amb m&eacute;s criteri.</p>
      <div style="text-align:center;"><img src="${sc('media__1772879694256.png')}" alt="Anàlisi IA" style="max-width:100%;height:auto;border-radius:8px;border:1px solid #e0e0e0;" /></div>
    </div>
  </div>

  <div style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e8e8f0;margin:0;" /></div>

  <!-- CTA -->
  <div style="padding:32px 40px;text-align:center;">
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 24px;">Si mentre llegiu aquest correu ja us han vingut al cap dos o tres processos que avui us resten temps i energia, probablement ja hi ha una <strong>oportunitat clara de millora</strong>.</p>
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 24px;">Adeptify us pot ajudar a analitzar-los, prioritzar-los i convertir-los en una soluci&oacute; realista, &uacute;til i assumible per al vostre centre o servei.</p>
    <a href="${BASE}" style="display:inline-block;background:#673DE6;color:#ffffff;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.5px;">Parlem-ne en 20 minuts</a>
    <p style="font-size:12px;color:#999;margin:16px 0 0;">Tamb&eacute; podeu respondre directament aquest correu o escriure a <a href="mailto:hola@adeptify.es" style="color:#673DE6;text-decoration:none;">hola@adeptify.es</a></p>
  </div>

  <!-- FOOTER -->
  <div style="background:#1a1a2e;padding:28px 40px;text-align:center;">
    <p style="color:#a0a0c0;font-size:12px;margin:0 0 4px;font-weight:600;">Adeptify Systems</p>
    <p style="color:#777;font-size:11px;margin:0 0 4px;">
      <a href="https://adeptify.es" style="color:#a0a0c0;text-decoration:none;">adeptify.es</a> &middot;
      <a href="${BASE}" style="color:#a0a0c0;text-decoration:none;">consultor.adeptify.es</a>
    </p>
    <p style="color:#777;font-size:11px;margin:0 0 12px;">hola@adeptify.es &middot; Tel: 690831770 &middot; C. Independ&egrave;ncia 3, Local 2, Cerdanyola del Vall&egrave;s, 08290 Barcelona</p>
    <p style="color:#555;font-size:9px;margin:0;line-height:1.4;text-align:justify;">
      Aquest missatge i els seus arxius adjunts van dirigits exclusivament al seu destinatari i poden contenir informaci&oacute; confidencial. D'acord amb el Reglament (UE) 2016/679 (RGPD), l'informem que les seves dades personals nom&eacute;s es faran servir per a mantenir la relaci&oacute; empresarial, t&egrave;cnica o comercial amb la pr&ograve;pia instituci&oacute;, i no es faran servir per a altres entitats. Vost&egrave; pot exercir els seus drets d'acc&eacute;s, rectificaci&oacute;, cancel&middot;laci&oacute; i oposici&oacute; adre&ccedil;ant-se a hola@adeptify.es o consultant la nostra pol&iacute;tica de privacitat a adeptify.es.
    </p>
  </div>

</div>
</body></html>`;
}

// -- Bulk email to education centers (from CenterMapExplorer) --
app.post('/api/centers/send-bulk-email', async (req, res) => {
  const { recipients, subject, campaignName, tenantSlug: reqTenantSlug } = req.body;
  if (!Array.isArray(recipients) || !subject) {
    return res.status(400).json({ error: 'Falten camps obligatoris' });
  }
  const host = process.env.SMTP_HOST;
  if (!host) return res.status(503).json({ error: 'SMTP no configurat' });

  const transporter = nodemailer.createTransport({
    host, port: Number(process.env.SMTP_PORT || 587), secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  // Generate brochure PDF
  let brochureAttachment = null;
  try {
    const brochureBuf = await generateBrochurePdfBuffer();
    brochureAttachment = { filename: 'Adeptify_Informacio_General.pdf', content: brochureBuf.toString('base64'), encoding: 'base64' };
    console.log(`[BulkEmail] Brochure PDF generated: ${Math.round(brochureBuf.length / 1024)} KB`);
  } catch (e) { console.warn('[BulkEmail] Brochure PDF failed:', e.message); }

  // Read logo for CID
  let logoCid = null;
  try {
    const logoPath = path.join(__dirname, 'dist', 'brand', 'adeptify-logo.png');
    const logoPathAlt = path.join(__dirname, 'public', 'brand', 'adeptify-logo.png');
    const lp = fs.existsSync(logoPath) ? logoPath : logoPathAlt;
    if (fs.existsSync(lp)) logoCid = { filename: 'adeptify-logo.png', path: lp, cid: 'adeptify-logo' };
  } catch (e) { /* optional */ }

  const capped = recipients.slice(0, 200);
  const supabase = getSupabaseAdmin();
  const tenantSlug = reqTenantSlug || 'default';

  // Create campaign for this send batch (if name provided)
  let campaignId = null;
  if (supabase && campaignName) {
    try {
      const { data: camp } = await supabase.from('campaigns').insert({
        tenant_slug: tenantSlug,
        name: campaignName,
        description: `Enviament massiu del ${new Date().toLocaleDateString('ca')}`,
        status: 'active',
        goal: `${capped.length} centres`,
        metadata_json: { subject, recipient_count: capped.length },
      }).select('id').single();
      campaignId = camp?.id || null;
      if (campaignId) console.log(`[BulkEmail] Campaign created: ${campaignName} (${campaignId})`);
    } catch (e) { console.warn('[BulkEmail] Campaign creation failed:', e.message); }
  }

  // Fetch lead data for personalization (Tier 3)
  let leadsByEmail = {};
  try {
    if (supabase) {
      const emails = capped.map(r => r.email).filter(Boolean);
      if (emails.length > 0) {
        const { data } = await supabase.from('leads')
          .select('id, email, company_name, status, ai_needs_analysis')
          .in('email', emails);
        for (const lead of (data || [])) leadsByEmail[lead.email] = lead;
      }
    }
  } catch (e) { console.warn('[BulkEmail] Lead fetch failed:', e.message); }

  // Fetch MongoDB profiles for all centers (enrichment)
  let mongoProfiles = {};
  try {
    const codis = capped.map(r => r.codi).filter(Boolean);
    if (codis.length > 0) {
      mongoProfiles = await fetchMongoProfiles(codis);
      console.log(`[BulkEmail] MongoDB profiles found: ${Object.keys(mongoProfiles).length}/${codis.length}`);
    }
  } catch (e) { console.warn('[BulkEmail] MongoDB fetch failed:', e.message); }

  // Identify Tier 3 centers (have lead data with needs analysis OR rich MongoDB profile)
  const tier3 = capped.filter(r => {
    const lead = leadsByEmail[r.email];
    const mongo = mongoProfiles[r.codi];
    const hasLeadNeeds = lead?.ai_needs_analysis && (
      lead.ai_needs_analysis.recommended_solution ||
      (lead.ai_needs_analysis.needs_detected && lead.ai_needs_analysis.needs_detected.length > 0)
    );
    const hasMongoNeeds = mongo?.needs?.dolor_principal || mongo?.needs?.necesidades_principales?.length;
    return hasLeadNeeds || hasMongoNeeds;
  });

  // Generate AI intros for Tier 3 (grouped by language)
  let aiIntros = {};
  if (tier3.length > 0) {
    console.log(`[BulkEmail] Generating AI intros for ${tier3.length} Tier 3 centers...`);
    try {
      const tier3ByLang = { ca: [], es: [], eu: [] };
      for (const r of tier3) {
        const lang = detectEmailLang(r.pais);
        (tier3ByLang[lang] || tier3ByLang.ca).push({ codi: r.codi, centerData: r, leadData: leadsByEmail[r.email], mongoProfile: mongoProfiles[r.codi] || null });
      }
      for (const [lang, items] of Object.entries(tier3ByLang)) {
        if (items.length > 0) {
          const intros = await generateAIIntros(items, lang);
          Object.assign(aiIntros, intros);
        }
      }
      console.log(`[BulkEmail] AI intros generated: ${Object.keys(aiIntros).length}`);
    } catch (e) { console.warn('[BulkEmail] AI intros failed:', e.message); }
  }

  // Send personalized emails with lead tracking
  let sent = 0;
  let leadsCreated = 0;
  const errors = [];
  const PRESERVE_STATUSES = ['proposal_sent', 'qualified', 'closed', 'converted'];

  for (const r of capped) {
    try {
      // A) Upsert lead in Supabase
      let leadId = leadsByEmail[r.email]?.id || null;
      if (supabase) {
        try {
          const existingLead = leadsByEmail[r.email];
          const upsertData = {
            tenant_slug: tenantSlug,
            email: r.email,
            company_name: r.centerName || r.email,
            source: existingLead?.source || 'bulk_email_map',
            last_contacted_at: new Date().toISOString(),
            codi_centre_ref: r.codi || null,
            region: r.region || (r.nom_comarca ? 'Catalunya' : 'unknown'),
            pais: r.pais || 'ES-CT',
          };
          if (campaignId && !existingLead?.campaign_id) upsertData.campaign_id = campaignId;
          // Only set status to 'new' if lead doesn't exist or has no advanced status
          if (!existingLead || !PRESERVE_STATUSES.includes(existingLead.status)) {
            upsertData.status = existingLead?.status || 'new';
          }
          const { data: upserted } = await supabase.from('leads')
            .upsert(upsertData, { onConflict: 'tenant_slug,email', ignoreDuplicates: false })
            .select('id').single();
          if (upserted?.id) {
            leadId = upserted.id;
            if (!existingLead) leadsCreated++;
          }
        } catch (le) { console.warn(`[BulkEmail] Lead upsert failed for ${r.email}:`, le.message); }
      }

      // B) Create interaction record + tracking pixel
      const interactionId = crypto.randomUUID();
      if (supabase && leadId) {
        try {
          const tierUsed = aiIntros[r.codi] ? 'tier3_ai' : (r.ai_custom_pitch ? 'tier2_pitch' : 'tier1_template');
          const hasMongo = !!mongoProfiles[r.codi];
          await supabase.from('lead_interactions').insert({
            id: interactionId,
            lead_id: leadId,
            interaction_type: 'bulk_email',
            content_summary: subject,
            payload_json: { centerName: r.centerName, codi: r.codi, tier: tierUsed, mongoEnriched: hasMongo },
          });
        } catch (ie) { console.warn(`[BulkEmail] Interaction insert failed:`, ie.message); }
      }

      // C) Build personalized intro (language-aware)
      const mongoProfile = mongoProfiles[r.codi] || null;
      const emailLang = detectEmailLang(r.pais);
      let introHtml;
      if (aiIntros[r.codi]) {
        // Tier 3: AI-generated intro wrapped in styled HTML
        const closingLine = emailLang === 'eu'
          ? `Horregatik, ez dugu beste aplikazio bat gehitzen proposatzen. <strong>Zuen testuinguru zehatzarentzako egokia den irtenbidea definitzea proposatzen dugu.</strong>`
          : emailLang === 'es'
            ? `Por eso, lo que proponemos no es a&ntilde;adir otra app. <strong>Lo que proponemos es definir la soluci&oacute;n adecuada para vuestro contexto.</strong>`
            : `Per aix&ograve;, el que proposem no &eacute;s afegir una altra app. <strong>El que proposem &eacute;s definir la soluci&oacute; adequada per al vostre context.</strong>`;
        introHtml = `
        <div style="padding:40px 40px 24px;">
          <h1 style="font-size:20px;color:#1a1a2e;margin:0 0 16px;line-height:1.3;font-weight:700;">${r.centerName || 'El vostre centre'}</h1>
          <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 16px;">${aiIntros[r.codi]}</p>
          <p style="font-size:14px;color:#555;line-height:1.7;margin:0;">${closingLine}</p>
        </div>`;
      } else {
        // Tier 1 or 2: template-based intro (enriched with MongoDB, language-aware)
        introHtml = emailLang === 'es'
          ? buildTemplatePersonalizedIntroEs(r, mongoProfile)
          : emailLang === 'eu'
            ? buildTemplatePersonalizedIntroEu(r, mongoProfile)
            : buildTemplatePersonalizedIntro(r, mongoProfile);
      }

      // D) Build full HTML with tracking pixel (language-aware)
      let html = emailLang === 'es'
        ? buildBulkEmailHtmlEs(introHtml)
        : emailLang === 'eu'
          ? buildBulkEmailHtmlEu(introHtml)
          : buildBulkEmailHtml(introHtml);
      const trackPixel = `<img src="https://consultor.adeptify.es/api/crm/track/${interactionId}.png" width="1" height="1" style="display:block;" alt="" />`;
      html = html.replace('</body>', `${trackPixel}</body>`);

      const attachments = [];
      if (logoCid) attachments.push(logoCid);
      if (brochureAttachment) attachments.push(brochureAttachment);
      await transporter.sendMail({ from: '"Adeptify" <hola@adeptify.es>', to: r.email, subject, html, attachments });
      sent++;
    } catch (e) {
      errors.push(`${r.email}: ${e.message}`);
    }
  }
  const t3count = Object.keys(aiIntros).length;
  const mongoCount = Object.keys(mongoProfiles).length;
  console.log(`[BulkEmail] Sent ${sent}/${capped.length} (${t3count} AI, ${mongoCount} MongoDB, ${leadsCreated} new leads), errors: ${errors.length}`);
  res.json({ sent, total: capped.length, errors, aiPersonalized: t3count, mongoEnriched: mongoCount, leadsCreated });
});

// -- Save AI enrichment data to cat_education_centers --
app.post('/api/centers/save-ai-enrichment', async (req, res) => {
  const { referenceCenterCode, enrichments } = req.body;
  if (!Array.isArray(enrichments) || enrichments.length === 0) {
    return res.status(400).json({ error: 'Enrichments array required' });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'DB not configured' });

  let updated = 0;
  const now = new Date().toISOString();
  try {
    for (const e of enrichments) {
      const { error } = await supabase
        .from('cat_education_centers')
        .update({
          ai_opportunity_score: Math.min(10, Math.max(1, Math.round(e.opportunity_score || 0))),
          ai_reason_similarity: (e.reason_for_similarity || '').substring(0, 2000),
          ai_custom_pitch: (e.custom_referral_pitch || '').substring(0, 2000),
          ai_enriched_at: now,
          ai_enriched_by_ref: referenceCenterCode || null,
        })
        .eq('codi_centre', e.codi_centre);
      if (!error) updated++;
      else console.warn(`[SaveEnrichment] Error updating ${e.codi_centre}:`, error.message);
    }
    console.log(`[SaveEnrichment] Updated ${updated}/${enrichments.length} centers`);
    res.json({ success: true, updated });
  } catch (err) {
    console.error('[SaveEnrichment] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -- Scrape URL helper (reused by capture + outreach) --
async function scrapeUrl(url) {
  const fetchResp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(15000),
  });
  const html = await fetchResp.text();
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header').remove();
  return $('body').text().replace(/\s+/g, ' ').trim().substring(0, 15000);
}

// -- NLP Persuasive Email Prompt Builder --
function buildPersuasiveEmailPrompt(params, scrapedData, aiEnrichment, lang) {
  const langMap = { ca: 'CATALÀ', es: 'CASTELLANO', eu: 'EUSKERA' };
  const targetLang = langMap[lang] || 'CATALÀ';

  return `Ets un expert en comunicació persuasiva i PNL (Programació NeuroLingüística) per al sector educatiu.

CONTEXT DEL CENTRE DESTINATARI:
- Nom: ${params.centerName}
- Tipus: ${params.centerData?.nom_naturalesa || 'No especificat'}
- Municipi: ${params.centerData?.nom_municipi || 'Catalunya'}
- Comarca: ${params.centerData?.nom_comarca || ''}
- Estudis: ${(params.centerData?.studies || []).join(', ') || 'Diversos'}
- Email: ${params.centerEmail}
${scrapedData?.scrapedText ? `- Informació de la web: ${scrapedData.scrapedText.substring(0, 3000)}` : ''}

ANÀLISI IA PRÈVIA (prospecció per proximitat):
- Puntuació d'oportunitat: ${aiEnrichment?.opportunity_score || 'N/A'}/10
- Raó de similitud: ${aiEnrichment?.reason_for_similarity || 'Centre educatiu de la zona'}
- Pitch personalitzat: ${aiEnrichment?.custom_referral_pitch || ''}

CENTRE DE REFERÈNCIA (client exitós): ${params.referenceCenterName || 'Centre educatiu col·laborador'}

INSTRUCCIONS DE PERSUASIÓ PNL — OBLIGATORIS:

1. FILOSOFIA CENTRAL: La tecnologia serveix al centre, MAI al revés. El missatge ha de transmetre que Adeptify s'adapta a ells, no ells a Adeptify.

2. RESPECTE PROFUND pels seus eines i processos actuals:
   - "Sabem que el vostre equip ja fa una feina excel·lent amb les eines que teniu"
   - "No volem canviar res del que ja funciona"
   - Mai criticar o menystenir les seves solucions actuals

3. OPTIMITZAR, NO CANVIAR:
   - "El nostre objectiu és que pugueu fer MÉS amb MENYS esforç"
   - "Automatitzar el que us roba temps perquè pugueu dedicar-vos al que realment importa: els vostres alumnes"
   - Usa ancoratge PNL: vincular les seves emocions positives (passió per l'educació) amb la solució

4. FRICCIÓ ZERO i gestió de la resistència al canvi:
   - "Implementació transparent que no requereix formació complexa"
   - "Comença funcionant al costat dels vostres sistemes actuals, sense substituir res"
   - "Podeu provar-ho sense compromís i veure resultats en dies, no mesos"
   - Usa el patró PNL "Yes-set": 3 afirmacions amb les quals estiguin d'acord abans de la proposta

5. EXEMPLES CONCRETS de valor:
   - Actes de reunions automatitzades: "Les gravacions s'encripten, es transcriuen amb IA, i es borren automàticament. Cap dada sensible queda guardada."
   - Reducció de paperassa: "Convertiu 3 hores de feina burocràtica en 15 minuts"
   - Privacitat per disseny: "Totes les dades es processen dins la UE, amb xifratge punt a punt. Les gravacions de veu o vídeo s'esborren un cop transcrites de forma automàtica. Anonimització de la informació sensible."

6. TÈCNIQUES PNL ESPECÍFIQUES:
   - Rapport: Usar el seu vocabulari (extret del scraping)
   - Reframing: Convertir "un altre eina nova" en "menys feina per al vostre equip"
   - Future pacing: "Imagineu que el proper trimestre, les actes es generen soles..."
   - Social proof: "Centres similars a ${params.centerData?.nom_comarca || 'la vostra comarca'} ja ho fan servir"
   - Scarcity suau: "Estem treballant amb un nombre limitat de centres pilot"

7. LINK AL CONSULTOR: Inclou un link a https://consultor.adeptify.es amb el text "Feu un diagnòstic gratuït en 5 minuts"

IDIOMA DE RESPOSTA: ${targetLang}

GENERA EXACTAMENT AQUEST JSON (sense res més fora del JSON):
{
  "subject": "Assumpte del correu (curt, personal, sense spam words)",
  "html_body": "Cos del correu en HTML amb estil professional (fonts sans-serif, colors suaus #2F1C6A i #673DE6). Inclou TOTS els elements PNL. Longitud: 400-600 paraules. Estructura: salutació personal → observació específica del centre → proposta de valor → exemples concrets → CTA suau → signatura Adeptify.",
  "plain_body": "Versió text pla del mateix correu"
}`;
}

// -- Send outreach email with attachments --
async function sendOutreachEmail(email, emailContent, docxBase64, pdfBase64, centerName) {
  const host = process.env.SMTP_HOST;
  if (!host) throw new Error('SMTP not configured');

  const transporter = nodemailer.createTransport({
    host, port: Number(process.env.SMTP_PORT || 587), secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const interactionId = crypto.randomUUID();
  const supabase = getSupabaseAdmin();

  // CRM tracking
  if (supabase) {
    await supabase.from('leads').upsert({
      tenant_slug: 'default',
      email,
      company_name: centerName,
      source: 'network_expansion_outreach',
      status: 'proposal_sent',
    }, { onConflict: 'tenant_slug,email' }).catch(() => { });

    await supabase.from('lead_interactions').insert({
      id: interactionId,
      lead_id: null,
      interaction_type: 'outreach_email',
      content_summary: emailContent.subject,
    }).catch(() => { });
  }

  const trackPixel = `<img src="https://consultor.adeptify.es/api/crm/track/${interactionId}.png" width="1" height="1"/>`;
  const html = `<div style="font-family:sans-serif;">${emailContent.html_body}${trackPixel}</div>`;

  const attachments = [];
  const safeName = centerName.replace(/[^a-zA-Z0-9àáèéíïòóúüçñ ]/g, '').replace(/\s+/g, '_');
  if (docxBase64) attachments.push({ filename: `Proposta_${safeName}.docx`, content: docxBase64, encoding: 'base64' });
  if (pdfBase64) attachments.push({ filename: `Proposta_${safeName}.pdf`, content: pdfBase64, encoding: 'base64' });

  await transporter.sendMail({
    from: '"Adeptify" <hola@adeptify.es>',
    to: email,
    subject: emailContent.subject,
    html,
    attachments,
  });
  console.log(`[Outreach] Email sent to ${email} with ${attachments.length} attachments`);
}

// -- Institution outreach pipeline: scrape → multi-agent → NLP email --
async function runInstitutionOutreach(jobId, params) {
  const job = reportJobs.get(jobId);
  const push = (type, payload) => { if (job) job.events.push({ type, ...payload }); };

  try {
    // STEP 1: Scrape website
    push('progress', { agent: 'SCRAPER', message: 'Fent scraping de la web del centre...', fase: 1 });
    let scrapedData = {};
    if (params.webUrl) {
      try {
        const text = await scrapeUrl(params.webUrl);
        scrapedData = { scrapedText: text, url: params.webUrl };
        push('progress', { agent: 'SCRAPER', message: `Web analitzada: ${text.length} chars extrets`, fase: 1 });
      } catch (e) {
        push('progress', { agent: 'SCRAPER', message: `Scrape warning: ${e.message}`, fase: 1 });
      }
    } else {
      push('progress', { agent: 'SCRAPER', message: 'Sense URL — saltant scraping', fase: 1 });
    }

    // STEP 2: Build datosCliente for multi-agent
    push('progress', { agent: 'ORQUESTADOR', message: 'Construint dades pel sistema multi-agent...', fase: 2 });
    const datosCliente = {
      cliente: {
        nombre: params.centerName,
        tipo: 'centre_educatiu',
        sector: 'Educació',
        web: params.webUrl || '',
        email: params.centerEmail,
        naturalesa: params.centerData?.nom_naturalesa,
        municipi: params.centerData?.nom_municipi,
        comarca: params.centerData?.nom_comarca,
        telefon: params.centerData?.telefon,
        estudis: params.centerData?.studies,
      },
      sistemas_existentes: [],
      proposta: {
        idioma: params.lang || 'ca',
        tipus_projecte: 'Consultoria educativa i transformació digital',
        pressupost_orientatiu: '5000-15000',
        termini_desitjat: '2-3 mesos',
      },
      contexto_inicial: {
        scraped: scrapedData,
        ai_enrichment: params.aiEnrichment,
        reference_center: params.referenceCenterName,
      },
    };

    // STEP 3: Run multi-agent orchestrator
    push('progress', { agent: 'ORQUESTADOR', message: 'Sistema multi-agent iniciat (14 agents)...', fase: 2 });
    const doc = await orchestrate(datosCliente, (agentId, message, fase) => {
      push('progress', { agent: agentId, message, fase });
    });

    // STEP 4: Generate DOCX + PDF
    push('progress', { agent: 'DOCX', message: 'Generant documents DOCX + PDF...', fase: 4 });
    let docxBase64 = null, pdfBase64 = null;
    const DOC_TIMEOUT = 30000;
    try {
      const buffer = await Promise.race([
        generateDocxBuffer(doc, datosCliente),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout DOCX')), DOC_TIMEOUT)),
      ]);
      docxBase64 = buffer.toString('base64');
      push('progress', { agent: 'DOCX', message: `DOCX generat: ${Math.round(buffer.length / 1024)} KB`, fase: 4 });
    } catch (e) {
      push('progress', { agent: 'DOCX', message: `DOCX warning: ${e.message}`, fase: 4 });
    }

    try {
      const buf = await Promise.race([
        generatePdfBuffer(doc, datosCliente),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout PDF')), DOC_TIMEOUT)),
      ]);
      pdfBase64 = buf.toString('base64');
      push('progress', { agent: 'PDF', message: `PDF generat: ${Math.round(buf.length / 1024)} KB`, fase: 4 });
    } catch (e) {
      push('progress', { agent: 'PDF', message: `PDF warning: ${e.message}`, fase: 4 });
    }

    // STEP 5: Generate persuasive email via AI
    push('progress', { agent: 'EMAIL_IA', message: 'Generant email persuasiu amb PNL...', fase: 5 });
    const emailPrompt = buildPersuasiveEmailPrompt(params, scrapedData, params.aiEnrichment, params.lang);
    const emailResult = await callClaude(emailPrompt);
    const emailContent = typeof emailResult === 'string' ? JSON.parse(emailResult) : emailResult;
    push('progress', { agent: 'EMAIL_IA', message: `Email generat: "${emailContent.subject}"`, fase: 5 });

    // STEP 6: Send email
    push('progress', { agent: 'EMAIL', message: `Enviant a ${params.centerEmail}...`, fase: 5 });
    await sendOutreachEmail(params.centerEmail, emailContent, docxBase64, pdfBase64, params.centerName);

    // STEP 7: Save report to Supabase
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const rawJsonBase64 = Buffer.from(JSON.stringify(doc, null, 2), 'utf-8').toString('base64');
      await supabase.from('report_downloads').upsert({
        job_id: jobId,
        client_name: params.centerName,
        docx_base64: docxBase64,
        pdf_base64: pdfBase64,
        raw_json_base64: rawJsonBase64,
      }, { onConflict: 'job_id' }).catch(() => { });
    }

    job.result = { doc, docxBase64, pdfBase64, emailContent };
    job.status = 'done';
    push('complete', { centerName: params.centerName, success: true });
    console.log(`[Outreach] Pipeline completed for ${params.centerName}`);
  } catch (e) {
    console.error(`[Outreach] Pipeline error for ${params.centerName}:`, e);
    if (job) {
      job.status = 'error';
      job.error = e.message;
    }
    push('error', { message: e.message });
  }
}

// -- Institution outreach endpoint --
app.post('/api/centers/institution-outreach', async (req, res) => {
  const { codi_centre, centerName, centerEmail, webUrl, centerData,
    aiEnrichment, referenceCenterName, lang } = req.body;

  if (!centerEmail) return res.status(400).json({ error: 'Email del centre requerit' });

  const jobId = crypto.randomUUID();
  reportJobs.set(jobId, { status: 'running', events: [], result: null, error: null });

  // Run pipeline async
  runInstitutionOutreach(jobId, {
    codi_centre, centerName, centerEmail, webUrl, centerData,
    aiEnrichment, referenceCenterName, lang: lang || 'ca',
  });

  // Auto-cleanup after 2h
  setTimeout(() => reportJobs.delete(jobId), 2 * 60 * 60 * 1000);

  res.json({
    jobId,
    message: "S'ha iniciat el pipeline de prospecció. Rebràs notificació quan estigui llest.",
  });
});

// -- Retrieve lead data for centers (by email list) --
app.post('/api/centers/get-lead-data', async (req, res) => {
  const { emails } = req.body;
  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: 'Emails array required' });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'DB not configured' });

  try {
    const { data, error } = await supabase
      .from('leads')
      .select('email, company_name, source, status, ai_needs_analysis, created_at, updated_at')
      .in('email', emails.slice(0, 100));
    if (error) throw error;

    // Index by email for easy lookup
    const byEmail = {};
    for (const lead of (data || [])) {
      byEmail[lead.email] = lead;
    }
    res.json({ leads: byEmail, total: Object.keys(byEmail).length });
  } catch (err) {
    console.error('[GetLeadData] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/automation/generate-docx', async (req, res) => {
  try {
    const { generateDocxBuffer } = require('./multi-agent/generate_docx');
    const buffer = await generateDocxBuffer(req.body.leadData, req.body.lang || 'ca');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').send(buffer);
  } catch (e) {
    console.error("[Generate DOCX error]", e);
    res.status(500).json({ error: e.message });
  }
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
    let pdfBase64 = null;
    const DOC_TIMEOUT = 30000; // 30 seconds max for document generation
    try {
      const buffer = await Promise.race([
        generateDocxBuffer(doc, datosCliente),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DOCX generation timeout (30s)')), DOC_TIMEOUT))
      ]);
      docxBase64 = buffer.toString('base64');
      console.log(`[MultiAgent] DOCX OK — ${Math.round(buffer.length / 1024)} KB`);
    } catch (docxErr) {
      console.error('[MultiAgent] DOCX generation failed:', docxErr.message);
      push('progress', { agent: 'DOCX', message: `Advertència DOCX: ${docxErr.message} — el JSON es pot descarregar igualment`, fase: 5 });
    }

    // Generate PDF from the same data
    push('progress', { agent: 'PDF', message: 'Generant document PDF...', fase: 5 });
    try {
      const pdfBuf = await Promise.race([
        generatePdfBuffer(doc, datosCliente),
        new Promise((_, reject) => setTimeout(() => reject(new Error('PDF generation timeout (30s)')), DOC_TIMEOUT))
      ]);
      pdfBase64 = pdfBuf.toString('base64');
      console.log(`[MultiAgent] PDF OK — ${Math.round(pdfBuf.length / 1024)} KB`);
    } catch (pdfErr) {
      console.error('[MultiAgent] PDF generation failed:', pdfErr.message);
      push('progress', { agent: 'PDF', message: `Advertència PDF: ${pdfErr.message}`, fase: 5 });
    }

    // Store result immediately so download endpoints work
    job.result = { doc, docxBase64, pdfBase64, rawJsonBase64, clientName };

    // Persist to Supabase for cross-instance downloads (Cloud Run)
    try {
      const sb = getSupabaseAdmin();
      if (sb) {
        await sb.from('report_downloads').upsert({
          job_id: jobId,
          client_name: clientName,
          docx_base64: docxBase64,
          pdf_base64: pdfBase64,
          raw_json_base64: rawJsonBase64,
        });
        console.log(`[MultiAgent] Download persisted to Supabase for job ${jobId}`);
      }
    } catch (persistErr) {
      console.error('[MultiAgent] Failed to persist download:', persistErr.message);
    }

    // Send email with the generated report (non-blocking for SSE)
    try {
      const host = process.env.SMTP_HOST;
      const emailTo = datosCliente?.cliente?.email || process.env.CONTACT_TO;
      if (host && emailTo) {
        const transporter = nodemailer.createTransport({ host, port: Number(process.env.SMTP_PORT || 587), secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });

        let attachments = [];
        if (docxBase64) {
          attachments.push({ filename: `Informe_${clientName.replace(/\s+/g, '_')}.docx`, content: docxBase64, encoding: 'base64' });
        }
        if (pdfBase64) {
          attachments.push({ filename: `Informe_${clientName.replace(/\s+/g, '_')}.pdf`, content: pdfBase64, encoding: 'base64' });
        }

        const htmlBody = `<div style="font-family:sans-serif;">Hola,<br><br>S'ha completat la generació del teu informe personalitzat iteratiu amb IA sobre: <strong>${clientName}</strong>.<br><br>Trobaràs l'informe generat adjunt en aquest missatge.<br><br>Salutacions,<br>Equip Adeptify</div>`;

        await transporter.sendMail({
          from: '"Adeptify" <hola@adeptify.es>',
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

    // IMPORTANT: Push 'complete' and set status='done' AFTER email,
    // otherwise the SSE drainer sees status='done' and closes the connection
    // before the frontend receives the 'complete' event.
    push('complete', { clientName, success: true });
    job.status = 'done';
  } catch (e) {
    console.error('[MultiAgent] Error:', e.message);
    if (reportJobs.get(jobId)) {
      reportJobs.get(jobId).status = 'error';
      reportJobs.get(jobId).error = e.message;
    }
    push('error', { message: e.message });
  }
}

// Nou endpoint per descarregar informes de la memòria a través de l'API web
app.get('/api/automation/full-report/download/:jobId/:type', async (req, res) => {
  const { jobId, type } = req.params;

  // Try in-memory first (same instance, fastest path)
  let result = reportJobs.get(jobId)?.result;

  // Fallback: read from Supabase (cross-instance / expired from memory)
  if (!result) {
    try {
      const sb = getSupabaseAdmin();
      if (sb) {
        const { data } = await sb
          .from('report_downloads')
          .select('client_name, docx_base64, pdf_base64, raw_json_base64')
          .eq('job_id', jobId)
          .single();
        if (data) {
          result = { clientName: data.client_name, docxBase64: data.docx_base64, pdfBase64: data.pdf_base64, rawJsonBase64: data.raw_json_base64 };
          console.log(`[Download] Served from Supabase fallback for job ${jobId}`);
        }
      }
    } catch (e) {
      console.error('[Download] Supabase fallback error:', e.message);
    }
  }

  if (!result) return res.status(404).send('Not Found o Caducat');

  const safeName = (result.clientName || 'Informe').replace(/[^a-zA-Z0-9\u00C0-\u00FF\s]/g, '').replace(/\s+/g, '_');

  if (type === 'docx' && result.docxBase64) {
    const buffer = Buffer.from(result.docxBase64, 'base64');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="Proposta_${safeName}.docx"`);
    return res.end(buffer);
  }

  if (type === 'pdf' && result.pdfBase64) {
    const buffer = Buffer.from(result.pdfBase64, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Proposta_${safeName}.pdf"`);
    return res.end(buffer);
  }

  if (type === 'json' && result.rawJsonBase64) {
    const buffer = Buffer.from(result.rawJsonBase64, 'base64');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="Adeptify_${safeName}.json"`);
    return res.end(buffer);
  }

  res.status(404).send('Document tipus no disponible o fallit');
});

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

  // Clean up in-memory job after 2h (downloads persisted in Supabase)
  setTimeout(() => reportJobs.delete(jobId), 2 * 60 * 60 * 1000);

  res.json({
    jobId,
    message: "S'ha iniciat la creació de l'informe detallat amb IA. Rebràs un correu electrònic amb l'informe completat un cop finalitzi el procés. Mentrestant, pots continuar treballant."
  });
});

// 2) SSE stream for job progress — use with EventSource(url) on the frontend
//    Supports ?cursor=N for reconnection after QUIC drops
app.get('/api/automation/full-report/stream/:jobId', (req, res) => {
  const { jobId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  // Support reconnection: client can pass ?cursor=N to resume from event N
  let cursor = Math.max(0, parseInt(req.query.cursor, 10) || 0);
  let heartbeatCount = 0;
  let jobNotFoundRetries = 0;
  const JOB_NOT_FOUND_MAX_RETRIES = 30; // 30 × 500ms = 15s de marge per Cloud Run multi-instancia

  // Heartbeat cada 10s para prevenir QUIC_NETWORK_IDLE_TIMEOUT en Cloud Run
  // (QUIC idle timeout can be as low as 30s; 10s keeps the connection alive)
  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping ${++heartbeatCount}\n\n`);
    } catch (_) { }
  }, 10000);

  const interval = setInterval(() => {
    const job = reportJobs.get(jobId);
    if (!job) {
      jobNotFoundRetries++;
      if (jobNotFoundRetries >= JOB_NOT_FOUND_MAX_RETRIES) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: 'Job no trobat' })}\n\n`);
        clearInterval(interval);
        clearInterval(heartbeat);
        res.end();
      }
      // Seguim esperant — pot ser que el job estigui a una altra instància de Cloud Run
      return;
    }

    // Job trobat — reiniciem el comptador de retries
    jobNotFoundRetries = 0;

    // Drain new events, sending cursor position so client can reconnect
    while (cursor < job.events.length) {
      const ev = job.events[cursor++];
      const { type, ...data } = ev;
      res.write(`event: ${type}\ndata: ${JSON.stringify({ ...data, _cursor: cursor })}\n\n`);
    }

    if (job.status === 'done' || job.status === 'error') {
      clearInterval(interval);
      clearInterval(heartbeat);
      res.end();
    }
  }, 500);

  req.on('close', () => {
    clearInterval(interval);
    clearInterval(heartbeat);
  });
});

// ─── GEMINI API PROXY ───────────────────────────────────────────────────────
// En desarrollo, vite.config.ts proxea /api-proxy → googleapis.com.
// En producción (Cloud Run), este endpoint hace lo mismo inyectando GEMINI_API_KEY.
app.post('/api-proxy/*', async (req, res) => {
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!geminiKey) {
    return res.status(503).json({ error: { message: 'GEMINI_API_KEY not configured on server. Set it as a Cloud Run secret.' } });
  }

  // Construir la URL de la API de Google (quitar el prefijo /api-proxy)
  const apiPath = req.path.replace(/^\/api-proxy/, '');
  const queryString = Object.keys(req.query).length
    ? '?' + new URLSearchParams(req.query).toString()
    : '';
  const targetUrl = `https://generativelanguage.googleapis.com${apiPath}${queryString}`;

  try {
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiKey,
      },
      body: JSON.stringify(req.body),
    });

    const data = await upstream.json().catch(() => ({}));
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error('[api-proxy] Error calling Gemini API:', err?.message || err);
    res.status(502).json({ error: { message: `Proxy error: ${err?.message || 'unknown'}` } });
  }
});

// ============================================================
// -- FULL CRM ENDPOINTS --
// ============================================================

// GET /api/crm/campaigns — list all campaigns with stats
app.get('/api/crm/campaigns', async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'DB not configured' });
  const tenantSlug = req.query.tenant_slug || 'default';
  try {
    const [{ data: camps }, { data: stats }] = await Promise.all([
      supabase.from('campaigns').select('*').eq('tenant_slug', tenantSlug).order('created_at', { ascending: false }),
      supabase.rpc('get_campaign_stats', { p_tenant_slug: tenantSlug }),
    ]);
    const statsMap = {};
    for (const s of (stats || [])) statsMap[s.campaign_id] = s;
    const campaigns = (camps || []).map(c => ({
      ...c,
      lead_count: Number(statsMap[c.id]?.lead_count || 0),
      open_count: Number(statsMap[c.id]?.open_count || 0),
      sent_count: Number(statsMap[c.id]?.sent_count || 0),
    }));
    res.json({ campaigns });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/crm/lead/:id — full lead detail with interactions, notes, centerData, mongoProfile
app.get('/api/crm/lead/:id', async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'DB not configured' });
  const { id } = req.params;
  try {
    const [{ data: lead }, { data: interactions }, { data: notes }] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase.from('lead_interactions').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
      supabase.from('crm_notes').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
    ]);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    let centerData = null;
    let mongoProfile = null;
    const codi = lead.codi_centre_ref;
    if (codi) {
      const [{ data: cd }, mp] = await Promise.all([
        supabase.from('cat_education_centers')
          .select('codi_centre,denominacio_completa,nom_naturalesa,nom_titularitat,adreca,nom_municipi,nom_comarca,codi_postal,telefon,email_centre,ai_opportunity_score,ai_custom_pitch,ai_reason_similarity,web_url')
          .eq('codi_centre', codi).single(),
        fetchMongoProfiles([codi]),
      ]);
      centerData = cd || null;
      mongoProfile = mp[codi] || null;
    }
    res.json({ lead, interactions: interactions || [], notes: notes || [], centerData, mongoProfile });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/crm/lead/:id — update lead status/tags/metadata
app.patch('/api/crm/lead/:id', async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'DB not configured' });
  const { id } = req.params;
  const VALID_STATUSES = ['new', 'qualified', 'proposal_sent', 'closed', 'lost'];
  const patch = {};
  if (req.body.status) {
    if (!VALID_STATUSES.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
    patch.status = req.body.status;
  }
  if (req.body.tags !== undefined) patch.tags = req.body.tags;
  if (req.body.metadata_json !== undefined) patch.metadata_json = req.body.metadata_json;
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'No fields to update' });
  try {
    const { data: lead } = await supabase.from('leads').update(patch).eq('id', id).select().single();
    res.json({ lead });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/crm/lead/:id/note — add a manual note
app.post('/api/crm/lead/:id/note', async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'DB not configured' });
  const { id } = req.params;
  const { content, created_by } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
  try {
    const [{ data: note }] = await Promise.all([
      supabase.from('crm_notes').insert({ lead_id: id, content: content.trim(), created_by: created_by || 'admin' }).select().single(),
      supabase.from('lead_interactions').insert({ lead_id: id, interaction_type: 'note', content_summary: content.trim().slice(0, 200) }),
    ]);
    res.json({ note });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// -- INSTITUTION IMPORT ENDPOINTS --
// ============================================================

const { parse: csvParse } = require('csv-parse/sync');

// Helper: generate deterministic codi_centre for non-Catalan centers
function generateCodi(pais, email, name) {
  const base = email || name || 'unknown';
  return `${pais}-${require('crypto').createHash('md5').update(base.toLowerCase().trim()).digest('hex').slice(0, 8)}`;
}

// Helper: batch-upsert centers into cat_education_centers
async function batchUpsertCenters(supabase, rows, batchSize = 300) {
  let imported = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from('cat_education_centers')
      .upsert(batch, { onConflict: 'codi_centre', ignoreDuplicates: false });
    if (error) { errors.push(error.message); } else { imported += batch.length; }
  }
  return { imported, errors };
}

// POST /api/centers/import/csv — import institutions from CSV text
app.post('/api/centers/import/csv', async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'DB not configured' });
  const { csvData, columnMap, region = 'Desconegut', pais = 'ES' } = req.body;
  if (!csvData || !columnMap?.name) return res.status(400).json({ error: 'csvData and columnMap.name required' });
  try {
    const records = csvParse(csvData, { columns: true, skip_empty_lines: true, relax_quotes: true, trim: true });
    const rows = [];
    for (const rec of records) {
      const name = rec[columnMap.name]?.trim();
      if (!name) continue;
      const email = columnMap.email ? rec[columnMap.email]?.trim()?.toLowerCase() : null;
      const codi = generateCodi(pais, email, name);
      rows.push({
        codi_centre: codi,
        denominacio_completa: name,
        nom_naturalesa: columnMap.type ? rec[columnMap.type]?.trim() : null,
        adreca: columnMap.address ? rec[columnMap.address]?.trim() : null,
        nom_municipi: columnMap.municipality ? rec[columnMap.municipality]?.trim() : null,
        telefon: columnMap.phone ? rec[columnMap.phone]?.trim() : null,
        email_centre: email || null,
        region, pais, source: 'csv_import',
      });
    }
    const { imported, errors } = await batchUpsertCenters(supabase, rows);
    console.log(`[Import CSV] ${imported}/${rows.length} centres importats de ${region}`);
    res.json({ imported, total: rows.length, skipped: rows.length - imported, errors });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/centers/import/pais-vasco — import from Euskadi open data
app.post('/api/centers/import/pais-vasco', async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'DB not configured' });
  try {
    const resp = await fetch('https://opendata.euskadi.eus/contenidos/ds_localizaciones/centros_docentes_no_universit/es_euskadi/adjuntos/dirgennouniv.csv');
    if (!resp.ok) throw new Error(`Euskadi API responded with ${resp.status}`);
    const text = await resp.text();
    const records = csvParse(text, { columns: true, delimiter: ';', skip_empty_lines: true, relax_quotes: true, trim: true });
    const rows = [];
    for (const rec of records) {
      const name = (rec['NOMBRE'] || rec['nombre'] || rec['Nombre'] || '').trim();
      if (!name) continue;
      const email = (rec['EMAIL'] || rec['email'] || rec['Email'] || '').trim().toLowerCase() || null;
      const codi = generateCodi('ES-PV', email, name);
      rows.push({
        codi_centre: codi,
        denominacio_completa: name,
        nom_naturalesa: rec['TIPO'] || rec['tipo'] || rec['Tipo'] || null,
        nom_municipi: rec['MUNICIPIO'] || rec['municipio'] || null,
        telefon: rec['TELEFONO'] || rec['telefono'] || null,
        email_centre: email || null,
        region: 'País Vasco', pais: 'ES-PV', source: 'euskadi_open_data',
      });
    }
    const { imported, errors } = await batchUpsertCenters(supabase, rows);
    console.log(`[Import PV] ${imported}/${rows.length} centres importats del País Vasco`);
    res.json({ imported, total: rows.length, errors });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/centers/import/navarra — import from Navarra open data
app.post('/api/centers/import/navarra', async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'DB not configured' });
  try {
    const resp = await fetch('https://datosabiertos.navarra.es/es/datastore/dump/39c2c8af-80b5-472a-b017-1ac196fafa59?format=csv&bom=True');
    if (!resp.ok) throw new Error(`Navarra API responded with ${resp.status}`);
    const text = await resp.text();
    const records = csvParse(text.replace(/^\uFEFF/, ''), { columns: true, skip_empty_lines: true, relax_quotes: true, trim: true });
    const rows = [];
    for (const rec of records) {
      const name = (rec['DENOMINACION'] || rec['denominacion'] || '').trim();
      if (!name) continue;
      const email = (rec['CORREO_ELECTRONICO'] || rec['correo_electronico'] || '').trim().toLowerCase() || null;
      const codi = generateCodi('ES-NC', email, name);
      rows.push({
        codi_centre: codi,
        denominacio_completa: name,
        nom_naturalesa: rec['TIPO_CENTRO'] || rec['tipo_centro'] || null,
        nom_municipi: rec['MUNICIPIO'] || rec['municipio'] || rec['LOCALIDAD'] || null,
        telefon: rec['TELEFONO'] || rec['telefono'] || null,
        email_centre: email || null,
        region: 'Navarra', pais: 'ES-NC', source: 'navarra_open_data',
      });
    }
    const { imported, errors } = await batchUpsertCenters(supabase, rows);
    console.log(`[Import NAV] ${imported}/${rows.length} centres importats de Navarra`);
    res.json({ imported, total: rows.length, errors });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/centers/import/madrid — import from Comunidad de Madrid open data
app.post('/api/centers/import/madrid', async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'DB not configured' });
  try {
    const resp = await fetch('https://datos.comunidad.madrid/catalogo/dataset/c750856d-3166-4dac-8e80-d1b824c968b5/resource/28d60557-1d73-4281-ab08-6cfd3b2f5f83/download/centros_educativos.csv');
    if (!resp.ok) throw new Error(`Madrid API responded with ${resp.status}`);
    const text = await resp.text();
    const records = csvParse(text.replace(/^\uFEFF/, ''), { columns: true, delimiter: ';', skip_empty_lines: true, relax_quotes: true, trim: true });
    const rows = [];
    for (const rec of records) {
      const name = Object.values(rec).find((v, i) => i === 0 && v?.trim()) || '';
      if (!name || typeof name !== 'string') continue;
      // Madrid CSV field names vary — try common patterns
      const keys = Object.keys(rec);
      const getField = (...patterns) => {
        const k = keys.find(k => patterns.some(p => k.toLowerCase().includes(p)));
        return k ? rec[k]?.trim() : null;
      };
      const email = getField('correo', 'email', 'mail')?.toLowerCase() || null;
      const codi = generateCodi('ES-MD', email, name.trim());
      rows.push({
        codi_centre: codi,
        denominacio_completa: name.trim(),
        nom_naturalesa: getField('tipo', 'tipo_centro', 'naturaleza') || null,
        nom_municipi: getField('municipio', 'localidad', 'ciudad') || null,
        adreca: getField('direccion', 'domicilio', 'calle') || null,
        email_centre: email || null,
        region: 'Madrid', pais: 'ES-MD', source: 'madrid_open_data',
      });
    }
    const { imported, errors } = await batchUpsertCenters(supabase, rows);
    console.log(`[Import MAD] ${imported}/${rows.length} centres importats de Madrid`);
    res.json({ imported, total: rows.length, errors });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/centers/import/valencia — import from Comunitat Valenciana open data
app.post('/api/centers/import/valencia', async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'DB not configured' });
  try {
    const resp = await fetch('https://dadesobertes.gva.es/dataset/68eb1d94-76d3-4305-8507-e1aab7717d0e/resource/1aa53c3a-4639-41aa-ac85-d58254c428c0/download/centros-docentes-de-la-comunitat-valenciana.csv');
    if (!resp.ok) throw new Error(`GVA API responded with ${resp.status}`);
    const text = await resp.text();
    // Try semicolon first, fallback to comma
    const delimiter = text.split('\n')[0].includes(';') ? ';' : ',';
    const records = csvParse(text.replace(/^\uFEFF/, ''), { columns: true, delimiter, skip_empty_lines: true, relax_quotes: true, trim: true });
    const rows = [];
    for (const rec of records) {
      const keys = Object.keys(rec);
      const getField = (...patterns) => {
        const k = keys.find(k => patterns.some(p => k.toLowerCase().includes(p)));
        return k ? (rec[k]?.trim() || null) : null;
      };
      const name = (getField('deno', 'nombre', 'nom', 'centro') || Object.values(rec)[0] || '').trim();
      if (!name) continue;
      const email = getField('correo', 'email', 'mail')?.toLowerCase() || null;
      const codi = generateCodi('ES-VC', email, name);
      rows.push({
        codi_centre: codi,
        denominacio_completa: name,
        nom_naturalesa: getField('tipo', 'tipologia', 'naturalesa') || null,
        nom_municipi: getField('municipio', 'municipi', 'localidad', 'localitat') || null,
        adreca: getField('direccion', 'domicilio', 'adresa', 'calle') || null,
        codi_postal: getField('postal', 'cp', 'cod_post') || null,
        telefon: getField('telefon', 'telefono') || null,
        email_centre: email || null,
        region: 'Comunitat Valenciana', pais: 'ES-VC', source: 'gva_open_data',
      });
    }
    const { imported, errors } = await batchUpsertCenters(supabase, rows);
    console.log(`[Import VC] ${imported}/${rows.length} centres importats de la Comunitat Valenciana`);
    res.json({ imported, total: rows.length, errors });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/centers/import/andalucia — import from Junta de Andalucía open data
app.post('/api/centers/import/andalucia', async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'DB not configured' });
  try {
    const resp = await fetch('https://gdc-pdpopendata-ckan.paas.junta-andalucia.es/datosabiertos/portal/dataset/e039df22-4b82-4d0d-9884-0ab5952e24e4/resource/b5924e81-0b53-4418-9d93-b1f39ba1ef65/download/da_centros.csv');
    if (!resp.ok) throw new Error(`Andalucía API responded with ${resp.status}`);
    const text = await resp.text();
    const delimiter = text.split('\n')[0].includes(';') ? ';' : ',';
    const records = csvParse(text.replace(/^\uFEFF/, ''), { columns: true, delimiter, skip_empty_lines: true, relax_quotes: true, trim: true });
    const rows = [];
    for (const rec of records) {
      const name = (rec['D_DENOMINA'] || rec['d_denomina'] || '').trim();
      if (!name) continue;
      const email = (rec['Correo_e'] || rec['correo_e'] || rec['CORREO_E'] || '').trim().toLowerCase() || null;
      const codi = generateCodi('ES-AN', email, name);
      rows.push({
        codi_centre: codi,
        denominacio_completa: name,
        nom_naturalesa: rec['D_TIPO'] || rec['d_tipo'] || null,
        nom_municipi: rec['D_MUNICIPIO'] || rec['D_LOCALIDAD'] || rec['d_municipio'] || null,
        adreca: rec['D_DOMICILIO'] || rec['d_domicilio'] || null,
        codi_postal: rec['C_POSTAL'] || rec['c_postal'] || null,
        telefon: rec['N_TELEFONO'] || rec['n_telefono'] || null,
        email_centre: email || null,
        region: 'Andalucía', pais: 'ES-AN', source: 'andalucia_open_data',
      });
    }
    const { imported, errors } = await batchUpsertCenters(supabase, rows);
    console.log(`[Import AN] ${imported}/${rows.length} centres importats d'Andalucía`);
    res.json({ imported, total: rows.length, errors });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
// Assets con hash (JS/CSS) → caché larga; index.html → siempre fresco
app.use(express.static(distDir, {
  setHeaders(res, filePath) {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
  }
}));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: "API Not Found" });
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, () => console.log(`Adeptify 2.0 on ${PORT}`));
