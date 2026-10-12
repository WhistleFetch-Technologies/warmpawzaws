/**
 * Pay Bill visit ladder: 10% / 8% / 8% / 6% / 6% off, then 6% with a tight cap from visit 6.
 * Cashback is fixed on every visit: ₹50 below ₹5,000, ₹75 from ₹5,000. Bills of ₹15,000+ stay at
 * 8% from visit 4. Every bill from ₹54 gets at least a flat ₹75 → ₹60 off, which is above the
 * ₹53.10 platform fee, so the fee is kept and the customer still pays less than the bill.
 *
 * Needs the bill-range backend (feature/abhi-promo-ranges) live on the target API and migration
 * 1125. Older backends ignore range bounds and would apply the first range to every bill.
 *
 *   ENVIRONMENT=prod AWS_PROFILE=cursor-agent node scripts/seed-promo-engine-paybill-ladder-prod.js --dry-run
 *   ... --apply --confirm-prod                 create the 6 promos PAUSED (customers see no change)
 *   ... --apply --confirm-prod --activate      switch them ACTIVE and take Pay Bill off the live platform promos
 *   ... --apply --confirm-prod --rollback      pause the ladder and give Pay Bill back to the platform promos
 *
 * Idempotent: promos are matched by code; a promo that exists with all its ranges is left alone.
 */

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

const START_AT = null; // null = start when activated
const END_AT = '2026-10-31T18:29:00Z'; // Oct 31, 23:59 IST (same window as the live platform promos)
const EXPIRY_DAYS = 30;
const TINY_MAX = 54;
const LOW_MAX = 5000;
const HIGH_FROM = 15000;
const CASHBACK_SMALL = 50;
const CASHBACK_BIG = 75;
const PLATFORM_FEE_WITH_GST = 53.1;
const OPEN_TOP_FOR_CAP = 40000;

/** pct: bills below ₹15,000; highPct: ₹15,000+; flat: Lowest range; cap: extra cap on every % range. */
const VISITS = [
  { n: 1, pct: 10, highPct: 10, flat: 75, budget: 250000 },
  { n: 2, pct: 8, highPct: 8, flat: 70, budget: 85000 },
  { n: 3, pct: 8, highPct: 8, flat: 65, budget: 50000 },
  { n: 4, pct: 6, highPct: 8, flat: 60, budget: 25000 },
  { n: 5, pct: 6, highPct: 8, flat: 60, budget: 15000 },
  { n: 6, pct: 6, highPct: 8, flat: 60, budget: 25000, cap: 250, onward: true },
];

/** Live platform promos that also publish on Pay Bill; activation keeps them on tele + ecommerce only. */
const PLATFORM_PROMOS = [
  { id: '1a5c0666-42d3-4b65-8232-ffe9f6faa074', name: 'New Customer - Visit 1' },
  { id: '8da11ce2-dd11-4243-b994-7334d765661f', name: 'Visit 2 onwards' },
];

const PAYBILL = 'paybill';
const REDEEM_CHANNELS = ['tele', 'appointment', 'paybill', 'ecommerce'];
const SOURCE = 'seed-promo-engine-paybill-ladder-prod';

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const codeFor = (v) => (v.onward ? `PB-LADDER-V${v.n}PLUS` : `PB-LADDER-V${v.n}`);
const nameFor = (v) => (v.onward ? `Pay Bill ladder - Visit ${v.n} onward` : `Pay Bill ladder - Visit ${v.n}`);

function cashback(value) {
  return { type: 'CASHBACK', mode: 'FIXED', value, expiryDays: EXPIRY_DAYS, redeemScope: [] };
}

function percentDiscount(v, pct, rangeTop) {
  const rangeCap = (pct * rangeTop) / 100;
  return { type: 'DISCOUNT', mode: 'PERCENT', value: pct, maxAmount: v.cap != null ? Math.min(rangeCap, v.cap) : rangeCap };
}

