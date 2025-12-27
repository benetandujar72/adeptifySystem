import jsPDF from 'jspdf';
import { CenterReport } from '../types';
import { DafoResult } from './geminiService';

type Lang = 'ca' | 'es';

const page = {
  margin: 48,
  lineHeight: 14,
};

function ensureSpace(doc: jsPDF, y: number, extra: number) {
  const height = doc.internal.pageSize.getHeight();
  if (y + extra <= height - page.margin) return y;
  doc.addPage();
  return page.margin;
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

function sanitizeFilename(name: string) {
  return (name || 'centre').replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '_');
}

export function downloadDafoPdf(centerName: string, dafo: DafoResult, lang: Lang = 'ca') {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = page.margin;

  const title = lang === 'ca' ? `DAFO del centre — ${centerName}` : `DAFO del centro — ${centerName}`;
  y = addTitle(doc, title, y);

  const generatedAt = dafo?.meta?.generatedAt ? new Date(dafo.meta.generatedAt).toLocaleString() : new Date().toLocaleString();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  y = ensureSpace(doc, y, 14);
  doc.text((lang === 'ca' ? 'Generat: ' : 'Generado: ') + generatedAt, page.margin, y);
  y += 18;

  y = addSubTitle(doc, lang === 'ca' ? 'Resum executiu' : 'Resumen ejecutivo', y);
  y = addParagraph(doc, dafo?.summary || '', y);

  y = addSubTitle(doc, lang === 'ca' ? 'Fortaleses' : 'Fortalezas', y);
  y = addBullets(doc, dafo?.strengths || [], y);

  y = addSubTitle(doc, lang === 'ca' ? 'Debilitats' : 'Debilidades', y);
  y = addBullets(doc, dafo?.weaknesses || [], y);

  y = addSubTitle(doc, lang === 'ca' ? 'Oportunitats' : 'Oportunidades', y);
  y = addBullets(doc, dafo?.opportunities || [], y);

  y = addSubTitle(doc, lang === 'ca' ? 'Amenaces' : 'Amenazas', y);
  y = addBullets(doc, dafo?.threats || [], y);

  if (Array.isArray(dafo?.quickWins) && dafo.quickWins.length) {
    y = addSubTitle(doc, lang === 'ca' ? 'Quick wins' : 'Quick wins', y);
    y = addBullets(doc, dafo.quickWins, y);
  }

  if (Array.isArray(dafo?.risksAndMitigations) && dafo.risksAndMitigations.length) {
    y = addSubTitle(doc, lang === 'ca' ? 'Riscos i mitigacions' : 'Riesgos y mitigaciones', y);
    const lines = dafo.risksAndMitigations.map(r => `${r.risk} — ${r.mitigation}`);
    y = addBullets(doc, lines, y);
  }

  const filename = `${sanitizeFilename(centerName)}_DAFO.pdf`;
  doc.save(filename);
}

export function downloadCenterReportPdf(centerName: string, report: CenterReport, lang: Lang = 'ca') {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = page.margin;

  const title = lang === 'ca' ? `Informe del centre — ${centerName}` : `Informe del centro — ${centerName}`;
  y = addTitle(doc, title, y);

  const generatedAt = report?.meta?.generatedAt ? new Date(report.meta.generatedAt).toLocaleString() : new Date().toLocaleString();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  y = ensureSpace(doc, y, 14);
  doc.text((lang === 'ca' ? 'Generat: ' : 'Generado: ') + generatedAt, page.margin, y);
  y += 18;

  y = addSubTitle(doc, lang === 'ca' ? 'Resum executiu' : 'Resumen ejecutivo', y);
  y = addParagraph(doc, report?.executiveSummary || '', y);

  y = addSubTitle(doc, lang === 'ca' ? 'Consens (el que es repeteix)' : 'Consenso (lo que se repite)', y);
  y = addBullets(doc, report?.consensus || [], y);

  if (Array.isArray(report?.divergences) && report.divergences.length) {
    y = addSubTitle(doc, lang === 'ca' ? 'Divergències' : 'Divergencias', y);
    y = addBullets(doc, report.divergences, y);
  }

  y = addSubTitle(doc, lang === 'ca' ? 'Prioritats' : 'Prioridades', y);
  y = addBullets(doc, report?.priorities || [], y);

  y = addSubTitle(doc, lang === 'ca' ? 'Quick wins (2–4 setmanes)' : 'Quick wins (2–4 semanas)', y);
  y = addBullets(doc, report?.quickWins || [], y);

  if (Array.isArray(report?.sections) && report.sections.length) {
    y = addSubTitle(doc, lang === 'ca' ? 'Anàlisi per categories' : 'Análisis por categorías', y);
    for (const section of report.sections) {
      const cat = String(section?.category || '').trim();
      if (cat) {
        y = addSubTitle(doc, cat, y);
      }

      if (section?.summary) {
        y = addParagraph(doc, String(section.summary), y);
      }

      if (Array.isArray(section?.evidence) && section.evidence.length) {
        y = addSubTitle(doc, lang === 'ca' ? 'Evidència' : 'Evidencia', y);
        y = addBullets(doc, section.evidence.map(String), y);
      }

      if (Array.isArray(section?.recommendations) && section.recommendations.length) {
        y = addSubTitle(doc, lang === 'ca' ? 'Recomanacions' : 'Recomendaciones', y);
        y = addBullets(doc, section.recommendations.map(String), y);
      }

      if (Array.isArray(section?.suggestedKpis) && section.suggestedKpis.length) {
        y = addSubTitle(doc, lang === 'ca' ? 'KPIs suggerits' : 'KPIs sugeridos', y);
        y = addBullets(doc, section.suggestedKpis.map(String), y);
      }

      if (Array.isArray(section?.quickWins) && section.quickWins.length) {
        y = addSubTitle(doc, lang === 'ca' ? 'Quick wins (categoria)' : 'Quick wins (categoría)', y);
        y = addBullets(doc, section.quickWins.map(String), y);
      }
    }
  }

  if (Array.isArray(report?.performanceMetrics) && report.performanceMetrics.length) {
    y = addSubTitle(doc, lang === 'ca' ? 'Mètriques de rendiment (KPIs)' : 'Métricas de rendimiento (KPIs)', y);
    y = addBullets(doc, report.performanceMetrics.map(String), y);
  }

  if (Array.isArray(report?.openQuestions) && report.openQuestions.length) {
    y = addSubTitle(doc, lang === 'ca' ? 'Preguntes obertes / buits d’informació' : 'Preguntas abiertas / vacíos de información', y);
    y = addBullets(doc, report.openQuestions.map(String), y);
  }

  y = addSubTitle(doc, lang === 'ca' ? 'Següents passos' : 'Siguientes pasos', y);
  y = addBullets(doc, report?.nextSteps || [], y);

  const filename = `${sanitizeFilename(centerName)}_informe.pdf`;
  doc.save(filename);
}
