import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 2705);
const STARTUP_TS = Date.now();

const app = express();

// --- DB CLIENT (ADMIN) ---
let cachedSupabase = null;
const getSupabaseAdmin = () => {
  if (cachedSupabase) return cachedSupabase;
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Use service role for backend ops
  if (!url || !key) return null;
  cachedSupabase = createClient(url, key);
  return cachedSupabase;
};

const isValidEmail = (value) => {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v || v.length > 320) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
};

const sanitizeText = (value, maxLen) => {
  if (typeof value !== 'string') return '';
  const v = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!v) return '';
  return v.length > maxLen ? v.slice(0, maxLen) : v;
};

let cachedTransporter = null;
const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  const host = (process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
  const user = (process.env.SMTP_USER || '').trim();
  const pass = process.env.SMTP_PASS || '';

  if (!host) return null;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  });

  return cachedTransporter;
};

// Basic security headers (kept permissive enough for SPA + Supabase).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');

  // Helps prevent unexpected third-party scripts from executing.
  // Note: connect-src allows https/wss because Supabase/other APIs are runtime-configured.
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https: https://fonts.gstatic.com",
      "connect-src 'self' https: wss:",
      "worker-src 'self' blob:",
    ].join('; ')
  );

  next();
});

// Serve a real service worker script.
// This prevents legacy service workers (from older deployments) from persisting and breaking POST /api-proxy calls.
// The script unregisters itself on activation.
app.get('/service-worker.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  res.status(200).send(
    [
      "/* Adeptify service worker (disable legacy SW) */",
      "self.addEventListener('install', (event) => { self.skipWaiting(); });",
      "self.addEventListener('activate', (event) => {",
      "  event.waitUntil((async () => {",
      "    try { await self.registration.unregister(); } catch (e) {}",
      "    try {",
      "      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });",
      "      for (const client of clients) { client.navigate(client.url); }",
      "    } catch (e) {}",
      "  })());",
      "});",
    ].join('\n')
  );
});

// Health
app.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true });
});

// Some Google frontends may intercept /healthz; expose alternatives too.
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.get('/readyz', (_req, res) => {
  res.status(200).json({ ok: true });
});

// Runtime config for the browser (NO SECRETS).
// Keep this limited to values that are safe to expose client-side.
app.get('/env.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const safeEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
    SB_PUBLISHABLE_KEY: process.env.SB_PUBLISHABLE_KEY || process.env.VITE_SB_PUBLISHABLE_KEY || '',
    // Optional (non-secret): AI pricing for token cost accounting.
    AI_COST_EUR_PER_1M_INPUT: process.env.AI_COST_EUR_PER_1M_INPUT || process.env.VITE_AI_COST_EUR_PER_1M_INPUT || '',
    AI_COST_EUR_PER_1M_OUTPUT: process.env.AI_COST_EUR_PER_1M_OUTPUT || process.env.VITE_AI_COST_EUR_PER_1M_OUTPUT || '',
  };

  res.status(200).send(`// Generated at request time; do not commit.\nwindow.__ADEPTIFY_ENV__ = ${JSON.stringify(safeEnv)};\n`);
});

