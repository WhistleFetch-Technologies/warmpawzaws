/**
 * Lock pet-store walk-in promo cashback redeem to Store / those vendors + paybill.
 * Updates promo_engine_promotions.metadata.vcf.redeem and matching wallet_transactions.redeem_scope.
 *
 * Dry-run (default):
 *   ENVIRONMENT=dev node scripts/backfill-pet-store-walkin-cashback-redeem.js
 *
 * Apply:
 *   ENVIRONMENT=dev node scripts/backfill-pet-store-walkin-cashback-redeem.js --apply
 *
 * Prod (explicit):
 *   ENVIRONMENT=prod node scripts/backfill-pet-store-walkin-cashback-redeem.js --apply --yes
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

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function uniqIds(raw) {
  const out = [];
  const seen = new Set();
  for (const value of raw || []) {
    const id = String(value || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function scopeIds(scope, letter) {
  const s = asRecord(scope);
  if (String(s.letter || '').toUpperCase() !== letter) return [];
  if (letter === 'V') {
    return uniqIds([...(Array.isArray(s.vendorIds) ? s.vendorIds : []), s.vendorId]);
  }
  return uniqIds([...(Array.isArray(s.categoryIds) ? s.categoryIds : []), s.categoryId]);
}

function isStoreSlug(raw) {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return key === 'store' || key === 'pet_store_walkin';
}

function redeemNeedsLock(redeem) {
  const r = asRecord(redeem);
  const letter = String(r.letter || 'F').toUpperCase();
  if (!letter || letter === 'F') return true;
  if (letter === 'C') return scopeIds({ ...r, letter: 'C' }, 'C').length === 0;
  if (letter === 'V') return scopeIds({ ...r, letter: 'V' }, 'V').length === 0;
  return false;
}

function listHasCashback(list) {
  return asArray(list).some(
    (b) => String(b.type || '').toUpperCase() === 'CASHBACK' && Number(b.value) > 0
  );
}

function promoHasCashback(vcf, ruleBenefitLists) {
  const mode = String(asRecord(vcf).benefitMode || '').toLowerCase();
  if (mode === 'cashback' || mode === 'both') return true;
  return (ruleBenefitLists || []).some((list) => listHasCashback(list));
}

function lockRedeem(vcf, storeIds, publishVendorsAreWalkin) {
  const storeSet = new Set(storeIds);
  const publish = asRecord(vcf.publish);
  const visit = asRecord(vcf.visitSource);
  const channels = ['paybill'];

  if (publishVendorsAreWalkin && String(publish.letter || '').toUpperCase() === 'V') {
    const vendorIds = scopeIds(publish, 'V');
    if (vendorIds.length) {
      return {
        ...vcf,
        redeem: { letter: 'V', vendorIds, vendorId: vendorIds[0], channels },
      };
    }
  }

  const fromPublish = scopeIds(publish, 'C').filter((id) => storeSet.has(id));
  const fromVisit = scopeIds(visit, 'C').filter((id) => storeSet.has(id));
  const categoryIds = fromPublish.length
    ? fromPublish
    : fromVisit.length
      ? fromVisit
      : [...storeSet];
  if (!categoryIds.length) return null;
  return {
    ...vcf,
    redeem: {
      letter: 'C',
      categoryIds,
      categoryId: categoryIds[0],
      channels,
    },
  };
}

function isWalkinAudience(vcf, storeIds, serviceCategories, publishVendorsAreWalkin) {
  if ((serviceCategories || []).some((s) => isStoreSlug(s))) return true;
  const storeSet = new Set(storeIds);
  const publish = asRecord(vcf.publish);
  const visit = asRecord(vcf.visitSource);
  if (scopeIds(publish, 'C').some((id) => storeSet.has(id))) return true;
  if (scopeIds(visit, 'C').some((id) => storeSet.has(id))) return true;
  if (
    publishVendorsAreWalkin &&
    String(publish.letter || '').toUpperCase() === 'V' &&
    scopeIds(publish, 'V').length
  ) {
    return true;
  }
  return false;
}

function walletRedeemNeedsLock(raw) {
  if (raw == null || raw === '') return true;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === 0) return true;
      return redeemNeedsLock(parsed);
    } catch {
      return true;
    }
  }
  if (Array.isArray(raw) && raw.length === 0) return true;
  const scope = asRecord(raw);
  if (!Object.keys(scope).length) return true;
  if (Array.isArray(scope.services) && scope.services.length === 0 && !scope.letter) return true;
  return redeemNeedsLock(scope);
}

async function loadStoreCategoryIds() {
  const rows = await query(`
    SELECT id::text AS id
    FROM service_categories
    WHERE lower(COALESCE(category_id, '')) = 'store'
       OR 'pet_store_walkin' = ANY (COALESCE(vendor_roles, '{}'::text[]))
  `);
  return uniqIds(rows.map((r) => r.id));
}

async function areAllWalkinVendors(vendorIds) {
  const ids = uniqIds(vendorIds);
  if (!ids.length) return false;
  const inList = ids.map((id) => `'${esc(id)}'`).join(',');
  const rows = await query(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (
             WHERE lower(COALESCE(r.name, '')) = 'pet_store_walkin'
                OR lower(COALESCE(v.role_id::text, '')) = 'pet_store_walkin'
           )::int AS walkin
    FROM vendors v
    LEFT JOIN roles r ON r.id = v.role_id
    WHERE v.id::text IN (${inList})
      AND (v.is_deleted IS NOT TRUE)
  `);
  const total = Number(rows[0]?.total || 0);
  const walkin = Number(rows[0]?.walkin || 0);
  return total > 0 && total === walkin && total === ids.length;
}

async function main() {
  if (ENVIRONMENT === 'prod' && APPLY && !YES) {
    console.error('Prod apply requires --yes');
    process.exit(1);
  }

  console.log(`Environment=${ENVIRONMENT} apply=${APPLY}`);
  const storeIds = await loadStoreCategoryIds();
  console.log('Store category ids', storeIds);
  if (!storeIds.length) {
    console.error('No store / pet_store_walkin catalogue rows found');
    process.exit(1);
  }

  const promos = await query(`
    SELECT p.id::text AS id,
           p.code,
           p.name,
           p.service_categories::text AS service_categories,
           p.metadata::text AS metadata
    FROM promo_engine_promotions p
    WHERE COALESCE(p.status, '') <> 'ARCHIVED'
    ORDER BY p.updated_at DESC NULLS LAST
  `);

  let promoUpdates = 0;
  const lockedPromoIds = [];

  for (const promo of promos) {
    const metadata = asRecord(promo.metadata);
    const vcf = asRecord(metadata.vcf);
    if (!Object.keys(vcf).length) continue;

    const serviceCategories = asArray(promo.service_categories);
    const rules = await query(`
      SELECT benefit_json::text AS benefit_json
      FROM promo_engine_rules
      WHERE promotion_id = '${esc(promo.id)}'::uuid
        AND COALESCE(is_active, true) IS TRUE
        AND archived_at IS NULL
    `);
    const ruleBenefits = rules.map((r) => asArray(r.benefit_json));
    if (!promoHasCashback(vcf, ruleBenefits)) continue;

    const publish = asRecord(vcf.publish);
    const publishVendorIds = scopeIds(publish, 'V');
    const publishVendorsAreWalkin =
      String(publish.letter || '').toUpperCase() === 'V' &&
      publishVendorIds.length > 0 &&
      (await areAllWalkinVendors(publishVendorIds));

    if (!isWalkinAudience(vcf, storeIds, serviceCategories, publishVendorsAreWalkin)) continue;
    if (!redeemNeedsLock(vcf.redeem)) {
      lockedPromoIds.push(promo.id);
      continue;
    }

    const nextVcf = lockRedeem(vcf, storeIds, publishVendorsAreWalkin);
    if (!nextVcf) continue;

    console.log(
      `${APPLY ? 'UPDATE' : 'WOULD UPDATE'} promo ${promo.code || promo.id} redeem`,
      JSON.stringify(vcf.redeem || null),
      '→',
      JSON.stringify(nextVcf.redeem)
    );

    if (APPLY) {
      const nextMeta = { ...metadata, vcf: nextVcf };
      await executeSQL(`
        UPDATE promo_engine_promotions
        SET metadata = '${esc(JSON.stringify(nextMeta))}'::jsonb,
            updated_at = NOW()
        WHERE id = '${esc(promo.id)}'::uuid
      `);
    }
    promoUpdates += 1;
    lockedPromoIds.push(promo.id);
  }

  console.log(`Promos ${APPLY ? 'updated' : 'to update'}: ${promoUpdates}`);

  let walletUpdates = 0;
  if (lockedPromoIds.length) {
    const inList = lockedPromoIds.map((id) => `'${esc(id)}'`).join(',');
    const txns = await query(`
      SELECT wt.id::text AS id,
             wt.promotion_id::text AS promotion_id,
             wt.redeem_scope::text AS redeem_scope,
             p.metadata::text AS metadata
      FROM wallet_transactions wt
      JOIN promo_engine_promotions p ON p.id = wt.promotion_id
      WHERE wt.source = 'PROMOTION'
        AND wt.promotion_id::text IN (${inList})
        AND COALESCE(wt.remaining_amount, 0) > 0
    `);

    for (const row of txns) {
      if (!walletRedeemNeedsLock(row.redeem_scope)) continue;
      const metadata = asRecord(row.metadata);
      const vcf = asRecord(metadata.vcf);
      let nextScope = asRecord(vcf.redeem);
      if (redeemNeedsLock(nextScope)) {
        nextScope = {
          letter: 'C',
          categoryIds: storeIds,
          categoryId: storeIds[0],
          channels: ['paybill'],
        };
      }

      console.log(
        `${APPLY ? 'UPDATE' : 'WOULD UPDATE'} wallet_txn ${row.id}`,
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
      walletUpdates += 1;
    }
  }

  console.log(`Wallet rows ${APPLY ? 'updated' : 'to update'}: ${walletUpdates}`);
  if (!APPLY) console.log('Re-run with --apply to write changes.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
