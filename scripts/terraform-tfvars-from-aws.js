#!/usr/bin/env node
/**
 * Build a temporary terraform.auto.tfvars from AWS Secrets Manager (read-only).
 * Avoids committing secrets; use for local plan/apply when terraform.tfvars is incomplete.
 *
 * Usage:
 *   node scripts/terraform-tfvars-from-aws.js dev infra/envs/dev/secrets.auto.tfvars
 *   node scripts/terraform-tfvars-from-aws.js prod infra/envs/prod/secrets.auto.tfvars
 */
const { execSync } = require('child_process');

const env = process.argv[2];
if (!env || !['dev', 'prod'].includes(env)) {
  console.error('Usage: node scripts/terraform-tfvars-from-aws.js <dev|prod>');
  process.exit(1);
}

const REGION = process.env.AWS_REGION || 'ap-south-1';

function getSecret(id) {
  const raw = execSync(
    `aws secretsmanager get-secret-value --secret-id "${id}" --region ${REGION} --query SecretString --output text`,
    { encoding: 'utf8' },
  ).trim();
  return JSON.parse(raw);
}

function hclString(s) {
  return JSON.stringify(String(s ?? ''));
}

function main() {
  const prefix = `warmpawz/${env}`;
  const razorpay = getSecret(`${prefix}/razorpay`);
  const googleMaps = getSecret(`${prefix}/google-maps`);
  const shiprocket = getSecret(`${prefix}/shiprocket`);

  const keyId = razorpay.keyId || razorpay.key_id || '';
  const keySecret = razorpay.keySecret || razorpay.key_secret || '';
  const xAccount =
    razorpay.razorpayXAccountNumber ||
    razorpay.razorpay_x_account_number ||
    razorpay.payoutSourceAccountNumber ||
    '';

  const lines = [
    '# AUTO-GENERATED — do not commit. From scripts/terraform-tfvars-from-aws.js',
    `aws_region = ${hclString(REGION)}`,
    `razorpay_key_id = ${hclString(keyId)}`,
    `razorpay_key_secret = ${hclString(keySecret)}`,
    `razorpay_x_account_number = ${hclString(xAccount)}`,
    `google_maps_api_key = ${hclString(googleMaps.api_key || googleMaps.apiKey || '')}`,
    `shiprocket_email = ${hclString(shiprocket.email || '')}`,
    `shiprocket_password = ${hclString(shiprocket.password || '')}`,
  ];

  if (env === 'dev') {
    lines.push('skip_cert_validation = false');
    lines.push('alert_emails = ["dev-alerts@warmpawz.com"]');
  }

  const out = lines.join('\n') + '\n';
  const outArg = process.argv[3];
  if (outArg) {
    require('fs').writeFileSync(outArg, out, 'utf8');
    console.error(`Wrote ${outArg}`);
  } else {
    console.log(out);
  }
}

main();