// Contact form email (server-side) - sends an email via SMTP.
// Configure with:
// - SMTP_HOST, SMTP_PORT, SMTP_SECURE (true/false), SMTP_USER, SMTP_PASS
// - CONTACT_TO (recipient), CONTACT_FROM (from email), CONTACT_FROM_NAME
app.post('/api/contact', express.json({ limit: '200kb' }), async (req, res) => {
  const contactId = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    const transporter = getTransporter();
    if (!transporter) {
      console.warn(`[contact:${contactId}] email service not configured`);
      res.status(503).json({ error: { message: 'Email service not configured' } });
      return;
    }

    const name = sanitizeText(req.body?.name, 120);
    const email = sanitizeText(req.body?.email, 320);
    const message = sanitizeText(req.body?.message, 4000);
    const page = sanitizeText(req.body?.page, 500);
    const lang = sanitizeText(req.body?.lang, 10);

    if (!name || !email || !message) {
      console.info(`[contact:${contactId}] invalid request: missing required fields`);
      res.status(400).json({ error: { message: 'Missing required fields' } });
      return;
    }
    if (!isValidEmail(email)) {
      console.info(`[contact:${contactId}] invalid request: invalid email format`);
      res.status(400).json({ error: { message: 'Invalid email' } });
      return;
    }

    const to = (process.env.CONTACT_TO || process.env.ADEPTIFY_CONTACT_EMAIL || 'bandujar@edutac.es').trim();
    const fromEmail = (process.env.CONTACT_FROM || process.env.SMTP_USER || '').trim();
    const fromName = sanitizeText(process.env.CONTACT_FROM_NAME || 'Adeptify Consultor', 120);
    if (!to) {
      console.warn(`[contact:${contactId}] recipient email not configured`);
      res.status(503).json({ error: { message: 'Recipient email not configured' } });
      return;
    }
    if (!fromEmail || !isValidEmail(fromEmail)) {
      console.warn(`[contact:${contactId}] sender email not configured`);
      res.status(503).json({ error: { message: 'Sender email not configured' } });
      return;
    }

    const emailDomain = String(email).split('@')[1] || '';
    console.info(
      `[contact:${contactId}] received: lang=${lang || '-'} page=${page || '-'} emailDomain=${emailDomain || '-'} nameLen=${name.length} msgLen=${message.length}`
    );

    const subject = `Nuevo contacto web: ${name}`;
    const text =
      `Nuevo mensaje desde /consultor\n\n` +
      `Nombre: ${name}\n` +
      `Email: ${email}\n` +
      (lang ? `Idioma: ${lang}\n` : '') +
      (page ? `Página: ${page}\n` : '') +
      `\nMensaje:\n${message}\n`;

    const info = await transporter.sendMail({
      to,
      from: { name: fromName, address: fromEmail },
      replyTo: email,
      subject,
      text,
    });

    console.info(
      `[contact:${contactId}] sent: messageId=${info?.messageId || '-'} durationMs=${Date.now() - startedAt}`
    );

    res.status(200).json({ ok: true, id: contactId });
  } catch (e) {
    console.error(`[contact:${contactId}] failed: durationMs=${Date.now() - startedAt}`, e);
    res.status(502).json({ error: { message: 'Email send failed' } });
  }
});

const readRawBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
};

const hopByHopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

// Server-side Gemini proxy.
// Browser calls /api-proxy/v1beta/... and this service injects the real API key.
app.all('/api-proxy/*', async (req, res) => {
  try {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      res.status(503).json({ error: { message: 'Gemini API key not configured' } });
      return;
    }

    const targetPath = req.originalUrl.replace(/^\/api-proxy/, '');
    const upstream = new URL(`https://generativelanguage.googleapis.com${targetPath}`);
    upstream.searchParams.set('key', apiKey);

    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (!v) continue;
      const key = k.toLowerCase();
      if (hopByHopHeaders.has(key)) continue;
      if (key === 'host') continue;
      // Prevent upstream compression to avoid Content-Encoding/body mismatches.
      if (key === 'accept-encoding') continue;
      headers[key] = v;
    }

    // Explicitly request an uncompressed upstream response.
    headers['accept-encoding'] = 'identity';

    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readRawBody(req);

    const upstreamResp = await fetch(upstream.toString(), {
      method: req.method,
      headers,
      body,
    });

    res.status(upstreamResp.status);
    upstreamResp.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      if (hopByHopHeaders.has(k)) return;
      // Prevent caching of model responses.
      if (k === 'cache-control') return;
      // Avoid browser decode errors if the body/length doesn't match upstream headers.
      if (k === 'content-encoding') return;
      if (k === 'content-length') return;
      res.setHeader(key, value);
    });
    res.setHeader('Cache-Control', 'no-store');

    const buf = Buffer.from(await upstreamResp.arrayBuffer());
    res.send(buf);
  } catch (e) {
    console.error('api-proxy error:', e);
    res.status(502).json({ error: { message: 'Upstream proxy error' } });
  }
});

// --- LEAD MANAGEMENT & AI AUTOMATION ---

