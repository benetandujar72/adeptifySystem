/*
  One-time importer for Catalonia education centers (TOTCAT CSV).

  Usage (PowerShell):
    $env:SUPABASE_URL="https://xxxx.supabase.co"
    $env:SUPABASE_SERVICE_ROLE_KEY="<service_role_key>"
    node scripts/import-centers-cat.js totcat-centres-educatius.csv

  Notes:
  - Uses service role key; DO NOT run this in the browser.
  - CSV is semicolon-delimited and typically ISO-8859-1 (latin1).
*/

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { parse } = require('csv-parse/sync');

const TABLE = 'cat_education_centers';

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function getEnv(name) {
  return (process.env[name] || '').trim();
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

function parseIntOrNull(value) {
  const s = String(value ?? '').trim();
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function parseFloatCommaOrNull(value) {
  const s = String(value ?? '').trim();
  if (!s) return null;
  const n = Number.parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const BOOLEAN_COLUMNS = new Set([
  'einf1c', 'einf2c', 'epri', 'eso', 'batx', 'aa01', 'cfpm', 'ppas', 'aa03', 'cfps', 'ee', 'ife', 'pfi',
  'pa01', 'cfam', 'pa02', 'cfas', 'esdi', 'escm', 'escs', 'adr', 'crbc', 'idi', 'dane', 'danp', 'dans',
  'muse', 'musp', 'muss', 'tegm', 'tegs', 'estr', 'adults',
]);

function parseBooleanLoose(value) {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return false;
  if (['1', 'true', 't', 'yes', 'y', 'si', 's', 'x'].includes(s)) return true;
  if (['0', 'false', 'f', 'no', 'n'].includes(s)) return false;
  const num = Number(s.replace(',', '.'));
  if (Number.isFinite(num)) return num !== 0;
  return true;
}

function mapRowToDbRecord(row) {
  // row is already keyed by normalized snake_case headers.
  const rec = {
    codi_centre: String(row.codi_centre || '').trim(),
    denominacio_completa: String(row.denominacio_completa || '').trim(),
    codi_naturalesa: (row.codi_naturalesa ?? '').toString().trim() || null,
    nom_naturalesa: (row.nom_naturalesa ?? '').toString().trim() || null,
    codi_titularitat: (row.codi_titularitat ?? '').toString().trim() || null,
    nom_titularitat: (row.nom_titularitat ?? '').toString().trim() || null,
    adreca: (row.adreca ?? '').toString().trim() || null,
    codi_postal: (row.codi_postal ?? '').toString().trim() || null,
    telefon: (row.telefon ?? '').toString().trim() || null,
    codi_delegacio: (row.codi_delegacio ?? '').toString().trim() || null,
    nom_delegacio: (row.nom_delegacio ?? '').toString().trim() || null,
    codi_comarca: (row.codi_comarca ?? '').toString().trim() || null,
    nom_comarca: (row.nom_comarca ?? '').toString().trim() || null,
    codi_municipi: (row.codi_municipi ?? '').toString().trim() || null,
    nom_municipi: (row.nom_municipi ?? '').toString().trim() || null,
    codi_districte_municipal: (row.codi_districte_municipal ?? '').toString().trim() || null,
    nom_dm: (row.nom_dm ?? '').toString().trim() || null,
    codi_localitat: (row.codi_localitat ?? '').toString().trim() || null,
    nom_localitat: (row.nom_localitat ?? '').toString().trim() || null,
    coordenades_utm_x: parseIntOrNull(row.coordenades_utm_x),
    coordenades_utm_y: parseIntOrNull(row.coordenades_utm_y),
    coordenades_geo_x: parseFloatCommaOrNull(row.coordenades_geo_x),
    coordenades_geo_y: parseFloatCommaOrNull(row.coordenades_geo_y),
    email_centre: (row.e_mail_centre ?? row.email_centre ?? '').toString().trim() || null,
    estudis: (row.estudis ?? '').toString().trim() || null,
  };

  for (const col of BOOLEAN_COLUMNS) {
    rec[col] = parseBooleanLoose(row[col]);
  }

  return rec;
}

async function main() {
  const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl) die('Missing SUPABASE_URL (or VITE_SUPABASE_URL).');
  if (!serviceKey) die('Missing SUPABASE_SERVICE_ROLE_KEY.');

  const csvPathArg = process.argv[2];
  if (!csvPathArg) die('Usage: node scripts/import-centers-cat.js <path-to-csv>');

  const csvPath = path.isAbsolute(csvPathArg) ? csvPathArg : path.join(process.cwd(), csvPathArg);
  if (!fs.existsSync(csvPath)) die(`CSV not found: ${csvPath}`);

  console.log(`Reading CSV: ${csvPath}`);

  // Most TOTCAT CSVs are in ISO-8859-1; reading as latin1 recovers accents.
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

  // Normalize keys.
  const records = recordsRaw.map((r) => {
    const out = {};
    for (const [k, v] of Object.entries(r)) {
      out[normalizeHeaderToSnake(k)] = v;
    }
    return out;
  });

  // Map + validate.
  const mapped = [];
  for (const row of records) {
    const rec = mapRowToDbRecord(row);
    if (!rec.codi_centre || !rec.denominacio_completa) continue;
    mapped.push(rec);
  }

  console.log(`Parsed rows: ${records.length}`);
  console.log(`Mapped rows (valid): ${mapped.length}`);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const batchSize = 500;
  for (let i = 0; i < mapped.length; i += batchSize) {
    const batch = mapped.slice(i, i + batchSize);
    const start = i + 1;
    const end = i + batch.length;
    console.log(`Upserting ${start}-${end} / ${mapped.length}...`);

    const { error } = await supabase
      .from(TABLE)
      .upsert(batch, { onConflict: 'codi_centre' });

    if (error) {
      console.error('Supabase upsert error:', error);
      process.exit(1);
    }
  }

  const { count, error: countError } = await supabase
    .from(TABLE)
    .select('codi_centre', { count: 'exact', head: true });

  if (countError) {
    console.warn('Done, but could not fetch count:', countError.message || countError);
    return;
  }

  console.log(`Done. Supabase count(${TABLE}): ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
