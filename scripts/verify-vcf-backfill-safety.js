/**
 * READ-ONLY fingerprint of everything the VCF backfill must NOT change, plus what it may change.
 * Capture before and after `backfill-vcf-visits.js --apply`, then compare (exit 2 if anything protected moved).
 * profile_non_vcf also counts profiles the backfill creates, so its row count may grow on the first apply.
 *
 *   $env:ENVIRONMENT='prod'; $env:AWS_PROFILE='cursor-agent'
 *   node scripts/verify-vcf-backfill-safety.js capture before
 *   node scripts/verify-vcf-backfill-safety.js capture after
 *   node scripts/verify-vcf-backfill-safety.js compare before after
 */
const fs = require('fs');
const path = require('path');
const { query, ENVIRONMENT } = require('./rds-data-api-utils-dev');

const DIR = path.join(__dirname, '..', 'reports', 'vcf-backfill');

const UNTOUCHED = {
  payments: `SELECT COUNT(*)::int AS n, md5(string_agg(id::text || '|' || COALESCE(payment_status,'') || '|' || COALESCE(updated_at::text,''), ',' ORDER BY id)) AS h FROM payments`,
  bookings: `SELECT COUNT(*)::int AS n, md5(string_agg(id::text || '|' || COALESCE(status,'') || '|' || COALESCE(updated_at::text,''), ',' ORDER BY id)) AS h FROM bookings`,
  wallet_transactions: `SELECT COUNT(*)::int AS n, md5(string_agg(id::text || '|' || COALESCE(amount::text,'') || '|' || COALESCE(remaining_amount::text,''), ',' ORDER BY id)) AS h FROM wallet_transactions`,
  promo_engine_usage: `SELECT COUNT(*)::int AS n, md5(string_agg(id::text, ',' ORDER BY id)) AS h FROM promo_engine_usage`,
  promo_engine_promotions: `SELECT COUNT(*)::int AS n, md5(string_agg(id::text || '|' || COALESCE(updated_at::text,''), ',' ORDER BY id)) AS h FROM promo_engine_promotions`,
  customers: `SELECT COUNT(*)::int AS n, md5(string_agg(id::text || '|' || COALESCE(updated_at::text,''), ',' ORDER BY id)) AS h FROM customers`,
  existing_events: `SELECT COUNT(*)::int AS n, md5(string_agg(id::text || '|' || event_type || '|' || payload::text || '|' || created_at::text, ',' ORDER BY id)) AS h
                    FROM customer_behaviour_events WHERE COALESCE(payload->>'backfill','') <> 'true'`,
  profile_non_vcf: `SELECT COUNT(*)::int AS n, md5(string_agg(user_id || '|' || COALESCE(overall::text,'') || '|' || COALESCE((services - 'vcf')::text,''), ',' ORDER BY user_id)) AS h
                    FROM customer_behaviour_profiles`,
};

const MAY_CHANGE = {
  events_by_type: `SELECT event_type, COALESCE(payload->>'backfill','false') AS backfill, COUNT(*)::int AS n
                   FROM customer_behaviour_events GROUP BY 1,2 ORDER BY 1,2`,
  backfill_dupes: `SELECT COUNT(*)::int AS n FROM (
                     SELECT user_id, payload->>'referenceId' FROM customer_behaviour_events
                     WHERE event_type = 'VCF_VISIT' GROUP BY 1,2 HAVING COUNT(*) > 1) d`,
  profiles: `SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE services ? 'vcf')::int AS with_vcf,
                    md5(string_agg(user_id || '|' || COALESCE((services->'vcf')::text,''), ',' ORDER BY user_id)) AS vcf_hash
             FROM customer_behaviour_profiles`,
};

async function capture(label) {
  const out = { environment: ENVIRONMENT, label, at: new Date().toISOString(), untouched: {}, mayChange: {} };
  for (const [k, sql] of Object.entries(UNTOUCHED)) out.untouched[k] = (await query(sql))[0];
  for (const [k, sql] of Object.entries(MAY_CHANGE)) out.mayChange[k] = await query(sql);
  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, `safety-${ENVIRONMENT}-${label}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  console.log('RESULT ' + JSON.stringify(out));
}

function compare(a, b) {
  const A = JSON.parse(fs.readFileSync(path.join(DIR, `safety-${ENVIRONMENT}-${a}.json`), 'utf8'));
  const B = JSON.parse(fs.readFileSync(path.join(DIR, `safety-${ENVIRONMENT}-${b}.json`), 'utf8'));
  const rows = Object.keys(A.untouched).map((k) => ({
    table: k,
    before: A.untouched[k].n,
    after: B.untouched[k].n,
    identical: A.untouched[k].n === B.untouched[k].n && A.untouched[k].h === B.untouched[k].h,
  }));
  console.log('RESULT ' + JSON.stringify({ untouched: rows, before: A.mayChange, after: B.mayChange }));
  if (rows.some((r) => !r.identical)) process.exitCode = 2;
}

const [mode, x, y] = process.argv.slice(2);
(mode === 'compare' ? Promise.resolve(compare(x, y)) : capture(x || 'before')).catch((e) => {
  console.error('ERR ' + e.message);
  process.exit(1);
});
