#!/usr/bin/env node
/**
 * Run DB report: active vendors, roles, services, packages, service styles
 * Connects to AWS RDS using same pattern as list-service-catalog-roles.js and
 * apply-migration-255-service-catalog-role-assignment.js.
 *
 * Usage:
 *   From project root: node scripts/run-db-report.js
 *   From scripts dir:  cd scripts && npm install && node run-db-report.js
 *
 * Environment (prefer in order):
 *   1. DATABASE_URL or DB_URL - PostgreSQL connection string (for RDS use postgresql://user:pass@host:5432/dbname with SSL)
 *   2. DB_HOST, DB_NAME, DB_USER, DB_PASSWORD - direct RDS connection
 *   3. Auto-discover: AWS CLI + Secrets Manager (warmpawz-${ENVIRONMENT}-cluster, warmpawz-${ENVIRONMENT}-rds-master-*)
 *   ENVIRONMENT=dev|stage|prod, AWS_REGION=ap-south-1, DB_SSL=true for RDS
 */

const { Pool } = require('pg');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
let DB_HOST = process.env.DB_HOST || process.env.RDS_HOSTNAME;
let DB_PORT = parseInt(process.env.DB_PORT || process.env.RDS_PORT || '5432', 10);
let DB_NAME = process.env.DB_NAME || process.env.RDS_DB_NAME;
let DB_USER = process.env.DB_USER || process.env.RDS_USERNAME;
const DB_SECRET_ARN = process.env.DB_SECRET_ARN;
let DB_PASSWORD = process.env.DB_PASSWORD || process.env.RDS_PASSWORD;