// Analyze lead needs using Gemini
app.post('/api/leads/analyze', express.json(), async (req, res) => {
  const { leadId, tenantSlug, companyInfo, previousInteractions } = req.body;
  
  if (!tenantSlug || !companyInfo) {
    return res.status(400).json({ error: 'Missing required lead info' });
  }

  try {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    const model = "gemini-1.5-flash"; // Fixed to a valid API model ID
    
    const prompt = `
      Analiza el siguiente perfil de cliente potencial para Adeptify (Consultoría Educativa y Tecnológica).
      Empresa/Centro: ${companyInfo.name}
      Contexto adicional: ${companyInfo.description || 'N/A'}
      Interacciones previas: ${JSON.stringify(previousInteractions || [])}
      
      Responde en formato JSON con la siguiente estructura:
      {
        "needs_detected": ["lista de necesidades"],
        "pain_points": ["puntos de dolor"],
        "recommended_services": ["servicios sugeridos"],
        "estimated_budget_range": "rango sugerido en EUR",
        "custom_pitch": "Un párrafo corto de venta personalizado"
      }
    `;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();
    const analysis = JSON.parse(data.candidates[0].content.parts[0].text);

    // Save to Supabase if leadId is provided
    const supabase = getSupabaseAdmin();
    if (supabase && leadId) {
      await supabase.from('leads').update({
        ai_needs_analysis: analysis,
        status: 'qualified'
      }).eq('id', leadId).eq('tenant_slug', tenantSlug);
      
      await supabase.from('lead_interactions').insert({
        lead_id: leadId,
        interaction_type: 'ai_analysis',
        content_summary: 'Análisis de necesidades generado por Gemini',
        payload_json: analysis
      });
    }

    res.status(200).json(analysis);
  } catch (e) {
    console.error('Lead analysis failed:', e);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// --- CRM & TRACKING SYSTEM ---

// Email Tracking Pixel
app.get('/api/crm/track/:interactionId.png', async (req, res) => {
  const { interactionId } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      // 1. Mark interaction as opened
      await supabase.from('lead_interactions').update({
        metadata_json: { opened_at: new Date().toISOString(), ...req.headers }
      }).eq('id', interactionId);

      // 2. Increment lead open count
      const { data: inter } = await supabase.from('lead_interactions').select('lead_id').eq('id', interactionId).single();
      if (inter?.lead_id) {
        await supabase.rpc('increment_lead_opens', { row_id: inter.lead_id });
      }
    }
  } catch (e) {
    console.error('Tracking error:', e);
  }

  // Return 1x1 transparent pixel
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': pixel.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
  });
  res.end(pixel);
});

