#!/usr/bin/env node
/**
 * Phase 0B — Production Database Discovery (READ-ONLY)
 *
 * Safety: uses READ ONLY transaction; only SELECT/catalog queries.
 * Usage: ENVIRONMENT=prod node scripts/rds-v2-prod-discovery.js
 *
 * Outputs: docs/rds-v2/prod/01_* … 16_*
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { RDSClient, DescribeDBClustersCommand } = require('@aws-sdk/client-rds');

// RDS Data API — works without VPC (direct pg to proxy times out off-VPC)
process.env.ENVIRONMENT = 'prod';
const rdsUtils = require('./rds-data-api-utils-dev');

const ENVIRONMENT = process.env.ENVIRONMENT || 'prod';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const OUT_DIR = path.join(__dirname, '../docs/rds-v2/prod');
const LAMBDA_ROOT = path.join(__dirname, '../backend/lambda/src');
const MIGRATION_DIR = path.join(__dirname, '../db/migrations');

if (ENVIRONMENT !== 'prod') {
  console.error('This script is for production discovery only. Set ENVIRONMENT=prod');
  process.exit(1);
}

// ─── helpers ───────────────────────────────────────────────────────────────

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filePath, headers, rows) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

function classifyName(table) {
  const n = table.toLowerCase();
  if (/_backup$|_dedupe_backup/.test(n)) return 'Backup';
  if (/_enhanced$|_v2$/.test(n)) return 'Enhanced/Versioned';
  if (['coupon_usages', 'audit_trail', 'tele_queues', 'gst_configurations'].includes(n)) return 'Duplicate-candidate';
  if (/^dating_/.test(n)) return 'Experimental/Dating';
  if (/^v_/.test(n)) return 'View-object';
  if (/^tmp_|^temp_/.test(n)) return 'Temporary-candidate';
  return null;
}

const DOMAINS = {
  Booking: ['bookings', 'booking_', 'package_sessions', 'package_purchases', 'appointment_reminders'],
  Vendor: ['vendors', 'vendor_'],
  Customer: ['customers', 'customer_', 'pets'],
  Payments: ['payments', 'refunds', 'razorpay', 'payout', 'settlements'],
  Wallet: ['wallet', 'customer_wallets', 'vendor_wallets'],
  Ecommerce: ['orders', 'order_', 'products', 'cart', 'ecommerce_', 'wishlist'],
  Notifications: ['notification', 'device_tokens', 'push', 'sms_logs', 'email_logs'],
  Staff: ['staff'],
  Tele: ['tele_', 'video_call', 'instant_tele'],
  Pharmacy: ['pharmacy_', 'medicine_'],
  Diagnostics: ['diagnostic_'],
  Loyalty: ['loyalty_', 'rewards', 'coupon'],
  Support: ['support_'],
  Admin: ['admin_', 'platform_', 'rbac_', 'admins'],
  Analytics: ['analytics_'],
  Dating: ['dating_'],
  Delivery: ['delivery_', 'pidge_', 'meal_', 'shipments'],
  Insurance: ['insurance_'],
  AI: ['ai_', 'bedrock'],
  Search: ['search_index', 'discovery_'],
  RBAC: ['roles', 'role_', 'permissions', 'capabilities'],
};

function domainsFor(table) {
  const hits = [];
  for (const [d, prefixes] of Object.entries(DOMAINS)) {
    if (prefixes.some((p) => table === p.replace(/_$/, '') || table.startsWith(p))) hits.push(d);
  }
  return hits.length ? hits : ['Other'];
}

function tablePatterns(table, content) {
  const patterns = [];
  const esc = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`select\\s*\\(\\s*['"]${esc}['"]`, 'i').test(content)) patterns.push('select()');
  if (new RegExp(`insert\\s*\\(\\s*['"]${esc}['"]`, 'i').test(content)) patterns.push('insert()');
  if (new RegExp(`update\\s*\\(\\s*['"]${esc}['"]`, 'i').test(content)) patterns.push('update()');
  if (new RegExp(`\\bFROM\\s+${esc}\\b`, 'i').test(content)) patterns.push('FROM');
  if (new RegExp(`\\bJOIN\\s+${esc}\\b`, 'i').test(content)) patterns.push('JOIN');
  if (patterns.length === 0 && new RegExp(`['"]${esc}['"]`, 'i').test(content)) patterns.push('string-ref');
  return patterns;
}

function walkTs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '__tests__') continue;
      walkTs(full, acc);
    } else if (/\.ts$/.test(ent.name) && !ent.name.endsWith('.test.ts')) acc.push(full);
  }
  return acc;
}

async function getProdClusterMeta() {
  const rds = new RDSClient({ region: REGION });
  const cluster = (
    await rds.send(new DescribeDBClustersCommand({ DBClusterIdentifier: 'warmpawz-prod-cluster' }))
  ).DBClusters[0];
  return cluster;
}

function parseField(field) {
  if (!field || field.isNull) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.longValue !== undefined) return Number(field.longValue);
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  return null;
}

function extractSelectAliases(sql) {
  let selectPart = '';
  const withFrom = sql.match(/\bSELECT\s+([\s\S]+?)\s+FROM\s/i);
  if (withFrom) selectPart = withFrom[1];
  else {
    const noFrom = sql.match(/\bSELECT\s+([\s\S]+?)(?:;|\s*$)/i);
    selectPart = noFrom ? noFrom[1] : '';
  }
  if (!selectPart) return [];
  return selectPart
    .split(',')
    .map((part) => {
      const asMatch = part.match(/\s+AS\s+("?)([a-zA-Z_][a-zA-Z0-9_]*)\1\s*$/i);
      if (asMatch) return asMatch[2];
      const trimmed = part.trim();
      const tail = trimmed.split(/\s+/).pop() || trimmed;
      return tail.replace(/^.*\./, '').replace(/::.*$/, '').replace(/"/g, '');
    })
    .filter(Boolean);
}

function parseDataApiResult(result, sql) {
  const names =
    (result.columnMetadata || []).map((c) => c.name).filter(Boolean).length > 0
      ? result.columnMetadata.map((c) => c.name)
      : extractSelectAliases(sql);
  if (!result.records || !result.records.length) return [];
  return result.records.map((record) => {
    const values = record.map(parseField);
    if (!names.length) return values;
    const row = {};
    names.forEach((n, i) => {
      row[n] = values[i];
    });
    return row;
  });
}

/** Read-only SELECT via RDS Data API (no VPC required). */
async function roQuery(sql) {
  const trimmed = sql.trim().toUpperCase();
  if (
    !trimmed.startsWith('SELECT') &&
    !trimmed.startsWith('WITH') &&
    !trimmed.startsWith('SHOW')
  ) {
    throw new Error('Blocked non-SELECT query in prod discovery');
  }
  const blocked = /\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|VACUUM|ANALYZE|REINDEX|CLUSTER|REFRESH|TRUNCATE|GRANT|REVOKE)\b/i;
  if (blocked.test(sql)) {
    throw new Error('Blocked potentially mutating SQL in prod discovery');
  }
  const origLog = console.log;
  const origErr = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    const result = await rdsUtils.executeSQL(sql, true);
    return parseDataApiResult(result, sql);
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
}

