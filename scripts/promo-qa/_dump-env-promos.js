/**
 * READ-ONLY dump of promo-engine visit/range config + catalogue roles.
 * Default ENVIRONMENT=prod. Never writes.
 *
 *   ENVIRONMENT=prod node scripts/promo-qa/_dump-env-promos.js
 *   ENVIRONMENT=dev  node scripts/promo-qa/_dump-env-promos.js
 */
const fs = require('fs');
const path = require('path');

const env = String(process.env.ENVIRONMENT || 'prod').toLowerCase();
if (env !== 'prod' && env !== 'dev') {
  console.error('ENVIRONMENT must be prod or dev');
  process.exit(1);
}
process.env.ENVIRONMENT = env;

const { query } = require('../rds-data-api-utils-dev');

function parseMaybeJson(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(String(v));
  } catch {
    return String(v);
  }
}

(async () => {
  const promotions = await query(`
    SELECT p.id::text AS id, p.code, p.name, p.status, p.priority,
           p.start_at::text AS start_at, p.end_at::text AS end_at,
           p.stacking_policy, p.funding_type, p.funding_split::text AS funding_split,
           p.budget_limit::text AS budget_limit, p.budget_consumed::text AS budget_consumed,
           p.service_categories::text AS service_categories,
           p.metadata::text AS metadata
    FROM promo_engine_promotions p
    WHERE p.status IN ('ACTIVE', 'PAUSED', 'DRAFT')
    ORDER BY p.status, p.priority DESC, p.code NULLS LAST, p.name
  `);
  const rules = await query(`
    SELECT r.id::text AS id, r.promotion_id::text AS promotion_id, r.priority, r.rule_type,
           r.is_active, r.label, r.sort_order, r.min_amount::text AS min_amount,
           r.max_amount::text AS max_amount, r.benefit_mode,
           r.condition_json::text AS condition_json, r.benefit_json::text AS benefit_json,
           r.customer_copy::text AS customer_copy,
           r.per_user_limit, r.daily_limit, r.campaign_limit,
           r.budget_limit::text AS budget_limit, r.archived_at::text AS archived_at
    FROM promo_engine_rules r
    JOIN promo_engine_promotions p ON p.id = r.promotion_id
    WHERE p.status IN ('ACTIVE', 'PAUSED', 'DRAFT')
    ORDER BY r.promotion_id, r.sort_order NULLS LAST, r.min_amount NULLS FIRST, r.priority
  `);
  const limits = await query(`
    SELECT l.promotion_id::text AS promotion_id, l.per_user, l.per_transaction,
           l.daily_limit, l.campaign_limit, l.budget_limit::text AS budget_limit
    FROM promo_engine_limits l
    JOIN promo_engine_promotions p ON p.id = l.promotion_id
    WHERE p.status IN ('ACTIVE', 'PAUSED', 'DRAFT')
  `);
  const categories = await query(`
    SELECT id::text AS id, category_id::text AS slug, name, is_active,
           vendor_roles::text AS vendor_roles, display_order
    FROM service_categories
    ORDER BY display_order NULLS LAST, name
  `);
  const roles = await query(`
    SELECT id::text AS id, name, config::text AS config
    FROM roles
    WHERE name ILIKE '%store%' OR name ILIKE '%walk%' OR name ILIKE '%shop%'
       OR name ILIKE '%groom%' OR name ILIKE '%vet%' OR name ILIKE '%train%'
    ORDER BY name
  `);

  const out = {
    environment: env,
    dumpedAt: new Date().toISOString(),
    promotions: promotions.map((p) => ({
      ...p,
      funding_split: parseMaybeJson(p.funding_split),
      service_categories: parseMaybeJson(p.service_categories),
      metadata: parseMaybeJson(p.metadata),
    })),
    rules: rules.map((r) => ({
      ...r,
      condition_json: parseMaybeJson(r.condition_json),
      benefit_json: parseMaybeJson(r.benefit_json),
      customer_copy: parseMaybeJson(r.customer_copy),
    })),
    limits,
    categories: categories.map((c) => ({
      ...c,
      vendor_roles: parseMaybeJson(c.vendor_roles),
    })),
    roles: roles.map((r) => ({ ...r, config: parseMaybeJson(r.config) })),
  };

  const dest = path.join(__dirname, '.out', `promo-dump-${env}.json`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));

  const visitRange = out.promotions.filter((p) => {
    const vcf = p.metadata && p.metadata.vcf;
    const hasLoop = Boolean(vcf && vcf.visitLoop);
    const promoRules = out.rules.filter((r) => r.promotion_id === p.id && !r.archived_at);
    const hasRange = promoRules.some((r) => r.min_amount != null || r.max_amount != null);
    return hasLoop || hasRange;
  });

  console.log(`DUMP ${env} promotions=${out.promotions.length} visitOrRange=${visitRange.length} written=${dest}`);
  for (const p of visitRange) {
    const vcf = (p.metadata && p.metadata.vcf) || {};
    const pub = vcf.publish || {};
    const vs = vcf.visitSource || {};
    const promoRules = out.rules.filter((r) => r.promotion_id === p.id && !r.archived_at);
    console.log(
      `PROMO ${p.status} ${p.code || '-'} | ${p.name} | pub=${pub.letter || '-'} ch=${JSON.stringify(pub.channels || vs.channels || [])} visit=${vs.letter || '-'} loop=${JSON.stringify(vcf.visitLoop || null)} cats=${JSON.stringify(p.service_categories || [])} ranges=${promoRules.length}`,
    );
  }
  for (const c of out.categories) {
    const rolesList = Array.isArray(c.vendor_roles) ? c.vendor_roles : [];
    if (
      String(c.slug || '').includes('store') ||
      String(c.name || '').toLowerCase().includes('store') ||
      rolesList.some((x) => String(x).toLowerCase().includes('store') || String(x).toLowerCase().includes('walk'))
    ) {
      console.log(`CAT ${c.id} slug=${c.slug} name=${c.name} active=${c.is_active} roles=${JSON.stringify(rolesList)}`);
    }
  }
})().catch((e) => {
  console.error('ERR', e.message || e);
  process.exit(1);
});
