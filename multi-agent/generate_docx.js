'use strict';
/**
 * generate_docx.js — Generador de documentos Word para Adeptify Multi-Agent System
 *
 * Lee outputs/consolidado_final.json (generado por orchestrator.js)
 * y produce un .docx profesional con la identidad visual de Adeptify Systems.
 *
 * Uso: node generate_docx.js outputs/consolidado_final.json
 */

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, HeadingLevel,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
  TableOfContents, StyleLevel, BorderStyle,
  convertInchesToTwip, LevelFormat, ImageRun,
} = require('docx');

const { getStyleRules } = require('./agents/ag11_estilo');
const S = getStyleRules();

// ─── Helpers de color ─────────────────────────────────────────────────────────
const C = S.colores;
const T = S.tipografia;
const P = S.pagina;
const TB = S.tablas;

// ─── Helpers de párrafo ───────────────────────────────────────────────────────

function heading1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true,
    spacing: { after: T.h1.spacing_after },
    run: { font: T.h1.font, size: T.h1.size, bold: T.h1.bold, color: T.h1.color },
  });
}

function heading2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { after: T.h2.spacing_after },
    run: { font: T.h2.font, size: T.h2.size, bold: T.h2.bold, color: T.h2.color },
  });
}

function heading3(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { after: T.h3.spacing_after },
    run: { font: T.h3.font, size: T.h3.size, bold: T.h3.bold, color: T.h3.color },
  });
}

function body(text, opts = {}) {
  if (!text) return new Paragraph({ children: [] });
  return new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    spacing: { after: T.body.spacing_after, line: T.body.line },
    children: [
      new TextRun({
        text: String(text),
        font: T.body.font,
        size: T.body.size,
        color: opts.color || T.body.color,
        bold: opts.bold || false,
        italics: opts.italic || false,
      }),
    ],
  });
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80 },
    children: [
      new TextRun({ text: String(text), font: T.body.font, size: T.body.size, color: T.body.color }),
    ],
  });
}

function spacer() {
  return new Paragraph({ children: [], spacing: { after: 160 } });
}

// ─── Helper de tabla ──────────────────────────────────────────────────────────

function normalizeTable(rows) {
  // Ensure all rows have the same number of columns (DOCX requires it).
  // Also ensure rows are arrays of primitive values.
  if (!rows || !Array.isArray(rows) || rows.length === 0) return [];
  const cleaned = rows.map(r => Array.isArray(r) ? r.map(c => (c === null || c === undefined ? '' : String(c))) : []);
  const maxCols = Math.max(...cleaned.map(r => r.length));
  if (maxCols === 0) return [];
  return cleaned.map(r => {
    while (r.length < maxCols) r.push('');
    return r;
  });
}

function makeTable(rows, colWidths) {
  const normalized = normalizeTable(rows);
  if (normalized.length === 0) return spacer();

  const numCols = normalized[0].length;
  const defaultWidths = Array(numCols).fill(Math.floor(TB.width_total / numCols));
  const widths = colWidths ? colWidths.slice(0, numCols) : defaultWidths;

  return new Table({
    width: { size: TB.width_total, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: TB.border_size, color: TB.border_color },
      bottom: { style: BorderStyle.SINGLE, size: TB.border_size, color: TB.border_color },
      left: { style: BorderStyle.SINGLE, size: TB.border_size, color: TB.border_color },
      right: { style: BorderStyle.SINGLE, size: TB.border_size, color: TB.border_color },
      insideH: { style: BorderStyle.SINGLE, size: TB.border_size, color: TB.border_color },
      insideV: { style: BorderStyle.SINGLE, size: TB.border_size, color: TB.border_color },
    },
    rows: normalized.map((row, rowIdx) => {
      const isHeader = rowIdx === 0;
      return new TableRow({
        tableHeader: isHeader,
        children: row.map((cell, colIdx) => {
          const bgColor = isHeader ? C.header_tablas_bg
            : rowIdx % 2 === 0 ? C.fondo_tablas_par : C.fondo_tablas_impar;
          return new TableCell({
            width: { size: widths[colIdx] || defaultWidths[colIdx], type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: bgColor },
            margins: {
              top: TB.cell_margin_top, bottom: TB.cell_margin_bottom,
              left: TB.cell_margin_left, right: TB.cell_margin_right,
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: cell !== null && cell !== undefined ? String(cell) : '',
                    font: isHeader ? T.tabla_header.font : T.tabla_body.font,
                    size: isHeader ? T.tabla_header.size : T.tabla_body.size,
                    bold: isHeader ? T.tabla_header.bold : false,
                    color: isHeader ? T.tabla_header.color : T.tabla_body.color,
                  }),
                ],
              }),
            ],
          });
        }),
      });
    }),
  });
}