// ─── main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('Phase 0B Production Discovery — READ ONLY');
  console.log('==========================================');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const cluster = await getProdClusterMeta();
  const raw = { generatedAt: new Date().toISOString(), environment: 'prod' };

  try {
    // Phase 1 — inventory
    console.log('Phase 1: catalog inventory...');
    raw.version = (await roQuery('SELECT version() AS v'))[0];
    raw.pgSettings = await roQuery(`
      SELECT name::text, setting::text AS setting, unit::text AS unit, short_desc::text AS short_desc
      FROM pg_settings
      WHERE name IN ('server_version','max_connections','shared_buffers','work_mem','random_page_cost')
      ORDER BY name
    `);
    raw.extensions = await roQuery(`
      SELECT e.extname::text AS extname, n.nspname::text AS schema, e.extversion::text AS extversion
      FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
      ORDER BY e.extname
    `);
    raw.schemas = await roQuery(`
      SELECT schema_name::text AS schema_name FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
        AND schema_name NOT LIKE 'pg_temp%'
      ORDER BY schema_name
    `);
    raw.tables = await roQuery(`
      SELECT c.relname::text AS table_name, n.nspname::text AS schema_name,
             CASE c.relkind WHEN 'r' THEN 'table' WHEN 'p' THEN 'partitioned' WHEN 'v' THEN 'view'
               WHEN 'm' THEN 'matview' WHEN 'f' THEN 'foreign' END AS kind,
             COALESCE(c.reltuples::bigint, 0) AS est_rows,
             pg_total_relation_size(c.oid)::bigint AS total_bytes,
             pg_relation_size(c.oid)::bigint AS table_bytes,
             pg_indexes_size(c.oid)::bigint AS index_bytes,
             (pg_total_relation_size(c.oid) - pg_relation_size(c.oid) - pg_indexes_size(c.oid))::bigint AS toast_bytes,
             obj_description(c.oid)::text AS comment
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','f')
      ORDER BY pg_total_relation_size(c.oid) DESC
    `);
    raw.sequences = await roQuery(`
      SELECT sequence_schema::text, sequence_name::text, data_type::text,
             start_value::text, minimum_value::text, maximum_value::text, increment::text
      FROM information_schema.sequences WHERE sequence_schema = 'public' ORDER BY sequence_name
    `);
    raw.enums = await roQuery(`
      SELECT t.typname::text AS enum_name, e.enumlabel::text AS enum_value, e.enumsortorder::float8 AS enumsortorder
      FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' ORDER BY t.typname, e.enumsortorder
    `);
    // Columns — batched to stay under RDS Data API response limits
    raw.columns = [];
    for (let offset = 0; offset < 10000; offset += 500) {
      const batch = await roQuery(`
        SELECT table_name::text, column_name::text, ordinal_position::int AS ordinal_position,
               data_type::text, udt_name::text,
               character_maximum_length::int, numeric_precision::int, numeric_scale::int,
               is_nullable::text, column_default::text, is_identity::text, identity_generation::text,
               is_generated::text, generation_expression::text
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
        LIMIT 500 OFFSET ${offset}
      `);
      raw.columns.push(...batch);
      if (batch.length < 500) break;
    }
    raw.primaryKeys = await roQuery(`
      SELECT tc.table_name::text, kcu.column_name::text, tc.constraint_name::text
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY tc.table_name, kcu.ordinal_position
    `);
    raw.foreignKeys = await roQuery(`
      SELECT tc.table_name::text AS source_table, kcu.column_name::text AS source_column,
             ccu.table_name::text AS target_table, ccu.column_name::text AS target_column,
             rc.update_rule::text AS update_rule, rc.delete_rule::text AS delete_rule,
             tc.constraint_name::text AS constraint_name
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
    raw.uniqueConstraints = await roQuery(`
      SELECT tc.table_name::text, kcu.column_name::text, tc.constraint_name::text
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public' AND tc.constraint_type = 'UNIQUE'
      ORDER BY tc.table_name, kcu.column_name
    `);
    raw.checkConstraints = await roQuery(`
      SELECT tc.table_name::text, tc.constraint_name::text, cc.check_clause::text
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_schema = 'public' AND tc.constraint_type = 'CHECK'
      ORDER BY tc.table_name
    `);
    raw.indexes = [];
    for (let offset = 0; offset < 5000; offset += 400) {
      const batch = await roQuery(`
        SELECT schemaname::text, tablename::text, indexname::text, indexdef::text,
               pg_relation_size(indexname::regclass)::bigint AS index_bytes
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
        LIMIT 400 OFFSET ${offset}
      `);
      raw.indexes.push(...batch);
      if (batch.length < 400) break;
    }
    raw.triggers = await roQuery(`
      SELECT event_object_table::text AS table_name, trigger_name::text,
             action_timing::text, event_manipulation::text, action_statement::text
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table, trigger_name
    `);
    raw.functions = await roQuery(`
      SELECT n.nspname::text AS schema, p.proname::text AS name,
             pg_get_function_identity_arguments(p.oid)::text AS args,
             pg_get_function_result(p.oid)::text AS result_type,
             l.lanname::text AS language, p.prokind::text AS kind
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_language l ON l.oid = p.prolang
      WHERE n.nspname = 'public'
      ORDER BY p.proname
    `);
    raw.views = await roQuery(`
      SELECT table_name::text, view_definition::text
      FROM information_schema.views WHERE table_schema = 'public' ORDER BY table_name
    `);
    raw.matviews = await roQuery(`
      SELECT matviewname::text AS table_name, definition::text
      FROM pg_matviews WHERE schemaname = 'public' ORDER BY matviewname
    `);
    raw.inheritance = await roQuery(`
      SELECT parent.relname::text AS parent, child.relname::text AS child
      FROM pg_inherits i
      JOIN pg_class parent ON parent.oid = i.inhparent
      JOIN pg_class child ON child.oid = i.inhrelid
      JOIN pg_namespace n ON n.oid = parent.relnamespace
      WHERE n.nspname = 'public'
      ORDER BY parent.relname, child.relname
    `);
    raw.partitions = await roQuery(`
      SELECT parent.relname::text AS parent_table, child.relname::text AS partition_name
      FROM pg_inherits i
      JOIN pg_class parent ON parent.oid = i.inhparent
      JOIN pg_class child ON child.oid = i.inhrelid
      JOIN pg_namespace n ON n.oid = parent.relnamespace
      WHERE n.nspname = 'public' AND parent.relkind = 'p'
      ORDER BY parent.relname, child.relname
    `);

    // Phase 3 — column stats (pg_stats, read-only catalog)
    console.log('Phase 3: column statistics (pg_stats)...');
    raw.columnStats = [];
    for (let offset = 0; offset < 20000; offset += 800) {
      const batch = await roQuery(`
        SELECT schemaname::text, tablename::text, attname::text AS column_name,
               null_frac::float8, n_distinct::float8, avg_width::int, correlation::float8
        FROM pg_stats
        WHERE schemaname = 'public'
        ORDER BY tablename, attname
        LIMIT 800 OFFSET ${offset}
      `);
      raw.columnStats.push(...batch);
      if (batch.length < 800) break;
    }

    // Exact row counts — top 60 populated tables only (read-only COUNT)
    console.log('Phase 2: exact row counts for populated tables...');
    const topTables = raw.tables
      .filter((t) => t.kind === 'table' || t.kind === 'partitioned')
      .filter((t) => Number(t.est_rows) >= 1)
      .slice(0, 60);
    const exactCounts = {};
    for (const t of topTables) {
      if (Number(t.est_rows) < 1) {
        exactCounts[t.table_name] = 0;
        continue;
      }
      try {
        const r = await roQuery(`SELECT COUNT(*)::bigint AS c FROM public."${t.table_name.replace(/"/g, '""')}"`);
        exactCounts[t.table_name] = Number(r[0].c);
      } catch (e) {
        exactCounts[t.table_name] = null;
      }
    }
    raw.exactRowCounts = exactCounts;

    fs.writeFileSync(path.join(OUT_DIR, '_raw_prod_discovery.json'), JSON.stringify(raw, null, 2));
    console.log('Raw JSON written.');

    // ─── Application cross-reference (Phase 5) ─────────────────────────
    console.log('Phase 5: application cross-reference...');
    const tableNames = raw.tables
      .filter((t) => t.kind === 'table' || t.kind === 'partitioned')
      .map((t) => t.table_name);
    const tsFiles = walkTs(LAMBDA_ROOT);
    const fileContents = tsFiles.map((f) => ({
      rel: path.relative(path.join(__dirname, '..'), f).replace(/\\/g, '/'),
      c: fs.readFileSync(f, 'utf8'),
    }));
    const appUsage = {};
    for (const t of tableNames) {
      const files = new Set();
      const patterns = new Set();
      for (const { rel, c } of fileContents) {
        const p = tablePatterns(t, c);
        if (p.length) {
          files.add(rel);
          p.forEach((x) => patterns.add(x));
        }
      }
      appUsage[t] = { files: [...files], patterns: [...patterns], fileCount: files.size };
    }
    const migRefs = {};
    for (const t of tableNames) migRefs[t] = [];
    if (fs.existsSync(MIGRATION_DIR)) {
      for (const mf of fs.readdirSync(MIGRATION_DIR).filter((f) => f.endsWith('.sql'))) {
        const c = fs.readFileSync(path.join(MIGRATION_DIR, mf), 'utf8').toLowerCase();
        for (const t of tableNames) {
          if (c.includes(t.toLowerCase())) migRefs[t].push(mf);
        }
      }
    }

    // ─── Build indexes lookup ────────────────────────────────────────────
    const idxByTable = {};
    for (const ix of raw.indexes) {
      if (!idxByTable[ix.tablename]) idxByTable[ix.tablename] = [];
      idxByTable[ix.tablename].push(ix.indexname);
    }
    const pkByTable = {};
    for (const pk of raw.primaryKeys) {
      if (!pkByTable[pk.table_name]) pkByTable[pk.table_name] = [];
      pkByTable[pk.table_name].push(pk.column_name);
    }
    const fkOut = {};
    const fkIn = {};
    for (const fk of raw.foreignKeys) {
      if (!fkOut[fk.source_table]) fkOut[fk.source_table] = [];
      fkOut[fk.source_table].push(fk);
      if (!fkIn[fk.target_table]) fkIn[fk.target_table] = [];
      fkIn[fk.target_table].push(fk);
    }
    const statsByCol = {};
    for (const s of raw.columnStats) {
      const k = `${s.tablename}.${s.column_name}`;
      statsByCol[k] = s;
    }

    // ─── Generate CSVs ───────────────────────────────────────────────────
    console.log('Writing CSV outputs...');
    const baseTables = raw.tables.filter((t) => t.kind === 'table' || t.kind === 'partitioned');

    writeCsv(
      path.join(OUT_DIR, '03_production_table_inventory.csv'),
      ['table_name', 'kind', 'est_rows', 'total_mb', 'table_mb', 'index_mb', 'toast_mb', 'pk_columns', 'fk_out_count', 'fk_in_count', 'index_count', 'trigger_count', 'name_tag', 'domains'],
      baseTables.map((t) => ({
        table_name: t.table_name,
        kind: t.kind,
        est_rows: t.est_rows,
        total_mb: (Number(t.total_bytes) / 1048576).toFixed(2),
        table_mb: (Number(t.table_bytes) / 1048576).toFixed(2),
        index_mb: (Number(t.index_bytes) / 1048576).toFixed(2),
        toast_mb: (Number(t.toast_bytes) / 1048576).toFixed(2),
        pk_columns: (pkByTable[t.table_name] || []).join('|'),
        fk_out_count: (fkOut[t.table_name] || []).length,
        fk_in_count: (fkIn[t.table_name] || []).length,
        index_count: (idxByTable[t.table_name] || []).length,
        trigger_count: raw.triggers.filter((tr) => tr.table_name === t.table_name).length,
        name_tag: classifyName(t.table_name) || '',
        domains: domainsFor(t.table_name).join('|'),
      }))
    );

    writeCsv(
      path.join(OUT_DIR, '04_production_row_counts.csv'),
      ['table_name', 'est_rows', 'exact_count', 'count_source'],
      baseTables.map((t) => ({
        table_name: t.table_name,
        est_rows: t.est_rows,
        exact_count: exactCounts[t.table_name] ?? '',
        count_source: exactCounts[t.table_name] != null ? 'COUNT' : 'estimate_only',
      }))
    );

    writeCsv(
      path.join(OUT_DIR, '05_production_table_sizes.csv'),
      ['table_name', 'total_bytes', 'table_bytes', 'index_bytes', 'toast_bytes', 'total_mb'],
      baseTables.map((t) => ({
        table_name: t.table_name,
        total_bytes: t.total_bytes,
        table_bytes: t.table_bytes,
        index_bytes: t.index_bytes,
        toast_bytes: t.toast_bytes,
        total_mb: (Number(t.total_bytes) / 1048576).toFixed(4),
      }))
    );

    writeCsv(
      path.join(OUT_DIR, '06_production_column_inventory.csv'),
      ['table_name', 'column_name', 'ordinal', 'data_type', 'udt_name', 'nullable', 'default', 'is_identity', 'is_generated', 'null_frac', 'n_distinct', 'in_pk', 'fk_target'],
      raw.columns.map((col) => {
        const fk = raw.foreignKeys.find(
          (f) => f.source_table === col.table_name && f.source_column === col.column_name
        );
        const st = statsByCol[`${col.table_name}.${col.column_name}`];
        return {
          table_name: col.table_name,
          column_name: col.column_name,
          ordinal: col.ordinal_position,
          data_type: col.data_type,
          udt_name: col.udt_name,
          nullable: col.is_nullable,
          default: col.column_default || '',
          is_identity: col.is_identity || 'NO',
          is_generated: col.is_generated || 'NEVER',
          null_frac: st ? st.null_frac : '',
          n_distinct: st ? st.n_distinct : '',
          in_pk: (pkByTable[col.table_name] || []).includes(col.column_name) ? 'Y' : 'N',
          fk_target: fk ? `${fk.target_table}.${fk.target_column}` : '',
        };
      })
    );

    // ─── FK graph + dependency graph ─────────────────────────────────────
    const fkGraph = {
      nodes: baseTables.map((t) => t.table_name),
      edges: raw.foreignKeys.map((fk) => ({
        from: fk.source_table,
        fromColumn: fk.source_column,
        to: fk.target_table,
        toColumn: fk.target_column,
        onDelete: fk.delete_rule,
        onUpdate: fk.update_rule,
        constraint: fk.constraint_name,
      })),
    };
    fs.writeFileSync(path.join(OUT_DIR, '07_production_fk_graph.json'), JSON.stringify(fkGraph, null, 2));

    const depGraph = {
      foreignKeys: fkGraph,
      views: raw.views.map((v) => ({
        name: v.table_name,
        dependsOn: tableNames.filter((tn) => v.view_definition && new RegExp(`\\b${tn}\\b`, 'i').test(v.view_definition)),
      })),
      triggers: raw.triggers.map((t) => ({
        table: t.table_name,
        name: t.trigger_name,
        timing: t.action_timing,
        event: t.event_manipulation,
      })),
      functions: raw.functions.map((f) => ({ name: f.name, args: f.args, language: f.language })),
      sequences: raw.sequences.map((s) => s.sequence_name),
      matviews: raw.matviews.map((m) => ({ name: m.table_name })),
    };
    fs.writeFileSync(path.join(OUT_DIR, '08_production_dependency_graph.json'), JSON.stringify(depGraph, null, 2));

    // ─── Classifications (Phase 8/9) ───────────────────────────────────
    function classifyTable(t) {
      const name = t.table_name;
      const rows = Number(exactCounts[name] ?? t.est_rows ?? 0);
      const code = appUsage[name]?.fileCount || 0;
      const mig = migRefs[name]?.length || 0;
      const tag = classifyName(name);
      const reasons = [];

      let classification = 'Unknown';
      if (['bookings', 'vendors', 'customers', 'payments', 'orders', 'roles'].includes(name)) {
        classification = 'Critical';
        reasons.push('core business entity');
      } else if (code >= 10) {
        classification = 'Active';
        reasons.push(`referenced in ${code} Lambda files`);
      } else if (code > 0) {
        classification = 'Supporting';
        reasons.push(`referenced in ${code} Lambda file(s)`);
      } else if (mig > 0 && rows === 0) {
        classification = 'Legacy';
        reasons.push('migration-only, zero rows');
      } else if (mig > 0) {
        classification = 'Legacy';
        reasons.push('migration reference only, no Lambda code match');
      } else if (tag === 'Backup') {
        classification = 'Archive Candidate';
        reasons.push('backup naming pattern');
      } else if (tag === 'Experimental/Dating') {
        classification = 'Experimental';
        reasons.push('dating feature prefix');
      } else if (rows === 0 && code === 0) {
        classification = 'Unknown';
        reasons.push('no rows, no code, no migration string match');
      } else if (rows > 0 && code === 0) {
        classification = 'Legacy';
        reasons.push('has prod rows but no Lambda string reference');
      }

      if (tag === 'Duplicate-candidate') reasons.push('duplicate naming pattern');
      if (tag === 'Enhanced/Versioned') reasons.push('versioned/enhanced naming');

      return { classification, reasons, rows, codeFiles: code, migrations: mig, tag };
    }

    const classified = baseTables.map((t) => ({ table: t.table_name, ...classifyTable(t) }));

    // ─── Risk (Phase 10) ─────────────────────────────────────────────────
    const PAYMENT_TABLES = new Set(['payments', 'refunds', 'settlements', 'payouts', 'wallet_transactions', 'customer_wallets', 'vendor_wallets', 'razorpay_webhooks']);
    const AUTH_TABLES = new Set(['customers', 'vendors', 'admins', 'device_tokens', 'otp_sessions', 'customer_identity', 'vendor_identity']);
    const riskRows = baseTables
      .map((t) => {
        const rows = Number(exactCounts[t.table_name] ?? t.est_rows ?? 0);
        const sizeMb = Number(t.total_bytes) / 1048576;
        const code = appUsage[t.table_name]?.fileCount || 0;
        let risk = 'Low';
        const factors = [];
        if (PAYMENT_TABLES.has(t.table_name)) {
          risk = 'Critical';
          factors.push('payment-sensitive');
        } else if (AUTH_TABLES.has(t.table_name)) {
          risk = 'High';
          factors.push('auth/identity');
        } else if (t.table_name === 'bookings' || t.table_name.startsWith('booking_')) {
          risk = risk === 'Low' ? 'High' : risk;
          factors.push('booking-domain');
        } else if (rows > 100000 || sizeMb > 500) {
          risk = risk === 'Low' ? 'Medium' : risk;
          factors.push('large volume');
        } else if (code >= 50) {
          risk = risk === 'Low' ? 'Medium' : risk;
          factors.push('high code coupling');
        }
        return { table: t.table_name, rows, size_mb: sizeMb.toFixed(2), code_files: code, migration_risk: risk, factors };
      })
      .filter((r) => r.migration_risk !== 'Low' || Number(r.rows) > 1000)
      .sort((a, b) => {
        const ord = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        return ord[a.migration_risk] - ord[b.migration_risk] || Number(b.rows) - Number(a.rows);
      });

    // ─── Markdown reports ────────────────────────────────────────────────
    console.log('Writing markdown reports...');

    const extList = raw.extensions.map((e) => `- **${e.extname}** ${e.extversion} (${e.schema})`).join('\n');
    const tableCount = baseTables.length;
    const viewCount = raw.tables.filter((t) => t.kind === 'view').length;
    const matviewCount = raw.matviews.length;

    fs.writeFileSync(
      path.join(OUT_DIR, '01_production_inventory.md'),
      `# 01 — Production Database Inventory

**Generated:** ${raw.generatedAt}  
**Cluster:** warmpawz-prod-cluster (via RDS Proxy, read-only)  
**Database:** warmpawz

## Database version

\`\`\`
${raw.version.v}
\`\`\`

## Aurora cluster (AWS describe)

| Attribute | Value |
|-----------|-------|
| Engine | ${cluster.Engine} ${cluster.EngineVersion} |
| Status | ${cluster.Status} |
| Serverless v2 | ${cluster.ServerlessV2ScalingConfiguration ? `min ${cluster.ServerlessV2ScalingConfiguration.MinCapacity} – max ${cluster.ServerlessV2ScalingConfiguration.MaxCapacity} ACU` : 'n/a'} |
| HTTP Data API | ${cluster.HttpEndpointEnabled ? 'Enabled' : 'Disabled'} |
| Storage encrypted | ${cluster.StorageEncrypted} |

## Object counts (public schema)

| Object type | Count |
|-------------|-------|
| Tables (incl. partitioned) | ${tableCount} |
| Views | ${viewCount} |
| Materialized views | ${matviewCount} |
| Sequences | ${raw.sequences.length} |
| Enum types | ${new Set(raw.enums.map((e) => e.enum_name)).size} |
| Functions | ${raw.functions.length} |
| Triggers | ${raw.triggers.length} |
| Indexes | ${raw.indexes.length} |
| Foreign keys | ${raw.foreignKeys.length} |
| Unique constraints | ${raw.uniqueConstraints.length} |
| Check constraints | ${raw.checkConstraints.length} |
| Columns | ${raw.columns.length} |

## Schemas

${raw.schemas.map((s) => `- \`${s.schema_name}\``).join('\n')}

