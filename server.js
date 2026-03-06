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

// -- Bulk email to education centers (from CenterMapExplorer) --
app.post('/api/centers/send-bulk-email', async (req, res) => {
  const { recipients, subject, body } = req.body;
  if (!Array.isArray(recipients) || !subject || !body) {
    return res.status(400).json({ error: 'Falten camps obligatoris' });
  }
  const host = process.env.SMTP_HOST;
  if (!host) return res.status(503).json({ error: 'SMTP no configurat' });

  const transporter = nodemailer.createTransport({
    host, port: Number(process.env.SMTP_PORT || 587), secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  // Generate Adeptify brochure PDF to attach to each email
  let brochureAttachment = null;
  try {
    const brochureBuf = await generateBrochurePdfBuffer();
    brochureAttachment = { filename: 'Adeptify_Serveis.pdf', content: brochureBuf.toString('base64'), encoding: 'base64' };
    console.log(`[BulkEmail] Brochure PDF generated: ${Math.round(brochureBuf.length / 1024)} KB`);
  } catch (e) {
    console.warn('[BulkEmail] Brochure PDF generation failed:', e.message);
  }

  let sent = 0;
  const errors = [];
  for (const r of recipients.slice(0, 200)) {
    try {
      const html = `<div style="font-family:sans-serif;">${body.replace(/\n/g, '<br>')}</div>`;
      const mailOpts = { from: process.env.SMTP_USER, to: r.email, subject, html };
      if (brochureAttachment) mailOpts.attachments = [brochureAttachment];
      await transporter.sendMail(mailOpts);
      sent++;
    } catch (e) {
      errors.push(`${r.email}: ${e.message}`);
    }
  }
  console.log(`[BulkEmail] Sent ${sent}/${recipients.length}, errors: ${errors.length}`);
  res.json({ sent, total: recipients.length, errors });
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
    }, { onConflict: 'tenant_slug,email' }).catch(() => {});

    await supabase.from('lead_interactions').insert({
      id: interactionId,
      lead_id: null,
      interaction_type: 'outreach_email',
      content_summary: emailContent.subject,
    }).catch(() => {});
  }

  const trackPixel = `<img src="https://consultor.adeptify.es/api/crm/track/${interactionId}.png" width="1" height="1"/>`;
  const html = `<div style="font-family:sans-serif;">${emailContent.html_body}${trackPixel}</div>`;

  const attachments = [];
  const safeName = centerName.replace(/[^a-zA-Z0-9àáèéíïòóúüçñ ]/g, '').replace(/\s+/g, '_');
  if (docxBase64) attachments.push({ filename: `Proposta_${safeName}.docx`, content: docxBase64, encoding: 'base64' });
  if (pdfBase64) attachments.push({ filename: `Proposta_${safeName}.pdf`, content: pdfBase64, encoding: 'base64' });

  await transporter.sendMail({
    from: process.env.SMTP_USER,
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
      }, { onConflict: 'job_id' }).catch(() => {});
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