// ─── Header y Footer ──────────────────────────────────────────────────────────

function createHeader(clientName, logoBase64) {
  const children = [];

  // Logo a la izquierda + texto a la derecha
  if (logoBase64) {
    try {
      children.push(
        new ImageRun({
          type: 'png',
          data: Buffer.from(logoBase64, 'base64'),
          transformation: { width: 90, height: 30 },
          altText: { title: 'Adeptify Logo', description: 'Logo de Adeptify Systems', name: 'adeptify-logo' },
        })
      );
      children.push(new TextRun({ text: '   ', font: T.header_footer.font, size: T.header_footer.size }));
    } catch (e) {
      console.warn('[DOCX] No se pudo insertar logo en header:', e.message);
    }
  }

  children.push(
    new TextRun({ text: 'Adeptify Systems  |  ', font: T.header_footer.font, size: T.header_footer.size, bold: true, color: C.meteorite_dark }),
    new TextRun({ text: clientName || 'Proposta Digital', font: T.header_footer.font, size: T.header_footer.size, color: C.texto_secundario }),
  );

  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: C.primary_purple } },
        children,
      }),
    ],
  });
}

function createFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 2, color: C.primary_purple } },
        children: [
          new TextRun({ text: 'CONFIDENCIAL  |  ', font: T.header_footer.font, size: T.header_footer.size, color: C.texto_secundario }),
          new TextRun({ children: [PageNumber.CURRENT], font: T.header_footer.font, size: T.header_footer.size, color: C.texto_secundario }),
          new TextRun({ text: ' / ', font: T.header_footer.font, size: T.header_footer.size, color: C.texto_secundario }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: T.header_footer.font, size: T.header_footer.size, color: C.texto_secundario }),
          new TextRun({ text: '  |  © Adeptify Systems', font: T.header_footer.font, size: T.header_footer.size, color: C.texto_secundario }),
        ],
      }),
    ],
  });
}

// ─── Portada (sin header/footer) ──────────────────────────────────────────────

async function buildCoverSection(doc_data, visuales = {}) {
  const meta = doc_data.metadata || {};
  const cliente = doc_data.datos_cliente?.cliente || {};

  // Usar portada generada por PIL o fallback a Unsplash
  let imageParagraph = null;
  if (visuales.portada_base64) {
    try {
      imageParagraph = new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            type: 'png',
            data: Buffer.from(visuales.portada_base64, 'base64'),
            transformation: { width: 550, height: 280 },
            altText: { title: 'Portada', description: 'Portada del informe Adeptify', name: 'portada' },
          }),
        ],
        spacing: { after: 400 },
      });
    } catch (err) {
      console.warn('[DOCX] Error insertant portada generada:', err.message);
    }
  }

  // Fallback: Unsplash (solo si no hay portada generada)
  if (!imageParagraph) {
    try {
      const imageUrl = `https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=600&h=300&auto=format&fit=crop`;
      const response = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      imageParagraph = new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ type: 'jpg', data: buffer, transformation: { width: 500, height: 250 }, altText: { title: 'Cover', description: 'Imagen de portada', name: 'cover-unsplash' } })],
        spacing: { after: 400 },
      });
    } catch (err) {
      console.warn("[DOCX] No s'ha pogut carregar la imatge visual:", err.message);
      imageParagraph = new Paragraph({ children: [], spacing: { after: 1200 } });
    }
  }

  // Logo en la portada (antes del título)
  let logoParagraph = null;
  if (visuales.logo_base64) {
    try {
      logoParagraph = new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            type: 'png',
            data: Buffer.from(visuales.logo_base64, 'base64'),
            transformation: { width: 180, height: 60 },
            altText: { title: 'Logo Adeptify', description: 'Logo de Adeptify Systems', name: 'logo-portada' },
          }),
        ],
        spacing: { after: 300 },
      });
    } catch (err) {
      console.warn('[DOCX] Error insertant logo en portada:', err.message);
    }
  }

  return [
    new Paragraph({ children: [], spacing: { after: 800 } }),
    logoParagraph || new Paragraph({ children: [], spacing: { after: 200 } }),
    imageParagraph,
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: 'Adeptify Systems', font: T.h1.font, size: 60, bold: true, color: C.meteorite_dark }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: S.marca.claim, font: T.body.font, size: 22, italic: true, color: C.texto_secundario }),
      ],
      spacing: { after: 1600 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      shading: { type: ShadingType.CLEAR, fill: C.meteorite_dark },
      children: [
        new TextRun({ text: `  Proposta de Transformació Digital  `, font: T.h2.font, size: 32, bold: true, color: 'FFFFFF', break: 1 }),
      ],
      spacing: { after: 600 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: cliente.nombre || meta.cliente || 'Client', font: T.h1.font, size: 44, bold: true, color: C.primary_purple }),
      ],
      spacing: { after: 400 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: `${cliente.sector || ''} · ${cliente.ubicacion || ''}`.replace(/^ · | · $/, ''), font: T.body.font, size: 22, color: C.texto_secundario }),
      ],
      spacing: { after: 2000 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: `Referència: ${meta.referencia || 'ADT-2026-001'}`, font: T.body.font, size: 20, color: C.texto_secundario }),
        new TextRun({ text: `  ·  Data: ${meta.fecha || new Date().toLocaleDateString('ca-ES')}`, font: T.body.font, size: 20, color: C.texto_secundario }),
        new TextRun({ text: `  ·  Versió: ${meta.version || '1.0'}`, font: T.body.font, size: 20, color: C.texto_secundario }),
      ],
      spacing: { after: 400 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '— DOCUMENT CONFIDENCIAL —', font: T.body.font, size: 20, bold: true, color: C.meteorite_light })],
    }),
  ];
}

