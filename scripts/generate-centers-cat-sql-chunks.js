/*
  Generate multiple SQL files (chunks) from TOTCAT CSV so each chunk is small
  enough to run via the Supabase SQL Editor.

  Usage:
    node scripts/generate-centers-cat-sql-chunks.js totcat-centres-educatius.csv supabase/import_chunks 200000

  Args:
    1) csvPath
    2) outDir
    3) maxBytesPerFile (optional, default 200000 ~ 200KB)

  Notes:
  - Each chunk is independent: it wraps its statements in BEGIN/COMMIT.
  - Run chunks in numeric order in the SQL Editor.
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

function chunkFileName(i) {
  return `cat_education_centers_import_part_${String(i).padStart(3, '0')}.sql`;
}

function makeChunkHeader({ csvBase, part, totalPartsUnknown }) {
  return [
    '-- Generated file (chunk).',
    `-- Source: ${csvBase}`,
    `-- Part: ${part}${totalPartsUnknown ? '' : ''}`,
    '-- Run chunks in order.',
    '',
    'BEGIN;',
    "SET statement_timeout = '0';",
    'SET client_min_messages = WARNING;',
    '',
  ].join('\n');
}

function main() {
  const csvArg = process.argv[2];
  const outDirArg = process.argv[3];
  const maxBytesArg = process.argv[4];

  if (!csvArg || !outDirArg) {
    die('Usage: node scripts/generate-centers-cat-sql-chunks.js <csvPath> <outDir> [maxBytesPerFile]');
  }

  const maxBytes = Number.parseInt(maxBytesArg || '200000', 10);
  if (!Number.isFinite(maxBytes) || maxBytes < 50000) {
    die('maxBytesPerFile must be a number >= 50000');
  }

  const csvPath = path.isAbsolute(csvArg) ? csvArg : path.join(process.cwd(), csvArg);
  const outDir = path.isAbsolute(outDirArg) ? outDirArg : path.join(process.cwd(), outDirArg);

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

  const records = recordsRaw.map((r) => {
    const out = {};
    for (const [k, v] of Object.entries(r)) {
      out[normalizeHeaderToSnake(k)] = v;
    }
    if (out.e_mail_centre && !out.email_centre) out.email_centre = out.e_mail_centre;
    return out;
  });

  const valid = records.filter((r) => String(r.codi_centre || '').trim() && String(r.denominacio_completa || '').trim());

  fs.mkdirSync(outDir, { recursive: true });

  const setClause = buildUpsertSetClause();

  const insertPrefix = `INSERT INTO ${TABLE} (${COLUMNS.join(', ')})\nVALUES\n`;
  const insertSuffix = `\nON CONFLICT (codi_centre) DO UPDATE SET\n  ${setClause};\n`;

  let part = 1;
  let current = '';
  let currentValues = [];

  const flush = (isLast) => {
    if (currentValues.length === 0) return;

    const body = insertPrefix + currentValues.join(',\n') + insertSuffix;

    const chunk = makeChunkHeader({ csvBase: path.basename(csvPath), part, totalPartsUnknown: true }) + body + '\nCOMMIT;\n' + (isLast ? `\nSELECT COUNT(*) AS cat_education_centers_count FROM ${TABLE};\n` : '') + '\n';

    const outPath = path.join(outDir, chunkFileName(part));
    fs.writeFileSync(outPath, chunk, 'utf8');

    part += 1;
    current = '';
    currentValues = [];
  };

  // Greedy pack rows until we exceed maxBytes.
  for (let i = 0; i < valid.length; i += 1) {
    const valuesLine = rowToValues(valid[i]);

    // Estimate current file size if we add this line.
    const tentativeValues = currentValues.length ? currentValues.join(',\n') + ',\n' + valuesLine : valuesLine;
    const tentativeBody = insertPrefix + tentativeValues + insertSuffix;
    const tentativeChunk = makeChunkHeader({ csvBase: path.basename(csvPath), part, totalPartsUnknown: true }) + tentativeBody + '\nCOMMIT;\n\n';

    if (tentativeChunk.length > maxBytes && currentValues.length > 0) {
      flush(false);
      // Re-try on next chunk.
      i -= 1;
      continue;
    }

    currentValues.push(valuesLine);
  }

  flush(true);

  const partsCount = part - 1;
  console.log(`Wrote ${partsCount} chunk(s) to: ${outDir}`);
}

main();