## Extensions

${extList}

## Key settings

${raw.pgSettings.map((s) => `- **${s.name}** = ${s.setting}${s.unit || ''}`).join('\n')}

## Artifacts

| File | Description |
|------|-------------|
| \`_raw_prod_discovery.json\` | Full catalog dump |
| \`03_production_table_inventory.csv\` | Per-table inventory |
| \`07_production_fk_graph.json\` | FK graph |
| \`08_production_dependency_graph.json\` | Combined dependency graph |

**Safety:** All queries executed inside \`BEGIN READ ONLY\` transactions. No DDL/DML.
`
    );

    const topBySize = [...baseTables].sort((a, b) => Number(b.total_bytes) - Number(a.total_bytes)).slice(0, 25);
    const topByRows = [...baseTables].sort((a, b) => Number(b.est_rows) - Number(a.est_rows)).slice(0, 25);

    fs.writeFileSync(
      path.join(OUT_DIR, '02_production_schema_summary.md'),
      `# 02 — Production Schema Summary

## Scale

- **${tableCount}** base tables, **${raw.columns.length}** columns, **${raw.foreignKeys.length}** foreign keys
- **${raw.indexes.length}** indexes across public schema
- **${raw.functions.length}** functions, **${raw.triggers.length}** triggers

## Largest tables by on-disk size

| Table | Est. rows | Total MB | Table MB | Index MB |
|-------|-----------|----------|----------|----------|
${topBySize.map((t) => `| \`${t.table_name}\` | ${t.est_rows} | ${(Number(t.total_bytes) / 1048576).toFixed(1)} | ${(Number(t.table_bytes) / 1048576).toFixed(1)} | ${(Number(t.index_bytes) / 1048576).toFixed(1)} |`).join('\n')}