// ─── Secciones del documento ──────────────────────────────────────────────────

function buildSection(children) {
  return children.filter(Boolean);
}

function safeText(v, fallback = '') {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function safeArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return [v];
}

function renderSection1(s1) {
  if (!s1) return [];
  const items = [
    heading1('1. Resum Executiu'),
    body(s1.parrafo_1), spacer(),
    body(s1.parrafo_2), spacer(),
    body(s1.parrafo_3), spacer(),
  ];
  if (s1.tabla_resumen && s1.tabla_resumen.length > 1) {
    items.push(heading2('Taula resum'), makeTable(s1.tabla_resumen, [1800, 2100, 2600, 2526]), spacer());
  }
  return items;
}

function renderSection2(s2) {
  if (!s2) return [];
  const items = [
    heading1('2. Context i Diagnòstic'),
    heading2('2.1 Context Sectorial'),
    body(s2.contexto_sectorial), spacer(),
    heading2('2.2 Diagnòstic Actual'),
    body(s2.diagnostico_actual), spacer(),
  ];
  if (s2.tabla_sistemas && s2.tabla_sistemas.length > 1) {
    items.push(heading3('Inventari de Sistemes'), makeTable(s2.tabla_sistemas, [2200, 2600, 1400, 2826]), spacer());
  }
  if (s2.cuello_botella) {
    items.push(heading3('Principal Coll d\'Ampolla'), body(s2.cuello_botella), spacer());
  }
  return items;
}

