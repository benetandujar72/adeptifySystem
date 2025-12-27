import jsPDF from 'jspdf';
import { CenterReport } from '../types';
import { DafoResult } from './geminiService';

type Lang = 'ca' | 'es';

const page = {
  margin: 48,
  lineHeight: 14,
  headerHeight: 44,
  footerHeight: 32,
  cardPadding: 12,
};

const palette = {
  text: [15, 23, 42] as const, // slate-ish
  muted: [71, 85, 105] as const,
  border: [226, 232, 240] as const,
  surface: [248, 250, 252] as const,
  surface2: [241, 245, 249] as const,
};

function ensureSpace(doc: jsPDF, y: number, extra: number) {
  const height = doc.internal.pageSize.getHeight();
  if (y + extra <= height - page.margin - page.footerHeight) return y;
  doc.addPage();
  return page.margin + page.headerHeight;
}

function setTextColor(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function drawHeader(doc: jsPDF, title: string, subtitle: string) {
  const width = doc.internal.pageSize.getWidth();

  doc.setFillColor(palette.surface2[0], palette.surface2[1], palette.surface2[2]);
  doc.rect(0, 0, width, page.headerHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setTextColor(doc, palette.muted);
  doc.text('ADEPTIFY', page.margin, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  setTextColor(doc, palette.text);
  doc.text(title, page.margin, 34);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setTextColor(doc, palette.muted);
  const subMax = width - page.margin * 2;
  const subLines = doc.splitTextToSize(subtitle, subMax);
  if (subLines.length) {
    doc.text(subLines[0], page.margin, 46);
  }
}

function addFooters(doc: jsPDF, lang: Lang) {
  const total = doc.internal.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(palette.border[0], palette.border[1], palette.border[2]);
    doc.setLineWidth(0.5);
    doc.line(page.margin, height - page.footerHeight, width - page.margin, height - page.footerHeight);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setTextColor(doc, palette.muted);
    const left = lang === 'ca' ? 'Adeptify — Informe generat automàticament' : 'Adeptify — Informe generado automáticamente';
    doc.text(left, page.margin, height - 14);
    doc.text(`${i}/${total}`, width - page.margin, height - 14, { align: 'right' });
  }
}

function addTitle(doc: jsPDF, title: string, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  y = ensureSpace(doc, y, 24);
  doc.text(title, page.margin, y);
  return y + 22;
}

function addSubTitle(doc: jsPDF, title: string, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  y = ensureSpace(doc, y, 18);
  doc.text(title, page.margin, y);
  return y + 14;
}

function addParagraph(doc: jsPDF, text: string, y: number) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setTextColor(doc, palette.text);
  const maxWidth = doc.internal.pageSize.getWidth() - page.margin * 2;
  const lines = doc.splitTextToSize(text || '', maxWidth);
  for (const line of lines) {
    y = ensureSpace(doc, y, page.lineHeight);
    doc.text(line, page.margin, y);
    y += page.lineHeight;
  }
  return y + 6;
}

function addBullets(doc: jsPDF, items: string[], y: number) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setTextColor(doc, palette.text);
  const maxWidth = doc.internal.pageSize.getWidth() - page.margin * 2 - 14;
  for (const item of items || []) {
    const lines = doc.splitTextToSize(String(item || ''), maxWidth);
    if (!lines.length) continue;
    y = ensureSpace(doc, y, page.lineHeight);
    doc.text('•', page.margin, y);
    doc.text(lines[0], page.margin + 14, y);
    y += page.lineHeight;
    for (let i = 1; i < lines.length; i++) {
      y = ensureSpace(doc, y, page.lineHeight);
      doc.text(lines[i], page.margin + 14, y);
      y += page.lineHeight;
    }
  }
  return y + 6;
}

function measureParagraphHeight(doc: jsPDF, text: string, maxWidth: number) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(text || '', maxWidth);
  return lines.length * page.lineHeight + 6;
}

function measureBulletsHeight(doc: jsPDF, items: string[], maxWidth: number) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  let linesCount = 0;
  for (const item of items || []) {
    const lines = doc.splitTextToSize(String(item || ''), maxWidth);
    linesCount += Math.max(1, lines.length);
  }
  return linesCount * page.lineHeight + 6;
}