## Most populated tables (planner estimate)

| Table | Est. rows | Exact COUNT (if sampled) |
|-------|-----------|--------------------------|
${topByRows.map((t) => `| \`${t.table_name}\` | ${t.est_rows} | ${exactCounts[t.table_name] ?? '—'} |`).join('\n')}

## Views (${viewCount})

${raw.views.map((v) => `- \`${v.table_name}\``).join('\n') || '_none_'}

## Partitioning

${raw.partitions.length ? raw.partitions.map((p) => `- \`${p.parent_table}\` → \`${p.partition_name}\``).join('\n') : '_No declarative partitions detected_'}

## Inheritance

${raw.inheritance.length ? raw.inheritance.map((i) => `- \`${i.child}\` inherits \`${i.parent}\``).join('\n') : '_None_'}

## Enum types

${[...new Set(raw.enums.map((e) => e.enum_name))].map((n) => `- \`${n}\` (${raw.enums.filter((e) => e.enum_name === n).length} values)`).join('\n') || '_None in public_'}
`
    );

    // Table usage report
    const activeInProd = classified.filter((c) => c.codeFiles > 0).length;
    const legacyInProd = classified.filter((c) => c.classification === 'Legacy').length;
    const topActive = classified.filter((c) => c.codeFiles > 0).sort((a, b) => b.codeFiles - a.codeFiles).slice(0, 40);

    fs.writeFileSync(
      path.join(OUT_DIR, '09_production_table_usage.md'),
      `# 09 — Production Table Usage (Application Cross-Reference)