function renderSection3(s3, visuals = {}) {
  if (!s3) return [];
  const items = [
    heading1('3. Solució Proposada'),
    heading2('3.1 Visió General'),
    body(s3.vision_general), spacer(),
  ];

  // Afegir mockups de la interfície aquí (si n'hi ha)
  if (visuals.mockup_base64) {
    items.push(heading3('3.1.1 Proposta Visual d\'Interfície (Mockup)'));
    try {
      items.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ type: 'png', data: Buffer.from(visuals.mockup_base64, 'base64'), transformation: { width: 550, height: 350 }, altText: { title: 'Mockup', description: 'Mockup de la interfaz propuesta', name: 'mockup' } })],
        spacing: { after: 200 }
      }), spacer());
    } catch (e) {
      console.warn("[DOCX] Failed to embed mockup base64:", e.message);
    }
  }
  if (s3.componentes && s3.componentes.length) {
    items.push(heading2('3.2 Components de la Solució'));
    for (const c of s3.componentes) {
      items.push(
        heading3(safeText(c.nombre)),
        body(safeText(c.descripcion)),
        body(`Tecnologia: ${safeText(c.tecnologia)}`, { bold: true }),
        body(`Benefici: ${safeText(c.beneficio)}`),
        spacer(),
      );
    }
  }
  if (s3.arquitectura_textual) {
    items.push(heading2('3.3 Arquitectura Tècnica'), body(s3.arquitectura_textual), spacer());
  }

  // Afegir diagrama de sistemes aquí
  if (visuals.diagrama_base64) {
    items.push(heading3('Esquema d\'Arquitectura'));
    try {
      items.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ type: 'png', data: Buffer.from(visuals.diagrama_base64, 'base64'), transformation: { width: 550, height: 350 }, altText: { title: 'Arquitectura', description: 'Diagrama de arquitectura de la solución', name: 'arquitectura' } })],
        spacing: { after: 200 }
      }), spacer());
    } catch (e) {
      console.warn("[DOCX] Failed to embed diagram base64:", e.message);
    }
  }

  // Workflow infographic
  if (visuals.workflow_base64) {
    items.push(heading2('3.3.1 Flux de Treball de la Solució'));
    try {
      items.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ type: 'png', data: Buffer.from(visuals.workflow_base64, 'base64'), transformation: { width: 550, height: 300 }, altText: { title: 'Workflow', description: 'Flujo de trabajo de la automatización', name: 'workflow' } })],
        spacing: { after: 200 },
      }), spacer());
    } catch (e) {
      console.warn('[DOCX] Failed to embed workflow infographic:', e.message);
    }
  }

  if (s3.integraciones_clave && s3.integraciones_clave.length) {
    const integRows = [['Des de', 'Cap a', 'Descripció'], ...s3.integraciones_clave.map(i => [safeText(i.de), safeText(i.a), safeText(i.descripcion)])];
    items.push(heading2('3.4 Integracions Clau'), makeTable(integRows, [2200, 2200, 4626]), spacer());
  }

  // Integration map visual
  if (visuals.integraciones_base64) {
    items.push(heading3('Mapa d\'Integracions'));
    try {
      items.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ type: 'png', data: Buffer.from(visuals.integraciones_base64, 'base64'), transformation: { width: 550, height: 350 }, altText: { title: 'Integraciones', description: 'Mapa de integraciones del sistema', name: 'integraciones' } })],
        spacing: { after: 200 },
      }), spacer());
    } catch (e) {
      console.warn('[DOCX] Failed to embed integration map:', e.message);
    }
  }

  if (s3.diferenciadores && s3.diferenciadores.length) {
    items.push(heading2('3.5 Diferenciadors'));
    for (const d of s3.diferenciadores) items.push(bullet(safeText(d)));
    items.push(spacer());
  }
  return items;
}

function renderSection4(s4) {
  if (!s4) return [];
  const items = [heading1('4. Metodologia'), body(s4.descripcion), spacer()];
  if (s4.tabla_fases && s4.tabla_fases.length > 1) {
    items.push(heading2('Fases del Projecte'), makeTable(s4.tabla_fases, [2000, 1200, 3200, 2626]), spacer());
  }
  return items;
}

function renderSection5(s5, visuals = {}) {
  if (!s5) return [];
  const items = [heading1('5. Cronograma'), body(`Durada total: ${safeText(s5.duracion_total)}`), spacer()];

  // Afegir cronograma visual a gantt aquí
  if (visuals.cronograma_base64) {
    try {
      items.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ type: 'png', data: Buffer.from(visuals.cronograma_base64, 'base64'), transformation: { width: 550, height: 250 }, altText: { title: 'Cronograma', description: 'Cronograma visual del proyecto', name: 'cronograma' } })],
        spacing: { after: 200 }
      }), spacer());
    } catch (e) {
      console.warn("[DOCX] Failed to embed cronograma base64:", e.message);
    }
  }

  if (s5.tabla_cronograma && s5.tabla_cronograma.length > 1) {
    items.push(makeTable(s5.tabla_cronograma, [3000, 1200, 4826]), spacer());
  }
  return items;
}

function renderSection6(s6) {
  if (!s6) return [];
  return [
    heading1('6. DevOps i Desplegament'),
    heading2('6.1 Estratègia de Desplegament'), body(s6.estrategia), spacer(),
    heading2('6.2 Pipeline CI/CD'), body(s6.pipeline), spacer(),
    heading2('6.3 Monitorització'), body(s6.monitorizacion), spacer(),
  ];
}