// Send personalized proposal email with tracking
app.post('/api/leads/send-proposal', express.json({ limit: '5mb' }), async (req, res) => {
  const { leadId, email, subject, body, pdfBase64, proposalData } = req.body;

  if (!email || !body) {
    return res.status(400).json({ error: 'Missing recipient or body' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const transporter = getTransporter();
    if (!transporter) throw new Error('Email service not configured');

    // 1. Create tracking interaction
    let interactionId = crypto.randomUUID();
    if (supabase && leadId) {
      const { data } = await supabase.from('lead_interactions').insert({
        id: interactionId,
        lead_id: leadId,
        interaction_type: 'proposal_sent',
        content_summary: subject,
        payload_json: proposalData,
        user_agent: req.headers['user-agent']
      }).select().single();
      if (data) interactionId = data.id;
    }

    const fromEmail = (process.env.CONTACT_FROM || process.env.SMTP_USER || '').trim();
    const fromName = (process.env.CONTACT_FROM_NAME || 'Adeptify Proposals').trim();
    const domain = req.headers.origin || req.headers.host || 'http://localhost:2705';
    const trackingPixel = `<img src="${domain}/api/crm/track/${interactionId}.png" width="1" height="1" style="display:none" />`;

    const mailOptions = {
      from: { name: fromName, address: fromEmail },
      to: email,
      subject: subject || 'Propuesta Personalizada - Adeptify',
      html: `
        <div style="font-family: sans-serif; color: #1e293b;">
          ${body.replace(/\n/g, '<br>')}
          <br><br>
          ${trackingPixel}
        </div>
      `,
      attachments: pdfBase64 ? [
        {
          filename: `Proposta_Adeptify_${new Date().getFullYear()}.pdf`,
          content: pdfBase64,
          encoding: 'base64'
        }
      ] : []
    };

    await transporter.sendMail(mailOptions);

    if (supabase && leadId) {
      await supabase.from('leads').update({ 
        status: 'proposal_sent',
        last_contacted_at: new Date().toISOString()
      }).eq('id', leadId);
    }

    res.status(200).json({ ok: true, interactionId });
  } catch (e) {
    console.error('Failed to send proposal:', e);
    res.status(500).json({ error: 'Email delivery failed' });
  }
});

// Get Audit data by Magic Link Token
app.get('/api/leads/audit/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ error: 'DB not configured' });

    const { data, error } = await supabase
      .from('leads')
      .select('company_name, ai_needs_analysis, created_at')
      .eq('magic_link_token', token)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Audit not found' });
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Automated Search & Scrape (Prospecting Motor)
app.post('/api/automation/capture', express.json(), async (req, res) => {
  const { url, tenantSlug } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    console.info(`[automation] Scraping URL: ${url}`);
    
    // 1. Fetch with internal timeout (15s) to prevent 504 proxy errors
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': 'https://www.google.com/'
        },
        signal: controller.signal,
        redirect: 'follow'
      });
    } catch (e) {
      if (e.name === 'AbortError') {
        console.warn('[automation] Scraping timed out for:', url);
        // Fallback: try to at least analyze the domain/URL if fetch fails
        response = { ok: false, status: 408 };
      } else {
        throw e;
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response || !response.ok) {
      // Logic if fetch fails: return partial data or inferred info
      return res.status(200).json({ 
        company_name: url.split('/')[2].replace('www.', ''), 
        contact_email: null,
        recommended_solution: "Hem detectat dificultats en la connexió amb la vostra web, però podem ajudar-vos a optimitzar el vostre entorn digital.",
        custom_pitch: "Anàlisi basada en domini: El vostre centre necessita una infraestructura digital resilient.",
        detected_needs: ["Millora de visibilitat digital", "Seguretat de xarxa"],
        is_relevant: true
      });
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    // 2. Extract specific data points (including hidden metadata)
    const mailtoLinks = [];
    $('a[href^="mailto:"]').each((i, el) => {
      try {
        const email = $(el).attr('href').replace('mailto:', '').split('?')[0].trim();
        if (email.includes('@')) mailtoLinks.push(email);
      } catch (e) {}
    });

    // Check OpenGraph and Meta
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogDesc = $('meta[property="og:description"]').attr('content');
    const title = ogTitle || $('title').text();
    const metaDesc = ogDesc || $('meta[name="description"]').attr('content') || '';
    
    // Deeper email search in text via Regex
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const bodyRaw = $('body').html() || '';
    const foundEmails = bodyRaw.match(emailRegex) || [];
    const allEmails = [...new Set([...mailtoLinks, ...foundEmails])];

    // Remove unwanted tags
    $('script, style, nav, footer, iframe, noscript').remove();
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    
    const pageContent = `URL: ${url}\nTITULO: ${title}\nDESCRIPCION: ${metaDesc}\nEMAILS: ${allEmails.join(', ')}\nCONTENIDO: ${bodyText}`.substring(0, 15000);

    if (pageContent.length < 100) {
      return res.status(422).json({ error: 'Contenido insuficiente extraído de la web' });
    }

    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    const prompt = `
      Actúa como un experto en auditoría de eficiencia y ventas B2B. 
      Analiza el siguiente texto extraído de un sitio web de un centro educativo.
      
      IMPORTANTE (IDIOMA): 
      - Responde siempre en el idioma predominante del texto analizado (Català, Castellano o Euskera).
      - Si el texto está en català, el pitch y detected_needs deben estar en català.
      
      CONTENIDO DE LA WEB:
      ${pageContent}
      
      TU OBJETIVO:
      1. Identifica el Nombre de la Institución (busca en el título o cabeceras).
      2. Busca un email de contacto real (terminado en @xtec.cat, @gencat.cat o propio del centro).
      3. Analiza el contenido para detectar 3 problemas o faltas de digitalización (ej: avisos antiguos, falta de gestiones online, procesos manuales).
      
      RESPONDE ÚNICAMENTE EN JSON:
      {
        "company_name": "Nombre oficial del centro",
        "contact_email": "Email encontrado o null",
        "detected_needs": ["problema 1", "problema 2", "problema 3"],
        "recommended_services": ["solución 1", "solución 2", "solución 3"],
        "main_bottleneck": "El principal problema de gestión detectado",
        "estimated_hours_lost_per_week": 25,
        "estimated_budget_range": "Rango de inversión sugerido (ej: 5.000€ - 8.000€)",
        "economic_profile": {
          "institution_type": "public | private",
          "economic_tier": "low | medium | high"
        },
        "custom_pitch": "Un párrafo de consultoría senior muy profesional y persuasivo",
        "recommended_solution": "Breve resumen de la solución técnica",
        "is_relevant": true
      }
    `;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`;
    const geminiResp = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const geminiData = await geminiResp.json();
    
    if (geminiData.error) {
      console.error('[gemini-error]', geminiData.error);
      throw new Error(`AI API Error: ${geminiData.error.message}`);
    }

    const analysis = JSON.parse(geminiData.candidates[0].content.parts[0].text);
    // ... resto de la lógica de guardado ...

    // --- IMPROVEMENT #6: AI Video Script Generation ---
    const videoScriptPrompt = `
      Escribe un guion de 30 segundos para un avatar de vídeo de IA que se presentará a ${analysis.company_name}.
      El tono debe ser profesional, innovador y directo.
      Menciona específicamente el problema: "${analysis.main_bottleneck}".
      Termina invitándoles a ver su auditoría interactiva.
      Responde solo con el texto del guion.
    `;
    const videoScriptResp = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: videoScriptPrompt }] }] })
    });
    const videoData = await videoScriptResp.json();
    const videoScript = videoData.candidates[0].content.parts[0].text;
    
    analysis.video_script = videoScript;
    // --------------------------------------------------

    let automatedAction = "Análisis guardado. No se encontró email.";

    if (analysis.is_relevant && analysis.contact_email) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const magicToken = crypto.randomUUID();
        
        const { data: lead, error } = await supabase.from('leads').upsert({
          tenant_slug: tenantSlug || 'default',
          email: analysis.contact_email,
          full_name: analysis.company_name,
          company_name: analysis.company_name,
          source: 'automated_scrape',
          status: 'audit_sent',
          ai_needs_analysis: analysis,
          metadata_json: { original_url: url },
          magic_link_token: magicToken,
          audit_email_sent: true
        }, { onConflict: 'tenant_slug,email' }).select().single();

        if (!error && lead) {
           await supabase.from('lead_interactions').insert({
             lead_id: lead.id,
             interaction_type: 'automated_capture',
             content_summary: `Capturado automáticamente y enviada auditoría fantasma`
           });

           // AUTONOMOUS ZERO-TOUCH: Send the email immediately
           const transporter = getTransporter();
           if (transporter) {
              const fromEmail = (process.env.CONTACT_FROM || process.env.SMTP_USER || '').trim();
              const fromName = (process.env.CONTACT_FROM_NAME || 'Adeptify Consultoría').trim();
              
              // Ensure the link works regardless of deployment environment
              const domain = req.headers.origin || req.headers.host || 'http://localhost:2705';
              const protocol = domain.startsWith('http') ? '' : (req.secure ? 'https://' : 'http://');
              const magicLink = `${protocol}${domain}/audit/${magicToken}`;

              const htmlBody = `
                <div style="font-family: sans-serif; color: #1e293b; max-width: 600px;">
                  <h2 style="color: #4f46e5;">Auditoría Preliminar: ${analysis.company_name}</h2>
                  <p>Hola equipo de <strong>${analysis.company_name}</strong>,</p>
                  <p>Hemos analizado vuestro ecosistema digital y detectado una fuga de aproximadamente <strong>${analysis.estimated_hours_lost_per_week || 20} horas semanales</strong> en tareas operativas.</p>
                  
                  <div style="margin: 30px 0; text-align: center;">
                    <a href="${magicLink}" style="text-decoration: none;">
                      <div style="background: #111827; border-radius: 16px; padding: 40px; color: white; position: relative;">
                        <div style="font-size: 48px; margin-bottom: 10px;">👤▶️</div>
                        <div style="font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 2px; color: #818cf8;">Mensaje de Vídeo Personalizado</div>
                        <p style="font-size: 14px; color: #9ca3af; margin-top: 8px;">Haz clic para reproducir el análisis de vuestro centro</p>
                      </div>
                    </a>
                  </div>

                  <p>Hemos preparado un <strong>Simulador de ROI</strong> exclusivo para vosotros donde podéis ver el ahorro neto real mensual.</p>
                  <p><a href="${magicLink}" style="color: #4f46e5; font-weight: bold;">👉 Acceder al Informe Interactivo Completo</a></p>
                  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                  <p style="font-size: 12px; color: #64748b;">Enviado de forma segura por el motor de IA de Adeptify Consultoría.</p>
                </div>
              `;

              await transporter.sendMail({
                from: { name: fromName, address: fromEmail },
                to: analysis.contact_email,
                subject: `Mensaje Urgente: Auditoría de Eficiencia para ${analysis.company_name}`,
                text: `Hola equipo de ${analysis.company_name},\n\nHemos detectado que podríais ahorrar ${analysis.estimated_hours_lost_per_week || 20} horas semanales. Hemos generado un vídeo y una auditoría interactiva para vosotros aquí: ${magicLink}`,
                html: htmlBody
              });
              automatedAction = `Auditoría con Gancho de Vídeo enviada a ${analysis.contact_email}`;
           }
        }
      }
    }

    res.status(200).json({ ...analysis, status: automatedAction });
  } catch (e) {
    console.error('Automated capture failed:', e);
    res.status(500).json({ error: 'Scraping/Analysis failed' });
  }
});

// --- IMPROVEMENT #2: Omnichannel Nurturing Agent ---

app.post('/api/automation/chat-nurture', express.json(), async (req, res) => {
  const { leadId, message, channel } = req.body;
  if (!leadId || !message) return res.status(400).json({ error: 'LeadID and Message required' });

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error('DB Error');

    // 1. Get Lead context and history
    const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single();
    const { data: history } = await supabase.from('lead_messages')
      .select('role, content')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(6);

    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // 2. Prepare AI Prompt with Context
    const conversationHistory = (history || []).reverse()
      .map(m => `${m.role === 'assistant' ? 'Adeptify' : 'Cliente'}: ${m.content}`)
      .join('\n');

    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    const prompt = `
      Eres el Agente de Maduración de Adeptify. Tu objetivo es convertir a un lead en una reunión de venta.
      
      DATOS DEL CLIENTE:
      - Empresa: ${lead.company_name}
      - Problema detectado: ${lead.ai_needs_analysis?.main_bottleneck}
      - Perfil económico: ${lead.ai_needs_analysis?.economic_profile?.economic_tier}
      - Fase actual: ${lead.nurturing_stage}
      
      HISTORIAL DE CONVERSACIÓN:
      ${conversationHistory}
      
      MENSAJE ENTRANTE DEL CLIENTE:
      "${message}"
      
      INSTRUCCIONES:
      - Responde de forma humana, empática y profesional.
      - No seas un bot aburrido. Usa el tono de un consultor experto.
      - Si el cliente tiene dudas sobre el ROI, recuérdale los datos de su auditoría interactiva.
      - Si parece listo, sugiere cerrar una breve llamada de 15 min.
      
      RESPONDE EN JSON:
      {
        "reply": "Texto de tu respuesta",
        "next_stage_suggested": "initial_contact | engaged | objection_handling | ready_for_meeting",
        "internal_note": "Breve nota sobre el estado de ánimo del cliente"
      }
    `;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`;
    const geminiResp = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await geminiResp.json();
    const aiResult = JSON.parse(data.candidates[0].content.parts[0].text);

    // 3. Save messages and update stage
    await supabase.from('lead_messages').insert([
      { lead_id: leadId, channel: channel || 'whatsapp', role: 'user', content: message },
      { lead_id: leadId, channel: channel || 'whatsapp', role: 'assistant', content: aiResult.reply }
    ]);

    if (aiResult.next_stage_suggested) {
      await supabase.from('leads').update({ nurturing_stage: aiResult.next_stage_suggested }).eq('id', leadId);
    }

    res.status(200).json(aiResult);
  } catch (e) {
    console.error('Nurturing agent failed:', e);
    res.status(500).json({ error: 'Agent failed' });
  }
});

