/*
  Generate a single SQL file containing all Catalonia education centers (TOTCAT CSV)
  as batched UPSERT statements.

  This is useful when you want to import via the Supabase SQL Editor (no \copy)
  or any SQL client.

  Usage:
    node scripts/generate-centers-cat-sql.js totcat-centres-educatius.csv supabase/cat_education_centers_import.sql
*/

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const TABLE = 'public.cat_education_centers';

const COLUMNS = [
  'codi_centre',
  'denominacio_completa',
  'codi_naturalesa',
  'nom_naturalesa',
  'codi_titularitat',
  'nom_titularitat',
  'adreca',
  'codi_postal',
  'telefon',
  'codi_delegacio',
  'nom_delegacio',
  'codi_comarca',
  'nom_comarca',
  'codi_municipi',
  'nom_municipi',
  'codi_districte_municipal',
  'nom_dm',
  'codi_localitat',
  'nom_localitat',
  'coordenades_utm_x',
  'coordenades_utm_y',
  'coordenades_geo_x',
  'coordenades_geo_y',
  'email_centre',
  'estudis',
  'einf1c',
  'einf2c',
  'epri',
  'eso',
  'batx',
  'aa01',
  'cfpm',
  'ppas',
  'aa03',
  'cfps',
  'ee',
  'ife',
  'pfi',
  'pa01',
  'cfam',
  'pa02',
  'cfas',
  'esdi',
  'escm',
  'escs',
  'adr',
  'crbc',
  'idi',
  'dane',
  'danp',
  'dans',
  'muse',
  'musp',
  'muss',
  'tegm',
  'tegs',
  'estr',
  'adults',
];

const BOOLEAN_COLUMNS = new Set([
  'einf1c', 'einf2c', 'epri', 'eso', 'batx', 'aa01', 'cfpm', 'ppas', 'aa03', 'cfps', 'ee', 'ife', 'pfi',
  'pa01', 'cfam', 'pa02', 'cfas', 'esdi', 'escm', 'escs', 'adr', 'crbc', 'idi', 'dane', 'danp', 'dans',
  'muse', 'musp', 'muss', 'tegm', 'tegs', 'estr', 'adults',
]);

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function normalizeHeaderToSnake(raw) {
  return String(raw || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function sqlStringOrNull(value) {
  const s = String(value ?? '').trim();
  if (!s) return 'NULL';
  return `'${s.replace(/'/g, "''")}'`;
}

function sqlIntOrNull(value) {
  const s = String(value ?? '').trim();
  if (!s) return 'NULL';
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? String(n) : 'NULL';
}

function sqlFloatCommaOrNull(value) {
  const s = String(value ?? '').trim();
  if (!s) return 'NULL';
  const n = Number.parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? String(n) : 'NULL';
}

function sqlBoolFromPresence(value) {
  const s = String(value ?? '').trim();
  return s ? 'TRUE' : 'FALSE';
}

function buildUpsertSetClause() {
  // Exclude PK.
  return COLUMNS
    .filter((c) => c !== 'codi_centre')
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(',\n  ');
}

function rowToValues(row) {
  const get = (key) => row[key];

  const values = [];
  for (const col of COLUMNS) {
    if (BOOLEAN_COLUMNS.has(col)) {
      values.push(sqlBoolFromPresence(get(col)));
      continue;
    }

    if (col === 'coordenades_utm_x' || col === 'coordenades_utm_y') {
      values.push(sqlIntOrNull(get(col)));
      continue;
    }

    if (col === 'coordenades_geo_x' || col === 'coordenades_geo_y') {
      values.push(sqlFloatCommaOrNull(get(col)));
      continue;
    }

    values.push(sqlStringOrNull(get(col)));
  }

  return `(${values.join(', ')})`;
}

function main() {
  const csvArg = process.argv[2];
  const outArg = process.argv[3];
  if (!csvArg || !outArg) {
    die('Usage: node scripts/generate-centers-cat-sql.js <csvPath> <outSqlPath>');
  }

  const csvPath = path.isAbsolute(csvArg) ? csvArg : path.join(process.cwd(), csvArg);
  const outPath = path.isAbsolute(outArg) ? outArg : path.join(process.cwd(), outArg);

  if (!fs.existsSync(csvPath)) die(`CSV not found: ${csvPath}`);

  const raw = fs.readFileSync(csvPath, 'latin1');
  const recordsRaw = parse(raw, {
    columns: true,
    delimiter: ';',
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
    trim: true,
  });

  if (!Array.isArray(recordsRaw) || recordsRaw.length === 0) {
    die('CSV parsed but no rows found.');
  }

  const records = recordsRaw.map((r) => {
    const out = {};
    for (const [k, v] of Object.entries(r)) {
      out[normalizeHeaderToSnake(k)] = v;
    }
    return out;
  });

  const valid = records
    .map((row) => {
      // Ensure we also accept email header variants.
      if (row.e_mail_centre && !row.email_centre) row.email_centre = row.e_mail_centre;
      return row;
    })
    .filter((r) => String(r.codi_centre || '').trim() && String(r.denominacio_completa || '').trim());

  const batchSize = 250;
  const setClause = buildUpsertSetClause();

  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const header = [
    '-- Generated file. Do not edit manually.',
    `-- Source: ${path.basename(csvPath)}`,
    `-- Rows (valid): ${valid.length}`,
    '',
    'BEGIN;',
    "SET statement_timeout = '0';",
    'SET client_min_messages = WARNING;',
    '',
  ].join('\n');

  const parts = [header];

  for (let i = 0; i < valid.length; i += batchSize) {
    const batch = valid.slice(i, i + batchSize);
    const valuesSql = batch.map(rowToValues).join(',\n');

    parts.push(
      `INSERT INTO ${TABLE} (${COLUMNS.join(', ')})\nVALUES\n${valuesSql}\nON CONFLICT (codi_centre) DO UPDATE SET\n  ${setClause};\n`
    );
  }

  parts.push('COMMIT;');
  parts.push(`SELECT COUNT(*) AS cat_education_centers_count FROM ${TABLE};`);
  parts.push('');

  fs.writeFileSync(outPath, parts.join('\n'), 'utf8');
  console.log(`Wrote SQL: ${outPath}`);
}

main();