function renderSection7(s7) {
  if (!s7) return [];
  return [
    heading1('7. Seguretat i Compliment Normatiu'),
    heading2('7.1 Avaluació de Seguretat'), body(s7.evaluacion), spacer(),
    heading2('7.2 Compliment RGPD/LOPD'), body(s7.cumplimiento_rgpd), spacer(),
    heading2('7.3 Clàusula de Confidencialitat'), body(s7.clausula_confidencialidad, { italic: true }), spacer(),
  ];
}

function renderSection8(s8) {
  if (!s8) return [];
  const items = [heading1('8. Proposta Econòmica')];
  if (s8.tabla_conceptos && s8.tabla_conceptos.length > 1) {
    items.push(heading2('8.1 Detall de Conceptes'), makeTable(s8.tabla_conceptos, [4200, 900, 1200, 2726]), spacer());
  }
  items.push(
    body(`Subtotal sense IVA: ${safeText(s8.total_sin_iva)}`, { bold: true }),
    body(`IVA (21%): ${safeText(s8.iva)}`),
    body(`TOTAL amb IVA: ${safeText(s8.total_con_iva)}`, { bold: true, color: C.primary_purple }),
    spacer(),
  );
  if (s8.tabla_pagos && s8.tabla_pagos.length > 1) {
    items.push(heading2('8.2 Condicions de Pagament'), makeTable(s8.tabla_pagos, [3200, 1600, 4226]), spacer());
  }
  if (s8.roi_texto) {
    items.push(heading2('8.3 Retorn de la Inversió (ROI)'), body(s8.roi_texto), spacer());
  }
  if (s8.tabla_roi_3anos && s8.tabla_roi_3anos.length > 1) {
    items.push(heading3('Projecció a 3 anys'), makeTable(s8.tabla_roi_3anos, [1800, 2000, 2000, 3226]), spacer());
  }
  return items;
}

function renderSection9(s9) {
  if (!s9) return [];
  const items = [heading1('9. Gestió de Riscos')];
  if (s9.tabla_riesgos && s9.tabla_riesgos.length > 1) {
    items.push(makeTable(s9.tabla_riesgos, [800, 2600, 700, 900, 4026]), spacer());
  }
  return items;
}

function renderSection10(s10) {
  if (!s10) return [];
  const items = [heading1('10. Gestió del Canvi i Formació'), body(s10.descripcion), spacer()];
  if (s10.plan_formacion && s10.plan_formacion.length) {
    items.push(heading2('Pla de Formació'));
    const formRows = [['Sessió', 'Audiència', 'Durada', 'Format'],
    ...s10.plan_formacion.map(f => [safeText(f.sesion), safeText(f.audiencia), safeText(f.duracion), safeText(f.formato)])];
    items.push(makeTable(formRows, [2600, 2200, 1200, 3026]), spacer());
  }
  return items;
}

function renderSection11(s11) {
  if (!s11) return [];
  return [heading1('11. Condicions Generals'), body(s11.texto_condiciones || s11), spacer()];
}

function renderSection12(s12) {
  if (!s12 || !s12.length) return [];
  const items = [heading1('12. Casos d\'Èxit')];
  for (const caso of s12) {
    items.push(heading2(safeText(caso.titulo)), body(safeText(caso.descripcion)));
    if (caso.resultados) items.push(body(`Resultats: ${safeText(caso.resultados)}`, { bold: true }));
    items.push(spacer());
  }
  return items;
}

function renderSection13(s13) {
  if (!s13) return [];
  const items = [heading1('13. Pròxims Passos')];
  if (s13.tabla_pasos && s13.tabla_pasos.length > 1) {
    items.push(makeTable(s13.tabla_pasos, [600, 3400, 2000, 3026]), spacer());
  }
  if (s13.llamada_accion) {
    items.push(spacer(), body(s13.llamada_accion, { bold: true, color: C.primary_purple }));
  }
  return items;
}

// ─── Generador principal ──────────────────────────────────────────────────────

