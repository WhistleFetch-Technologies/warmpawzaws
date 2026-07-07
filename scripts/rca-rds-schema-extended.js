#!/usr/bin/env node
/**
 * Extended RDS schema audit: FK constraints, cascades, taxonomy tables, indexes.
 * Usage: AWS_PROFILE=cursor-agent ENVIRONMENT=prod node scripts/rca-rds-schema-extended.js
 */
process.env.ENVIRONMENT = process.env.ENVIRONMENT || 'prod';
const fs = require('fs');
const path = require('path');
const { query } = require('./rds-data-api-utils-dev');

const OUT = path.join(__dirname, `_rca-rds-schema-${process.env.ENVIRONMENT}.json`);

async function q(label, sql) {
  const origLog = console.log;
  const origErr = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    const result = await query(sql);
    console.log = origLog;
    console.error = origErr;
    return { ok: true, label, rows: result, count: result.length };
  } catch (err) {
    console.log = origLog;
    console.error = origErr;
    return { ok: false, label, error: err.message };
  }
}

async function main() {
  console.log(`RDS extended schema audit (${process.env.ENVIRONMENT})...`);
  const out = { generatedAt: new Date().toISOString(), environment: process.env.ENVIRONMENT };

  out.foreignKeys = await q('foreign_keys', `
    SELECT
      tc.table_name AS source_table,
      kcu.column_name AS source_column,
      ccu.table_name AS target_table,
      ccu.column_name AS target_column,
      rc.update_rule,
      rc.delete_rule,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON rc.unique_constraint_name = ccu.constraint_name AND rc.unique_constraint_schema = ccu.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name
  `);

  out.taxonomyFk = await q('taxonomy_fk', `
    SELECT source_table, source_column, target_table, target_column, delete_rule, constraint_name
    FROM (
      SELECT tc.table_name AS source_table, kcu.column_name AS source_column,
             ccu.table_name AS target_table, ccu.column_name AS target_column,
             rc.delete_rule, tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ) fk
    WHERE source_table IN (
      'service_catalog','service_categories','specialization_master','specialization_symptoms',
      'problem_grid_mappings','vendor_specializations','vendor_services','roles','role_permissions',
      'vendors','bookings','onboarding_forms','vendor_onboarding_applications'
    ) OR target_table IN (
      'service_catalog','service_categories','specialization_master','vendors','roles','services'
    )
    ORDER BY source_table
  `);

  out.cascadeDeletes = await q('cascade_deletes', `
    SELECT tc.table_name AS child_table, kcu.column_name AS fk_column,
           ccu.table_name AS parent_table, rc.delete_rule, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      AND rc.delete_rule IN ('CASCADE', 'SET NULL', 'RESTRICT')
    ORDER BY parent_table, child_table
  `);

  out.tablesWithoutFk = await q('tables_without_fk', `
    SELECT c.relname AS table_name, COALESCE(c.reltuples::bigint,0) AS est_rows
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        WHERE tc.table_schema = 'public' AND tc.table_name = c.relname
          AND tc.constraint_type = 'FOREIGN KEY'
      )
      AND c.reltuples > 20
    ORDER BY c.reltuples DESC
    LIMIT 40
  `);

  out.checkConstraints = await q('check_constraints', `
    SELECT tc.table_name, tc.constraint_name, cc.check_clause
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
    WHERE tc.table_schema = 'public' AND tc.constraint_type = 'CHECK'
      AND tc.table_name IN ('service_catalog','vendor_services','specialization_master','bookings','vendors','roles')
    ORDER BY tc.table_name
    LIMIT 80
  `);

  out.taxonomyIndexes = await q('taxonomy_indexes', `
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN (
        'service_catalog','service_categories','specialization_master','problem_grid_mappings',
        'vendor_specializations','vendor_services','search_index','roles','role_permissions'
      )
    ORDER BY tablename, indexname
  `);

  out.orphanFkRisk = await q('orphan_fk_risk', `
    SELECT 'vendor_services.service_id' AS check_name,
           COUNT(*) FILTER (WHERE vs.service_id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM services s WHERE s.id = vs.service_id
           )) AS orphan_count,
           COUNT(*) AS total
    FROM vendor_services vs
    UNION ALL
    SELECT 'vendor_services missing catalog link',
           COUNT(*) FILTER (WHERE NOT EXISTS (
             SELECT 1 FROM service_catalog sc WHERE sc.id::text = vs.service_id::text OR sc.service_name ILIKE vs.service_name
           )),
           COUNT(*)
    FROM vendor_services vs WHERE vs.is_custom_service = false
    UNION ALL
    SELECT 'vendor_specializations no master',
           COUNT(*) FILTER (WHERE NOT EXISTS (
             SELECT 1 FROM specialization_master sm WHERE sm.specialization_id = vs.specialization
           ) AND NOT EXISTS (
             SELECT 1 FROM problem_grid_mappings pgm WHERE pgm.problem_id = vs.specialization
           )),
           COUNT(*)
    FROM vendor_specializations vs
    UNION ALL
    SELECT 'bookings.service_id invalid',
           COUNT(*) FILTER (WHERE b.service_id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM vendor_services vs WHERE vs.id = b.service_id
           )),
           COUNT(*)
    FROM bookings b
  `);

  out.rolePermissionGaps = await q('role_permission_gaps', `
    SELECT r.name AS role_name, r.id::text AS role_id,
           COUNT(rp.id) AS permission_count,
           array_agg(DISTINCT rp.permission_name ORDER BY rp.permission_name) FILTER (WHERE rp.permission_name IS NOT NULL) AS permissions
    FROM roles r
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    GROUP BY r.id, r.name
    ORDER BY permission_count ASC, r.name
    LIMIT 40
  `);

  out.onboardingFormFields = await q('onboarding_forms', `
    SELECT id::text, role_id::text, form_name, status,
           jsonb_array_length(COALESCE(form_schema->'fields', '[]'::jsonb)) AS field_count,
           form_schema->'fields' AS fields_sample
    FROM onboarding_forms
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 15
  `);

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`Written ${OUT}`);
  console.log(`FK constraints: ${out.foreignKeys.count || 0}`);
  console.log(`Taxonomy FK: ${out.taxonomyFk.count || 0}`);
  console.log(`Cascade rules: ${out.cascadeDeletes.count || 0}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
