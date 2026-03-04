'use strict';
const fs = require('fs');
const path = require('path');

const ag01 = require('./agents/ag01_requerimientos');
const ag02 = require('./agents/ag02_mercado');
const ag03 = require('./agents/ag03_auditoria');
const ag04 = require('./agents/ag04_arquitectura');
const ag05 = require('./agents/ag05_ux');
const ag06 = require('./agents/ag06_integraciones');
const ag07 = require('./agents/ag07_proyecto');
const ag08 = require('./agents/ag08_devops');
const ag09 = require('./agents/ag09_seguridad');
const ag10 = require('./agents/ag10_financiero');
const ag11 = require('./agents/ag11_estilo');
const ag12 = require('./agents/ag12_redactor');
const ag13 = require('./agents/ag13_change');
const ag14 = require('./agents/ag14_validador');
const ag15 = require('./agents/ag15_compliance');

const AGENT_MAP = {
  'AG-01': ag01, 'AG-02': ag02, 'AG-03': ag03, 'AG-04': ag04,
  'AG-05': ag05, 'AG-06': ag06, 'AG-07': ag07, 'AG-08': ag08,
  'AG-09': ag09, 'AG-10': ag10, 'AG-12': ag12, 'AG-13': ag13, 'AG-14': ag14,
};

// ── Budget control ────────────────────────────────────────────────────────────
const PRICE_INPUT_PER_M = 3.00;   // USD per million tokens (claude-sonnet-4-6)
const PRICE_OUTPUT_PER_M = 15.00;
const USD_TO_EUR = 0.92;
const BUDGET_WARN_EUR = 1.50;   // warn user
const BUDGET_STOP_EUR = 5.00;   // hard stop (abort remaining agents)

