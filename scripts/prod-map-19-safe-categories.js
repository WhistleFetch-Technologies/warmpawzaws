#!/usr/bin/env node
/**
 * Map exactly 19 SAFE TO MAP no-category vendor_services to current catalogue UUIDs.
 * Dry-run by default. Apply: ENVIRONMENT=prod node scripts/prod-map-19-safe-categories.js --apply
 *
 * Updates ONLY vendor_services.category_id and vendor_services.category.
 * Does not touch prices, metadata, bookings, payments, GST cards, or other SKUs.
 */
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand, BeginTransactionCommand, CommitTransactionCommand, RollbackTransactionCommand } = require('@aws-sdk/client-rds-data');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const APPLY = process.argv.includes('--apply');
const ENVIRONMENT = process.env.ENVIRONMENT || 'prod';
const REGION = process.env.AWS_REGION || 'ap-south-1';

const TARGETS = {
  walking: { id: 'effeec22-c4b6-44c3-bfee-1962f66110d5', slug: 'walking' },
  grooming: { id: '4fbdc899-e4da-4219-952f-6d038a48981d', slug: 'grooming' },
  training: { id: '0eacb704-9b92-44ce-8ac7-32156b5d3e38', slug: 'training' },
};

/** Investigation SAFE TO MAP list — IDs + expected names. Do not expand. */
const SAFE_MAP = [
  { id: '1f05311b-6c15-437e-b212-6ac57ddb4464', name: 'Standard Daily Walk (25–30 Minutes)', target: 'walking' },
  { id: '25251541-24f5-4ac5-be14-9f3b8061842e', name: 'Extended Dog Walk', target: 'walking' },
  { id: '3e56d360-46aa-4d4f-a097-c60a5d440567', name: 'Standard Daily Walk (25–30 Minutes)', target: 'walking' },
  { id: '4a28e848-aab9-42b1-8af7-e9b5fc3bf9ab', name: 'Extended Dog Walk', target: 'walking' },
  { id: '7917652f-36c8-4848-a74c-f0776fbdd7e9', name: 'Extended Dog Walk', target: 'walking' },
  { id: '884e51be-eb9f-4e0d-b7aa-31772707f836', name: 'Standard Daily Walk (25–30 Minutes)', target: 'walking' },
  { id: '88eec8ca-c115-4dde-bafd-a57b89cde5bf', name: 'Extended Dog Walk', target: 'walking' },
  { id: '905f2158-d706-49a3-98aa-e76984abd36c', name: 'Standard Daily Walk (25–30 Minutes)', target: 'walking' },
  { id: 'cdf1f8d6-6ae3-40c8-a92c-478e42042de1', name: 'Standard Daily Walk (25–30 Minutes)', target: 'walking' },
  { id: 'e6265466-aa56-4d5b-b878-714fc3498331', name: 'Extended Dog Walk', target: 'walking' },
  { id: 'f97a7b8c-3d6f-492b-8927-ca3dac89949b', name: 'Standard Daily Walk (25–30 Minutes)', target: 'walking' },
  { id: '332d6ba2-b2a6-47f3-bb6b-87f862ad5c56', name: 'Delux Cut : Short Coat', target: 'grooming' },
  { id: '78625e8a-8ac1-4096-ad63-c014a49f76c6', name: 'Grooming Package', target: 'grooming' },
  { id: '9787112d-5230-4263-8241-53ea62447e17', name: 'Full Grooming Pack', target: 'grooming' },
  { id: 'c7b32510-9ee6-4a0d-8eff-a986c299814f', name: 'Oil massage - large breeds', target: 'grooming' },
  { id: '624c422f-beaf-4ede-999e-73d4279c9e4d', name: 'Dog Spa - Bath and Blow Dry : Small sized - Short Coat', target: 'grooming' },
  { id: '3721020c-145d-4e17-bbbd-790ccbb56d0f', name: 'Dog Spa and Grooming Packages : Large Dog : Short Coat(12 sessions)', target: 'grooming' },
  { id: 'f804361d-0844-4e13-aff2-9a28b9703de7', name: 'Dog Spa and Grooming Packages : Medium Dog : Short Coat(6 sessions)', target: 'grooming' },
  { id: '147fe4bd-c6fc-4ab5-987f-65719fdc454b', name: 'Leash Manners Training (3 sessions)-', target: 'training' },
];

