#!/usr/bin/env node
/**
 * RDS Data API Utilities for Dev Environment
 *
 * Connects to dev/prod RDS using AWS RDS Data API (@aws-sdk/client-rds-data).
 * Cluster + secret discovery uses @aws-sdk/client-rds and client-secrets-manager (no AWS CLI required).
 * 
 * Usage:
 *   const { getClusterInfo, executeSQL, parseRecord, parseRecords } = require('./rds-data-api-utils-dev');
 *   
 *   const clusterInfo = await getClusterInfo();
 *   const result = await executeSQL('SELECT * FROM bookings LIMIT 1', true);
 *   const records = parseRecords(result);
 */

const fs = require('fs');
const path = require('path');

/**
 * Load scripts/.env.local then scripts/.env (gitignored) so migrations work without exporting vars in the shell.
 * Does not override variables already set in the environment.
 */
function loadScriptsDirEnvFiles() {
  const dir = __dirname;
  for (const name of ['.env.local', '.env']) {
    const full = path.join(dir, name);
    if (!fs.existsSync(full)) continue;
    const text = fs.readFileSync(full, 'utf8');
    for (let line of text.split(/\r?\n/)) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined || process.env[key] === '') {
        process.env[key] = val;
      }
    }
  }
}

loadScriptsDirEnvFiles();

const { RDSClient, DescribeDBClustersCommand } = require('@aws-sdk/client-rds');
const { SecretsManagerClient, DescribeSecretCommand } = require('@aws-sdk/client-secrets-manager');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const CLUSTER_IDENTIFIER = `warmpawz-${ENVIRONMENT}-cluster`;
const SECRET_NAME = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
const DATABASE_NAME = 'warmpawz';

let rdsDataClient = null;
function getRdsDataClient() {
  if (!rdsDataClient) {
    rdsDataClient = new RDSDataClient({ region: REGION });
  }
  return rdsDataClient;
}

/**
 * Strip SQL line comments and block comments without touching string or dollar-quoted literals.
 */
