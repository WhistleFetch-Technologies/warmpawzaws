#!/usr/bin/env node
/**
 * Hide Aadhaar fields on the veterinary-clinic vendor onboarding form.
 *
 * The vendor form re-adds hardcoded KYC fields. Deleting the row from
 * onboarding_forms brings them back. This script keeps a stored override
 * with isActive=false so admin and vendor forms stop showing them.
 *
 * Dry run (default):
 *   node scripts/remove-vet-clinic-aadhaar-onboarding.js --prod
 *
 * Apply:
 *   node scripts/remove-vet-clinic-aadhaar-onboarding.js --prod --apply
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const APPLY = process.argv.includes('--apply');
const PROD = process.argv.includes('--prod');
const CLUSTER = PROD ? 'warmpawz-prod-cluster' : 'warmpawz-dev-cluster';
const SECRET_FALLBACK = PROD
  ? 'warmpawz-prod-rds-master-20260207201049162400000001'
  : '';

const ROLE_IDS = ['vet_clinic', 'veterinary_clinic'];
const TOMBSTONE_IDS = ['ownerAadhaarNumber', 'ownerAadhaarDoc', 'aadhaarNumber'];

function getCluster() {
  const cluster = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${CLUSTER} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  ).DBClusters[0];
  let secretArn = cluster.MasterUserSecret?.SecretArn;
  if (!secretArn && SECRET_FALLBACK) {
    secretArn = JSON.parse(
      execSync(
        `aws secretsmanager describe-secret --secret-id "${SECRET_FALLBACK}" --region ${REGION} --output json`,
        { encoding: 'utf8' }
      )
    ).ARN;
  }
  if (!secretArn) throw new Error(`No master secret for ${CLUSTER}`);
  return { clusterArn: cluster.DBClusterArn, secretArn, dbName: cluster.DatabaseName || 'warmpawz' };
}

function execute(conn, sql, parameters) {
  const tmp = path.join(__dirname, `_tmp_vet_aadhaar_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);
  const input = {
    resourceArn: conn.clusterArn,
    secretArn: conn.secretArn,
    database: conn.dbName,
    sql,
    formatRecordsAs: 'JSON',
  };
  if (parameters) input.parameters = parameters;
  fs.writeFileSync(tmp, JSON.stringify(input), 'utf8');
  const url = 'file://' + tmp.replace(/\\/g, '/');
  try {
    const out = execSync(
      `aws rds-data execute-statement --cli-input-json "${url}" --region ${REGION} --output json`,
      { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
    );
    const parsed = JSON.parse(out);
    let records = parsed.formattedRecords;
    if (typeof records === 'string') {
      try {
        records = JSON.parse(records);
      } catch (_) {
        records = [];
      }
    }
    return { records: Array.isArray(records) ? records : [], numberOfRecordsUpdated: parsed.numberOfRecordsUpdated || 0 };
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch (_) {}
  }
}

function parseFields(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }
  return [];
}

function isAadhaarField(field) {
  const id = String(field.id || '').toLowerCase();
  const name = String(field.fieldName || field.name || '').toLowerCase();
  const label = String(field.label || '').toLowerCase();
  const type = String(field.type || '').toLowerCase();
  const blob = `${id} ${name} ${label} ${type}`;
  return blob.includes('aadhaar') || blob.includes('aadhar');
}

function tombstone(id) {
  return {
    id,
    fieldName: id,
    name: id,
    label: id,
    type: id === 'ownerAadhaarDoc' ? 'file' : 'aadhaar-otp',
    section: 'identity_verification',
    isActive: false,
    isMandatory: false,
    required: false,
    removedBy: 'remove-vet-clinic-aadhaar-onboarding',
    updatedAt: new Date().toISOString(),
  };
}

function hideAadhaar(fields) {
  const next = fields.map((field) => {
    if (!isAadhaarField(field)) return field;
    return {
      ...field,
      isActive: false,
      isMandatory: false,
      required: false,
      removedBy: 'remove-vet-clinic-aadhaar-onboarding',
      updatedAt: new Date().toISOString(),
    };
  });
  const present = new Set(
    next.flatMap((field) => [field.id, field.fieldName, field.name].filter(Boolean).map(String))
  );
  for (const id of TOMBSTONE_IDS) {
    if (!present.has(id)) next.push(tombstone(id));
  }
  return next;
}

function fieldSummary(fields) {
  return fields
    .filter(isAadhaarField)
    .map((field) => ({
      id: field.id || field.fieldName || field.name,
      label: field.label || '',
      type: field.type || '',
      isActive: field.isActive !== false,
    }));
}

async function main() {
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} on ${CLUSTER}`);
  const conn = getCluster();
  const roleList = ROLE_IDS.map((id) => `'${id}'`).join(', ');
  const listed = execute(
    conn,
    `SELECT id::text AS id, role_id, COALESCE(version, 1) AS version, fields::text AS fields
     FROM onboarding_forms
     WHERE lower(role_id) IN (${roleList})
        OR lower(role_id) LIKE '%vet%clinic%'
        OR lower(role_id) LIKE '%veterinary%'
     ORDER BY role_id, COALESCE(version, 1) DESC`
  );

  if (!listed.records.length) {
    console.log('No vet-clinic onboarding_forms rows found.');
    const roles = execute(
      conn,
      `SELECT name, display_name FROM roles
       WHERE lower(name) LIKE '%vet%' OR lower(COALESCE(display_name, '')) LIKE '%vet%'
       ORDER BY name`
    );
    console.log('Vet roles:', JSON.stringify(roles.records, null, 2));
    process.exit(1);
  }

  for (const row of listed.records) {
    const before = parseFields(row.fields);
    const after = hideAadhaar(before);
    const beforeAadhaar = fieldSummary(before);
    const afterAadhaar = fieldSummary(after);
    console.log(`\nrole_id=${row.role_id} id=${row.id} version=${row.version} fields=${before.length} -> ${after.length}`);
    console.log('before:', JSON.stringify(beforeAadhaar));
    console.log('after:', JSON.stringify(afterAadhaar));

    if (!APPLY) continue;

    const updated = execute(
      conn,
      `UPDATE onboarding_forms
       SET fields = :fields::jsonb,
           version = COALESCE(version, 1) + 1,
           updated_at = NOW()
       WHERE id = :id::uuid
       RETURNING id::text AS id, role_id, version`,
      [
        { name: 'fields', value: { stringValue: JSON.stringify(after) } },
        { name: 'id', value: { stringValue: String(row.id) } },
      ]
    );
    console.log('updated:', JSON.stringify(updated.records));
  }

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to write these overrides.');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