const MANUAL_REVIEW_45 = [
  '0443f079-8569-4835-b2c2-fe7f2c76252a', '0981f51b-e215-49e6-8b70-181ffdb0420b', '1363ffbd-04c9-469e-9807-2c08beaa0f2c',
  '1afb094a-1706-456c-9b2d-685f12c7cb4b', '21478d53-29b4-4ec2-aa05-e0536c460296', '25a34d1d-2827-4ed9-b2b3-8699ed8a949b',
  '2ffc89ab-2b1f-4d39-9907-b0bb09f14d54', '30119926-d0a0-4c33-87d7-19a840fe913f', '44b8fd9d-c147-4e82-9180-04204b55ca4a',
  '47980cb0-ccb1-45a9-8a98-1d0ad32d22d2', '4a191a96-189a-4c1e-866e-5346f30679db', '4d28aaf1-7e1b-4381-a4f9-fd15e55bc2f2',
  '5056785f-d1a7-449f-8d4e-922f21fc52c1', '523bdc61-b9e5-4270-b5a7-270346aae03c', '59ea5776-feb3-481a-9ba9-18690fe1df71',
  '5ca7a293-4e20-41ca-8a10-816455273b01', '615b96af-1309-435f-8d19-383e38993ee5', '6405ac3e-95c5-4f51-ae02-709c696bcc94',
  '64157cc0-145f-4a57-ab27-3b5742965ec4', '64dfcda4-615f-424b-a351-5f74eccf8ee0', '6c0902cd-09c0-4135-8970-7446eca2e25b',
  '6f778c86-3648-481d-9f08-2f291f4b234f', '7cb46b18-a4f7-4e9e-8aec-2f87c73549c6', '823be307-61c5-4b19-a316-56e1c44fbf6b',
  '82879847-5289-4441-b296-67308d8434ce', '85a93b9f-8add-4366-82d5-322155a57fb4', '895a7903-57ab-42d7-b4dc-9bf6bd647513',
  '92cbe995-1f02-4e36-b4f7-a2dffb4d15d1', '9401d268-15c5-4f55-b784-97090dd7ddca', '94c7b138-73c5-479d-ad0f-fdd299f3a2ca',
  'a682da06-fc3c-48b0-9a08-00330427b2bc', 'b41c6284-11dc-4bfd-9e48-f62b2935a3a7', 'b89df227-e729-42e9-b913-07e67e6fb7f1',
  'bb2d0a43-b6c2-4b51-b58f-1ab22e014285', 'bd3f2b69-ae9f-4df3-9fdb-ee47b892ffe4', 'be851007-e54f-4620-abfd-35979b948567',
  'c898eae2-642e-4e88-be25-7eae2a6922bc', 'd32b1997-c7ce-4398-b9f6-a2c5321428cf', 'dcff2e48-c4bc-4ef3-b85c-1a82004bf574',
  'e242aeeb-f3a5-435d-bb33-a408d83fb82f', 'e8a886a6-3de2-4a30-b7f4-a06a9bdc7ad2', 'e9e91ba0-59c0-447f-a0c0-1c6d82ad61ad',
  'f89a2d89-51c5-4799-9d67-63a5663dc309', 'f8f40781-af3e-43a2-b92d-b66d2bd5a166', 'f9d774a5-8d92-425b-a689-d6aaa186acac',
];