// --- IMPROVEMENT #9: Autonomous Data Migration ---

app.post('/api/automation/migrate-data', express.json({ limit: '2mb' }), async (req, res) => {
  const { rawData, tenantSlug, centerKey } = req.body;
  if (!rawData) return res.status(400).json({ error: 'No data provided' });

  try {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    const prompt = `
      Actúa como un experto en migración de datos educativos. 
      A continuación te paso datos brutos extraídos de un archivo de un colegio (puede ser CSV, texto o Excel desordenado).
      
      DATOS BRUTOS:
      ${rawData}
      
      TU OBJETIVO:
      1. Identifica a las personas (profesores/personal).
      2. Identifica sus roles o asignaturas si aparecen.
      3. Limpia los nombres y formatos.
      
      RESPONDE ÚNICAMENTE EN JSON CON ESTA ESTRUCTURA:
      {
        "mapped_staff": [
          { "full_name": "Nombre completo", "email": "email o null", "department": "departamento o asignatura" }
        ],
        "confidence_score": 0-100,
        "migration_summary": "Breve resumen de lo que has encontrado"
      }
    `;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`;
    const geminiResp = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await geminiResp.json();
    const migration = JSON.parse(data.candidates[0].content.parts[0].text);

    // Save to Supabase (Optional for now, we'll return it for confirmation)
    res.status(200).json(migration);
  } catch (e) {
    console.error('Migration failed:', e);
    res.status(500).json({ error: 'AI Migration failed' });
  }
});

// --- IMPROVEMENT #10: Digital Twin (Predictive Engine) ---

app.post('/api/automation/digital-twin', express.json(), async (req, res) => {
  const { tenantSlug, context } = req.body;
  if (!tenantSlug) return res.status(400).json({ error: 'Tenant is required' });

  try {
    const currentMonth = new Date().toLocaleString('es-ES', { month: 'long' });
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    
    const prompt = `
      Eres el motor de IA predictiva de un "Digital Twin" educativo (Gemelo Digital).
      Tu objetivo es prever problemas en un centro escolar ANTES de que ocurran, basándote en la estacionalidad y el volumen de trabajo.
      
      CONTEXTO DEL CENTRO:
      - Mes actual: ${currentMonth}
      - Datos operativos conocidos: ${JSON.stringify(context || { staff: 50, avg_absences: 2 })}
      
      INSTRUCCIONES:
      Genera 2 alertas predictivas de fricción operativa altamente probables para este mes (ej. Evaluaciones, estrés del profesorado, matriculaciones, claustros largos).
      Para cada alerta, propone un "Protocolo Automático" que Adeptify podría activar hoy para evitar el problema.
      
      RESPONDE ÚNICAMENTE EN JSON CON ESTA ESTRUCTURA:
      {
        "stress_level": 0-100,
        "critical_department": "Ej: Secundaria, Secretaría, Dirección",
        "predictions": [
          {
            "risk_title": "Nombre del riesgo",
            "probability": "Alta/Media",
            "description": "Por qué va a pasar esto",
            "suggested_action": "Acción a activar en 1 clic",
            "time_to_impact": "En X días/semanas"
          }
        ]
      }
    `;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`;
    const geminiResp = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await geminiResp.json();
    const prediction = JSON.parse(data.candidates[0].content.parts[0].text);

    res.status(200).json(prediction);
  } catch (e) {
    console.error('Digital Twin analysis failed:', e);
    res.status(500).json({ error: 'Digital Twin failed' });
  }
});