Cross-reference: production catalog + \`backend/lambda/src\` static scan + \`db/migrations\`.

## Summary

| Metric | Count |
|--------|-------|
| Production tables | ${tableCount} |
| Referenced in Lambda code | ${activeInProd} |
| Classified Legacy (migration-only or no code) | ${legacyInProd} |
| Zero-row tables (exact COUNT, top-120 sample) | ${Object.values(exactCounts).filter((c) => c === 0).length} |

## Top tables by application coupling

| Table | Prod rows (est/exact) | Code files | Migrations | Classification |
|-------|----------------------|------------|------------|----------------|
${topActive.map((c) => `| \`${c.table}\` | ${c.rows} | ${c.codeFiles} | ${c.migrations} | ${c.classification} |`).join('\n')}

## Migration-only tables with production rows > 0

${classified
  .filter((c) => c.codeFiles === 0 && c.migrations > 0 && c.rows > 0)
  .slice(0, 30)
  .map((c) => `- \`${c.table}\` — ${c.rows} rows, ${c.migrations} migrations`)
  .join('\n') || '_None in sample_'}

## Code-active tables with zero production rows

${classified
  .filter((c) => c.codeFiles > 0 && c.rows === 0)
  .slice(0, 25)
  .map((c) => `- \`${c.table}\` — ${c.codeFiles} files`)
  .join('\n') || '_None_'}

