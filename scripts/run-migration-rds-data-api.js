#!/usr/bin/env node
/**
 * Run a DB migration against AWS RDS Aurora using the RDS Data API (HTTPS).
 * Unlike run-migration-rds-node.js, this does NOT require a VPN or direct TCP
 * connection to the RDS cluster — it uses the HTTP endpoint (Data API) that is
 * already enabled on the dev cluster.
 *
 * Usage:
 *   ENVIRONMENT=dev node scripts/run-migration-rds-data-api.js 1030_seed_search_taxonomy_keywords.sql
 *   ENVIRONMENT=prod node scripts/run-migration-rds-data-api.js <file>.sql
 *
 * Requirements:
 *   - AWS CLI configured (aws sts get-caller-identity must work)
 *   - RDS cluster must have HttpEndpointEnabled = true (Data API on)
 *   - npm install @aws-sdk/client-rds-data @aws-sdk/client-secrets-manager
 */
const {
  RDSDataClient,
  ExecuteStatementCommand,
  BeginTransactionCommand,
  CommitTransactionCommand,
  RollbackTransactionCommand,
} = require('@aws-sdk/client-rds-data');
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const CLUSTER_ID = `warmpawz-${ENVIRONMENT}-cluster`;

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: ENVIRONMENT=dev node scripts/run-migration-rds-data-api.js <migration-file>.sql');
  process.exit(1);
}

const migrationPath = path.join(__dirname, '..', 'db', 'migrations', migrationFile);
if (!fs.existsSync(migrationPath)) {
  console.error(`Migration file not found: ${migrationPath}`);
  process.exit(1);
}

async function main() {
  console.log('=== RDS Data API Migration Runner ===');
  console.log(`Environment : ${ENVIRONMENT}`);
  console.log(`Region      : ${REGION}`);
  console.log(`Migration   : ${migrationFile}`);
  console.log('');

  // 1. Resolve cluster ARN
  console.log('Fetching cluster ARN...');
  const clusterInfo = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${CLUSTER_ID} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  );
  const cluster = clusterInfo.DBClusters[0];
  const resourceArn = cluster.DBClusterArn;
  if (!cluster.HttpEndpointEnabled) {
    console.error('ERROR: Data API (HttpEndpoint) is not enabled on this cluster. Enable it in the RDS console.');
    process.exit(1);
  }
  console.log(`Cluster ARN : ${resourceArn}`);

  // 2. Resolve secret ARN
  console.log('Fetching Secrets Manager secret...');
  const smClient = new SecretsManagerClient({ region: REGION });
  const secretPattern = `warmpawz-${ENVIRONMENT}-rds-master`;
  const secretsList = JSON.parse(
    execSync(
      `aws secretsmanager list-secrets --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  );
  const secret = secretsList.SecretList.find((s) => s.Name.startsWith(secretPattern));
  if (!secret) {
    console.error(`ERROR: Could not find secret matching "${secretPattern}" in Secrets Manager.`);
    process.exit(1);
  }
  const secretArn = secret.ARN;
  console.log(`Secret ARN  : ${secretArn}`);
  console.log('');

  // 3. Read migration SQL and split into individual statements
  const rawSql = fs.readFileSync(migrationPath, 'utf8');
  // Split on semicolons that end a statement (ignore semicolons inside $$ blocks)
  const statements = splitSqlStatements(rawSql);
  console.log(`Statements  : ${statements.length}`);
  console.log('');

  // 4. Fetch DB name from secret
  const secretValue = await smClient.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const dbCreds = JSON.parse(secretValue.SecretString);
  const dbName = dbCreds.dbname || 'warmpawz';
  console.log(`Database    : ${dbName}`);
  console.log('');

  // 5. Run statements via Data API inside a transaction
  const rdsData = new RDSDataClient({ region: REGION });

  console.log('Beginning transaction...');
  const txResult = await rdsData.send(
    new BeginTransactionCommand({
      resourceArn,
      secretArn,
      database: dbName,
    })
  );
  const transactionId = txResult.transactionId;
  console.log(`Transaction : ${transactionId}`);
  console.log('');

  let successCount = 0;
  try {
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt || stmt.startsWith('--')) continue;
      process.stdout.write(`  [${i + 1}/${statements.length}] Running...`);
      await rdsData.send(
        new ExecuteStatementCommand({
          resourceArn,
          secretArn,
          database: dbName,
          transactionId,
          sql: stmt,
        })
      );
      process.stdout.write(' OK\n');
      successCount++;
    }

    console.log('');
    console.log('Committing transaction...');
    await rdsData.send(
      new CommitTransactionCommand({ resourceArn, secretArn, transactionId })
    );
    console.log(`SUCCESS: ${successCount} statement(s) committed.`);
  } catch (err) {
    console.error('\nERROR:', err.message);
    console.error('Rolling back transaction...');
    await rdsData.send(
      new RollbackTransactionCommand({ resourceArn, secretArn, transactionId })
    ).catch(() => {});
    process.exit(1);
  }
}

/**
 * Splits a SQL file into individual statements, respecting $$ dollar-quoted blocks.
 */
function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';
  let i = 0;

  while (i < sql.length) {
    // Skip line comments
    if (!inDollarQuote && sql[i] === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      current += '\n';
      continue;
    }

    // Detect $$ or $tag$ blocks
    if (sql[i] === '$') {
      const tagEnd = sql.indexOf('$', i + 1);
      if (tagEnd !== -1) {
        const tag = sql.slice(i, tagEnd + 1);
        if (!inDollarQuote) {
          inDollarQuote = true;
          dollarTag = tag;
          current += tag;
          i = tagEnd + 1;
          continue;
        } else if (tag === dollarTag) {
          inDollarQuote = false;
          dollarTag = '';
          current += tag;
          i = tagEnd + 1;
          continue;
        }
      }
    }

    if (!inDollarQuote && sql[i] === ';') {
      current += ';';
      const trimmed = current.trim();
      if (trimmed && trimmed !== ';') statements.push(trimmed);
      current = '';
      i++;
      continue;
    }

    current += sql[i];
    i++;
  }

  const trimmed = current.trim();
  if (trimmed && trimmed !== ';') statements.push(trimmed);
  return statements;
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