async function generateDocx(consolidadoPath) {
  const raw = JSON.parse(fs.readFileSync(consolidadoPath, 'utf-8'));

  // El consolidado puede tener el documento en raw.documento o ser el documento directamente
  const doc_data = raw.documento || raw;
  const datosCliente = raw.datos_cliente || doc_data.datos_cliente || {};
  const clientName = datosCliente?.cliente?.nombre || doc_data.metadata?.cliente || 'Client';

  const visuales = doc_data.ag11_estilo?.visuales || raw.ag11_estilo?.visuales || {};

  // Fallback: embed the real Adeptify logo if AG-11 didn't produce one
  if (!visuales.logo_base64) {
    try {
      const logoPath = path.join(__dirname, 'assets', 'logo_adeptify.png');
      if (fs.existsSync(logoPath)) {
        visuales.logo_base64 = fs.readFileSync(logoPath).toString('base64');
        console.log('[DOCX] Using bundled Adeptify logo (fallback)');
      }
    } catch (e) {
      console.warn('[DOCX] Could not load bundled logo:', e.message);
    }
  }

  const cover = await buildCoverSection({ ...doc_data, datos_cliente: datosCliente }, visuales);

  const mainChildren = [
    ...renderSection1(doc_data.s1_resumen_ejecutivo),
    ...renderSection2(doc_data.s2_contexto_diagnostico),
    ...renderSection3(doc_data.s3_solucion, visuales),
    ...renderSection4(doc_data.s4_metodologia),
    ...renderSection5(doc_data.s5_cronograma, visuales),
    ...renderSection6(doc_data.s6_devops),
    ...renderSection7(doc_data.s7_seguridad),
    ...renderSection8(doc_data.s8_economia),
    ...renderSection9(doc_data.s9_riesgos),
    ...renderSection10(doc_data.s10_change_management),
    ...renderSection11(doc_data.s11_condiciones),
    ...renderSection12(doc_data.s12_casos_exito),
    ...renderSection13(doc_data.s13_proximos_pasos),
  ];

  const document = new Document({
    title: `Proposta Adeptify — ${clientName}`,
    description: 'Proposta de Transformació Digital generada per Adeptify Multi-Agent System',
    styles: {
      default: {
        document: {
          run: { font: T.body.font, size: T.body.size, color: T.body.color },
          paragraph: { spacing: { after: T.body.spacing_after } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: P.width, height: P.height },
            margin: { top: P.margin_top, bottom: P.margin_bottom, left: P.margin_left, right: P.margin_right },
            pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
          },
        },
        children: cover,
      },
      {
        properties: {
          page: {
            size: { width: P.width, height: P.height },
            margin: { top: P.margin_top + 400, bottom: P.margin_bottom + 400, left: P.margin_left, right: P.margin_right },
          },
        },
        headers: { default: createHeader(clientName, visuales.logo_base64) },
        footers: { default: createFooter() },
        children: mainChildren,
      },
    ],
  });

  const buffer = await Packer.toBuffer(document);

  const outputDir = path.join(path.dirname(consolidadoPath));
  const safeName = clientName.replace(/[^a-zA-Z0-9À-ÿ\s]/g, '').replace(/\s+/g, '_').substring(0, 40);
  const date = new Date().toISOString().slice(0, 10);
  const outputPath = path.join(outputDir, `Proposta_Adeptify_${safeName}_${date}.docx`);

  fs.writeFileSync(outputPath, buffer);
  console.log(`\n✅ Document generat: ${outputPath}`);
  return outputPath;
}

// ─── Entry point ──────────────────────────────────────────────────────────────
if (require.main === module) {
  const inputFile = process.argv[2] || 'outputs/consolidado_final.json';
  const filePath = path.isAbsolute(inputFile) ? inputFile : path.join(process.cwd(), inputFile);

  if (!fs.existsSync(filePath)) {
    console.error(`[ERROR] No se encontró: ${filePath}`);
    console.error('Uso: node generate_docx.js outputs/consolidado_final.json');
    process.exit(1);
  }

  generateDocx(filePath).catch((err) => {
    console.error('[ERROR FATAL]', err);
    process.exit(1);
  });
}

/**
 * generateDocxBuffer — builds the Word document from a document data object
 * and returns the raw Buffer (no file I/O). Used by the Express API endpoint.
 *
 * @param {object} docData - The ag12 document object (or consolidado_final content)
 * @param {object} [datosCliente] - Optional client data for cover page
 * @returns {Promise<Buffer>}
 */
