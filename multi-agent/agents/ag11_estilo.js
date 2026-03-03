'use strict';

/**
 * AG-11 — Director de Estilo
 * Módulo estático — NO llama a la API de Anthropic.
 * Retorna las reglas de formato y estilo de Adeptify Systems.
 */
function getStyleRules() {
  return {
    marca: {
      nombre: 'Adeptify Systems',
      claim: 'Ens adaptem a la teva realitat. Com un camaleó digital, cada solució és única.',
      web: 'https://adeptify.es',
    },
    colores: {
      meteorite_dark: '2F1C6A',
      primary_purple: '673DE6',
      meteorite_light: '8C85FF',
      texto_principal: '333333',
      texto_secundario: '666666',
      fondo_tablas_par: 'F3F0FF',
      fondo_tablas_impar: 'FFFFFF',
      bordes_tablas: 'D4CCFF',
      header_tablas_bg: '2F1C6A',
      header_tablas_text: 'FFFFFF',
      fondo_portada: '2F1C6A',
      acento_portada: '8C85FF',
    },
    tipografia: {
      principal: 'Lato',
      fallback: 'Arial',
      // docx usa half-points (1pt = 2 half-points)
      h1: { font: 'Lato', size: 32, bold: true, color: '2F1C6A', spacing_after: 200 },
      h2: { font: 'Lato', size: 26, bold: true, color: '673DE6', spacing_after: 160 },
      h3: { font: 'Lato', size: 22, bold: true, color: '8C85FF', spacing_after: 120 },
      body: { font: 'Lato', size: 22, color: '333333', spacing_after: 120, line_rule: 'auto', line: 276 },
      tabla_header: { font: 'Lato', size: 20, bold: true, color: 'FFFFFF' },
      tabla_body: { font: 'Lato', size: 20, color: '333333' },
      caption: { font: 'Lato', size: 18, color: '666666', italic: true },
      header_footer: { font: 'Lato', size: 16, color: '666666' },
    },
    pagina: {
      tamano: 'A4',
      width: 11906,
      height: 16838,
      margin_top: 1440,
      margin_bottom: 1440,
      margin_left: 1440,
      margin_right: 1440,
      content_width: 9026, // 11906 - 1440 - 1440
    },
    tablas: {
      width_total: 9026,
      width_type: 'DXA',
      shading_type: 'CLEAR',
      cell_margin_top: 80,
      cell_margin_bottom: 80,
      cell_margin_left: 120,
      cell_margin_right: 120,
      border_color: 'D4CCFF',
      border_size: 4,
      border_style: 'single',
    },
    espaciado: {
      spacing_after_paragraph: 120,
      spacing_after_heading: 160,
      indent_first_line: 0,
      page_break_before_h1: true,
    },
  };
}

module.exports = { getStyleRules };