function addCard(doc: jsPDF, x: number, y: number, w: number, h: number, title: string) {
  doc.setDrawColor(palette.border[0], palette.border[1], palette.border[2]);
  doc.setFillColor(palette.surface[0], palette.surface[1], palette.surface[2]);
  doc.roundedRect(x, y, w, h, 10, 10, 'FD');

  // Header strip
  doc.setFillColor(palette.surface2[0], palette.surface2[1], palette.surface2[2]);
  doc.roundedRect(x, y, w, 22, 10, 10, 'F');
  doc.rect(x, y + 12, w, 10, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setTextColor(doc, palette.text);
  doc.text(title, x + page.cardPadding, y + 16);
}

function addCardBullets(doc: jsPDF, x: number, y: number, w: number, items: string[]) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setTextColor(doc, palette.text);
  const maxWidth = w - page.cardPadding * 2 - 14;
  let yy = y;
  for (const item of items || []) {
    const lines = doc.splitTextToSize(String(item || ''), maxWidth);
    if (!lines.length) continue;
    doc.text('•', x + page.cardPadding, yy);
    doc.text(lines[0], x + page.cardPadding + 14, yy);
    yy += page.lineHeight;
    for (let i = 1; i < lines.length; i++) {
      doc.text(lines[i], x + page.cardPadding + 14, yy);
      yy += page.lineHeight;
    }
  }
  return yy + 2;
}

function addCardParagraph(doc: jsPDF, x: number, y: number, w: number, text: string) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setTextColor(doc, palette.text);
  const maxWidth = w - page.cardPadding * 2;
  const lines = doc.splitTextToSize(text || '', maxWidth);
  let yy = y;
  for (const line of lines) {
    doc.text(line, x + page.cardPadding, yy);
    yy += page.lineHeight;
  }
  return yy + 2;
}

function sanitizeFilename(name: string) {
  return (name || 'centre').replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '_');
}