function stripSqlComments(sql) {
  let out = '';
  let i = 0;
  let state = 'code'; // code | squote | dollar
  let dollarTag = '';

  while (i < sql.length) {
    const c = sql[i];
    const next = sql[i + 1];

    if (state === 'code') {
      if (c === '-' && next === '-') {
        i += 2;
        while (i < sql.length && sql[i] !== '\n') i++;
        if (i < sql.length) {
          out += '\n';
          i++;
        }
        continue;
      }
      if (c === '/' && next === '*') {
        i += 2;
        while (i < sql.length - 1 && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
        i += 2;
        out += '\n';
        continue;
      }
      if (c === "'") {
        state = 'squote';
        out += c;
        i++;
        continue;
      }
      if (c === '$') {
        const rest = sql.slice(i);
        const m = rest.match(/^\$([a-zA-Z_]*)\$/);
        if (m) {
          dollarTag = m[1];
          state = 'dollar';
          out += m[0];
          i += m[0].length;
          continue;
        }
      }
      out += c;
      i++;
      continue;
    }

    if (state === 'squote') {
      out += c;
      if (c === "'" && next === "'") {
        out += next;
        i += 2;
        continue;
      }
      if (c === "'") {
        state = 'code';
      }
      i++;
      continue;
    }

    if (state === 'dollar') {
      const close = '$' + dollarTag + '$';
      if (sql.slice(i, i + close.length) === close) {
        out += close;
        i += close.length;
        state = 'code';
        continue;
      }
      out += c;
      i++;
      continue;
    }
  }
  return out;
}

/**
 * Split a PostgreSQL script on semicolons outside strings and dollar-quoted blocks
 * (so DO $$ ... END $$; stays one statement).
 */
function splitPostgresStatements(sql) {
  const clean = stripSqlComments(sql);
  const statements = [];
  let buf = '';
  let i = 0;
  let state = 'code';
  let dollarTag = '';

  while (i < clean.length) {
    const c = clean[i];
    const next = clean[i + 1];

    if (state === 'code') {
      if (c === "'") {
        state = 'squote';
        buf += c;
        i++;
        continue;
      }
      if (c === '$') {
        const rest = clean.slice(i);
        const m = rest.match(/^\$([a-zA-Z_]*)\$/);
        if (m) {
          dollarTag = m[1];
          state = 'dollar';
          buf += m[0];
          i += m[0].length;
          continue;
        }
      }
      if (c === ';') {
        const t = buf.trim();
        if (t.length > 0) statements.push(t);
        buf = '';
        i++;
        continue;
      }
      buf += c;
      i++;
      continue;
    }

    if (state === 'squote') {
      buf += c;
      if (c === "'" && next === "'") {
        buf += next;
        i += 2;
        continue;
      }
      if (c === "'") {
        state = 'code';
      }
      i++;
      continue;
    }

    if (state === 'dollar') {
      const close = '$' + dollarTag + '$';
      if (clean.slice(i, i + close.length) === close) {
        buf += close;
        i += close.length;
        state = 'code';
        continue;
      }
      buf += c;
      i++;
      continue;
    }
  }

  const tail = buf.trim();
  if (tail.length > 0) statements.push(tail);
  return statements;
}

// Cache for cluster info
let cachedClusterInfo = null;

/**
 * Get cluster ARN and secret ARN (cached after first lookup).
 * Uses AWS SDK (same APIs as `aws rds describe-db-clusters` / `describe-secret`) — no AWS CLI required.
 * @returns {Promise<{clusterArn: string, secretArn: string, httpEndpointEnabled: boolean}>}
 */
async function getClusterInfo() {
  if (cachedClusterInfo) {
    return cachedClusterInfo;
  }

  console.log('📊 Getting RDS cluster information...');

  try {
    const rdsClient = new RDSClient({ region: REGION });
    const clusterOut = await rdsClient.send(
      new DescribeDBClustersCommand({ DBClusterIdentifier: CLUSTER_IDENTIFIER }),
    );

    if (!clusterOut.DBClusters || clusterOut.DBClusters.length === 0) {
      throw new Error(`RDS cluster not found: ${CLUSTER_IDENTIFIER}`);
    }

    const cluster = clusterOut.DBClusters[0];
    const clusterArn = cluster.DBClusterArn;
    const httpEndpointEnabled = cluster.HttpEndpointEnabled || false;

    if (!httpEndpointEnabled) {
      throw new Error(
        `RDS Data API is not enabled on cluster ${CLUSTER_IDENTIFIER}. HttpEndpointEnabled must be true.`,
      );
    }

    console.log(`   ✅ Cluster ARN: ${clusterArn}`);
    console.log('   ✅ HTTP Endpoint: Enabled');

    let secretArn = cluster.MasterUserSecret?.SecretArn;
    if (!secretArn) {
      const secretName =
        ENVIRONMENT === 'prod'
          ? 'warmpawz-prod-rds-master-20260207201049162400000001'
          : SECRET_NAME;
      const smClient = new SecretsManagerClient({ region: REGION });
      const secOut = await smClient.send(new DescribeSecretCommand({ SecretId: secretName }));
      secretArn = secOut.ARN;
      if (!secretArn) {
        throw new Error(`Could not resolve secret ARN for ${secretName}`);
      }
    }

    console.log(`   ✅ Secret ARN: ${secretArn}`);
    console.log('');

    cachedClusterInfo = {
      clusterArn,
      secretArn,
      httpEndpointEnabled,
    };

    return cachedClusterInfo;
  } catch (error) {
    console.error('❌ Failed to get cluster information:');
    console.error(error.message);
    throw error;
  }
}

/**
 * Execute SQL statement using RDS Data API
 * @param {string} sql - SQL statement to execute
 * @param {boolean} expectResult - Whether to expect and return result records
 * @returns {Promise<Object>} RDS Data API response
 */
async function executeSQL(sql, expectResult = false) {
  const clusterInfo = await getClusterInfo();
  const client = getRdsDataClient();

  console.log('⚙️  Executing SQL...');
  if (sql.length > 200) {
    console.log(`   SQL preview: ${sql.substring(0, 200)}...`);
  } else {
    console.log(`   SQL: ${sql}`);
  }

  try {
    const result = await client.send(
      new ExecuteStatementCommand({
        resourceArn: clusterInfo.clusterArn,
        secretArn: clusterInfo.secretArn,
        database: DATABASE_NAME,
        sql,
        includeResultMetadata: expectResult,
      })
    );

    if (expectResult && result.records?.length) {
      console.log(`   ✅ Query executed successfully (${result.records.length} records)`);
    } else {
      console.log(`   ✅ Statement executed successfully`);
    }

    return result;
  } catch (error) {
    console.error('❌ SQL execution failed:');
    const msg = error.message || String(error);
    console.error(`   Error: ${msg}`);
    throw error;
  }
}

/**
 * Parse a single record from RDS Data API format
 * @param {Array} record - Record array from RDS Data API
 * @returns {Object} Parsed record object
 */
function parseRecord(record) {
  return record.map(field => {
    if (field.isNull) {
      return null;
    }
    if (field.stringValue !== undefined) {
      return field.stringValue;
    }
    if (field.longValue !== undefined) {
      return field.longValue;
    }
    if (field.doubleValue !== undefined) {
      return field.doubleValue;
    }
    if (field.booleanValue !== undefined) {
      return field.booleanValue;
    }
    if (field.blobValue !== undefined) {
      return Buffer.from(field.blobValue, 'base64');
    }
    return null;
  });
}

/**
 * Parse all records from RDS Data API result
 * @param {Object} result - RDS Data API response
 * @param {Array<string>} columnNames - Optional column names (if not provided, uses generic names)
 * @returns {Array<Object>} Array of parsed record objects
 */
function parseRecords(result, columnNames = null) {
  if (!result.records || result.records.length === 0) {
    return [];
  }
  
  // Get column names from columnMetadata if available
  if (!columnNames && result.columnMetadata) {
    columnNames = result.columnMetadata.map(col => col.name);
  }
  
  const records = result.records.map(record => {
    const parsed = parseRecord(record);
    
    // If column names available, return as object; otherwise return as array
    if (columnNames && columnNames.length === parsed.length) {
      const obj = {};
      columnNames.forEach((name, index) => {
        obj[name] = parsed[index];
      });
      return obj;
    }
    
    return parsed;
  });
  
  return records;
}

/**
 * Execute SQL and return parsed records
 * @param {string} sql - SQL SELECT statement
 * @returns {Promise<Array>} Array of parsed record objects
 */
async function query(sql) {
  const result = await executeSQL(sql, true);
  return parseRecords(result);
}

/**
 * Execute SQL file
 * @param {string} filePath - Path to SQL file
 * @returns {Promise<Object>} RDS Data API response
 */
async function executeSQLFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`SQL file not found: ${filePath}`);
  }
  
  const sql = fs.readFileSync(filePath, 'utf8');
  return executeSQL(sql, false);
}

module.exports = {
  getClusterInfo,
  executeSQL,
  parseRecord,
  parseRecords,
  query,
  executeSQLFile,
  stripSqlComments,
  splitPostgresStatements,
  ENVIRONMENT,
  REGION,
  CLUSTER_IDENTIFIER,
  SECRET_NAME,
  DATABASE_NAME
};
