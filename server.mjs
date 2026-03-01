
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { 
  Document, Packer, Paragraph, TextRun, HeadingLevel, 
  AlignmentType, Table, TableRow, TableCell, WidthType, 
  ShadingType, PageBreak, Header, Footer, PageNumber, 
  TableOfContents
} from "docx";

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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  cachedSupabase = createClient(url, key);
  return cachedSupabase;
};

// --- WORD GENERATOR SERVICE (INTEGRATED) ---
const COLORS = {
  PRIMARY: "1B3A5C",
  SECONDARY: "2E75B6",
  ACCENT: "4A90D9",
  DARK: "1A1A1A",
  LIGHT_BG: "E8F0FE",
  BORDER: "B0C4DE"
};

class WordProposalGenerator {
  async generate(data) {
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
              border: { bottom: { color: COLORS.SECONDARY, size: 6, style: "single", space: 1 } }
            }
          }
        ]
      },
      sections: [{
        properties: { page: { size: { width: 12240, height: 15840 } } },
        headers: {
          default: new Header({
            children: [new Paragraph({
              border: { bottom: { color: COLORS.SECONDARY, size: 6, style: "single" } },
              children: [
                new TextRun({ text: "ADEPTIFY SYSTEMS | CONSULTORIA DIGITAL", bold: true, color: COLORS.PRIMARY, size: 16 }),
                new TextRun({ text: "\t\tProposta Estratègica", italics: true, color: "666666", size: 16 })
              ]
            })]
          })
        },
        children: [
          new Paragraph({ spacing: { before: 2400 }, alignment: AlignmentType.CENTER, children: [
            new TextRun({ text: "ADEPTIFY SYSTEMS", bold: true, size: 56, color: COLORS.PRIMARY })
          ]}),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [
            new TextRun({ text: (data.proyecto?.titulo || "PROPOSTA ESTRATÈGICA").toUpperCase(), bold: true, size: 28, color: COLORS.SECONDARY })
          ]}),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. RESUM EXECUTIU")] }),
          new Paragraph({ children: [new TextRun(data.proyecto?.resumen || "[Pendent]")] }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("7. PROPUESTA ECONÒMICA")] }),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            rows: [
              new TableRow({ children: [
                new TableCell({ shading: { fill: COLORS.PRIMARY }, children: [new Paragraph({ children: [new TextRun({ text: "CONCEPTE", color: "FFFFFF", bold: true })] })] }),
                new TableCell({ shading: { fill: COLORS.PRIMARY }, children: [new Paragraph({ children: [new TextRun({ text: "IMPORT", color: "FFFFFF", bold: true })] })] })
              ]}),
              ...(data.economia?.conceptos || []).map((c, i) => new TableRow({
                children: [
                  new TableCell({ shading: { fill: i % 2 === 0 ? "FFFFFF" : COLORS.LIGHT_BG }, children: [new Paragraph({ text: c.concepto })] }),
                  new TableCell({ shading: { fill: i % 2 === 0 ? "FFFFFF" : COLORS.LIGHT_BG }, children: [new Paragraph({ text: c.importe })] })
                ]
              }))
            ]
          }),
          new Paragraph({ children: [new PageBreak()] }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("12. PRÒXIMS PASSOS I ACCEPTACIÓ")] }),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            rows: [
              new TableRow({ children: [
                new TableCell({ children: [new Paragraph({ spacing: { before: 1200 }, children: [new TextRun({ text: "Per Adeptify Systems SLU", bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ spacing: { before: 1200 }, children: [new TextRun({ text: `Per ${data.cliente?.nombre || 'Client'}`, bold: true })] })] })
              ]})
            ]
          })
        ]
      }]
    });
    return await Packer.toBuffer(doc);
  }
}

// --- APP LOGIC ---

const getTransporter = () => {
  const host = (process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
  const user = (process.env.SMTP_USER || '').trim();
  const pass = process.env.SMTP_PASS || '';
  if (!host) return null;
  return nodemailer.createTransport({ host, port, secure, auth: user ? { user, pass } : undefined });
};

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.get('/healthz', (req, res) => res.status(200).json({ ok: true }));

// Server-side Gemini proxy
app.all('/api-proxy/*', async (req, res) => {
  try {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    const targetPath = req.originalUrl.replace(/^\/api-proxy/, '');
    const upstream = new URL(`https://generativelanguage.googleapis.com${targetPath}`);
    upstream.searchParams.set('key', apiKey);
    const upstreamResp = await fetch(upstream.toString(), { method: req.method, body: req.method !== 'GET' ? req.body : undefined });
    const buf = Buffer.from(await upstreamResp.arrayBuffer());
    res.send(buf);
  } catch (e) { res.status(502).json({ error: 'Proxy error' }); }
});

// Capture & Scrape
app.post('/api/automation/capture', express.json(), async (req, res) => {
  const { url } = req.body;
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await response.text();
    const $ = cheerio.load(html);
    const pageContent = $('body').text().replace(/\s+/g, ' ').substring(0, 10000);
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    const prompt = `Analitza aquesta web escolar i retorna JSON amb company_name, contact_email, detected_needs, custom_pitch, estimated_budget_range. TEXT: ${pageContent}`;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`;
    const geminiResp = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
    });
    const geminiData = await geminiResp.json();
    res.status(200).json(JSON.parse(geminiData.candidates[0].content.parts[0].text));
  } catch (e) { res.status(500).json({ error: 'Scrape failed' }); }
});

// DOCX Generation
app.post('/api/automation/generate-docx', express.json(), async (req, res) => {
  try {
    const generator = new WordProposalGenerator();
    const buffer = await generator.generate(req.body.leadData);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);
  } catch (e) { res.status(500).json({ error: 'DOCX failed' }); }
});

// Static SPA
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));
app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
