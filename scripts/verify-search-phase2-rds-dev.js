#!/usr/bin/env node
/**
 * Dev RDS smoke: run Phase-2-style search counts (category + residual tokens).
 */
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');

const REGION = 'ap-south-1';
const SECRET_ARN =
  process.env.DB_SECRET_ARN ||
  'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI';
const DB_HOST =
  process.env.DB_HOST || 'warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';
const DB_NAME = process.env.DB_NAME || 'warmpawz';

const CASES = [
  { q: 'dog doctor', hub: 'vet', tokens: ['doctor'] },
  { q: 'cat doctor', hub: 'vet', tokens: ['doctor'] },
  { q: 'pet clinic', hub: 'vet', tokens: [] },
  { q: 'animal hospital', hub: 'vet', tokens: [] },
  { q: 'dog grooming', hub: 'grooming', tokens: ['grooming'] },
  { q: 'pet nutritionist', hub: 'nutritionist', tokens: [] },
  { q: 'pet surgery', hub: 'vet', tokens: ['surgery'] },
  { q: 'vet near me', hub: 'vet', tokens: [] },
];

async function getCreds() {
  const sm = new SecretsManagerClient({ region: REGION });
  const r = await sm.send(new GetSecretValueCommand({ SecretId: SECRET_ARN }));
  return JSON.parse(r.SecretString);
}

async function countVendors(client, tokens) {
  let sql = `
    SELECT COUNT(DISTINCT v.id)::int AS n
    FROM vendors v
    WHERE v.is_active = true
      AND LOWER(COALESCE(v.status::text, '')) IN ('approved', 'active', 'live')
  `;
  const params = [];
  let i = 1;
  for (const t of tokens) {
    sql += ` AND (
      v.business_name ILIKE $${i} OR v.specialization ILIKE $${i}
      OR EXISTS (
        SELECT 1 FROM vendor_services vs
        WHERE vs.vendor_id = v.id AND vs.is_enabled = true
          AND vs.publish_status IN ('published', 'auto_published')
          AND (vs.service_name ILIKE $${i} OR COALESCE(vs.custom_description,'') ILIKE $${i})
      )
    )`;
    params.push(`%${t}%`);
    i++;
  }
  const { rows } = await client.query(sql, params);
  return rows[0]?.n ?? 0;
}

async function main() {
  const creds = await getCreds();
  const client = new Client({
    host: DB_HOST,
    port: 5432,
    database: DB_NAME,
    user: creds.username,
    password: creds.password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  console.log('Connected to dev RDS\n');
  for (const c of CASES) {
    const n = await countVendors(client, c.tokens);
    console.log(
      JSON.stringify({
        query: c.q,
        effectiveCategory: c.hub,
        taxonomySource: '(after deploy: db|builtin)',
        searchText: c.tokens.join(' '),
        totalApprox: n,
        resultsReturned: n > 0,
      })
    );
  }
  await client.end();
}

main().catch((e) => {
  console.error('RDS verify failed:', e.message);
  process.exit(1);
});