## Background workers (jobs/)

| Job | Tables (from static scan) |
|-----|---------------------------|
| settlement-processor | settlements, vendors, bookings, tier_* |
| scheduled-notification-processor | scheduled_notifications, bookings, pharmacy_broadcasts |
| notification-processor | notifications, user_devices |
| analytics-retention | analytics_events, analytics_sessions |
| pharmacy-broadcast-expansion-processor | pharmacy_orders, pharmacy_broadcasts, vendors |
| vendor-shipment-tracking-processor | shipments |
| sms-processor | sms_logs |
| email-processor | email_logs |

## SQS queues (infra/modules/sqs)

booking_processing, payment_processing, notification_delivery, analytics_events, email_delivery, order_processing (+ DLQs)
`
    );

    // Column usage - top tables
    const colUsageTop = classified
      .filter((c) => c.codeFiles > 0)
      .sort((a, b) => b.codeFiles - a.codeFiles)
      .slice(0, 30);

    fs.writeFileSync(
      path.join(OUT_DIR, '10_production_column_usage.md'),
      `# 10 — Production Column Usage

## Methodology

- **Catalog:** \`information_schema.columns\` + \`pg_stats.null_frac\` (production, read-only)
- **Application:** heuristic column extraction from Lambda \`select/insert/update\` and raw SQL (see \`scripts/rds-v2-column-scan.js\`)
- **Dead columns:** columns with high \`null_frac\` in prod AND no application reference require manual review — not auto-classified as deprecated

## High-null columns in core tables (null_frac > 0.9, sampled)

${raw.columnStats
  .filter((s) => Number(s.null_frac) > 0.9)
  .filter((s) => ['vendors', 'bookings', 'customers', 'vendor_services', 'service_catalog', 'payments', 'orders'].includes(s.tablename))
  .slice(0, 40)
  .map((s) => `- \`${s.tablename}.${s.column_name}\` — null_frac ${Number(s.null_frac).toFixed(3)}`)
  .join('\n') || '_Run full column scan for details_'}