export function downloadDafoPdf(centerName: string, dafo: DafoResult, lang: Lang = 'ca') {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const title = lang === 'ca' ? `DAFO del centre` : `DAFO del centro`;
  const generatedAt = dafo?.meta?.generatedAt
    ? new Date(dafo.meta.generatedAt).toLocaleString()
    : new Date().toLocaleString();
  const subtitle = `${centerName} • ${(lang === 'ca' ? 'Generat: ' : 'Generado: ') + generatedAt}`;
  drawHeader(doc, title, subtitle);

  let y = page.margin + page.headerHeight;

  // Executive summary card
  {
    const width = doc.internal.pageSize.getWidth() - page.margin * 2;
    const x = page.margin;
    const contentH = measureParagraphHeight(doc, dafo?.summary || '', width - page.cardPadding * 2);
    const h = 22 + page.cardPadding + contentH + 4;
    y = ensureSpace(doc, y, h);
    addCard(doc, x, y, width, h, lang === 'ca' ? 'Resum executiu' : 'Resumen ejecutivo');
    addCardParagraph(doc, x, y + 22 + page.cardPadding, width, dafo?.summary || '');
    y += h + 14;
  }

  // Quadrants in two columns when possible
  const pageW = doc.internal.pageSize.getWidth();
  const fullW = pageW - page.margin * 2;
  const gap = 14;
  const colW = (fullW - gap) / 2;
  const leftX = page.margin;
  const rightX = page.margin + colW + gap;

  const quadrants: Array<{ title: string; items: string[] }> = [
    { title: lang === 'ca' ? 'Fortaleses' : 'Fortalezas', items: dafo?.strengths || [] },
    { title: lang === 'ca' ? 'Debilitats' : 'Debilidades', items: dafo?.weaknesses || [] },
    { title: lang === 'ca' ? 'Oportunitats' : 'Oportunidades', items: dafo?.opportunities || [] },
    { title: lang === 'ca' ? 'Amenaces' : 'Amenazas', items: dafo?.threats || [] },
  ];

  for (let i = 0; i < quadrants.length; i += 2) {
    const left = quadrants[i];
    const right = quadrants[i + 1];

    const leftH = 22 + page.cardPadding + measureBulletsHeight(doc, left.items, colW - page.cardPadding * 2 - 14) + 6;
    const rightH = right
      ? 22 + page.cardPadding + measureBulletsHeight(doc, right.items, colW - page.cardPadding * 2 - 14) + 6
      : 0;
    const rowH = Math.max(leftH, rightH);

    y = ensureSpace(doc, y, rowH);
    addCard(doc, leftX, y, colW, rowH, left.title);
    addCardBullets(doc, leftX, y + 22 + page.cardPadding, colW, left.items);

    if (right) {
      addCard(doc, rightX, y, colW, rowH, right.title);
      addCardBullets(doc, rightX, y + 22 + page.cardPadding, colW, right.items);
    }

    y += rowH + 14;
  }

  if (Array.isArray(dafo?.quickWins) && dafo.quickWins.length) {
    const width = doc.internal.pageSize.getWidth() - page.margin * 2;
    const x = page.margin;
    const contentH = measureBulletsHeight(doc, dafo.quickWins, width - page.cardPadding * 2 - 14);
    const h = 22 + page.cardPadding + contentH + 6;
    y = ensureSpace(doc, y, h);
    addCard(doc, x, y, width, h, lang === 'ca' ? 'Quick wins' : 'Quick wins');
    addCardBullets(doc, x, y + 22 + page.cardPadding, width, dafo.quickWins);
    y += h + 14;
  }

  if (Array.isArray(dafo?.risksAndMitigations) && dafo.risksAndMitigations.length) {
    const width = doc.internal.pageSize.getWidth() - page.margin * 2;
    const x = page.margin;
    const lines = dafo.risksAndMitigations.map(r => `${r.risk} — ${r.mitigation}`);
    const contentH = measureBulletsHeight(doc, lines, width - page.cardPadding * 2 - 14);
    const h = 22 + page.cardPadding + contentH + 6;
    y = ensureSpace(doc, y, h);
    addCard(doc, x, y, width, h, lang === 'ca' ? 'Riscos i mitigacions' : 'Riesgos y mitigaciones');
    addCardBullets(doc, x, y + 22 + page.cardPadding, width, lines);
    y += h + 14;
  }

  addFooters(doc, lang);

  const filename = `${sanitizeFilename(centerName)}_DAFO.pdf`;
  doc.save(filename);
}