// --- IMPROVEMENT #5: Predictive Churn & Upsell ---

app.post('/api/automation/usage-analysis', express.json(), async (req, res) => {
  const { tenantSlug, usageMetrics } = req.body;
  if (!tenantSlug) return res.status(400).json({ error: 'Tenant is required' });

  try {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    const prompt = `
      Actúa como un experto en Customer Success para SaaS educativo.
      Analiza los siguientes datos de uso de un centro escolar y predice su estado.
      
      MÉTRICAS:
      ${JSON.stringify(usageMetrics || { last_login_days: 5, docs_generated: 150, active_users: 12 })}
      
      INSTRUCCIONES:
      1. Determina la probabilidad de abandono (Churn Risk).
      2. Identifica si es el momento de ofrecerle un módulo superior (Upsell Opportunity).
      3. Escribe un asunto y cuerpo de email breve y persuasivo para este caso.
      
      RESPONDE EN JSON:
      {
        "health_score": 0-100,
        "status": "Healthy | At Risk | Upsell Target",
        "analysis_summary": "Explicación breve",
        "automated_email": {
          "send_now": true/false,
          "subject": "Asunto",
          "body": "Cuerpo del mensaje"
        }
      }
    `;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`;
    const geminiResp = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await geminiResp.json();
    const result = JSON.parse(data.candidates[0].content.parts[0].text);

    // If upsell target, we could send the email here automatically
    if (result.automated_email.send_now && usageMetrics.contact_email) {
       const transporter = getTransporter();
       if (transporter) {
          const fromEmail = (process.env.CONTACT_FROM || process.env.SMTP_USER || '').trim();
          await transporter.sendMail({
            from: { name: 'Adeptify Premium', address: fromEmail },
            to: usageMetrics.contact_email,
            subject: result.automated_email.subject,
            text: result.automated_email.body
          });
       }
    }

    res.status(200).json(result);
  } catch (e) {
    console.error('Usage analysis failed:', e);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// --- IMPROVEMENT #7: Network Graph Prospecting (Expansion) ---

app.post('/api/automation/network-prospecting', express.json(), async (req, res) => {
  const { referenceCenterName, location } = req.body;
  if (!referenceCenterName) return res.status(400).json({ error: 'Reference center is required' });

  try {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    const prompt = `
      Actúa como un estratega de expansión comercial para Adeptify.
      Acabamos de implementar con éxito nuestra IA en el centro: "${referenceCenterName}" ubicado en ${location || 'la zona'}.
      
      TU OBJETIVO:
      1. Simula la búsqueda de 3 centros educativos cercanos o similares en la misma zona.
      2. Crea un pitch de "Prueba Social por Proximidad". El mensaje debe decir algo como: "Vuestros vecinos de ${referenceCenterName} ya han automatizado X, ¿queréis ver cómo lo hemos hecho?".
      
      RESPONDE EN JSON:
      {
        "reference_success": "${referenceCenterName}",
        "expansion_nodes": [
          {
            "target_name": "Nombre del centro vecino 1",
            "reason_for_similarity": "Ej: Ambos son institutos técnicos de gran tamaño",
            "custom_referral_pitch": "Texto del mensaje de contacto mencionando el éxito cercano"
          },
          {
            "target_name": "Nombre del centro vecino 2",
            "reason_for_similarity": "Ej: Comparten el mismo clúster educativo",
            "custom_referral_pitch": "Texto del mensaje"
          }
        ],
        "strategy_note": "Por qué esta zona es prioritaria ahora"
      }
    `;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`;
    const geminiResp = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await geminiResp.json();
    const expansion = JSON.parse(data.candidates[0].content.parts[0].text);

    res.status(200).json(expansion);
  } catch (e) {
    console.error('Network prospecting failed:', e);
    res.status(500).json({ error: 'Expansion analysis failed' });
  }
});

// Static SPA
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir, {
  index: false,
  immutable: true,
  maxAge: '365d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  },
}));

app.get('*', (req, res) => {
  // SPA fallback (no-store) + cache-bust env.js reference
  res.setHeader('Cache-Control', 'no-store');
  fs.readFile(path.join(distDir, 'index.html'), 'utf8')
    .then((html) => {
      const withBuster = html
        .replace(/\"\/env\.js\"/g, `\"/env.js?v=${STARTUP_TS}\"`)
        .replace(/\'\/env\.js\'/g, `\'/env.js?v=${STARTUP_TS}\'`);
      res.status(200).send(withBuster);
    })
    .catch(() => res.sendFile(path.join(distDir, 'index.html')));
});

// --- LEGACY API PROXY / COMPATIBILITY ---
// Ensure calls to /api/v1/documents... don't 404 if frontend uses relative paths
app.all('/api/v1/*', async (req, res) => {
  // If we want to proxy these to the old system or handle them locally:
  // For now, we handle them as a 200 empty to avoid frontend crashes, 
  // but ideally, we should point this to the correct microservice or local logic.
  res.status(200).json([]); 
});

app.listen(PORT, () => {
  console.log(`Adeptify server listening on :${PORT}`);
});
