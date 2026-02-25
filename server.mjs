import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 2705);
const STARTUP_TS = Date.now();

const app = express();

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

app.listen(PORT, () => {
  console.log(`Adeptify server listening on :${PORT}`);
});