// ── AG-12 compact input ───────────────────────────────────────────────────────
// AG-12 receives ALL previous outputs — we trim to avoid exceeding context limits
// and hitting the 8192-token output ceiling (which causes "Unterminated JSON").
function buildAG12Input(consolidado) {
  const d = consolidado;

  const first = (arr, n = 3) => Array.isArray(arr) ? arr.slice(0, n) : [];
  const short = (s, max = 600) => typeof s === 'string' && s.length > max ? s.slice(0, max) + '…' : (s || '');

  return {
    datos_cliente: d.datos_cliente,

    // AG-01: summary + top 5 needs (not all 15)
    ag01_necesidades: {
      resumen_ejecutivo_necesidades: short(d.ag01_necesidades?.resumen_ejecutivo_necesidades, 800),
      necesidades: first(d.ag01_necesidades?.necesidades, 5).map(n => ({
        id: n.id, categoria: n.categoria, descripcion: short(n.descripcion, 200),
        impacto: n.impacto, prioridad_calculada: n.prioridad_calculada, kpi_asociado: short(n.kpi_asociado, 120),
      })),
    },

    // AG-02: context + 2 cases
    ag02_mercado: {
      contexto_sectorial: short(d.ag02_mercado?.analisis_entorno?.contexto_sectorial, 800),
      tendencias_clave: first(d.ag02_mercado?.analisis_entorno?.tendencias_clave, 4),
      oportunidades: first(d.ag02_mercado?.analisis_entorno?.oportunidades, 3),
      amenazas: first(d.ag02_mercado?.analisis_entorno?.amenazas, 3),
      casos_exito: first(d.ag02_mercado?.casos_exito, 2).map(c => ({
        titulo: c.titulo, sector: c.sector, reto: short(c.reto, 200),
        solucion_implementada: short(c.solucion_implementada, 200),
        resultados_cuantitativos: c.resultados_cuantitativos,
      })),
    },

    // AG-03: diagnosis summary only
    ag03_auditoria: {
      nivel_madurez_digital: d.ag03_auditoria?.diagnostico_procesos?.nivel_madurez_digital,
      cuello_botella_principal: short(d.ag03_auditoria?.diagnostico_procesos?.cuello_botella_principal, 400),
      procesos_manuales: first(d.ag03_auditoria?.diagnostico_procesos?.procesos_manuales, 4),
      sistemas: first(d.ag03_auditoria?.inventario_sistemas, 4).map(s => ({
        sistema: s.sistema, tipo: s.tipo, integrabilidad: s.integrabilidad, funcion_actual: short(s.funcion_actual, 120),
      })),
      oportunidades_integracion: first(d.ag03_auditoria?.oportunidades_integracion, 3),
    },

    // AG-04: vision + components (critical — keep most)
    ag04_arquitectura: {
      vision_general: short(d.ag04_arquitectura?.vision_general, 800),
      diferenciadores: first(d.ag04_arquitectura?.diferenciadores, 4).map(df => ({
        diferenciador: df.diferenciador, valor_cliente: short(df.valor_cliente, 200),
      })),
      componentes_solucion: d.ag04_arquitectura?.componentes_solucion,
      arquitectura: {
        capas: d.ag04_arquitectura?.arquitectura?.capas,
        flujo_datos_principal: d.ag04_arquitectura?.arquitectura?.flujo_datos_principal,
      },
    },

    // AG-05: just dashboard + notification types (UX detail not needed in doc)
    ag05_ux: {
      dashboard_principal: d.ag05_ux?.dashboard_principal,
      puntos_contacto: first(d.ag05_ux?.puntos_contacto, 2).map(p => ({
        nombre: p.nombre, usuario_objetivo: p.usuario_objetivo, canal: p.canal,
      })),
    },

    // AG-06: diagram text + 3 main integrations
    ag06_integraciones: {
      diagrama_flujo_integraciones: short(d.ag06_integraciones?.diagrama_flujo_integraciones, 500),
      middleware_central: d.ag06_integraciones?.middleware_central,
      mapa_integraciones: first(d.ag06_integraciones?.mapa_integraciones, 4).map(i => ({
        id: i.id, nombre: i.nombre, origen: i.origen, destino: i.destino, frecuencia: i.frecuencia,
      })),
    },

    // AG-07: full (methodology, schedule, risks, next steps are core doc content)
    ag07_proyecto: {
      metodologia: d.ag07_proyecto?.metodologia,
      cronograma: {
        duracion_total: d.ag07_proyecto?.cronograma?.duracion_total,
        fases: first(d.ag07_proyecto?.cronograma?.fases, 6).map(f => ({
          nombre: f.nombre, duracion: f.duracion, entregables: f.entregables,
        })),
        hitos_clave: first(d.ag07_proyecto?.cronograma?.hitos_clave, 5),
      },
      riesgos: first(d.ag07_proyecto?.riesgos, 5).map(r => ({
        id: r.id, riesgo: short(r.riesgo, 150), probabilidad: r.probabilidad,
        impacto: r.impacto, mitigacion: short(r.mitigacion, 200),
      })),
      proximos_pasos: first(d.ag07_proyecto?.proximos_pasos, 5),
    },

    // AG-08: deployment strategy summary
    ag08_devops: {
      enfoque: d.ag08_devops?.estrategia_despliegue?.enfoque,
      entornos: d.ag08_devops?.estrategia_despliegue?.entornos,
      garantia_tecnica: d.ag08_devops?.garantia_tecnica,
      backup_recovery: {
        RTO: d.ag08_devops?.backup_recovery?.RTO,
        RPO: d.ag08_devops?.backup_recovery?.RPO,
      },
    },

    // AG-09: RGPD + confidentiality clause (verbatim — needed in document)
    ag09_seguridad: {
      cumplimiento_rgpd: d.ag09_seguridad?.cumplimiento_rgpd,
      confidencialidad: d.ag09_seguridad?.confidencialidad,
      medidas_tecnicas: first(d.ag09_seguridad?.evaluacion_seguridad?.medidas_tecnicas, 4),
    },

    // AG-10: full economic proposal (critical — numbers must be exact)
    ag10_financiero: d.ag10_financiero,

    // AG-13: training plan (3 sessions max)
    ag13_change: {
      plan_formacion: first(d.ag13_change?.plan_change_management?.plan_formacion, 3).map(s => ({
        sesion: s.sesion, audiencia: s.audiencia, duracion: s.duracion, formato: s.formato,
      })),
      soporte_post_formacion: d.ag13_change?.plan_change_management?.soporte_post_formacion,
    },
  };
}

/**
 * @param {object} datosCliente
 * @param {function} [onProgress] - callback(agentId, message, fase)
 */
