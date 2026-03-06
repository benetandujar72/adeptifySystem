'use strict';
/**
 * generate_pdf.js — PDF Generator for Adeptify Multi-Agent System
 *
 * Generates professionally styled PDFs from the same consolidated data
 * that generate_docx.js uses, with Adeptify brand identity.
 *
 * Exports:
 *   generatePdfBuffer(docData, datosCliente) → Buffer
 *   generateBrochurePdfBuffer()              → Buffer  (generic Adeptify services brochure)
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { getStyleRules } = require('./agents/ag11_estilo');

const S = getStyleRules();

// Brand colors
const COL = {
  meteorite: '#2F1C6A',
  purple: '#673DE6',
  lightPurple: '#8C85FF',
  body: '#333333',
  secondary: '#666666',
  white: '#FFFFFF',
  headerBg: '#2F1C6A',
  evenRow: '#F3F0FF',
  oddRow: '#FFFFFF',
  border: '#D4CCFF',
};

const MARGIN = 60;
const PW = 595.28;   // A4 width in points
const PH = 841.89;   // A4 height
const CW = PW - 2 * MARGIN; // content width

// Load bundled logo once
let LOGO_BUF = null;
try {
  const p = path.join(__dirname, 'assets', 'logo_adeptify.png');
  if (fs.existsSync(p)) LOGO_BUF = fs.readFileSync(p);
} catch (_) {}

// ── Helpers ──────────────────────────────────────────────────────────────────

function safe(v, fb = '') {
  if (v == null) return fb;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function needsPage(doc, h = 80) {
  return doc.y + h > PH - MARGIN - 40;
}

function ensureSpace(doc, h = 80) {
  if (needsPage(doc, h)) { doc.addPage(); doc.y = MARGIN + 10; }
}

function heading(doc, text, level = 1) {
  if (level === 1) {
    doc.addPage();
    doc.y = MARGIN + 10;
    doc.fontSize(20).font('Helvetica-Bold').fillColor(COL.meteorite)
       .text(text, MARGIN, doc.y, { width: CW });
    doc.moveTo(MARGIN, doc.y).lineTo(PW - MARGIN, doc.y)
       .strokeColor(COL.purple).lineWidth(1.5).stroke();
    doc.moveDown(0.5);
  } else if (level === 2) {
    ensureSpace(doc, 60);
    doc.moveDown(0.3);
    doc.fontSize(13).font('Helvetica-Bold').fillColor(COL.purple)
       .text(text, MARGIN, doc.y, { width: CW });
    doc.moveDown(0.3);
  } else {
    ensureSpace(doc, 50);
    doc.moveDown(0.2);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(COL.lightPurple)
       .text(text, MARGIN, doc.y, { width: CW });
    doc.moveDown(0.2);
  }
}

function bodyText(doc, text, opts = {}) {
  if (!text) return;
  ensureSpace(doc, 40);
  const font = opts.bold ? 'Helvetica-Bold' : opts.italic ? 'Helvetica-Oblique' : 'Helvetica';
  doc.fontSize(10).font(font).fillColor(opts.color || COL.body)
     .text(safe(text), MARGIN, doc.y, { width: CW, align: 'justify', lineGap: 2 });
  doc.moveDown(0.3);
}

function bulletItem(doc, text) {
  if (!text) return;
  ensureSpace(doc, 30);
  doc.fontSize(10).font('Helvetica').fillColor(COL.body)
     .text(`  •  ${safe(text)}`, MARGIN, doc.y, { width: CW, lineGap: 2 });
  doc.moveDown(0.1);
}

function drawTable(doc, rows) {
  if (!rows || !Array.isArray(rows) || rows.length < 1) return;
  // Normalize
  const maxCols = Math.max(...rows.map(r => (Array.isArray(r) ? r.length : 0)));
  if (maxCols === 0) return;
  const norm = rows.map(r => {
    const a = Array.isArray(r) ? r.map(c => safe(c)) : [];
    while (a.length < maxCols) a.push('');
    return a;
  });

  const colW = CW / maxCols;
  const rH = 20;
  const fs = 7.5;

  for (let ri = 0; ri < norm.length; ri++) {
    ensureSpace(doc, rH + 5);
    const isHdr = ri === 0;
    const bg = isHdr ? COL.headerBg : (ri % 2 === 0 ? COL.evenRow : COL.oddRow);
    const tc = isHdr ? COL.white : COL.body;
    const fn = isHdr ? 'Helvetica-Bold' : 'Helvetica';
    const y = doc.y;

    for (let ci = 0; ci < maxCols; ci++) {
      const x = MARGIN + ci * colW;
      doc.save();
      doc.rect(x, y, colW, rH).fill(bg);
      doc.restore();
      doc.rect(x, y, colW, rH).strokeColor(COL.border).lineWidth(0.3).stroke();
      doc.fontSize(fs).font(fn).fillColor(tc)
         .text(norm[ri][ci], x + 3, y + 4, { width: colW - 6, height: rH - 4, ellipsis: true });
    }
    doc.y = y + rH;
  }
  doc.moveDown(0.5);
}

function tryImage(doc, base64, opts = {}) {
  if (!base64) return;
  try {
    const buf = Buffer.from(base64, 'base64');
    const w = opts.width || CW * 0.8;
    const h = opts.height || 200;
    ensureSpace(doc, h + 20);
    const x = MARGIN + (CW - w) / 2;
    doc.image(buf, x, doc.y, { width: w });
    doc.moveDown(1);
  } catch (e) {
    console.warn(`[PDF] Image embed failed: ${e.message}`);
  }
}

// ── Cover page ───────────────────────────────────────────────────────────────

function renderCover(doc, docData, datosCliente, vis) {
  const meta = docData.metadata || {};
  const cl = datosCliente?.cliente || docData.datos_cliente?.cliente || {};

  // Top bar
  doc.rect(0, 0, PW, 100).fill(COL.meteorite);

  // Logo
  if (LOGO_BUF) {
    try { doc.image(LOGO_BUF, (PW - 100) / 2, 15, { width: 100 }); } catch (_) {}
  }

  doc.y = 120;
  doc.fontSize(30).font('Helvetica-Bold').fillColor(COL.meteorite)
     .text('Adeptify Systems', { align: 'center', width: PW });
  doc.moveDown(0.2);
  doc.fontSize(11).font('Helvetica-Oblique').fillColor(COL.secondary)
     .text(S.marca.claim, { align: 'center', width: PW });
  doc.moveDown(1.5);

  // Cover image
  if (vis.portada_base64) {
    tryImage(doc, vis.portada_base64, { width: 380, height: 190 });
  } else {
    doc.moveDown(3);
  }

  // Branded bar
  const barY = doc.y;
  doc.rect(MARGIN + 40, barY, CW - 80, 36).fill(COL.meteorite);
  doc.fontSize(14).font('Helvetica-Bold').fillColor(COL.white)
     .text('Proposta de Transformació Digital', 0, barY + 10, { align: 'center', width: PW });
  doc.y = barY + 50;
  doc.moveDown(1);

  // Client name
  doc.fontSize(24).font('Helvetica-Bold').fillColor(COL.purple)
     .text(cl.nombre || meta.cliente || 'Client', { align: 'center' });
  doc.moveDown(0.3);
  const loc = `${safe(cl.sector)} · ${safe(cl.ubicacion)}`.replace(/^ · | · $/g, '');
  if (loc.trim()) {
    doc.fontSize(11).font('Helvetica').fillColor(COL.secondary).text(loc, { align: 'center' });
  }
  doc.moveDown(3);

  // Reference
  doc.fontSize(9).font('Helvetica').fillColor(COL.secondary)
     .text(`Ref: ${safe(meta.referencia, 'ADT-2026-001')}  ·  Data: ${safe(meta.fecha, new Date().toLocaleDateString('ca-ES'))}  ·  Versió: ${safe(meta.version, '1.0')}`, { align: 'center' });
  doc.moveDown(0.8);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(COL.meteorite)
     .text('— DOCUMENT CONFIDENCIAL —', { align: 'center' });
}

// ── Sections ─────────────────────────────────────────────────────────────────

function renderS1(doc, s) {
  if (!s) return;
  heading(doc, '1. Resum Executiu');
  bodyText(doc, s.parrafo_1);
  bodyText(doc, s.parrafo_2);
  bodyText(doc, s.parrafo_3);
  if (s.tabla_resumen?.length > 1) { heading(doc, 'Taula resum', 2); drawTable(doc, s.tabla_resumen); }
}

function renderS2(doc, s) {
  if (!s) return;
  heading(doc, '2. Context i Diagnòstic');
  heading(doc, '2.1 Context Sectorial', 2); bodyText(doc, s.contexto_sectorial);
  heading(doc, '2.2 Diagnòstic Actual', 2); bodyText(doc, s.diagnostico_actual);
  if (s.tabla_sistemas?.length > 1) { heading(doc, 'Inventari de Sistemes', 3); drawTable(doc, s.tabla_sistemas); }
  if (s.cuello_botella) { heading(doc, 'Principal Coll d\'Ampolla', 3); bodyText(doc, s.cuello_botella); }
}

function renderS3(doc, s, vis) {
  if (!s) return;
  heading(doc, '3. Solució Proposada');
  heading(doc, '3.1 Visió General', 2); bodyText(doc, s.vision_general);
  tryImage(doc, vis.mockup_base64, { width: 420, height: 250 });
  if (s.componentes?.length) {
    heading(doc, '3.2 Components', 2);
    for (const c of s.componentes) {
      heading(doc, safe(c.nombre), 3);
      bodyText(doc, safe(c.descripcion));
      bodyText(doc, `Tecnologia: ${safe(c.tecnologia)}`, { bold: true });
      bodyText(doc, `Benefici: ${safe(c.beneficio)}`);
    }
  }
  if (s.arquitectura_textual) { heading(doc, '3.3 Arquitectura Tècnica', 2); bodyText(doc, s.arquitectura_textual); }
  tryImage(doc, vis.diagrama_base64, { width: 420, height: 250 });
  tryImage(doc, vis.workflow_base64, { width: 420, height: 220 });
  if (s.integraciones_clave?.length) {
    const rows = [['Des de', 'Cap a', 'Descripció'], ...s.integraciones_clave.map(i => [safe(i.de), safe(i.a), safe(i.descripcion)])];
    heading(doc, '3.4 Integracions Clau', 2); drawTable(doc, rows);
  }
  tryImage(doc, vis.integraciones_base64, { width: 420, height: 250 });
  if (s.diferenciadors?.length || s.diferenciadores?.length) {
    heading(doc, '3.5 Diferenciadors', 2);
    for (const d of (s.diferenciadors || s.diferenciadores || [])) bulletItem(doc, d);
  }
}

function renderS4(doc, s) {
  if (!s) return;
  heading(doc, '4. Metodologia');
  bodyText(doc, s.descripcion);
  if (s.tabla_fases?.length > 1) { heading(doc, 'Fases del Projecte', 2); drawTable(doc, s.tabla_fases); }
}

function renderS5(doc, s, vis) {
  if (!s) return;
  heading(doc, '5. Cronograma');
  bodyText(doc, `Durada total: ${safe(s.duracion_total)}`);
  tryImage(doc, vis.cronograma_base64, { width: 420, height: 180 });
  if (s.tabla_cronograma?.length > 1) drawTable(doc, s.tabla_cronograma);
}

function renderS6(doc, s) {
  if (!s) return;
  heading(doc, '6. DevOps i Desplegament');
  heading(doc, '6.1 Estratègia', 2); bodyText(doc, s.estrategia);
  heading(doc, '6.2 Pipeline CI/CD', 2); bodyText(doc, s.pipeline);
  heading(doc, '6.3 Monitorització', 2); bodyText(doc, s.monitorizacion);
}

function renderS7(doc, s) {
  if (!s) return;
  heading(doc, '7. Seguretat i Compliment Normatiu');
  heading(doc, '7.1 Avaluació', 2); bodyText(doc, s.evaluacion);
  heading(doc, '7.2 Compliment RGPD/LOPD', 2); bodyText(doc, s.cumplimiento_rgpd);
  heading(doc, '7.3 Confidencialitat', 2); bodyText(doc, s.clausula_confidencialidad, { italic: true });
}

function renderS8(doc, s) {
  if (!s) return;
  heading(doc, '8. Proposta Econòmica');
  if (s.tabla_conceptos?.length > 1) { heading(doc, '8.1 Detall de Conceptes', 2); drawTable(doc, s.tabla_conceptos); }
  bodyText(doc, `Subtotal sense IVA: ${safe(s.total_sin_iva)}`, { bold: true });
  bodyText(doc, `IVA (21%): ${safe(s.iva)}`);
  bodyText(doc, `TOTAL amb IVA: ${safe(s.total_con_iva)}`, { bold: true, color: COL.purple });
  if (s.tabla_pagos?.length > 1) { heading(doc, '8.2 Condicions de Pagament', 2); drawTable(doc, s.tabla_pagos); }
  if (s.roi_texto) { heading(doc, '8.3 Retorn de la Inversió (ROI)', 2); bodyText(doc, s.roi_texto); }
  if (s.tabla_roi_3anos?.length > 1) { heading(doc, 'Projecció a 3 anys', 3); drawTable(doc, s.tabla_roi_3anos); }
}

function renderS9(doc, s) {
  if (!s) return;
  heading(doc, '9. Gestió de Riscos');
  if (s.tabla_riesgos?.length > 1) drawTable(doc, s.tabla_riesgos);
}

function renderS10(doc, s) {
  if (!s) return;
  heading(doc, '10. Gestió del Canvi i Formació');
  bodyText(doc, s.descripcion);
  if (s.plan_formacion?.length) {
    heading(doc, 'Pla de Formació', 2);
    const rows = [['Sessió', 'Audiència', 'Durada', 'Format'],
      ...s.plan_formacion.map(f => [safe(f.sesion), safe(f.audiencia), safe(f.duracion), safe(f.formato)])];
    drawTable(doc, rows);
  }
}

function renderS11(doc, s) {
  if (!s) return;
  heading(doc, '11. Condicions Generals');
  bodyText(doc, s.texto_condiciones || s);
}

function renderS12(doc, s) {
  if (!s || !s.length) return;
  heading(doc, '12. Casos d\'Èxit');
  for (const c of s) {
    heading(doc, safe(c.titulo), 2);
    bodyText(doc, safe(c.descripcion));
    if (c.resultados) bodyText(doc, `Resultats: ${safe(c.resultados)}`, { bold: true });
  }
}

function renderS13(doc, s) {
  if (!s) return;
  heading(doc, '13. Pròxims Passos');
  if (s.tabla_pasos?.length > 1) drawTable(doc, s.tabla_pasos);
  if (s.llamada_accion) {
    doc.moveDown(0.5);
    bodyText(doc, s.llamada_accion, { bold: true, color: COL.purple });
  }
}

// ── Footer on every page ─────────────────────────────────────────────────────

function addHeadersFooters(doc, clientName) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    // Footer
    doc.save();
    doc.moveTo(MARGIN, PH - 42).lineTo(PW - MARGIN, PH - 42)
       .strokeColor(COL.purple).lineWidth(0.5).stroke();
    doc.fontSize(7).font('Helvetica').fillColor(COL.secondary)
       .text(`CONFIDENCIAL  |  ${i + 1} / ${range.count}  |  © Adeptify Systems`,
         MARGIN, PH - 35, { width: CW, align: 'center' });
    // Header (skip cover)
    if (i > 0) {
      doc.fontSize(7).font('Helvetica').fillColor(COL.secondary)
         .text(`Adeptify Systems  |  ${safe(clientName)}`, MARGIN, 15, { width: CW, align: 'right' });
      doc.moveTo(MARGIN, 28).lineTo(PW - MARGIN, 28)
         .strokeColor(COL.purple).lineWidth(0.3).stroke();
    }
    doc.restore();
  }
}

// ── Main exports ─────────────────────────────────────────────────────────────

/**
 * generatePdfBuffer — builds a full multi-agent proposal PDF from consolidated data
 * @param {object} docData - The AG-12 document object (or consolidado_final)
 * @param {object} [datosCliente] - Client data for cover page
 * @returns {Promise<Buffer>}
 */