export function downloadCenterReportPdf(centerName: string, report: CenterReport, lang: Lang = 'ca') {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const title = lang === 'ca' ? `Informe del centre` : `Informe del centro`;
  const generatedAt = report?.meta?.generatedAt
    ? new Date(report.meta.generatedAt).toLocaleString()
    : new Date().toLocaleString();
  const subtitle = `${centerName} • ${(lang === 'ca' ? 'Generat: ' : 'Generado: ') + generatedAt}`;
  drawHeader(doc, title, subtitle);

  let y = page.margin + page.headerHeight;
  const pageW = doc.internal.pageSize.getWidth();
  const fullW = pageW - page.margin * 2;
  const x = page.margin;

  const addListCard = (cardTitle: string, items: string[]) => {
    const contentH = measureBulletsHeight(doc, items || [], fullW - page.cardPadding * 2 - 14);
    const h = 22 + page.cardPadding + contentH + 6;
    y = ensureSpace(doc, y, h);
    addCard(doc, x, y, fullW, h, cardTitle);
    addCardBullets(doc, x, y + 22 + page.cardPadding, fullW, items || []);
    y += h + 14;
  };

  // Executive summary
  {
    const contentH = measureParagraphHeight(doc, report?.executiveSummary || '', fullW - page.cardPadding * 2);
    const h = 22 + page.cardPadding + contentH + 4;
    y = ensureSpace(doc, y, h);
    addCard(doc, x, y, fullW, h, lang === 'ca' ? 'Resum executiu' : 'Resumen ejecutivo');
    addCardParagraph(doc, x, y + 22 + page.cardPadding, fullW, report?.executiveSummary || '');
    y += h + 14;
  }

  addListCard(lang === 'ca' ? 'Consens (el que es repeteix)' : 'Consenso (lo que se repite)', report?.consensus || []);

  if (Array.isArray(report?.divergences) && report.divergences.length) {
    addListCard(lang === 'ca' ? 'Divergències' : 'Divergencias', report.divergences);
  }

  addListCard(lang === 'ca' ? 'Prioritats' : 'Prioridades', report?.priorities || []);
  addListCard(lang === 'ca' ? 'Quick wins (2–4 setmanes)' : 'Quick wins (2–4 semanas)', report?.quickWins || []);

  if (Array.isArray(report?.sections) && report.sections.length) {
    // High-level title card
    {
      const h = 22 + page.cardPadding + 6;
      y = ensureSpace(doc, y, h);
      addCard(doc, x, y, fullW, h, lang === 'ca' ? 'Anàlisi per categories' : 'Análisis por categorías');
      y += h + 6;
    }

    for (const s of report.sections) {
      const blockTitle = String(s?.category || '').trim() || (lang === 'ca' ? 'Categoria' : 'Categoría');
      const summary = String(s?.summary || '').trim();

      const evidence = Array.isArray(s?.evidence) ? s.evidence.map(String) : [];
      const recs = Array.isArray(s?.recommendations) ? s.recommendations.map(String) : [];
      const kpis = Array.isArray(s?.suggestedKpis) ? s.suggestedKpis.map(String) : [];
      const qws = Array.isArray(s?.quickWins) ? s.quickWins.map(String) : [];

      const evidenceH = evidence.length ? (14 + measureBulletsHeight(doc, evidence, fullW - page.cardPadding * 2 - 14)) : 0;
      const recsH = recs.length ? (14 + measureBulletsHeight(doc, recs, fullW - page.cardPadding * 2 - 14)) : 0;
      const kpisH = kpis.length ? (14 + measureBulletsHeight(doc, kpis, fullW - page.cardPadding * 2 - 14)) : 0;
      const qwsH = qws.length ? (14 + measureBulletsHeight(doc, qws, fullW - page.cardPadding * 2 - 14)) : 0;
      const sumH = summary ? measureParagraphHeight(doc, summary, fullW - page.cardPadding * 2) : 0;

      const h = 22 + page.cardPadding + sumH + evidenceH + recsH + kpisH + qwsH + 10;
      y = ensureSpace(doc, y, Math.min(h, 9999));
      addCard(doc, x, y, fullW, h, blockTitle);

      let yy = y + 22 + page.cardPadding;
      if (summary) {
        yy = addCardParagraph(doc, x, yy, fullW, summary);
      }

      const addInlineList = (label: string, items: string[]) => {
        if (!items.length) return;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        setTextColor(doc, palette.muted);
        doc.text(label, x + page.cardPadding, yy);
        yy += 12;
        yy = addCardBullets(doc, x, yy, fullW, items);
        yy += 4;
      };

      addInlineList(lang === 'ca' ? 'Evidència' : 'Evidencia', evidence);
      addInlineList(lang === 'ca' ? 'Recomanacions' : 'Recomendaciones', recs);
      addInlineList(lang === 'ca' ? 'KPIs suggerits' : 'KPIs sugeridos', kpis);
      addInlineList('Quick wins', qws);

      y += h + 14;
    }
  }

  if (Array.isArray(report?.performanceMetrics) && report.performanceMetrics.length) {
    addListCard(lang === 'ca' ? 'Mètriques de rendiment (KPIs)' : 'Métricas de rendimiento (KPIs)', report.performanceMetrics.map(String));
  }

  if (Array.isArray(report?.openQuestions) && report.openQuestions.length) {
    addListCard(lang === 'ca' ? 'Preguntes obertes / buits d’informació' : 'Preguntas abiertas / vacíos de información', report.openQuestions.map(String));
  }

  addListCard(lang === 'ca' ? 'Següents passos' : 'Siguientes pasos', report?.nextSteps || []);

  addFooters(doc, lang);

  const filename = `${sanitizeFilename(centerName)}_informe.pdf`;
  doc.save(filename);
}