async function generateDocxBuffer(docData, datosCliente) {
  const doc_data = docData.documento || docData;
  const clientData = datosCliente || docData.datos_cliente || doc_data.datos_cliente || {};
  const clientName = clientData?.cliente?.nombre || doc_data.metadata?.cliente || 'Client';

  // Log which sections are present to diagnose empty-doc issues
  const sectionKeys = ['s1_resumen_ejecutivo', 's2_contexto_diagnostico', 's3_solucion',
    's4_metodologia', 's5_cronograma', 's6_devops', 's7_seguridad', 's8_economia',
    's9_riesgos', 's10_change_management', 's11_condiciones', 's12_casos_exito', 's13_proximos_pasos'];
  const present = sectionKeys.filter(k => doc_data[k] && typeof doc_data[k] === 'object');
  console.log(`[DOCX] Client: ${clientName} | Sections found: ${present.length}/13 (${present.join(', ')})`);

  const visuales = doc_data.ag11_estilo?.visuales || docData.ag11_estilo?.visuales || {};

  // Fallback: embed the real Adeptify logo if AG-11 didn't produce one
  if (!visuales.logo_base64) {
    try {
      const logoPath = path.join(__dirname, 'assets', 'logo_adeptify.png');
      if (fs.existsSync(logoPath)) {
        visuales.logo_base64 = fs.readFileSync(logoPath).toString('base64');
        console.log('[DOCX] Using bundled Adeptify logo (fallback)');
      }
    } catch (e) {
      console.warn('[DOCX] Could not load bundled logo:', e.message);
    }
  }

  const cover = await buildCoverSection({ ...doc_data, datos_cliente: clientData }, visuales);

  // Wrap each section render in try-catch to avoid one bad section killing the whole document
  const tryRender = (fn, data, sectionName) => {
    try { return fn(data); }
    catch (e) {
      console.warn(`[DOCX] Section ${sectionName} render error: ${e.message}`);
      return [heading2(`${sectionName} (error de renderització)`), body('Contingut no disponible.'), spacer()];
    }
  };

  const mainChildren = [
    ...tryRender((d) => renderSection1(d), doc_data.s1_resumen_ejecutivo, 'S1'),
    ...tryRender((d) => renderSection2(d), doc_data.s2_contexto_diagnostico, 'S2'),
    ...tryRender((d) => renderSection3(d, visuales), doc_data.s3_solucion, 'S3'),
    ...tryRender((d) => renderSection4(d), doc_data.s4_metodologia, 'S4'),
    ...tryRender((d) => renderSection5(d, visuales), doc_data.s5_cronograma, 'S5'),
    ...tryRender((d) => renderSection6(d), doc_data.s6_devops, 'S6'),
    ...tryRender(renderSection7, doc_data.s7_seguridad, 'S7'),
    ...tryRender(renderSection8, doc_data.s8_economia, 'S8'),
    ...tryRender(renderSection9, doc_data.s9_riesgos, 'S9'),
    ...tryRender(renderSection10, doc_data.s10_change_management, 'S10'),
    ...tryRender(renderSection11, doc_data.s11_condiciones, 'S11'),
    ...tryRender(renderSection12, doc_data.s12_casos_exito, 'S12'),
    ...tryRender(renderSection13, doc_data.s13_proximos_pasos, 'S13'),
  ];

  // DOCX sections must have at least one child — add placeholder if empty
  if (mainChildren.length === 0) {
    mainChildren.push(body('Document en blanc — no s\'han pogut renderitzar les seccions.'));
  }

  const document = new Document({
    title: `Proposta Adeptify — ${clientName}`,
    description: 'Proposta de Transformació Digital generada per Adeptify Multi-Agent System',
    styles: {
      default: {
        document: {
          run: { font: T.body.font, size: T.body.size, color: T.body.color },
          paragraph: { spacing: { after: T.body.spacing_after } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: { size: { width: P.width, height: P.height }, margin: { top: P.margin_top, bottom: P.margin_bottom, left: P.margin_left, right: P.margin_right }, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
        },
        children: cover,
      },
      {
        properties: {
          page: { size: { width: P.width, height: P.height }, margin: { top: P.margin_top + 400, bottom: P.margin_bottom + 400, left: P.margin_left, right: P.margin_right } },
        },
        headers: { default: createHeader(clientName, visuales.logo_base64) },
        footers: { default: createFooter() },
        children: mainChildren,
      },
    ],
  });

  const buffer = await Packer.toBuffer(document);
  console.log(`[DOCX] Buffer generated: ${Math.round(buffer.length / 1024)} KB | Children: ${mainChildren.length}`);
  return buffer;
}

module.exports = { generateDocx, generateDocxBuffer };
