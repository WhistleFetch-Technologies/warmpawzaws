#!/usr/bin/env node
/**
 * Read-only audit of banners table (image_url + cta_link patterns).
 * Usage: ENVIRONMENT=dev node scripts/audit-banners-rds.js
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

const DEV = {
  SECRET_ARN:
    'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI',
  DB_HOST: 'warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
};

async function getDbCredentials(secretArn) {
  const sm = new SecretsManagerClient({ region: REGION });
  const response = await sm.send(new GetSecretValueCommand({ SecretId: secretArn }));
  return JSON.parse(response.SecretString);
}

async function main() {
  if (ENVIRONMENT !== 'dev') {
    console.error('This audit script is configured for dev only. Set ENVIRONMENT=dev');
    process.exit(1);
  }

  const creds = await getDbCredentials(DEV.SECRET_ARN);
  const client = new Client({
    host: DEV.DB_HOST,
    port: 5432,
    database: 'warmpawz',
    user: creds.username || creds.user,
    password: creds.password,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log(`Banner audit (${ENVIRONMENT})\n`);

  const rows = await client.query(`
    SELECT id, title, type, cta_link, image_url, is_active,
           metadata->'bannerTarget' AS banner_target
    FROM banners
    ORDER BY type, display_order
  `);
  console.log('All banners:', JSON.stringify(rows.rows, null, 2));

  const byImage = await client.query(`
    SELECT type, image_url, count(*)::int AS n
    FROM banners GROUP BY type, image_url ORDER BY type, n DESC
  `);
  console.log('\nBy type + image_url:', JSON.stringify(byImage.rows, null, 2));

  const bad = await client.query(`
    SELECT count(*)::int AS placeholder_cta FROM banners WHERE cta_link ILIKE '%/placeholder%'
  `);
  const hero = await client.query(`
    SELECT count(*)::int AS hero_pet_img FROM banners WHERE image_url = '/images/home/hero-pet.webp'
  `);
  console.log('\nBad counts:', { placeholder_cta: bad.rows[0].placeholder_cta, hero_pet_img: hero.rows[0].hero_pet_img });

  await client.end();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