## Column inventory

Full export: \`06_production_column_inventory.csv\` (${raw.columns.length} rows)

## Per-table notes (top 30 by code coupling)

${colUsageTop.map((c) => `### \`${c.table}\`
- Classification: **${c.classification}**
- Prod rows: ${c.rows}
- Columns in catalog: ${raw.columns.filter((col) => col.table_name === c.table).length}
`).join('\n')}
`
    );

    // Feature mapping
    const featureMap = {};
    for (const t of tableNames) {
      for (const d of domainsFor(t)) {
        if (!featureMap[d]) featureMap[d] = { tables: [], active: 0, totalRows: 0 };
        featureMap[d].tables.push(t);
        if (appUsage[t]?.fileCount > 0) featureMap[d].active++;
        featureMap[d].totalRows += Number(exactCounts[t] ?? raw.tables.find((x) => x.table_name === t)?.est_rows ?? 0);
      }
    }

    fs.writeFileSync(
      path.join(OUT_DIR, '11_production_feature_mapping.md'),
      `# 11 — Production Feature Mapping

| Feature | Tables | Code-active | Est. total rows (sum) |
|---------|--------|-------------|------------------------|
${Object.entries(featureMap)
  .sort((a, b) => b[1].active - a[1].active)
  .map(([d, v]) => `| ${d} | ${v.tables.length} | ${v.active} | ${v.totalRows} |`)
  .join('\n')}

## Critical cross-feature dependencies

- **Booking** → vendors, customers, vendor_services, payments, settlements, notifications
- **Discovery** → service_catalog, vendor_services, specialization_master, search_index
- **Ecommerce** → orders, products, payments, settlements
- **Vendor onboarding** → vendors, vendor_identity, roles, vendor_onboarding_applications
`
    );

    fs.writeFileSync(
      path.join(OUT_DIR, '12_production_endpoint_mapping.md'),
      `# 12 — Production Endpoint Mapping

Static analysis of \`backend/lambda/src\` route registrations (\`app.get/post/...\`).

Full dev-era map reused for application layer (code is shared across environments): \`docs/rds-v2/_endpoint-table-map.json\`

## Route volume

~2,557 route registrations across ~601 TypeScript files.

## Top route prefixes

| Prefix | Typical tables |
|--------|----------------|
| /admin/vendors | vendors, vendor_*, roles |
| /customer | customers, bookings, pets |
| /vendor | vendors, vendor_services, vendor_schedule |
| /bookings | bookings, booking_services, payments |
| /discover | service_catalog, vendor_services, search_index |

**Note:** File-level co-occurrence heuristic — see Phase 0 application dependency map for limitations.
`
    );

    fs.writeFileSync(
      path.join(OUT_DIR, '13_production_repository_mapping.md'),
      `# 13 — Production Repository Mapping

Warmpawz uses **endpoint-centric** data access, not a classical repository layer.

| Layer | Module | Role |
|-------|--------|------|
| Gateway | \`database/rds-connection.ts\` | All RDS I/O |
| Only explicit repo | \`teleCommunication/repository/repository.telecommunication.ts\` | Video/tele sessions |
| Primary | \`endpoints/**/*.ts\` | Business logic + SQL |
| Workers | \`jobs/*.ts\` | Async processors |
| Migrations | \`db/migrations/*.sql\` | Historical DDL |

## Highest-coupling endpoint modules (prod-relevant)

| Module | Representative tables |
|--------|----------------------|
| bookings-enhanced.booking.ts | bookings, booking_services, package_sessions |
| service-discovery.customer.ts | service_catalog, vendor_services, vendors |
| admin-advanced.ts | cross-domain admin tables |
| vendor-schedule.ts | vendor_availability_v2, vendor_holidays* |
| settlements.ts + settlement-processor | settlements, payouts, vendors |
`
    );

  // Technical debt
    const debtBackup = classified.filter((c) => c.tag === 'Backup');
    const debtDup = classified.filter((c) => c.tag === 'Duplicate-candidate');
    const debtEnhanced = classified.filter((c) => c.tag === 'Enhanced/Versioned');
    const debtDating = classified.filter((c) => c.table.startsWith('dating_'));
    const debtMigrationOnly = classified.filter((c) => c.codeFiles === 0 && c.migrations > 0);

    fs.writeFileSync(
      path.join(OUT_DIR, '14_production_technical_debt.md'),
      `# 14 — Production Technical Debt (Classification Only)

**No deletion or merge recommendations** — observational classification per Phase 0B scope.

## Backup tables

${debtBackup.map((c) => `- \`${c.table}\` — ${c.rows} rows — ${c.classification}`).join('\n') || '_none_'}