async function getConnectionConfig() {
  const DATABASE_URL = process.env.DATABASE_URL || process.env.DB_URL;
  if (DATABASE_URL) {
    if (DATABASE_URL.includes('rds.amazonaws.com') || DATABASE_URL.includes('rds.')) {
      const url = new URL(DATABASE_URL.replace(/^postgresql:\/\//, 'https://'));
      return {
        host: url.hostname,
        port: parseInt(url.port || '5432', 10),
        database: (url.pathname || '/').slice(1) || 'warmpawz',
        user: url.username,
        password: url.password,
        ssl: { rejectUnauthorized: false },
      };
    }
    return { connectionString: DATABASE_URL };
  }

  if (!DB_HOST || !DB_NAME) {
    try {
      const { execSync } = require('child_process');
      const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
      const endpoint = execSync(
        `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].Endpoint' --output text 2>/dev/null`,
        { encoding: 'utf8', maxBuffer: 1024 * 1024 }
      ).trim();
      if (endpoint && endpoint !== 'None' && endpoint !== 'null') {
        DB_HOST = endpoint;
        DB_PORT = parseInt(
          execSync(
            `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].Port' --output text 2>/dev/null`,
            { encoding: 'utf8', maxBuffer: 1024 * 1024 }
          ).trim() || '5432',
          10
        );
        DB_NAME = execSync(
          `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].DatabaseName' --output text 2>/dev/null`,
          { encoding: 'utf8', maxBuffer: 1024 * 1024 }
        ).trim() || 'warmpawz';
        DB_USER = execSync(
          `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].MasterUsername' --output text 2>/dev/null`,
          { encoding: 'utf8', maxBuffer: 1024 * 1024 }
        ).trim() || 'warmpawz_admin';
      }
    } catch (e) {
      /* ignore */
    }
  }

  if (DB_HOST && DB_NAME) {
    if (!DB_USER || !DB_PASSWORD) {
      try {
        const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
        const secretName = DB_SECRET_ARN || `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
        const client = new SecretsManagerClient({ region: AWS_REGION });
        const response = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
        const secret = JSON.parse(response.SecretString);
        DB_USER = DB_USER || secret.username || secret.Username || secret.user;
        DB_PASSWORD = DB_PASSWORD || secret.password || secret.Password;
      } catch (err) {
        console.error('DB report: could not get credentials:', err.message);
        throw new Error('Set DATABASE_URL or DB_HOST/DB_NAME and DB_USER/DB_PASSWORD or Secrets Manager access');
      }
    }
    const useSsl = process.env.DB_SSL === 'true' || (DB_HOST && DB_HOST.includes('rds.'));
    return {
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      password: DB_PASSWORD,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    };
  }

  throw new Error('Set DATABASE_URL or DB_HOST/DB_NAME (and credentials). For RDS, run with AWS CLI + Secrets Manager or set DATABASE_URL.');
}

async function runReport() {
  const config = await getConnectionConfig();
  const pool = new Pool({ ...config, max: 1 });
  const out = {
    activeVendorsCount: 0,
    byRole: [],
    serviceStylesInUse: [],
    discoverableRoles: [],
    vendorServicesSample: [],
    packagesCount: 0,
    diagnosticPackagesCount: 0,
  };

  try {
    const client = await pool.connect();

    const countRes = await client.query(`
      SELECT COUNT(*) AS n FROM vendors v
      WHERE v.status = 'approved' AND v.is_active = true
    `);
    out.activeVendorsCount = parseInt(countRes.rows[0]?.n || '0', 10);

    const roleRes = await client.query(`
      SELECT r.name AS role_name, r.display_name AS role_display_name, COUNT(v.id) AS vendor_count
      FROM vendors v
      INNER JOIN roles r ON v.role_id = r.id
      WHERE v.status = 'approved' AND v.is_active = true AND r.is_active = true
      GROUP BY r.id, r.name, r.display_name
      ORDER BY vendor_count DESC, r.name
    `);
    out.byRole = roleRes.rows;

    const styleRes = await client.query(`
      SELECT vs.service_style, COUNT(DISTINCT vs.vendor_id) AS vendors_with_style, COUNT(vs.id) AS services_count
      FROM vendor_services vs
      INNER JOIN vendors v ON v.id = vs.vendor_id
      WHERE v.status = 'approved' AND v.is_active = true AND vs.is_enabled = true
        AND (vs.publish_status = 'published' OR vs.publish_status IS NULL)
      GROUP BY vs.service_style
      ORDER BY vs.service_style
    `);
    out.serviceStylesInUse = styleRes.rows;

    const discoverableRes = await client.query(`
      SELECT DISTINCT r.name AS role_name, r.display_name AS role_display_name
      FROM vendors v
      INNER JOIN roles r ON v.role_id = r.id
      INNER JOIN vendor_services vs ON vs.vendor_id = v.id
      WHERE v.status = 'approved' AND v.is_active = true AND r.is_active = true
        AND vs.is_enabled = true AND (vs.publish_status = 'published' OR vs.publish_status IS NULL)
      ORDER BY r.name
    `);
    out.discoverableRoles = discoverableRes.rows;

    const sampleRes = await client.query(`
      SELECT v.id AS vendor_id, v.business_name, r.name AS role_name,
        COUNT(vs.id) AS services_count,
        COUNT(CASE WHEN vs.service_style = 'at_center' AND vs.is_enabled = true AND (vs.publish_status = 'published' OR vs.publish_status IS NULL) THEN 1 END) AS at_center_published,
        COUNT(CASE WHEN vs.service_style = 'at_home' AND vs.is_enabled = true AND (vs.publish_status = 'published' OR vs.publish_status IS NULL) THEN 1 END) AS at_home_published,
        COUNT(CASE WHEN vs.service_style = 'tele' AND vs.is_enabled = true AND (vs.publish_status = 'published' OR vs.publish_status IS NULL) THEN 1 END) AS tele_published
      FROM vendors v
      INNER JOIN roles r ON v.role_id = r.id
      LEFT JOIN vendor_services vs ON vs.vendor_id = v.id
      WHERE v.status = 'approved' AND v.is_active = true
      GROUP BY v.id, v.business_name, r.name
      ORDER BY v.business_name
      LIMIT 20
    `);
    out.vendorServicesSample = sampleRes.rows;

    try {
      const pkgRes = await client.query(`
        SELECT COUNT(*) AS n FROM service_packages sp
        INNER JOIN vendors v ON v.id = sp.vendor_id
        WHERE v.status = 'approved' AND v.is_active = true AND sp.is_active = true
      `);
      out.packagesCount = parseInt(pkgRes.rows[0]?.n || '0', 10);
    } catch (_) {
      out.packagesCount = 0;
    }

    try {
      const diagRes = await client.query(`
        SELECT COUNT(*) AS n FROM diagnostic_packages dp
        INNER JOIN vendors v ON v.id = dp.vendor_id
        WHERE v.status = 'approved' AND v.is_active = true AND dp.is_active = true
      `);
      out.diagnosticPackagesCount = parseInt(diagRes.rows[0]?.n || '0', 10);
    } catch (_) {
      out.diagnosticPackagesCount = 0;
    }

    client.release();
  } catch (err) {
    const msg = err && (err.message || err.toString());
    console.error('DB report error:', msg || err);
    if (process.env.DATABASE_URL || process.env.DB_URL) {
      console.error('Hint: Check DATABASE_URL connectivity and schema.');
    } else {
      console.error('Hint: Set DATABASE_URL, or DB_HOST/DB_NAME and credentials, or run with AWS CLI + Secrets Manager (e.g. from scripts/: npm install && node run-db-report.js).');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }

  return out;
}

runReport()
  .then((out) => {
    console.log(JSON.stringify(out, null, 2));
    console.error('\nSummary:');
    console.error('  Active vendors:', out.activeVendorsCount);
    console.error('  Roles with vendors:', out.byRole.length);
    console.error('  Service styles in use:', (out.serviceStylesInUse || []).map((s) => s.service_style).join(', ') || 'none');
    console.error('  Discoverable roles:', (out.discoverableRoles || []).map((r) => r.role_name).join(', ') || 'none');
    console.error('  Service packages configured:', out.packagesCount);
    console.error('  Diagnostic packages:', out.diagnosticPackagesCount);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
