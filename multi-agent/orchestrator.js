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

/**
 * @param {object} datosCliente - Client data object
 * @param {function} [onProgress] - Optional callback(agentId, message, fase)
 */
async function orchestrate(datosCliente, onProgress) {
  const emit = (agentId, message, fase) => {
    console.log(`[${agentId}] ${message}`);
    if (typeof onProgress === 'function') onProgress(agentId, message, fase);
  };
  const resultados = {};

  // FASE 1: Analisis en paralelo
  emit('AG-01', 'Analitzant requeriments del client...', 1);
  emit('AG-02', 'Investigant mercat i competencia...', 1);
  emit('AG-03', 'Auditant sistemes existents...', 1);
  const [res01, res02, res03] = await Promise.all([
    ag01.run(datosCliente),
    ag02.run(datosCliente),
    ag03.run(datosCliente),
  ]);
  resultados.ag01 = res01; emit('AG-01', 'Requeriments completats', 1);
  resultados.ag02 = res02; emit('AG-02', 'Analisi de mercat completada', 1);
  resultados.ag03 = res03; emit('AG-03', 'Auditoria de sistemes completada', 1);

  // FASE 2: Disseny
  emit('AG-04', 'Dissenyant arquitectura de la solucio...', 2);
  resultados.ag04 = await ag04.run({
    ...datosCliente,
    necesidades: resultados.ag01,
    sistemas: resultados.ag03,
  });
  emit('AG-04', 'Arquitectura completada', 2);

  emit('AG-05', "Dissenyant experiencia d'usuari (UX/UI)...", 2);
  emit('AG-06', 'Planificant integracions de sistemes...', 2);
  const [res05, res06] = await Promise.all([
    ag05.run({ ...datosCliente, necesidades: resultados.ag01, arquitectura: resultados.ag04 }),
    ag06.run({ ...datosCliente, sistemas: resultados.ag03, arquitectura: resultados.ag04 }),
  ]);
  resultados.ag05 = res05; emit('AG-05', 'UX/UI completat', 2);
  resultados.ag06 = res06; emit('AG-06', 'Integracions completades', 2);

  // FASE 3: Planificacio
  emit('AG-07', 'Planificant projecte i cronograma...', 3);
  resultados.ag07 = await ag07.run({
    ...datosCliente,
    arquitectura: resultados.ag04,
    integraciones: resultados.ag06,
  });
  emit('AG-07', 'Pla de projecte completat', 3);

  emit('AG-08', 'Definint estrategia DevOps...', 3);
  emit('AG-09', 'Avaluant seguretat i compliment RGPD...', 3);
  emit('AG-10', 'Calculant proposta economica i ROI...', 3);
  const [res08, res09, res10] = await Promise.all([
    ag08.run({ ...datosCliente, arquitectura: resultados.ag04, integraciones: resultados.ag06 }),
    ag09.run({ ...datosCliente, arquitectura: resultados.ag04, integraciones: resultados.ag06 }),
    ag10.run({ ...datosCliente, arquitectura: resultados.ag04, cronograma: resultados.ag07 }),
  ]);
  resultados.ag08 = res08; emit('AG-08', 'DevOps completat', 3);
  resultados.ag09 = res09; emit('AG-09', 'Seguretat i RGPD completats', 3);
  resultados.ag10 = res10; emit('AG-10', 'Proposta economica completada', 3);

  // FASE 4: Documentacio
  resultados.ag11 = ag11.getStyleRules();
  emit('AG-11', 'Estil visual Adeptify aplicat', 4);

  emit('AG-13', 'Elaborant pla de gestio del canvi...', 4);
  resultados.ag13 = await ag13.run({
    ...datosCliente,
    arquitectura: resultados.ag04,
    ux: resultados.ag05,
    cronograma: resultados.ag07,
  });
  emit('AG-13', 'Gestio del canvi completada', 4);

  const consolidado = buildConsolidado(datosCliente, resultados);

  emit('AG-12', 'Redactant document final integrat (pot trigar 1-2 min)...', 4);
  resultados.ag12 = await ag12.run(consolidado);
  emit('AG-12', 'Document redactat', 4);

  emit('AG-14', 'Validant qualitat del document...', 4);
  resultados.ag14 = await ag14.run({
    documento_integrado: resultados.ag12,
    consolidado,
  });
  emit('AG-14', `Validacio: ${resultados.ag14.resultado_validacion} (score: ${resultados.ag14.puntuacion_calidad})`, 4);

  // Cicle de correccio (max 2 iteracions)
  let intentos = 0;
  while (resultados.ag14.resultado_validacion === 'RECHAZADO' && intentos < 2) {
    intentos++;
    emit('AG-14', `Cicle de correccio #${intentos}...`, 4);
    const acciones = resultados.ag14.acciones_correctivas || [];
    const agentesAfectados = [...new Set(acciones.map((a) => a.agente_responsable))];

    for (const agId of agentesAfectados) {
      const agKey = agId.replace('-', '').toLowerCase();
      const agModule = AGENT_MAP[agId];
      if (!agModule) { console.warn(`Agent ${agId} no trobat.`); continue; }
      emit(agId, `Re-executant per correccions...`, 4);
      const correccions = acciones.filter((a) => a.agente_responsable === agId);
      resultados[agKey] = await agModule.run({ ...consolidado, correccions });
    }

    consolidado.correcciones_aplicadas = acciones;
    resultados.ag12 = await ag12.run(buildConsolidado(datosCliente, resultados));
    resultados.ag14 = await ag14.run({
      documento_integrado: resultados.ag12,
      consolidado,
    });
    emit('AG-14', `Re-validacio #${intentos}: ${resultados.ag14.resultado_validacion} (${resultados.ag14.puntuacion_calidad})`, 4);
  }

  if (resultados.ag14.resultado_validacion === 'APROBADO') {
    emit('ORQUESTADOR', 'Document APROVAT', 4);
  } else {
    emit('ORQUESTADOR', 'Document generat amb advertencies (2 cicles esgotats)', 4);
  }

  // Guardar consolidado final
  const outputDir = path.join(__dirname, 'outputs');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, 'consolidado_final.json'),
    JSON.stringify({ ...buildConsolidado(datosCliente, resultados), documento: resultados.ag12 }, null, 2),
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
  };
}

// Entry point
if (require.main === module) {
  const dataFile = process.argv[2] || 'datos_cliente.json';
  const filePath = path.isAbsolute(dataFile) ? dataFile : path.join(process.cwd(), dataFile);

  if (!fs.existsSync(filePath)) {
    console.error(`[ERROR] No se encontro el archivo: ${filePath}`);
    process.exit(1);
  }

  const datos = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  orchestrate(datos)
    .then(() => console.log('\nProceso completado. Ejecuta: node generate_docx.js outputs/consolidado_final.json'))
    .catch((err) => { console.error('[ERROR FATAL]', err); process.exit(1); });
}

module.exports = { orchestrate };
