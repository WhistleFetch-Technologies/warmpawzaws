#!/usr/bin/env node
/**
 * Repair inflated package-session vendor_earnings (full package net per walk).
 * Default is dry-run. Pass --apply to write.
 *
 *   ENVIRONMENT=dev node scripts/repair-package-session-vendor-earnings.js
 *   ENVIRONMENT=dev node scripts/repair-package-session-vendor-earnings.js --apply
 *   ENVIRONMENT=prod node scripts/repair-package-session-vendor-earnings.js
 *
 * Formula: vendorPool = base − tier commission; per session = vendorPool / N
 * Example: 12712 − 10% = 11440.80; 11440.80 / 48 = 238.35
 */

const { execSync } = require('child_process');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const APPLY = process.argv.includes('--apply');

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function vendorPoolAfterCommission(base, rate) {
  const b = round2(Math.max(0, base));
  const r = Math.max(0, rate);
  return round2(b - round2((b * r) / 100));
}

function allocateNet({ pool, n, priorCount, priorSum }) {
  if (!(pool > 0.009) || n <= 0 || priorCount >= n) return 0;
  const remaining = round2(pool - priorSum);
  if (remaining <= 0.009) return 0;
  const even = round2(pool / n);
  const slice = priorCount === n - 1 ? remaining : Math.min(even, remaining);
  return slice > 0.009 ? round2(slice) : 0;
}

function scaleGrossFromNet(net, rate) {
  const vendorNet = round2(Math.max(0, net));
  if (vendorNet <= 0.009) return { gross: 0, commission: 0, net: 0 };
  if (rate >= 100) return { gross: vendorNet, commission: 0, net: vendorNet };
  const gross = round2(vendorNet / (1 - rate / 100));
  return { gross, commission: round2(gross - vendorNet), net: vendorNet };
}

async function connect() {
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  );
  const cluster = clusterInfo.DBClusters[0];
  let endpoint = cluster.Endpoint;
  if (ENVIRONMENT === 'prod') {
    endpoint = 'warmpawz-prod-proxy.proxy-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';
  }
  const secretName =
    ENVIRONMENT === 'prod'
      ? 'warmpawz-prod-rds-master-20260207201049162400000001'
      : 'warmpawz-dev-rds-master-20260106164510791100000002';
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretValue = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  const creds = JSON.parse(secretValue.SecretString);
  const client = new Client({
    host: endpoint,
    port: cluster.Port || 5432,
    database: cluster.DatabaseName || 'warmpawz',
    user: creds.username || creds.user,
    password: creds.password,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

async function main() {
  console.log(`Repair package session earnings (${ENVIRONMENT}) ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  const client = await connect();
  try {
    const { rows } = await client.query(`
      SELECT
        ve.id,
        ve.vendor_id,
        ve.booking_id,
        ve.amount::numeric AS amount,
        ve.commission_amount::numeric AS commission_amount,
        ve.total_amount::numeric AS total_amount,
        ve.commission_rate::numeric AS commission_rate,
        ve.status,
        b.package_purchase_id,
        COALESCE(pp.total_sessions, (
          SELECT COUNT(*)::int FROM package_scheduled_sessions pss
          WHERE pss.package_purchase_id = b.package_purchase_id
        ), 1) AS session_n,
        COALESCE(
          NULLIF(parent_b.total_amount, 0),
          NULLIF(parent_b.base_price, 0),
          NULLIF(pp.amount, 0),
          NULLIF(pp.package_price, 0),
          0
        )::numeric AS parent_base,
        v.business_name,
        c.full_name AS customer_name
      FROM vendor_earnings ve
      JOIN bookings b ON b.id = ve.booking_id
      JOIN vendors v ON v.id = ve.vendor_id
      LEFT JOIN customers c ON c.id = b.customer_id
      LEFT JOIN bookings parent_b
        ON parent_b.package_purchase_id = b.package_purchase_id
       AND COALESCE(parent_b.is_package_session, false) = false
       AND parent_b.parent_booking_id IS NULL
      LEFT JOIN package_purchases pp ON pp.id = b.package_purchase_id
      WHERE COALESCE(b.is_package_session, false) = true
        AND ve.status IS DISTINCT FROM 'cancelled'
        AND b.package_purchase_id IS NOT NULL
      ORDER BY b.package_purchase_id, ve.realized_at NULLS LAST, ve.created_at, ve.id
    `);

    const byPurchase = new Map();
    for (const row of rows) {
      const pid = String(row.package_purchase_id);
      if (!byPurchase.has(pid)) byPurchase.set(pid, []);
      byPurchase.get(pid).push(row);
    }

    const updates = [];
    for (const [pid, group] of byPurchase) {
      const n = Math.max(1, Number(group[0].session_n) || 1);
      const rate = Number(group[0].commission_rate) || 0;
      const base = Number(group[0].parent_base) || 0;
      if (!(base > 0) || n <= 0) continue;
      const pool = vendorPoolAfterCommission(base, rate);
      const even = round2(pool / n);
      let priorSum = 0;
      group.forEach((row, idx) => {
        const stored = Number(row.amount) || 0;
        if (stored <= even * 1.5 + 0.01) {
          priorSum = round2(priorSum + stored);
          return;
        }
        const net = allocateNet({ pool, n, priorCount: idx, priorSum });
        const scaled = scaleGrossFromNet(net, rate);
        const delta = round2(net - stored);
        priorSum = round2(priorSum + net);
        updates.push({
          id: row.id,
          vendorId: row.vendor_id,
          business: row.business_name,
          customer: row.customer_name,
          purchaseId: pid,
          from: stored,
          to: net,
          delta,
          n,
          pool,
          ...scaled,
        });
      });
    }

    if (updates.length === 0) {
      console.log('No inflated package session earnings found.');
      return;
    }

    console.log(`Found ${updates.length} inflated row(s):`);
    for (const u of updates) {
      console.log(
        `  ${u.business} / ${u.customer}: ${u.from} → ${u.to} (N=${u.n}, pool=${u.pool})`
      );
    }

    const vendorDelta = new Map();
    for (const u of updates) {
      vendorDelta.set(u.vendorId, round2((vendorDelta.get(u.vendorId) || 0) + u.delta));
    }

    if (!APPLY) {
      console.log('Dry-run only. Re-run with --apply to write.');
      return;
    }

    await client.query('BEGIN');
    for (const u of updates) {
      await client.query(
        `UPDATE vendor_earnings
         SET amount = $1::numeric,
             commission_amount = $2::numeric,
             total_amount = $3::numeric
         WHERE id = $4::uuid AND status = 'pending'`,
        [u.to, u.commission, u.gross, u.id]
      );
    }
    for (const [vendorId, delta] of vendorDelta) {
      await client.query(
        `UPDATE vendors
         SET pending_payout = GREATEST(COALESCE(pending_payout, 0) + $1, 0),
             total_earnings = GREATEST(COALESCE(total_earnings, 0) + $1, 0),
             updated_at = NOW()
         WHERE id = $2::uuid`,
        [delta, vendorId]
      );
    }
    await client.query('COMMIT');
    console.log(`Applied ${updates.length} row update(s).`);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    console.error(err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