const FRESH_MEAL = 'e619eb62-0ff0-4c5a-b79e-fbb36af7ef81';
const BEHAVIORAL = [
  '02a83d43-6802-4ad9-94db-f415a0b6e2f6',
  '0526fffb-1d90-4af0-8804-bc7aece988e0',
  '999c5aed-5003-405a-8966-afa0205a20c3',
  'a5dc431e-5541-4010-8a5e-4cc5a6e5ff73',
];
const PET_SITTING = [
  '280cd5f4-0b22-48fa-8658-4a7d26a3da99',
  '292469e4-c8b5-4223-aeeb-7f106e10964e',
  'ff160883-c657-4711-8c67-79d983a7df1d',
];
const SHOP = '6bc0140a-0520-4d45-985b-07e027ad5a6d';
const PHYSIO = [
  '9a990487-07b3-4291-8393-aaf12387aa57',
  'b394b5ea-03fb-4ad6-a106-7546a66d1769',
  'b5f65f49-4b8b-45bd-8ad6-b245608e7fd9',
  'fd84a011-f2c9-4878-828e-f163c2903b03',
];
const EMERGENCY = 'f1786ee4-0bd4-4484-8f2a-88f0a65504df';

function cellValue(field) {
  if (field == null || field.isNull) return null;
  return field.stringValue ?? field.longValue ?? field.doubleValue ?? field.booleanValue ?? null;
}
function rowsFromResult(result) {
  const cols = (result.columnMetadata || []).map((c) => c.name);
  return (result.records || []).map((rec) => {
    const row = {};
    rec.forEach((field, i) => { row[cols[i] || `col_${i}`] = cellValue(field); });
    return row;
  });
}
function sqlList(ids) {
  return ids.map((id) => `'${id}'`).join(', ');
}
function normName(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

async function main() {
  if (SAFE_MAP.length !== 19) {
    console.error('STOP: SAFE_MAP length is', SAFE_MAP.length, 'not 19');
    process.exit(1);
  }
  if (new Set(SAFE_MAP.map((r) => r.id)).size !== 19) {
    console.error('STOP: duplicate SAFE_MAP IDs');
    process.exit(1);
  }
  if (MANUAL_REVIEW_45.length !== 45 || new Set(MANUAL_REVIEW_45).size !== 45) {
    console.error('STOP: MANUAL_REVIEW_45 is', MANUAL_REVIEW_45.length, 'unique', new Set(MANUAL_REVIEW_45).size);
    process.exit(1);
  }
  const overlap = SAFE_MAP.filter((r) => MANUAL_REVIEW_45.includes(r.id) || r.id === FRESH_MEAL || BEHAVIORAL.includes(r.id) || PET_SITTING.includes(r.id));
  if (overlap.length) {
    console.error('STOP: SAFE_MAP overlaps a protected set', overlap.map((r) => r.id));
    process.exit(1);
  }
  if (ENVIRONMENT !== 'prod') {
    console.error('This script is production-only. Set ENVIRONMENT=prod');
    process.exit(1);
  }

  const clusterInfo = JSON.parse(execSync(
    `aws rds describe-db-clusters --db-cluster-identifier warmpawz-${ENVIRONMENT}-cluster --region ${REGION} --output json`,
    { encoding: 'utf8' },
  ));
  const cluster = clusterInfo.DBClusters[0];
  const sm = new SecretsManagerClient({ region: REGION });
  const secretValue = await sm.send(new GetSecretValueCommand({
    SecretId: 'warmpawz-prod-rds-master-20260207201049162400000001',
  }));
  const client = new RDSDataClient({ region: REGION });
  const base = {
    resourceArn: cluster.DBClusterArn,
    secretArn: secretValue.ARN,
    database: cluster.DatabaseName || 'warmpawz',
  };
  async function q(sql, transactionId) {
    const res = await client.send(new ExecuteStatementCommand({
      ...base,
      sql,
      includeResultMetadata: true,
      ...(transactionId ? { transactionId } : {}),
    }));
    return rowsFromResult(res);
  }

  const catRows = await q(`
    SELECT id::text AS id, category_id AS slug, name
    FROM service_categories
    WHERE id::text IN ('${TARGETS.walking.id}', '${TARGETS.grooming.id}', '${TARGETS.training.id}')
  `);
  const cats = Object.fromEntries(catRows.map((r) => [r.id, r]));
  for (const [slug, t] of Object.entries(TARGETS)) {
    const row = cats[t.id];
    if (!row || String(row.slug).toLowerCase() !== slug) {
      console.error('STOP: target category missing or slug mismatch', slug, t.id, row);
      process.exit(1);
    }
    t.name = row.name;
  }

  const gstCards = await q(`
    SELECT tc.id::text AS tax_id, tc.category_name AS tax_name, tc.catalog_category_id::text AS cat_id,
           tc.tax_rate::text AS rate
    FROM tax_categories tc
    WHERE tc.is_active = true
      AND COALESCE(tc.gst_application_scope, 'service_booking') = 'service_booking'
      AND tc.catalog_category_id::text IN ('${TARGETS.walking.id}', '${TARGETS.grooming.id}', '${TARGETS.training.id}')
  `);
  const gstByCat = Object.fromEntries(gstCards.map((r) => [r.cat_id, r]));
  for (const t of Object.values(TARGETS)) {
    if (!gstByCat[t.id]) {
      console.error('STOP: missing active service_booking GST card for', t.slug, t.id);
      process.exit(1);
    }
  }

  const snapshotSql = (ids) => `
    SELECT vs.id::text AS sku_id,
           COALESCE(vs.service_name, sc.service_name) AS sku_name,
           v.business_name AS vendor_name,
           r.name AS vendor_role,
           vs.category AS vs_category,
           vs.category_id::text AS vs_category_id,
           sc.category_id AS sc_category_id,
           sc.category_name AS sc_category_name,
           vs.price::text AS price,
           vs.custom_price::text AS custom_price,
           vs.is_custom_service::text AS is_custom,
           vs.is_enabled::text AS is_enabled,
           vs.publish_status,
           vs.metadata::text AS metadata,
           (SELECT COUNT(*)::int FROM bookings b WHERE b.service_id = vs.id) AS booking_count,
           (SELECT MAX(b.created_at)::text FROM bookings b WHERE b.service_id = vs.id) AS last_booking
    FROM vendor_services vs
    JOIN vendors v ON v.id = vs.vendor_id
    LEFT JOIN roles r ON r.id = v.role_id
    LEFT JOIN service_catalog sc ON sc.id = vs.service_id
    WHERE vs.id IN (${sqlList(ids)})
    ORDER BY vs.id
  `;

  const fingerprintSql = (ids) => `
    SELECT vs.id::text AS sku_id,
           md5(concat_ws('|',
             COALESCE(vs.category, ''),
             COALESCE(vs.category_id::text, ''),
             COALESCE(vs.price::text, ''),
             COALESCE(vs.custom_price::text, ''),
             COALESCE(vs.metadata::text, ''),
             COALESCE(vs.service_id::text, ''),
             COALESCE(vs.is_enabled::text, ''),
             COALESCE(vs.publish_status, '')
           )) AS fp
    FROM vendor_services vs
    WHERE vs.id IN (${sqlList(ids)})
    ORDER BY vs.id
  `;

  const found = await q(snapshotSql(SAFE_MAP.map((r) => r.id)));
  if (found.length !== 19) {
    console.error('STOP: selected population is', found.length, 'not 19. IDs found:', found.map((r) => r.sku_id));
    process.exit(1);
  }

  const byId = Object.fromEntries(found.map((r) => [r.sku_id, r]));
  const mismatches = [];
  for (const expected of SAFE_MAP) {
    const row = byId[expected.id];
    if (!row) {
      mismatches.push({ id: expected.id, reason: 'missing' });
      continue;
    }
    if (normName(row.sku_name) !== normName(expected.name)) {
      mismatches.push({ id: expected.id, reason: 'name', expected: expected.name, actual: row.sku_name });
    }
  }
  if (mismatches.length) {
    console.error('STOP: SAFE TO MAP list does not match production rows');
    console.error(JSON.stringify(mismatches, null, 2));
    process.exit(1);
  }

  const targetSlugs = new Set(SAFE_MAP.map((r) => r.target));
  if ([...targetSlugs].some((s) => !['walking', 'grooming', 'training'].includes(s))) {
    console.error('STOP: unexpected target category');
    process.exit(1);
  }

  const dryRun = SAFE_MAP.map((expected) => {
    const row = byId[expected.id];
    const target = TARGETS[expected.target];
    const gst = gstByCat[target.id];
    let pkg = null;
    try {
      const meta = row.metadata ? JSON.parse(row.metadata) : {};
      const details = meta.packageDetails || {};
      if (meta.isPackage || meta.packageType === 'session') {
        pkg = {
          packageType: meta.packageType || null,
          totalSessions: details.totalSessions || null,
          sessionDuration: details.sessionDuration || null,
          packagePrice: details.price || null,
        };
      }
    } catch { /* ignore */ }
    return {
      sku_id: expected.id,
      vendor: row.vendor_name,
      role: row.vendor_role,
      sku_name: row.sku_name,
      old_vs_category: row.vs_category,
      old_vs_category_id: row.vs_category_id,
      old_sc_category_id: row.sc_category_id,
      target_category_id: target.id,
      target_category_slug: target.slug,
      target_category_name: target.name,
      custom_price: row.custom_price,
      price: row.price,
      booking_count: row.booking_count,
      last_booking: row.last_booking,
      package: pkg,
      gst_card: gst.tax_name,
      gst_rate: gst.rate,
    };
  });

  console.log(JSON.stringify({
    mode: APPLY ? 'APPLY' : 'DRY_RUN',
    count: dryRun.length,
    by_target: {
      walking: dryRun.filter((r) => r.target_category_slug === 'walking').length,
      grooming: dryRun.filter((r) => r.target_category_slug === 'grooming').length,
      training: dryRun.filter((r) => r.target_category_slug === 'training').length,
    },
    records: dryRun,
  }, null, 2));

  const controlIds = [...MANUAL_REVIEW_45, FRESH_MEAL, ...BEHAVIORAL, ...PET_SITTING, SHOP, ...PHYSIO, EMERGENCY];
  const beforeFp = await q(fingerprintSql(controlIds));
  const beforeFpMap = Object.fromEntries(beforeFp.map((r) => [r.sku_id, r.fp]));
  if (beforeFp.length !== controlIds.length) {
    console.error('STOP: control snapshot size', beforeFp.length, 'expected', controlIds.length);
    process.exit(1);
  }

  if (!APPLY) {
    console.log('DRY RUN only. Re-run with --apply to write category_id + category on these 19 rows.');
    return;
  }

  const tx = await client.send(new BeginTransactionCommand(base));
  const transactionId = tx.transactionId;
  try {
    const walkingIds = SAFE_MAP.filter((r) => r.target === 'walking').map((r) => r.id);
    const groomingIds = SAFE_MAP.filter((r) => r.target === 'grooming').map((r) => r.id);
    const trainingIds = SAFE_MAP.filter((r) => r.target === 'training').map((r) => r.id);

    const updateOne = async (ids, target) => {
      if (!ids.length) return 0;
      const res = await client.send(new ExecuteStatementCommand({
        ...base,
        transactionId,
        sql: `
          UPDATE vendor_services
          SET category_id = '${target.id}'::uuid,
              category = '${target.name.replace(/'/g, "''")}'
          WHERE id IN (${sqlList(ids)})
            AND id NOT IN (${sqlList(controlIds)})
          RETURNING id::text AS sku_id, price::text AS price, custom_price::text AS custom_price
        `,
        includeResultMetadata: true,
      }));
      return rowsFromResult(res);
    };

    const u1 = await updateOne(walkingIds, TARGETS.walking);
    const u2 = await updateOne(groomingIds, TARGETS.grooming);
    const u3 = await updateOne(trainingIds, TARGETS.training);
    const updated = [...u1, ...u2, ...u3];
    if (updated.length !== 19) {
      throw new Error(`Updated ${updated.length} rows, expected 19 — rolling back`);
    }
    for (const row of updated) {
      const before = byId[row.sku_id];
      if (String(row.price) !== String(before.price) || String(row.custom_price) !== String(before.custom_price)) {
        throw new Error(`Price changed for ${row.sku_id} — rolling back`);
      }
    }

    await client.send(new CommitTransactionCommand({ resourceArn: base.resourceArn, secretArn: base.secretArn, transactionId }));
  } catch (err) {
    await client.send(new RollbackTransactionCommand({ resourceArn: base.resourceArn, secretArn: base.secretArn, transactionId })).catch(() => {});
    console.error('STOP: write failed, rolled back', err.message || err);
    process.exit(1);
  }

  const after = await q(snapshotSql(SAFE_MAP.map((r) => r.id)));
  const afterById = Object.fromEntries(after.map((r) => [r.sku_id, r]));
  const verifyFails = [];
  for (const expected of SAFE_MAP) {
    const row = afterById[expected.id];
    const target = TARGETS[expected.target];
    if (!row) verifyFails.push({ id: expected.id, reason: 'missing after write' });
    else if (row.vs_category_id !== target.id) verifyFails.push({ id: expected.id, reason: 'category_id', actual: row.vs_category_id });
    else if (String(row.price) !== String(byId[expected.id].price) || String(row.custom_price) !== String(byId[expected.id].custom_price)) {
      verifyFails.push({ id: expected.id, reason: 'price drifted' });
    } else if (String(row.metadata || '') !== String(byId[expected.id].metadata || '')) {
      verifyFails.push({ id: expected.id, reason: 'metadata drifted' });
    }
  }

  const gstVerify = await q(`
    SELECT vs.id::text AS sku_id,
           cat.category_id AS cat_slug,
           tc.category_name AS tax_name,
           tc.tax_rate::text AS rate,
           r.name AS vendor_role
    FROM vendor_services vs
    JOIN vendors v ON v.id = vs.vendor_id
    LEFT JOIN roles r ON r.id = v.role_id
    JOIN service_categories cat ON cat.id = vs.category_id
    JOIN tax_categories tc ON tc.catalog_category_id = cat.id
      AND tc.is_active = true
      AND COALESCE(tc.gst_application_scope, 'service_booking') = 'service_booking'
    WHERE vs.id IN (${sqlList(SAFE_MAP.map((r) => r.id))})
  `);

  const afterFp = await q(fingerprintSql(controlIds));
  const controlChanged = afterFp.filter((r) => r.fp !== beforeFpMap[r.sku_id]);

  console.log(JSON.stringify({
    applied: true,
    updated: after.length,
    verify_fails: verifyFails,
    gst_resolved: gstVerify.length,
    gst_rows: gstVerify,
    control_unchanged: controlChanged.length === 0,
    control_changed: controlChanged,
    prices_unchanged: verifyFails.every((f) => f.reason !== 'price drifted'),
  }, null, 2));

  if (verifyFails.length || gstVerify.length !== 19 || controlChanged.length) {
    console.error('POST-WRITE VALIDATION FAILED');
    process.exit(1);
  }
  console.log('POST-WRITE VALIDATION OK: 19 mapped, prices/metadata intact, controls unchanged, GST cards resolve from category.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