/** Bill ranges for one visit, in bill order. Shared edges go to the lower range. */
function buildRanges(v) {
  const flatTop = Math.floor((v.flat * 100) / v.pct);
  return [
    {
      label: `Under ${inr(TINY_MAX)}`,
      min: 0,
      max: TINY_MAX,
      benefits: [{ type: 'DISCOUNT', mode: 'PERCENT', value: v.pct }],
    },
    {
      label: `${inr(TINY_MAX)}–${inr(flatTop)}`,
      min: TINY_MAX,
      max: flatTop,
      benefits: [{ type: 'DISCOUNT', mode: 'FIXED', value: v.flat }, cashback(CASHBACK_SMALL)],
    },
    {
      label: `${inr(flatTop)}–${inr(LOW_MAX)}`,
      min: flatTop,
      max: LOW_MAX,
      benefits: [percentDiscount(v, v.pct, LOW_MAX), cashback(CASHBACK_SMALL)],
    },
    {
      label: `${inr(LOW_MAX)}–${inr(HIGH_FROM)}`,
      min: LOW_MAX,
      max: HIGH_FROM,
      benefits: [percentDiscount(v, v.pct, HIGH_FROM), cashback(CASHBACK_BIG)],
    },
    {
      label: `${inr(HIGH_FROM)}+`,
      min: HIGH_FROM,
      max: null,
      benefits: [percentDiscount(v, v.highPct, OPEN_TOP_FOR_CAP), cashback(CASHBACK_BIG)],
    },
  ];
}

function benefitMode(benefits) {
  const d = benefits.some((b) => b.type === 'DISCOUNT' && b.value > 0);
  const c = benefits.some((b) => b.type === 'CASHBACK' && b.value > 0);
  return d && c ? 'both' : d ? 'discount' : c ? 'cashback' : null;
}

function buildVcf(v) {
  return {
    visitSource: { width: 'general', letter: 'F', countMode: 'pooled' },
    visitLoop: v.onward ? { kind: 'from_onward', n: v.n } : { kind: 'visit_number', n: v.n },
    benefitMode: 'both',
    expiryDays: EXPIRY_DAYS,
    publish: { letter: 'F', channels: [PAYBILL] },
    redeem: { letter: 'F', channels: REDEEM_CHANNELS },
  };
}

/** The full ladder in the shape the admin wizard saves. */
function buildLadder() {
  return VISITS.map((v) => ({
    code: codeFor(v),
    name: nameFor(v),
    visit: v.n,
    priority: 50,
    budget: v.budget,
    metadata: { vcf: buildVcf(v), seed: SOURCE },
    ranges: buildRanges(v).map((r, i) => ({ ...r, sortOrder: i + 1, benefitMode: benefitMode(r.benefits) })),
  }));
}

function checkLadder(ladder) {
  const errors = [];
  for (const p of ladder) {
    const v = VISITS.find((x) => x.n === p.visit);
    const maxPct = v.n === 1 ? 10 : 8;
    p.ranges.forEach((r, i) => {
      const prev = p.ranges[i - 1];
      if (prev && prev.max !== r.min) errors.push(`${p.code} ${r.label}: does not start where the previous range ends`);
      if (r.max != null && r.max <= r.min) errors.push(`${p.code} ${r.label}: max must be above min`);
      if (r.max == null && i !== p.ranges.length - 1) errors.push(`${p.code} ${r.label}: only the last range can be open`);
      for (const b of r.benefits) {
        if (b.type === 'DISCOUNT' && b.mode === 'PERCENT' && b.value > maxPct) errors.push(`${p.code} ${r.label}: ${b.value}% is above ${maxPct}%`);
        if (b.type === 'DISCOUNT' && b.mode === 'FIXED' && b.value <= PLATFORM_FEE_WITH_GST) {
          errors.push(`${p.code} ${r.label}: flat ₹${b.value} does not clear the ₹${PLATFORM_FEE_WITH_GST} fee`);
        }
      }
    });
  }
  return errors;
}

// ── Database ────────────────────────────────────────────────────────────────
const lit = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const num = (v) => (v == null ? 'NULL' : String(Number(v)));
const json = (v) => (v == null ? 'NULL' : `${lit(JSON.stringify(v))}::jsonb`);

let query;

async function audit(promotionId, payload) {
  await query(`
    INSERT INTO promo_engine_audit_log (promotion_id, event_type, payload)
    VALUES (${lit(promotionId)}::uuid, 'STATUS_CHANGED', ${json({ ...payload, source: SOURCE })})`);
}