async function orchestrate(datosCliente, onProgress) {
  const tokens = { input: 0, output: 0 };
  let budgetExceeded = false;

  const onTokens = (usage, agentId) => {
    if (!usage || budgetExceeded) return;
    tokens.input += usage.input_tokens || 0;
    tokens.output += usage.output_tokens || 0;
    const costUSD = (tokens.input / 1e6 * PRICE_INPUT_PER_M) + (tokens.output / 1e6 * PRICE_OUTPUT_PER_M);
    const costEUR = costUSD * USD_TO_EUR;

    if (typeof onProgress === 'function') {
      onProgress('TOKENS', JSON.stringify({
        agent: agentId,
        delta_input: usage.input_tokens || 0,
        delta_output: usage.output_tokens || 0,
        total_input: tokens.input,
        total_output: tokens.output,
        cost_eur: Math.round(costEUR * 1000) / 1000,
        budget_eur: BUDGET_STOP_EUR,
        budget_pct: Math.min(100, Math.round((costEUR / BUDGET_STOP_EUR) * 100)),
      }), -1);
    }

    if (costEUR >= BUDGET_STOP_EUR) {
      budgetExceeded = true;
      throw new Error(`Pressupost superat: ${costEUR.toFixed(2)} EUR > limit ${BUDGET_STOP_EUR} EUR. Atura operació per evitar despeses addicionals.`);
    }
    if (costEUR >= BUDGET_WARN_EUR) {
      if (typeof onProgress === 'function') {
        onProgress('BUDGET', `Avís: cost actual ${costEUR.toFixed(2)} EUR / limit ${BUDGET_STOP_EUR} EUR`, 0);
      }
    }
  };

  const emit = (agentId, message, fase) => {
    console.log(`[${agentId}] ${message}`);
    if (typeof onProgress === 'function') onProgress(agentId, message, fase);
  };

  const inp = (extra) => ({ ...datosCliente, ...extra, _onTokens: onTokens });

  const resultados = {};

  // FASE 1
  emit('AG-01', 'Analitzant requeriments del client...', 1);
  emit('AG-02', 'Investigant mercat i competencia...', 1);
  emit('AG-03', 'Auditant sistemes existents...', 1);
  const [res01, res02, res03] = await Promise.all([
    ag01.run(inp({})),
    ag02.run(inp({})),
    ag03.run(inp({})),
  ]);
  resultados.ag01 = res01; emit('AG-01', 'Requeriments completats', 1);
  resultados.ag02 = res02; emit('AG-02', 'Analisi de mercat completada', 1);
  resultados.ag03 = res03; emit('AG-03', 'Auditoria de sistemes completada', 1);

  // FASE 2
  emit('AG-04', 'Dissenyant arquitectura de la solucio...', 2);
  resultados.ag04 = await ag04.run(inp({ necesidades: resultados.ag01, sistemas: resultados.ag03 }));
  emit('AG-04', 'Arquitectura completada', 2);

  emit('AG-05', "Dissenyant experiencia d'usuari (UX/UI)...", 2);
  emit('AG-06', 'Planificant integracions de sistemes...', 2);
  let res05 = {}, res06 = {};
  try {
    const [r5, r6] = await Promise.all([
      ag05.run(inp({ necesidades: resultados.ag01, arquitectura: resultados.ag04 })),
      ag06.run(inp({ sistemas: resultados.ag03, arquitectura: resultados.ag04 })),
    ]);
    res05 = r5; res06 = r6;
  } catch (e05_06) {
    console.error('[ERROR FASE-2] AG-05/AG-06:', e05_06.message);
    emit('AG-05', `AVÍS: Error en fase 2 — ${e05_06.message}. Continuant amb dades parcials...`, 2);
  }
  resultados.ag05 = res05; emit('AG-05', 'UX/UI completat', 2);
  resultados.ag06 = res06; emit('AG-06', 'Integracions completades', 2);

  // FASE 3
  emit('AG-07', 'Planificant projecte i cronograma...', 3);
  resultados.ag07 = await ag07.run(inp({ arquitectura: resultados.ag04, integraciones: resultados.ag06 }));
  emit('AG-07', 'Pla de projecte completat', 3);

  emit('AG-08', 'Definint estrategia DevOps...', 3);
  emit('AG-09', 'Avaluant seguretat i compliment RGPD...', 3);
  emit('AG-10', 'Calculant proposta economica i ROI...', 3);
  emit('AG-15', 'Generant marc legal i compliance exhaustiu (RGPD, cookies, EU AI Act)...', 3);
  const [res08, res09, res10, res15] = await Promise.all([
    ag08.run(inp({ arquitectura: resultados.ag04, integraciones: resultados.ag06 })),
    ag09.run(inp({ arquitectura: resultados.ag04, integraciones: resultados.ag06 })),
    ag10.run(inp({ arquitectura: resultados.ag04, cronograma: resultados.ag07 })),
    ag15.run(inp({ datos_cliente: datosCliente, arquitectura: resultados.ag04, integraciones: resultados.ag06, auditoria: resultados.ag03 })),
  ]);
  resultados.ag08 = res08; emit('AG-08', 'DevOps completat', 3);
  resultados.ag09 = res09; emit('AG-09', 'Seguretat i RGPD completats', 3);
  resultados.ag10 = res10; emit('AG-10', 'Proposta economica completada', 3);
  resultados.ag15 = res15; emit('AG-15', 'Compliance legal i normativa completats', 3);

  // FASE 4
  resultados.ag11 = ag11.getStyleRules();
  emit('AG-11', 'Estil visual Adeptify aplicat', 4);

  emit('AG-13', 'Elaborant pla de gestio del canvi...', 4);
  resultados.ag13 = await ag13.run(inp({ arquitectura: resultados.ag04, ux: resultados.ag05, cronograma: resultados.ag07 }));
  emit('AG-13', 'Gestio del canvi completada', 4);

  const consolidado = buildConsolidado(datosCliente, resultados);

  // AG-12 gets a COMPACT version to avoid JSON truncation
  const ag12Input = buildAG12Input(consolidado);
  const ag12InputSize = JSON.stringify(ag12Input).length;
  emit('AG-12', `Redactant document final (input compacte: ${Math.round(ag12InputSize / 1024)}KB)...`, 4);
  resultados.ag12 = await ag12.run({ ...ag12Input, _onTokens: onTokens });
  emit('AG-12', 'Document redactat', 4);

  emit('AG-14', 'Validant qualitat del document...', 4);
  resultados.ag14 = await ag14.run({ documento_integrado: resultados.ag12, consolidado: ag12Input, _onTokens: onTokens });
  emit('AG-14', `Validacio: ${resultados.ag14.resultado_validacion} (score: ${resultados.ag14.puntuacion_calidad})`, 4);

  // Cicle de correccio (max 2 iteracions)
  let intentos = 0;
  while (resultados.ag14.resultado_validacion === 'RECHAZADO' && intentos < 2 && !budgetExceeded) {
    intentos++;
    emit('AG-14', `Cicle de correccio #${intentos}...`, 4);
    const acciones = resultados.ag14.acciones_correctivas || [];
    const agentesAfectados = [...new Set(acciones.map((a) => a.agente_responsable))];

    for (const agId of agentesAfectados) {
      const agKey = agId.replace('-', '').toLowerCase();
      const agModule = AGENT_MAP[agId];
      if (!agModule) continue;
      emit(agId, `Re-executant per correccions...`, 4);
      resultados[agKey] = await agModule.run({ ...ag12Input, _onTokens: onTokens });
    }

    resultados.ag12 = await ag12.run({ ...buildAG12Input(buildConsolidado(datosCliente, resultados)), _onTokens: onTokens });
    resultados.ag14 = await ag14.run({ documento_integrado: resultados.ag12, consolidado: ag12Input, _onTokens: onTokens });
    emit('AG-14', `Re-validacio #${intentos}: ${resultados.ag14.resultado_validacion} (${resultados.ag14.puntuacion_calidad})`, 4);
  }

  if (resultados.ag14.resultado_validacion === 'APROBADO') {
    emit('ORQUESTADOR', 'Document APROVAT', 4);
  } else {
    emit('ORQUESTADOR', 'Document generat amb advertencies', 4);
  }

  const outputDir = path.join(__dirname, 'outputs');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, 'consolidado_final.json'),
    JSON.stringify({ ...consolidado, documento: resultados.ag12 }, null, 2),
    'utf-8'
  );

  return resultados.ag12;
}