async function generatePdfBuffer(docData, datosCliente) {
  const dd = docData.documento || docData;
  const cd = datosCliente || docData.datos_cliente || dd.datos_cliente || {};
  const clientName = cd?.cliente?.nombre || dd.metadata?.cliente || 'Client';
  const vis = dd.ag11_estilo?.visuales || docData.ag11_estilo?.visuales || {};

  // Fallback logo
  if (!vis.logo_base64 && LOGO_BUF) {
    vis.logo_base64 = LOGO_BUF.toString('base64');
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      bufferPages: true,
      info: {
        Title: `Proposta Adeptify — ${clientName}`,
        Author: 'Adeptify Systems',
        Subject: 'Proposta de Transformació Digital',
      },
    });

    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      renderCover(doc, dd, cd, vis);

      const tryRender = (fn, ...args) => {
        try { fn(doc, ...args); }
        catch (e) { console.warn(`[PDF] Section render error: ${e.message}`); }
      };

      tryRender(renderS1, dd.s1_resumen_ejecutivo);
      tryRender(renderS2, dd.s2_contexto_diagnostico);
      tryRender(renderS3, dd.s3_solucion, vis);
      tryRender(renderS4, dd.s4_metodologia);
      tryRender(renderS5, dd.s5_cronograma, vis);
      tryRender(renderS6, dd.s6_devops);
      tryRender(renderS7, dd.s7_seguridad);
      tryRender(renderS8, dd.s8_economia);
      tryRender(renderS9, dd.s9_riesgos);
      tryRender(renderS10, dd.s10_change_management);
      tryRender(renderS11, dd.s11_condiciones);
      tryRender(renderS12, dd.s12_casos_exito);
      tryRender(renderS13, dd.s13_proximos_pasos);

      addHeadersFooters(doc, clientName);
    } catch (e) {
      console.error('[PDF] Fatal render error:', e.message);
    }

    doc.end();
  });
}

