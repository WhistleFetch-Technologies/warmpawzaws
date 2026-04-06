/**
 * Prod: apply db/migrations/623_vendor_wallets_and_transactions.sql via RDS Data API.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const PROD_CLUSTER = 'warmpawz-prod-cluster';
const PROD_SECRET = 'warmpawz-prod-rds-master-20260207201049162400000001';

const base = () => {
  const clusterJson = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${PROD_CLUSTER} --region ${REGION} --output json`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }
    )
  );
  const c = clusterJson.DBClusters?.[0];
  if (!c?.HttpEndpointEnabled) throw new Error('Prod cluster missing or Data API off');
  const secretJson = JSON.parse(
    execSync(
      `aws secretsmanager describe-secret --secret-id "${PROD_SECRET}" --region ${REGION} --output json`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }
    )
  );
  return {
    resourceArn: c.DBClusterArn,
    secretArn: secretJson.ARN,
    database: c.DatabaseName || 'warmpawz',
  };
};

function splitStatements(sql) {
  const out = [];
  let cur = '';
  let i = 0;
  let state = 'code';
  let dollarTag = '';
  while (i < sql.length) {
    const c = sql[i];
    const next = sql[i + 1];
    if (state === 'code') {
      if (c === '-' && next === '-') {
        i += 2;
        while (i < sql.length && sql[i] !== '\n') i++;
        continue;
      }
      if (c === '/' && next === '*') {
        i += 2;
        while (i < sql.length - 1 && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
        i += 2;
        continue;
      }
      if (c === "'") {
        state = 'squote';
        cur += c;
        i++;
        continue;
      }
      if (c === '$') {
        const rest = sql.slice(i);
        const m = rest.match(/^\$([a-zA-Z_]*)\$/);
        if (m) {
          dollarTag = m[1];
          state = 'dollar';
          cur += m[0];
          i += m[0].length;
          continue;
        }
      }
      if (c === ';') {
        const t = cur.trim();
        if (t) out.push(t);
        cur = '';
        i++;
        continue;
      }
      cur += c;
      i++;
      continue;
    }
    if (state === 'squote') {
      cur += c;
      if (c === "'" && next === "'") {
        cur += next;
        i += 2;
        continue;
      }
      if (c === "'") state = 'code';
      i++;
      continue;
    }
    if (state === 'dollar') {
      const close = '$' + dollarTag + '$';
      if (sql.slice(i, i + close.length) === close) {
        cur += close;
        i += close.length;
        state = 'code';
        continue;
      }
      cur += c;
      i++;
    }
  }
  const t = cur.trim();
  if (t) out.push(t);
  return out;
}

const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '623_vendor_wallets_and_transactions.sql');
const outJson = path.join(__dirname, 'temp-prod-cli-one.json');

const b = base();
const sqlFile = fs.readFileSync(migrationPath, 'utf8');
const stmts = splitStatements(sqlFile).filter((s) => !/^--/.test(s.split('\n')[0]?.trim()));

console.log('Prod migration 623 —', stmts.length, 'statement(s)');

stmts.forEach((sql, idx) => {
  console.log('Step', idx + 1, '/', stmts.length);
  fs.writeFileSync(outJson, JSON.stringify({ ...b, sql }));
  execSync(
    `aws rds-data execute-statement --cli-input-json file://${outJson.replace(/\\/g, '/')} --region ${REGION}`,
    { stdio: 'inherit' }
  );
});

console.log('Done.');
