#!/usr/bin/env node
/**
 * Dev-only: copy parent products.stock to default SKU when SKU aggregate is 0 but parent > 0.
 * Usage: ENVIRONMENT=dev node scripts/backfill-product-sku-stock-from-parent.js
 */
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const SECRET_ARN =
  process.env.DB_SECRET_ARN ||
  (ENVIRONMENT === 'prod'
    ? process.env.PROD_DB_SECRET_ARN
    : 'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI');
const DB_HOST =
  process.env.DB_HOST ||
  (ENVIRONMENT === 'prod'
    ? process.env.PROD_DB_HOST
    : 'warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com');
const DB_NAME = process.env.DB_NAME || 'warmpawz';

const SQL = `
UPDATE product_skus ps
SET stock = p.stock, updated_at = now()
FROM products p
WHERE ps.product_id = p.id
  AND p.stock > 0
  AND ps.sort_order = 0
  AND (
    SELECT COALESCE(SUM(stock), 0)
    FROM product_skus
    WHERE product_id = p.id
  ) = 0;
`;

async function main() {
  if (ENVIRONMENT === 'prod' && process.env.CONFIRM_PROD !== 'yes') {
    console.error('Prod backfill blocked. Set CONFIRM_PROD=yes to run on prod.');
    process.exit(1);
  }
  const sm = new SecretsManagerClient({ region: REGION });
  const creds = JSON.parse((await sm.send(new GetSecretValueCommand({ SecretId: SECRET_ARN }))).SecretString);
  const client = new Client({
    host: DB_HOST,
    port: 5432,
    database: DB_NAME,
    user: creds.username || creds.user,
    password: creds.password,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const r = await client.query(SQL);
  console.log(`Updated ${r.rowCount ?? 0} product_skus row(s) from parent stock (${ENVIRONMENT}).`);
  await client.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