/**
 * generateBrochurePdfBuffer — generic Adeptify services brochure for email attachment
 * @returns {Promise<Buffer>}
 */
async function generateBrochurePdfBuffer() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      bufferPages: true,
      info: { Title: 'Adeptify Systems — Serveis', Author: 'Adeptify Systems' },
    });

    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      // Cover bar
      doc.rect(0, 0, PW, 90).fill(COL.meteorite);
      if (LOGO_BUF) {
        try { doc.image(LOGO_BUF, (PW - 90) / 2, 10, { width: 90 }); } catch (_) {}
      }

      doc.y = 110;
      doc.fontSize(26).font('Helvetica-Bold').fillColor(COL.meteorite)
         .text('Adeptify Systems', { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(11).font('Helvetica-Oblique').fillColor(COL.secondary)
         .text(S.marca.claim, { align: 'center' });
      doc.moveDown(1);

      // Divider
      doc.moveTo(MARGIN + 80, doc.y).lineTo(PW - MARGIN - 80, doc.y)
         .strokeColor(COL.purple).lineWidth(1).stroke();
      doc.moveDown(1);

      // Intro
      doc.fontSize(14).font('Helvetica-Bold').fillColor(COL.purple)
         .text('Consultoria Estratègica en Intel·ligència Artificial', MARGIN, doc.y, { width: CW, align: 'center' });
      doc.moveDown(0.8);

      doc.fontSize(10).font('Helvetica').fillColor(COL.body)
         .text(
           'A Adeptify, ens especialitzem en transformació digital per a centres educatius i institucions. ' +
           'Combinem IA avançada, automatització de processos i consultoria estratègica per generar impacte real.',
           MARGIN, doc.y, { width: CW, align: 'justify', lineGap: 3 }
         );
      doc.moveDown(1);

      // Services
      doc.fontSize(14).font('Helvetica-Bold').fillColor(COL.meteorite)
         .text('Els Nostres Serveis', MARGIN);
      doc.moveDown(0.5);

      const services = [
        { name: 'GESTIÓ DE GUÀRDIES', desc: 'Automatització total del quadrant de substitucions diàries mitjançant IA. Redueix el temps de gestió un 90%.' },
        { name: 'ASSISTATUT v3.1', desc: "Control d'assistència intel·ligent per a 7 classes simultànies amb anàlisi predictiu d'absentisme." },
        { name: 'ROYAL MATH', desc: "Plataforma gamificada d'aprenentatge matemàtic amb itineraris personalitzats adaptats al ritme de cada alumne." },
        { name: 'qViC v2.0', desc: 'Sistema de gestió de qualitat educativa certificat i automatitzat per facilitar auditories i millora contínua.' },
      ];

      for (const svc of services) {
        ensureSpace(doc, 60);
        doc.rect(MARGIN, doc.y, CW, 0.5).fill(COL.border);
        doc.moveDown(0.3);
        doc.fontSize(11).font('Helvetica-Bold').fillColor(COL.purple).text(svc.name, MARGIN);
        doc.fontSize(9.5).font('Helvetica').fillColor(COL.body)
           .text(svc.desc, MARGIN, doc.y, { width: CW, lineGap: 2 });
        doc.moveDown(0.6);
      }

      doc.moveDown(1);

      // Value proposition
      doc.fontSize(14).font('Helvetica-Bold').fillColor(COL.meteorite)
         .text('Per Què Adeptify?', MARGIN);
      doc.moveDown(0.5);

      const values = [
        'IA aplicada específicament al sector educatiu',
        'Més de 15 anys d\'experiència en transformació digital',
        'Resultats mesurables: ROI clar des del primer trimestre',
        'Acompanyament integral: consultoria + desenvolupament + formació',
        'Compliment normatiu: RGPD, LOPD, ISO 27001',
      ];
      for (const v of values) bulletItem(doc, v);

      doc.moveDown(1.5);

      // CTA bar
      ensureSpace(doc, 80);
      const ctaY = doc.y;
      doc.rect(MARGIN, ctaY, CW, 60).fill(COL.meteorite);
      doc.fontSize(13).font('Helvetica-Bold').fillColor(COL.white)
         .text('Vol veure com ho fem?', MARGIN + 20, ctaY + 10, { width: CW - 40 });
      doc.fontSize(9).font('Helvetica').fillColor('#D4CCFF')
         .text('Agenda una sessió de consultoria estratègica personalitzada.', MARGIN + 20, ctaY + 28, { width: CW - 40 });
      doc.fontSize(9).font('Helvetica').fillColor(COL.white)
         .text('bandujar@edutac.es  ·  www.adeptify.es', MARGIN + 20, ctaY + 42, { width: CW - 40 });

      // Footer
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.save();
        doc.fontSize(7).font('Helvetica').fillColor(COL.secondary)
           .text('adeptify.es · Document informatiu · © Adeptify Systems',
             MARGIN, PH - 30, { width: CW, align: 'center' });
        doc.restore();
      }
    } catch (e) {
      console.error('[PDF Brochure] Error:', e.message);
    }

    doc.end();
  });
}

module.exports = { generatePdfBuffer, generateBrochurePdfBuffer };
