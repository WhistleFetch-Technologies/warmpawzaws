#!/usr/bin/env node
/**
 * Remove OpenSearch (es:ESHttp*) statements from Lambda execution role inline policy.
 * Use when Terraform apply is blocked locally but IAM must match code (OpenSearch removed).
 *
 * Usage:
 *   node scripts/strip-opensearch-lambda-iam.js dev
 *   node scripts/strip-opensearch-lambda-iam.js prod
 */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const env = process.argv[2] || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const FN = env === 'prod' ? 'warmpawz-prod-api-handler' : 'warmpawz-dev-api-handler';

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }).trim();
}

function stripOpenSearchStatements(doc) {
  const statements = (doc.Statement || []).filter((s) => {
    const actions = Array.isArray(s.Action) ? s.Action : [s.Action || ''];
    return !actions.some((a) => String(a).startsWith('es:ESHttp') || a === 'es:*');
  });
  return { ...doc, Statement: statements };
}

function main() {
  console.log(`Stripping OpenSearch IAM from ${FN} (${env})...`);
  const roleArn = run(
    `aws lambda get-function-configuration --function-name ${FN} --region ${REGION} --query Role --output text`,
  );
  const roleName = roleArn.split('/').pop();
  console.log(`  Role: ${roleName}`);

  const policyNames = JSON.parse(
    run(`aws iam list-role-policies --role-name ${roleName} --region ${REGION} --output json`),
  ).PolicyNames;

  const custom = policyNames.filter((n) => n.includes('lambda-custom'));
  if (custom.length === 0) {
    console.log('  No lambda-custom inline policy found — nothing to do.');
    return;
  }

  for (const policyName of custom) {
    const raw = run(
      `aws iam get-role-policy --role-name ${roleName} --policy-name ${policyName} --region ${REGION} --query PolicyDocument --output json`,
    );
    const doc = JSON.parse(raw);
    const before = doc.Statement?.length || 0;
    const cleaned = stripOpenSearchStatements(doc);
    const after = cleaned.Statement?.length || 0;
    if (before === after) {
      console.log(`  ${policyName}: no es:ESHttp* statement (already clean)`);
      continue;
    }
    const tmp = path.join(os.tmpdir(), `lambda-policy-${env}-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify(cleaned));
    run(
      `aws iam put-role-policy --role-name ${roleName} --policy-name ${policyName} --policy-document file://${tmp.replace(/\\/g, '/')}`,
    );
    fs.unlinkSync(tmp);
    console.log(`  ${policyName}: removed OpenSearch statement (${before} -> ${after} statements)`);
  }
  console.log('Done.');
}

main();
