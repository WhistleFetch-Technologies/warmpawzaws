#!/usr/bin/env node
/**
 * Verify search_taxonomy_keywords table via RDS Data API.
 * Usage: ENVIRONMENT=dev node scripts/verify-taxonomy-db.js
 */
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = 'ap-south-1';
const RESOURCE_ARN = 'arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-dev-cluster';
const SECRET_ARN = 'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI';
const DATABASE = 'warmpawz';

async function query(sql) {
  const client = new RDSDataClient({ region: REGION });
  const result = await client.send(new ExecuteStatementCommand({
    resourceArn: RESOURCE_ARN,
    secretArn: SECRET_ARN,
    database: DATABASE,
    sql,
    includeResultMetadata: true,
  }));
  return result;
}

async function main() {
  console.log('=== Taxonomy DB Verification ===\n');

  const total = await query('SELECT COUNT(*) as cnt FROM search_taxonomy_keywords WHERE is_active = true');
  console.log('Total active keywords:', total.records[0][0].longValue);

  const byHub = await query(
    "SELECT hub_slug, COUNT(*) as cnt FROM search_taxonomy_keywords WHERE is_active = true GROUP BY hub_slug ORDER BY cnt DESC"
  );
  console.log('\nKeywords by hub:');
  for (const row of byHub.records) {
    console.log(' ', (row[0].stringValue || '').padEnd(20), row[1].longValue);
  }

  const testKeywords = ['vaccination', 'dog boarding', 'dog trainer', 'dog food', 'pet medicine'];
  console.log('\nTest keyword lookups:');
  for (const kw of testKeywords) {
    const norm = kw.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const res = await query(
      `SELECT keyword, hub_slug, subcategory FROM search_taxonomy_keywords WHERE keyword_normalized = '${norm}' AND is_active = true`
    );
    if (res.records.length > 0) {
      const r = res.records[0];
      console.log(`  "${kw}" → hub="${r[1].stringValue}"  subcategory="${r[2].stringValue || r[2].isNull ? (r[2].stringValue || 'null') : 'null'}"`);
    } else {
      console.log(`  "${kw}" → NOT FOUND`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
