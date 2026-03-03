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

const AGENT_MAP = {
  'AG-01': ag01, 'AG-02': ag02, 'AG-03': ag03, 'AG-04': ag04,
  'AG-05': ag05, 'AG-06': ag06, 'AG-07': ag07, 'AG-08': ag08,
  'AG-09': ag09, 'AG-10': ag10, 'AG-12': ag12, 'AG-13': ag13, 'AG-14': ag14,
};

async function orchestrate(datosCliente) {
  const log = (msg) => console.log(`\n[ORQUESTADOR] ${new Date().toISOString()} — ${msg}`);
  const resultados = {};

  // ═══════════════════════════════════════════════════════════
  // FASE 1 — ANÁLISIS (paralelo: AG-01, AG-02, AG-03)
  // ═══════════════════════════════════════════════════════════
  log('FASE 1: Análisis en paralelo (AG-01, AG-02, AG-03)...');
  const [res01, res02, res03] = await Promise.all([
    ag01.run(datosCliente),
    ag02.run(datosCliente),
    ag03.run(datosCliente),
  ]);
  resultados.ag01 = res01;
  resultados.ag02 = res02;
  resultados.ag03 = res03;
  log('✅ FASE 1 completada.');

  // ═══════════════════════════════════════════════════════════
  // FASE 2 — DISEÑO (AG-04 → AG-05 ∥ AG-06)
  // ═══════════════════════════════════════════════════════════
  log('FASE 2: Diseño...');

  resultados.ag04 = await ag04.run({
    ...datosCliente,
    necesidades: resultados.ag01,
    sistemas: resultados.ag03,
  });
  log('AG-04 (Arquitectura) completado.');

  const [res05, res06] = await Promise.all([
    ag05.run({ ...datosCliente, necesidades: resultados.ag01, arquitectura: resultados.ag04 }),
    ag06.run({ ...datosCliente, sistemas: resultados.ag03, arquitectura: resultados.ag04 }),
  ]);
  resultados.ag05 = res05;
  resultados.ag06 = res06;
  log('✅ FASE 2 completada.');

  // ═══════════════════════════════════════════════════════════
  // FASE 3 — PLANIFICACIÓN (AG-07 → AG-08 ∥ AG-09 ∥ AG-10)
  // ═══════════════════════════════════════════════════════════
  log('FASE 3: Planificación...');

  resultados.ag07 = await ag07.run({
    ...datosCliente,
    arquitectura: resultados.ag04,
    integraciones: resultados.ag06,
  });
  log('AG-07 (Proyecto) completado.');

  const [res08, res09, res10] = await Promise.all([
    ag08.run({ ...datosCliente, arquitectura: resultados.ag04, integraciones: resultados.ag06 }),
    ag09.run({ ...datosCliente, arquitectura: resultados.ag04, integraciones: resultados.ag06 }),
    ag10.run({ ...datosCliente, arquitectura: resultados.ag04, cronograma: resultados.ag07 }),
  ]);
  resultados.ag08 = res08;
  resultados.ag09 = res09;
  resultados.ag10 = res10;
  log('✅ FASE 3 completada.');

  // ═══════════════════════════════════════════════════════════
  // FASE 4 — DOCUMENTACIÓN (AG-11 → AG-13 → AG-12 → AG-14)
  // ═══════════════════════════════════════════════════════════
  log('FASE 4: Documentación...');

  resultados.ag11 = ag11.getStyleRules();
  log('AG-11 (Estilo) aplicado.');

  resultados.ag13 = await ag13.run({
    ...datosCliente,
    arquitectura: resultados.ag04,
    ux: resultados.ag05,
    cronograma: resultados.ag07,
  });
  log('AG-13 (Change Management) completado.');

  const consolidado = buildConsolidado(datosCliente, resultados);

  resultados.ag12 = await ag12.run(consolidado);
  log('AG-12 (Redactor) completado.');

  resultados.ag14 = await ag14.run({
    documento_integrado: resultados.ag12,
    consolidado,
  });
  log(`AG-14 (Validación): ${resultados.ag14.resultado_validacion} — score: ${resultados.ag14.puntuacion_calidad}`);

  // ═══════════════════════════════════════════════════════════
  // CICLO DE CORRECCIÓN (máx 2 iteraciones)
  // ═══════════════════════════════════════════════════════════
  let intentos = 0;
  while (resultados.ag14.resultado_validacion === 'RECHAZADO' && intentos < 2) {
    intentos++;
    log(`⚠️  Ciclo de corrección #${intentos}...`);

    const acciones = resultados.ag14.acciones_correctivas || [];
    const agentesAfectados = [...new Set(acciones.map((a) => a.agente_responsable))];

    for (const agId of agentesAfectados) {
      const agKey = agId.replace('-', '').toLowerCase();
      const agModule = AGENT_MAP[agId];
      if (!agModule) { console.warn(`Agente ${agId} no encontrado en mapa.`); continue; }
      log(`Re-ejecutando ${agId}...`);
      const correcciones = acciones.filter((a) => a.agente_responsable === agId);
      resultados[agKey] = await agModule.run({ ...consolidado, correcciones });
    }

    consolidado.correcciones_aplicadas = acciones;
    resultados.ag12 = await ag12.run(buildConsolidado(datosCliente, resultados));
    resultados.ag14 = await ag14.run({
      documento_integrado: resultados.ag12,
      consolidado,
    });
    log(`AG-14 re-validación #${intentos}: ${resultados.ag14.resultado_validacion} — score: ${resultados.ag14.puntuacion_calidad}`);
  }

  if (resultados.ag14.resultado_validacion === 'APROBADO') {
    log('✅ DOCUMENTO APROBADO — Generando .docx...');
  } else {
    log('⚠️  Documento no aprobado tras 2 correcciones — se genera igualmente con advertencias.');
  }

  // Guardar consolidado final
  const outputDir = path.join(__dirname, 'outputs');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, 'consolidado_final.json'),
    JSON.stringify({ ...buildConsolidado(datosCliente, resultados), documento: resultados.ag12 }, null, 2),
    'utf-8'
  );
  log('Consolidado guardado en outputs/consolidado_final.json');

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
  };
}

// ─── Entry point ──────────────────────────────────────────────────────────────
if (require.main === module) {
  const dataFile = process.argv[2] || 'datos_cliente.json';
  const filePath = path.isAbsolute(dataFile) ? dataFile : path.join(process.cwd(), dataFile);

  if (!fs.existsSync(filePath)) {
    console.error(`[ERROR] No se encontró el archivo: ${filePath}`);
    console.error('Uso: node orchestrator.js datos_cliente.json');
    process.exit(1);
  }

  const datos = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Adeptify Multi-Agent System — Iniciando`);
  console.log(`  Cliente: ${datos?.cliente?.nombre || 'N/A'}`);
  console.log(`${'═'.repeat(60)}\n`);

  orchestrate(datos)
    .then((doc) => {
      console.log(`\n${'═'.repeat(60)}`);
      console.log('  ✅ Proceso completado. Ejecuta ahora:');
      console.log('  node generate_docx.js outputs/consolidado_final.json');
      console.log(`${'═'.repeat(60)}\n`);
    })
    .catch((err) => {
      console.error('[ERROR FATAL]', err);
      process.exit(1);
    });
}

module.exports = { orchestrate };