async function preflight() {
  const [cols] = await query(`
    SELECT
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promo_engine_rules' AND column_name = 'min_amount') AS ranges,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promo_engine_rules' AND column_name = 'archived_at') AS archived,
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'promo_engine_settings') AS benefit_cap`);
  const ok = (v) => v === true || v === 't' || v === 'true';
  if (!ok(cols.ranges) || !ok(cols.archived)) throw new Error('Migration 1125 (bill ranges) is not on this database');
  if (!ok(cols.benefit_cap)) console.log('WARN migration 1126 (benefit cap) is not on this database');
}

async function existingPromo(code) {
  const [row] = await query(`
    SELECT p.id, p.status,
      (SELECT count(*) FROM promo_engine_rules r WHERE r.promotion_id = p.id AND r.archived_at IS NULL)::int AS ranges
    FROM promo_engine_promotions p WHERE p.code = ${lit(code)} LIMIT 1`);
  return row || null;
}

async function insertRanges(promotionId, ranges) {
  for (const r of ranges) {
    await query(`
      INSERT INTO promo_engine_rules (
        promotion_id, condition_json, label, sort_order, min_amount, max_amount, benefit_mode,
        benefit_json, customer_copy, per_user_limit, daily_limit, campaign_limit, budget_limit,
        is_active, rule_type, priority
      ) VALUES (
        ${lit(promotionId)}::uuid, ${json({ operator: 'AND', conditions: [] })}, ${lit(r.label)}, ${r.sortOrder},
        ${num(r.min)}, ${num(r.max)}, ${lit(r.benefitMode)}, ${json(r.benefits)}, NULL, NULL, NULL, NULL, NULL,
        true, 'CUSTOMER_JOURNEY', 100
      )`);
  }
}

async function seedPromo(p, dryRun) {
  const found = await existingPromo(p.code);
  if (found && Number(found.ranges) === p.ranges.length) {
    console.log(`SKIP    ${p.code} exists (${found.id}, ${found.status}, ${found.ranges} ranges)`);
    return found.id;
  }
  if (found && Number(found.ranges) > 0) {
    throw new Error(`${p.code} exists with ${found.ranges} ranges instead of ${p.ranges.length}; fix it in admin first`);
  }
  if (dryRun) {
    console.log(`DRY     ${found ? 'add ranges to' : 'create'} ${p.code} PAUSED, budget ${inr(p.budget)}`);
    return found ? found.id : null;
  }

  let id = found && found.id;
  if (!id) {
    const [row] = await query(`
      INSERT INTO promo_engine_promotions
        (name, code, status, priority, start_at, end_at, stacking_policy, funding_type,
         budget_limit, service_categories, metadata)
      VALUES (${lit(p.name)}, ${lit(p.code)}, 'PAUSED', ${p.priority}, ${START_AT ? `${lit(START_AT)}::timestamptz` : 'NOW()'},
              ${lit(END_AT)}::timestamptz, 'DISCOUNT_WITH_CASHBACK', 'WARMPAWZ', ${p.budget}, '{}'::text[], ${json(p.metadata)})
      RETURNING id`);
    id = row.id;
    await query(`
      INSERT INTO promo_engine_limits (promotion_id, per_user, per_transaction, daily_limit, campaign_limit, budget_limit)
      VALUES (${lit(id)}::uuid, NULL, NULL, NULL, NULL, ${p.budget})
      ON CONFLICT (promotion_id) DO NOTHING`);
    await audit(id, { to: 'PAUSED', action: 'CREATE' });
  }
  await insertRanges(id, p.ranges);
  console.log(`CREATED ${p.code} ${id} (PAUSED, ${p.ranges.length} ranges)`);
  return id;
}

async function setLadderStatus(ids, to, dryRun) {
  for (const id of ids) {
    const [row] = await query(`SELECT code, status FROM promo_engine_promotions WHERE id = ${lit(id)}::uuid`);
    if (!row || row.status === to) {
      console.log(`SKIP    ${row ? row.code : id} already ${to}`);
      continue;
    }
    if (dryRun) {
      console.log(`DRY     ${row.code} ${row.status} -> ${to}`);
      continue;
    }
    const startNow = to === 'ACTIVE' && !START_AT ? ', start_at = NOW()' : '';
    await query(`UPDATE promo_engine_promotions SET status = ${lit(to)}${startNow}, updated_at = NOW() WHERE id = ${lit(id)}::uuid`);
    await audit(id, { from: row.status, to });
    console.log(`${to.padEnd(7)} ${row.code}`);
  }
}

