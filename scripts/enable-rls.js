/**
 * enable-rls.js
 * Habilita RLS (Row Level Security) a totes les taules públiques de Supabase
 * que puguin estar exposades sense protecció.
 *
 * Ús: SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=yyy node scripts/enable-rls.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('ERROR: Falten SUPABASE_URL i/o SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Taules que cal protegir amb RLS
const TABLES = [
    'lead_proposals',
    'leads',
    'lead_interactions',
    'project_examples',
    'center_artifacts',
    'ai_usage_logs',
];

async function enableRLS(table) {
    const { error } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`
    });
    if (error) return { table, ok: false, error: error.message };
    return { table, ok: true };
}

async function addServiceRolePolicy(table) {
    // Política que permet llegir/escriure al service role (backend)
    const policyName = `${table}_service_role_all`;
    const { error } = await supabase.rpc('exec_sql', {
        sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = '${table}' AND policyname = '${policyName}'
        ) THEN
          CREATE POLICY "${policyName}"
          ON public.${table}
          FOR ALL
          TO service_role
          USING (true) WITH CHECK (true);
        END IF;
      END $$;
    `
    });
    if (error) return { table, ok: false, error: error.message };
    return { table, ok: true };
}

async function main() {
    // Primer intentem via rpc exec_sql (si existeix la funció)
    // Si no, informem l'usuari amb el SQL que ha d'executar manualment
    console.log('=== Habilitant RLS a Supabase ===\n');

    // Generem el SQL per si cal executar-lo manualment
    console.log('--- SQL PER EXECUTAR AL SUPABASE SQL EDITOR (si aquest script falla) ---');
    for (const table of TABLES) {
        console.log(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
        console.log(`CREATE POLICY IF NOT EXISTS "${table}_service_role_all" ON public.${table} FOR ALL TO service_role USING (true) WITH CHECK (true);`);
    }
    console.log('---\n');

    // Intentem via fetch directe a l'API de Supabase (REST)
    for (const table of TABLES) {
        try {
            const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({
                    sql: `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`
                })
            });
            if (resp.ok) {
                console.log(`✅ RLS habilitat a: ${table}`);
            } else {
                const err = await resp.text();
                console.warn(`⚠️  ${table}: ${err.substring(0, 100)}`);
            }
        } catch (e) {
            console.warn(`⚠️  ${table}: ${e.message}`);
        }
    }

    console.log('\nFet. Si alguna taula mostra ⚠️, executa el SQL manualment al Supabase SQL Editor.');
}

main();