function buildConsolidado(datosCliente, resultados) {
  return {
    datos_cliente: datosCliente,
    ag01_necesidades: resultados.ag01,
    ag02_mercado: resultados.ag02,
    ag03_auditoria: resultados.ag03,
    ag04_arquitectura: resultados.ag04,
    ag05_ux: resultados.ag05,
    ag06_integraciones: resultados.ag06,
    ag07_proyecto: resultados.ag07,
    ag08_devops: resultados.ag08,
    ag09_seguridad: resultados.ag09,
    ag10_financiero: resultados.ag10,
    ag11_estilo: resultados.ag11,
    ag13_change: resultados.ag13,
    ag15_compliance: resultados.ag15,
  };
}

if (require.main === module) {
  const dataFile = process.argv[2] || 'datos_cliente.json';
  const filePath = path.isAbsolute(dataFile) ? dataFile : path.join(process.cwd(), dataFile);
  if (!fs.existsSync(filePath)) { console.error(`[ERROR] No trobat: ${filePath}`); process.exit(1); }
  const datos = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  orchestrate(datos)
    .then(() => console.log('\nComplet. Executa: node generate_docx.js outputs/consolidado_final.json'))
    .catch((err) => { console.error('[ERROR FATAL]', err); process.exit(1); });
}

module.exports = { orchestrate, BUDGET_STOP_EUR, BUDGET_WARN_EUR };