/** keepPaybill=false takes Pay Bill off the platform promo's publish channels; true puts it back. */
async function setPlatformPaybill(keepPaybill, dryRun) {
  for (const p of PLATFORM_PROMOS) {
    const [row] = await query(`
      SELECT status, metadata->'vcf'->'publish'->'channels' AS channels
      FROM promo_engine_promotions WHERE id = ${lit(p.id)}::uuid`);
    if (!row) {
      console.log(`SKIP    ${p.name} not found`);
      continue;
    }
    const channels = typeof row.channels === 'string' ? JSON.parse(row.channels) : row.channels || [];
    const has = channels.includes(PAYBILL);
    if (has === keepPaybill) {
      console.log(`SKIP    ${p.name} Pay Bill already ${keepPaybill ? 'on' : 'off'} (${channels.join(', ')})`);
      continue;
    }
    const next = keepPaybill ? [...channels, PAYBILL] : channels.filter((c) => c !== PAYBILL);
    if (dryRun) {
      console.log(`DRY     ${p.name} (${row.status}) publish ${channels.join(', ')} -> ${next.join(', ')}`);
      continue;
    }
    await query(`
      UPDATE promo_engine_promotions
      SET metadata = jsonb_set(metadata, '{vcf,publish,channels}', ${json(next)}), updated_at = NOW()
      WHERE id = ${lit(p.id)}::uuid`);
    await audit(p.id, { action: 'PUBLISH_CHANNELS', from: channels, to: next });
    console.log(`UPDATED ${p.name} publish ${channels.join(', ')} -> ${next.join(', ')}`);
  }
}

function printPlan(ladder) {
  for (const p of ladder) {
    const loop = p.metadata.vcf.visitLoop;
    console.log(`\n${p.code}  ${p.name}  (${loop.kind} ${loop.n}, budget ${inr(p.budget)})`);
    for (const r of p.ranges) {
      const d = r.benefits.find((b) => b.type === 'DISCOUNT');
      const c = r.benefits.find((b) => b.type === 'CASHBACK');
      const disc = d.mode === 'FIXED' ? `₹${d.value} off` : `${d.value}% off${d.maxAmount != null ? ` up to ${inr(d.maxAmount)}` : ''}`;
      console.log(`  ${r.label.padEnd(18)} ${disc.padEnd(22)} ${c ? `₹${c.value} cashback` : 'no cashback (fee drops)'}`);
    }
  }
  console.log('');
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--apply');
  const dryRun = !apply;
  const activate = args.has('--activate');
  const rollback = args.has('--rollback');
  if (activate && rollback) throw new Error('Use --activate or --rollback, not both');
  if (apply && ENVIRONMENT === 'prod' && !args.has('--confirm-prod')) {
    throw new Error('Writing to prod needs --confirm-prod (and the bill-range backend deployed first)');
  }

  const ladder = buildLadder();
  const errors = checkLadder(ladder);
  if (errors.length) throw new Error(`Ladder config is invalid:\n  ${errors.join('\n  ')}`);

  ({ query } = require('./rds-data-api-utils-dev'));
  console.log(`${dryRun ? 'DRY RUN' : 'APPLY'} on ${ENVIRONMENT}${activate ? ' + activate' : ''}${rollback ? ' + rollback' : ''}`);
  printPlan(ladder);
  await preflight();

  if (rollback) {
    const ids = [];
    for (const p of ladder) {
      const found = await existingPromo(p.code);
      if (found) ids.push(found.id);
    }
    await setLadderStatus(ids, 'PAUSED', dryRun);
    await setPlatformPaybill(true, dryRun);
    return;
  }

  const ids = [];
  for (const p of ladder) ids.push(await seedPromo(p, dryRun));
  if (activate) {
    await setLadderStatus(ids.filter(Boolean), 'ACTIVE', dryRun);
    await setPlatformPaybill(false, dryRun);
  }
}

module.exports = { buildLadder, checkLadder, VISITS };

if (require.main === module) {
  main().catch((e) => {
    console.error(`ERR ${e.message}`);
    process.exit(1);
  });
}
