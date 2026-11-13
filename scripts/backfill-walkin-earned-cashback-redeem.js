/**
 * Lock open wallet promo cashback earned at a pet_store_walkin Pay Bill to that
 * **same vendor** + paybill only (not all walk-in stores / not other services).
 *
 * Dry-run:
 *   ENVIRONMENT=dev node scripts/backfill-walkin-earned-cashback-redeem.js
 * Apply:
 *   ENVIRONMENT=dev node scripts/backfill-walkin-earned-cashback-redeem.js --apply
 */
const { query, executeSQL, ENVIRONMENT } = require('./rds-data-api-utils-dev');

const APPLY = process.argv.includes('--apply');
const YES = process.argv.includes('--yes');

function esc(s) {
  return String(s).replace(/'/g, "''");
}

function asRecord(v) {
  if (!v) return {};
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof v === 'object' && !Array.isArray(v) ? v : {};
}

function needsVendorLock(redeem, vendorId) {
  const r = asRecord(redeem);
  const letter = String(r.letter || 'F').toUpperCase();
  if (!letter || letter === 'F') return true;
  if (letter === 'C') return true; // Store-wide — tighten to this vendor
  if (letter === 'V') {
    const ids = [...(Array.isArray(r.vendorIds) ? r.vendorIds : []), r.vendorId]
      .map((x) => String(x || '').trim())
      .filter(Boolean);
    if (!ids.length) return true;
    return !(ids.length === 1 && ids[0] === vendorId);
  }
  return true;
}

async function main() {
  if (ENVIRONMENT === 'prod' && APPLY && !YES) {
    console.error('Prod apply requires --yes');
    process.exit(1);
  }
  console.log(`Environment=${ENVIRONMENT} apply=${APPLY}`);

  const storeRows = await query(`
    SELECT id::text AS id
    FROM service_categories
    WHERE lower(COALESCE(category_id, '')) = 'store'
       OR 'pet_store_walkin' = ANY (COALESCE(vendor_roles, '{}'::text[]))
  `);
  const storeIds = storeRows.map((r) => String(r.id)).filter(Boolean);
  console.log('Store category ids', storeIds);
  if (!storeIds.length) {
    console.error('No store catalogue rows');
    process.exit(1);
  }

  const storeIn = storeIds.map((id) => `'${esc(id)}'`).join(',');
  const rows = await query(`
    SELECT wt.id::text AS id,
           wt.redeem_scope::text AS redeem_scope,
           wt.remaining_amount::text AS remaining,
           wt.reference_id,
           wt.promotion_id::text AS promotion_id,
           p.code AS promo_code,
           COALESCE(
             e.request_json->'transaction'->>'vendorId',
             e.request_json->'transaction'->>'vendor_id',
             v.id::text
           ) AS vendor_id,
           r.name AS role_name
    FROM wallet_transactions wt
    JOIN promo_engine_usage u
      ON u.transaction_id = wt.reference_id
     AND u.promotion_id = wt.promotion_id
     AND u.reversed_at IS NULL
    LEFT JOIN promo_engine_evaluations e ON e.id = u.evaluation_id
    LEFT JOIN promo_engine_promotions p ON p.id = wt.promotion_id
    LEFT JOIN vendors v
      ON v.id::text = COALESCE(
           e.request_json->'transaction'->>'vendorId',
           e.request_json->'transaction'->>'vendor_id'
         )
    LEFT JOIN roles r ON r.id = v.role_id
    WHERE wt.source = 'PROMOTION'
      AND COALESCE(wt.remaining_amount, 0) > 0
      AND wt.cashback_status IN ('AVAILABLE', 'PARTIALLY_USED')
      AND (
        lower(COALESCE(r.name, '')) = 'pet_store_walkin'
        OR COALESCE(
             e.request_json->'transaction'->>'categoryId',
             e.request_json->'transaction'->>'category_id',
             ''
           ) IN (${storeIn})
        OR lower(COALESCE(
             e.request_json->'transaction'->>'service_category',
             e.request_json->'transaction'->>'serviceCategory',
             ''
           )) IN ('store', 'pet_store_walkin')
      )
    ORDER BY wt.created_at DESC
  `);

  console.log('Walk-in-earned open credits', rows.length);
  let updates = 0;

  for (const row of rows) {
    const vendorId = String(row.vendor_id || '').trim();
    if (!vendorId) {
      console.log('SKIP (no vendor)', row.id, row.promo_code);
      continue;
    }
    if (!needsVendorLock(row.redeem_scope, vendorId)) continue;

    const nextScope = {
      letter: 'V',
      vendorId,
      vendorIds: [vendorId],
      channels: ['paybill'],
    };
    console.log(
      `${APPLY ? 'UPDATE' : 'WOULD UPDATE'} ${row.id} ${row.promo_code || row.promotion_id} rem=${row.remaining}`,
      row.redeem_scope,
      '→',
      JSON.stringify(nextScope)
    );
    if (APPLY) {
      await executeSQL(`
        UPDATE wallet_transactions
        SET redeem_scope = '${esc(JSON.stringify(nextScope))}'::jsonb
        WHERE id = '${esc(row.id)}'::uuid
      `);
    }
    updates += 1;
  }

  console.log(`Wallet rows ${APPLY ? 'updated' : 'to update'}: ${updates}`);
  if (!APPLY) console.log('Re-run with --apply to write changes.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