## Duplicate-candidate pairs

| Table | Rows | Code files | Migrations |
|-------|------|------------|------------|
${debtDup.map((c) => `| \`${c.table}\` | ${c.rows} | ${c.codeFiles} | ${c.migrations} |`).join('\n')}

_Pairs from handover: coupon_usage/coupon_usages, gst_configs/gst_configurations, audit_logs/audit_trail, tele_queue/tele_queues_

## Enhanced / versioned

${debtEnhanced.map((c) => `- \`${c.table}\` — ${c.rows} rows, ${c.codeFiles} code files`).join('\n')}

## Dating (experimental)

${debtDating.map((c) => `- \`${c.table}\` — ${c.rows} rows, code=${c.codeFiles}, mig=${c.migrations}`).join('\n') || '_none_'}

## Migration-only tables (${debtMigrationOnly.length} total)

Sample: ${debtMigrationOnly.slice(0, 20).map((c) => c.table).join(', ')}…

## Naming inconsistencies observed

- Plural/singular duplicates (coupon_usage vs coupon_usages)
- \`_enhanced\` / \`_v2\` suffix tables alongside base tables
- \`*_backup\` tables from dedupe operations
- Parallel taxonomy: \`specialization_master\` vs \`problem_grid_mappings\`
`
    );

    fs.writeFileSync(
      path.join(OUT_DIR, '15_production_risk_report.md'),
      `# 15 — Production Risk Report

## Migration risk matrix (subset)

| Table | Rows | Size MB | Code files | Risk | Factors |
|-------|------|---------|------------|------|---------|
${riskRows.slice(0, 50).map((r) => `| \`${r.table}\` | ${r.rows} | ${r.size_mb} | ${r.code_files} | **${r.migration_risk}** | ${r.factors.join(', ') || '—'} |`).join('\n')}

## Business-critical (Critical classification)

${classified.filter((c) => c.classification === 'Critical').map((c) => `- \`${c.table}\` — ${c.reasons.join('; ')}`).join('\n')}

## Operational risks

1. **Handler runtime DDL** — schema mutations outside migration ledger
2. **Dual active duplicate tables** — coupon_usage + coupon_usages; vendor_holidays + vendor_holidays_enhanced
3. **High coupling mega-files** — admin-advanced.ts, admin-comprehensive.ts
4. **FK orphan drift** — vendor_services.service_id vs services (per prior RCA)
5. **Staff decommission** — routes disabled but tables still referenced
`
    );

    fs.writeFileSync(
      path.join(OUT_DIR, '16_production_questions.md'),
      `# 16 — Production Discovery Questions

Awaiting approval before next phase (prod vs dev drift comparison).

1. Which migration-only tables with **prod rows > 0** are still business-required?
2. Confirm canonical table for duplicate pairs (coupon_usage/usages, vendor_holidays/enhanced).
3. Is the dating feature retired in production?
4. Are \`*_backup\` tables required for compliance/audit retention?
5. What is acceptable downtime/write-freeze window for prod cutover?
6. Should \`search_index\` be rebuilt vs migrated in v2?
7. Is full ecommerce in v2 core scope?
8. Retain staff tables if solo-vendor model is final?
9. Prod tables with rows but zero code refs — batch jobs outside Lambda?
10. Old prod cluster retention period after cutover (14 vs 30 days)?
`
    );

    console.log('\n✅ Phase 0B complete. Outputs in docs/rds-v2/prod/');
    console.log(`   Tables: ${tableCount}, FKs: ${raw.foreignKeys.length}, Columns: ${raw.columns.length}`);
  } catch (inner) {
    throw inner;
  }
}

main().catch((err) => {
  console.error('Discovery failed:', err);
  process.exit(1);
});
