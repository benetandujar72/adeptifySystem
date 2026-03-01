
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
  TableOfContents, Numbering, LevelFormat 
} = docx;

const PORT = Number(process.env.PORT || 2705);
const STARTUP_TS = Date.now();

const app = express();

// --- CONFIGURACIÓ DE BRANDING ADEPTIFY.ES ---
const COLORS = {
  PRIMARY: "1B3A5C",    // Azul oscuro — títulos H1
  SECONDARY: "2E75B6",  // Azul medio — títulos H2
  ACCENT: "4A90D9",     // Azul claro — títulos H3
  DARK: "1A1A1A",       // Texto cuerpo
  GRAY: "666666",       // Texto secundario
  LIGHT_BG: "E8F0FE",   // Filas alternadas
  BORDER: "B0C4DE"      // Bordes
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
async function callGemini(prompt, modelId = "gemini-3.1-pro-preview") {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });
  const data = await response.json();
  if (data.error) {
    if (modelId.includes("3.1")) return callGemini(prompt, "gemini-1.5-pro");
    throw new Error(data.error.message);
  }
  const rawText = data.candidates[0].content.parts[0].text;
  return JSON.parse(rawText.replace(/```json|```/g, "").trim());
}

// --- CLASSE GENERADORA DE DOCX (ESTÀNDARD 12 SECCIONS) ---
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
          },
          {
            id: "Heading2",
            name: "Heading 2",
            run: { size: 26, bold: true, font: "Arial", color: COLORS.SECONDARY },
            paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 }
          }
        ]
      },
      sections: [
        // 1. PORTADA
        {
          properties: { page: { size: { width: 12240, height: 15840 } } },
          children: [
            new Paragraph({ spacing: { before: 2400 }, alignment: AlignmentType.CENTER, children: [
              new TextRun({ text: "ADEPTIFY SYSTEMS", bold: true, size: 56, color: COLORS.PRIMARY })
            ]}),
            new Paragraph({ spacing: { before: 400 }, alignment: AlignmentType.CENTER, children: [
              new TextRun({ text: (data.proyecto?.titulo || "PROPOSTA DE TRANSFORMACIÓ DIGITAL").toUpperCase(), bold: true, size: 28, color: COLORS.SECONDARY })
            ]}),
            new Paragraph({ spacing: { before: 4000 }, alignment: AlignmentType.RIGHT, children: [
              new TextRun({ text: `CLIENT: ${data.cliente?.nombre || '[Client]'}`, bold: true, size: 24 }),
              new TextRun({ text: "", break: 1 }),
              new TextRun({ text: `Codi: ${data.propuesta?.codigo || 'PROP-2026'}`, size: 20, color: COLORS.GRAY }),
              new TextRun({ text: "", break: 1 }),
              new TextRun({ text: `Data: ${data.propuesta?.fecha || new Date().toLocaleDateString()}`, size: 20, color: COLORS.GRAY })
            ]}),
            new Paragraph({ children: [new PageBreak()] })
          ]
        },
        // 2. CONTINGUT AMB HEADERS/FOOTERS
        {
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  border: { bottom: { color: COLORS.SECONDARY, size: 6, style: "single" } },
                  children: [
                    new TextRun({ text: "ADEPTIFY SYSTEMS", bold: true, color: COLORS.PRIMARY, size: 16 }),
                    new TextRun({ text: "\t\tProposta de Solucions Digitals", italics: true, color: COLORS.GRAY, size: 16 })
                  ]
                })
              ]
            })
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  border: { top: { color: COLORS.SECONDARY, size: 6, style: "single" } },
                  children: [
                    new TextRun({ text: `CONFIDENCIAL | ${data.cliente?.nombre || 'Client'}`, color: COLORS.GRAY, size: 14 }),
                    new TextRun({ text: "\t\tPàgina ", color: COLORS.GRAY, size: 14 }),
                    new TextRun({ children: [PageNumber.CURRENT], color: COLORS.GRAY, size: 14 })
                  ]
                })
              ]
            })
          },
          children: [
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("ÍNDEX DE CONTINGUTS")] }),
            new TableOfContents("Índex", { headingStyleRange: "1-3", hyperlink: true }),
            new Paragraph({ children: [new PageBreak()] }),

            // 1. RESUM EXECUTIU
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. RESUM EXECUTIU")] }),
            new Paragraph({ children: [new TextRun(data.proyecto?.resumen || "[Pendent]")] }),

            // 2. CONTEXT I DIAGNÒSTIC
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("2. CONTEXT I DIAGNÒSTIC DE SITUACIÓ")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.1 Anàlisi de l'Entorn Actual")] }),
            new Paragraph({ children: [new TextRun(data.diagnostico?.entorno || "[Pendent]")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.2 Identificació de Necessitats")] }),
            new Table({
              width: { size: 9360, type: WidthType.DXA },
              rows: [
                new TableRow({ children: [
                  new TableCell({ shading: { fill: COLORS.PRIMARY }, children: [new Paragraph({ children: [new TextRun({ text: "ID", color: "FFFFFF", bold: true })] })] }),
                  new TableCell({ shading: { fill: COLORS.PRIMARY }, children: [new Paragraph({ children: [new TextRun({ text: "DESCRIPCIÓ", color: "FFFFFF", bold: true })] })] }),
                  new TableCell({ shading: { fill: COLORS.PRIMARY }, children: [new Paragraph({ children: [new TextRun({ text: "PRIORITAT", color: "FFFFFF", bold: true })] })] })
                ]}),
                ...(data.diagnostico?.necesidades || []).map((n, i) => new TableRow({
                  children: [
                    new TableCell({ shading: { fill: i % 2 === 0 ? "FFFFFF" : COLORS.LIGHT_BG }, children: [new Paragraph({ text: n.id })] }),
                    new TableCell({ shading: { fill: i % 2 === 0 ? "FFFFFF" : COLORS.LIGHT_BG }, children: [new Paragraph({ text: n.descripcion })] }),
                    new TableCell({ shading: { fill: i % 2 === 0 ? "FFFFFF" : COLORS.LIGHT_BG }, children: [new Paragraph({ text: n.prioridad })] })
                  ]
                }))
              ]
            }),

            // 3. SOLUCIÓ PROPOSADA
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("3. SOLUCIÓ PROPOSADA")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.1 Visió General de la Solució")] }),
            new Paragraph({ children: [new TextRun(data.solucion?.vision || "[Pendent]")] }),

            // 7. PROPUESTA ECONÒMICA
            new Paragraph({ children: [new PageBreak()] }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("7. PROPOSTA ECONÒMICA")] }),
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

            // 12. SIGNATURA
            new Paragraph({ children: [new PageBreak()] }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("12. PRÒXIMS PASSOS I ACCEPTACIÓ")] }),
            new Table({
              width: { size: 9360, type: WidthType.DXA },
              rows: [
                new TableRow({ children: [
                  new TableCell({ children: [new Paragraph({ spacing: { before: 1200 }, children: [new TextRun({ text: "Per Adeptify Systems SLU", bold: true })] }), new Paragraph({ children: [new TextRun("Benet Andújar, Director") ]}) ] }),
                  new TableCell({ children: [new Paragraph({ spacing: { before: 1200 }, children: [new TextRun({ text: `Per ${data.cliente?.nombre || 'Client'}`, bold: true })] }), new Paragraph({ children: [new TextRun(data.cliente?.contacto_nombre || "Signatura representant") ]}) ] })
                ]})
              ]
            })
          ]
        }
      ]
    });
    return await Packer.toBuffer(doc);
  }
}

// --- ENDPOINTS ---

app.post('/api/automation/capture', express.json(), async (req, res) => {
  const { url } = req.body;
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await resp.text();
    const $ = cheerio.load(html);
    const text = $('body').text().replace(/\s+/g, ' ').substring(0, 10000);
    const prompt = `Actua com a consultor Adeptify. Analitza aquesta web i retorna un JSON EXHAUSTIU de 12 seccions segons l'estàndard definit per a .docx. IDIOMA: CATALÀ. TEXT: ${text}`;
    const result = await callGemini(prompt, "gemini-3.1-pro-preview");
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/automation/generate-docx', express.json(), async (req, res) => {
  try {
    const generator = new WordProposalGenerator();
    const buffer = await generator.generate(req.body.leadData);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename=Proposta_Adeptify.docx');
    res.send(buffer);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Static SPA
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));
app.get('*', (req, res) => {
  try {
    const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
    res.send(html.replace(/\"\/env\.js\"/g, `\"/env.js?v=${STARTUP_TS}\"`));
  } catch(e) { res.sendFile(path.join(distDir, 'index.html')); }
});

app.listen(PORT, () => console.log(`Adeptify Server 2.0 running on ${PORT}`));
