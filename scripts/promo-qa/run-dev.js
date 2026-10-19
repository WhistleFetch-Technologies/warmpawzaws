/**
 * DEV ONLY: run a spec's scenarios against the dev promo engine and check expectations.
 * Workflow + spec format: .cursor/rules/promo-engine-dev-qa.mdc
 *
 *   node scripts/promo-qa/run-dev.js <spec.json> [--only <text>]   evaluate every scenario (commit ones that ask)
 *   node scripts/promo-qa/run-dev.js --reverse-committed             reverse every QA commit made so far
 *
 * Env: QA_PHONE (+91…, dev customer; UAT OTP 123456) unless spec.customerPhone is set.
 *      AWS credentials for the dev RDS Data API (promo id lookup). QA_API_BASE overrides the dev API URL.
 */
const fs = require('fs');
const path = require('path');
const { apiBase, assertDev, die, lit, loadSpec, quietQuery } = require('./lib');

assertDev();
const API = apiBase();
const OUT_DIR = path.join(__dirname, '.out');
const COMMITTED_FILE = path.join(OUT_DIR, 'committed.json');
const args = process.argv.slice(2);

async function post(pathname, body, token) {
  const res = await fetch(`${API}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function login(phone) {
  await post('/auth/send-otp', { phone, role: 'customer' });
  const { status, data } = await post('/auth/verify-otp', { phone, otp: '123456', role: 'customer' });
  const d = data?.data?.data || data?.data || data;
  const token = d?.token?.access_token || d?.access_token || data?.access_token || null;
  const customerId = d?.profile?.id || d?.user?.id || null;
  if (!token || !customerId) die(`Dev login failed for ${phone} (HTTP ${status}). Is UAT OTP enabled on dev?`);
  return { token, customerId };
}

function readCommitted() {
  return fs.existsSync(COMMITTED_FILE) ? JSON.parse(fs.readFileSync(COMMITTED_FILE, 'utf8')) : [];
}

function writeCommitted(rows) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(COMMITTED_FILE, JSON.stringify(rows, null, 2));
}

/** "Visit N" = N-1 completed visits on the scenario channel, platform-wide and at the spec vendor. */
function behaviourFor(visit, channel, vendorId) {
  const completed = visit - 1;
  const cell = { count: completed, lastAt: completed ? new Date(Date.now() - 86400000).toISOString() : null };
  return {
    overall: { completed_orders: completed },
    services: {
      vcf: {
        platform: { [channel]: cell },
        vendors: { [vendorId]: { categoryId: '', roleId: '', [channel]: cell } },
        categories: {},
      },
    },
  };
}

function near(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.01;
}

function check(expect, got) {
  const fails = [];
  if (expect.eligible != null && expect.eligible !== Boolean(got.winner)) {
    fails.push(`eligible: expected ${expect.eligible}, got ${Boolean(got.winner)}`);
  }
  if (expect.winner !== undefined && expect.winner !== got.winner) {
    fails.push(`winner: expected ${expect.winner}, got ${got.winner}`);
  }
  if (expect.range !== undefined) {
    const r = got.range;
    const ok = Array.isArray(expect.range)
      ? r && (r.min ?? null) === expect.range[0] && (r.max ?? null) === expect.range[1]
      : (r?.label ?? null) === expect.range;
    if (!ok) fails.push(`range: expected ${JSON.stringify(expect.range)}, got ${JSON.stringify(r)}`);
  }
  for (const key of ['discount', 'cashback', 'payable']) {
    if (expect[key] != null && !near(expect[key], got.summary?.[key])) {
      fails.push(`${key}: expected ${expect[key]}, got ${got.summary?.[key]}`);
    }
  }
  if (expect.rejected) {
    const hit = got.rejected.find((r) => r.code === expect.rejected.code);
    if (!hit || (expect.rejected.reason && hit.reason !== expect.rejected.reason)) {
      fails.push(`rejected: expected ${expect.rejected.code} ${expect.rejected.reason || ''}, got ${JSON.stringify(got.rejected)}`);
    }
  }
  return fails;
}

async function promoIds(spec, q) {
  const codes = spec.promos.map((p) => lit(p.code)).join(', ');
  const rows = await q(`SELECT id::text AS id, code, status FROM promo_engine_promotions WHERE code IN (${codes})`);
  const missing = spec.promos.filter((p) => !rows.some((r) => r.code === p.code)).map((p) => p.code);
  if (missing.length) die(`Not seeded on dev: ${missing.join(', ')}. Run seed-dev.js first.`);
  return new Map(rows.map((r) => [r.id, r.code]));
}

async function runScenarios() {
  const spec = loadSpec(args.find((a) => !a.startsWith('--')));
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
  const scenarios = (spec.scenarios || []).filter((s) => !only || (s.name || '').includes(only));
  if (!scenarios.length) die('No scenarios to run.');

  const q = quietQuery();
  const idToCode = await promoIds(spec, q);
  const phone = process.env.QA_PHONE || spec.customerPhone;
  if (!phone) die('Set QA_PHONE or spec.customerPhone (a dev customer phone, +91…).');
  const { token, customerId } = await login(phone);
  console.log(`API ${API} | customer ${customerId} | ${scenarios.length} scenario(s)\n`);

  const runId = Date.now().toString(36);
  const committed = readCommitted();
  const results = [];
  let rangeFieldSeen = false;

  for (const [i, s] of scenarios.entries()) {
    const channel = s.channel || spec.defaults.channels[0];
    const { status, data } = await post(
      '/promo-engine/evaluate',
      {
        user_id: customerId,
        transaction: { type: channel === 'paybill' ? 'WPAY' : 'BOOKING', channel, vendorId: spec.vendorId, amount: s.amount },
        behaviour_override: behaviourFor(s.visit, channel, spec.vendorId),
        persist: Boolean(s.commit),
      },
      token,
    );
    if (status !== 200 || data.success === false) {
      results.push({ name: s.name, pass: false, fails: [`HTTP ${status}: ${data.error || 'evaluate failed'}`] });
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'range')) rangeFieldSeen = true;
    const winnerId = data.eligible ? data.winner_promotion_id : null;
    const got = {
      winner: winnerId ? idToCode.get(winnerId) || null : null,
      otherWinner: winnerId && !idToCode.has(winnerId) ? winnerId : null,
      range: data.range || null,
      summary: data.summary,
      rejected: (data.explain?.rejected_promotions || [])
        .filter((r) => idToCode.has(r.promotion_id))
        .map((r) => ({ code: idToCode.get(r.promotion_id), reason: r.reason })),
    };
    const fails = check(s.expect || {}, got);

    let commit = null;
    if (s.commit && data.eligible && data.evaluation_id) {
      const txn = `QA-${runId}-${i + 1}`;
      const c = await post('/promo-engine/commit', { evaluation_id: data.evaluation_id, transaction_id: txn, user_id: customerId }, token);
      commit = { txn, ok: c.status === 200 && c.data.success !== false, error: c.data.error };
      if (commit.ok) committed.push({ transaction_id: txn, user_id: customerId, scenario: s.name, at: new Date().toISOString() });
      else fails.push(`commit failed: ${c.data.error || c.status}`);
    }
    results.push({ name: s.name, visit: s.visit, amount: s.amount, pass: !fails.length, fails, got, commit });
  }
  writeCommitted(committed);

  for (const r of results) {
    const g = r.got;
    const line = g
      ? `winner=${g.winner || (g.otherWinner ? `non-QA ${g.otherWinner.slice(0, 8)}` : 'none')}` +
        ` range=${g.range ? g.range.label || `${g.range.min ?? 0}-${g.range.max ?? 'open'}` : '-'}` +
        ` discount=${g.summary?.discount} cashback=${g.summary?.cashback}` +
        (g.rejected.length ? ` rejected=${g.rejected.map((x) => `${x.code}:${x.reason}`).join(',')}` : '') +
        (r.commit ? ` committed=${r.commit.txn}` : '')
      : '';
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  ${line}`);
    for (const f of r.fails) console.log(`        - ${f}`);
  }
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (!rangeFieldSeen) {
    console.log('WARN dev API returned no "range" field: the dev Lambda does not have the ranges build yet.');
  }
  if (results.some((r) => r.got?.otherWinner)) {
    console.log('WARN a non-QA promo won some scenarios: an ACTIVE dev promo also covers this vendor/visit.');
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `run-${runId}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ spec: spec.file, api: API, results }, null, 2));
  console.log(`Details: ${outFile}`);
  if (failed) process.exitCode = 1;
}

async function reverseCommitted() {
  const rows = readCommitted();
  if (!rows.length) return console.log('Nothing to reverse.');
  const phone = process.env.QA_PHONE;
  if (!phone) die('Set QA_PHONE (same dev customer used for the run).');
  const { token } = await login(phone);
  const left = [];
  for (const r of rows) {
    const { status, data } = await post('/promo-engine/reverse', { ...r, reason: 'QA cleanup' }, token);
    const ok = status === 200 && data.success !== false;
    console.log(`${ok ? 'REVERSED' : 'FAILED  '} ${r.transaction_id} (${r.scenario}) cashback ${data.reversed_cashback ?? '-'}`);
    if (!ok) left.push(r);
  }
  writeCommitted(left);
}

(async () => {
  try {
    if (args.includes('--reverse-committed')) await reverseCommitted();
    else await runScenarios();
  } catch (e) {
    die(e.message);
  }
})();
