import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8080);
const STARTUP_TS = Date.now();

const app = express();

// Health
app.get('/healthz', (_req, res) => {
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
  };

  res.status(200).send(`// Generated at request time; do not commit.\nwindow.__ADEPTIFY_ENV__ = ${JSON.stringify(safeEnv)};\n`);
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
      headers[key] = v;
    }

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
