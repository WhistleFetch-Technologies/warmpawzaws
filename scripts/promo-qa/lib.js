/**
 * Shared helpers for the promo-engine QA seeder / scenario runner (DEV ONLY).
 * Spec format and workflow: .cursor/rules/promo-engine-dev-qa.mdc
 */
const fs = require('fs');
const path = require('path');

const DEV_API = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const PROD_API_MARKER = 'mss9sa4y01';
const CODE_PREFIX = 'QA-';
const MAX_RANGES = 20;
const CHANNELS = ['tele', 'appointment', 'paybill', 'ecommerce'];
const LOOP_KINDS = ['visit_number', 'every_nth', 'from_onward', 'between', 'every'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function die(msg) {
  console.error(`ERROR ${msg}`);
  process.exit(1);
}

function assertDev() {
  const env = process.env.ENVIRONMENT || 'dev';
  if (env !== 'dev') die(`ENVIRONMENT=${env}. These QA scripts only run against dev.`);
  process.env.ENVIRONMENT = 'dev';
}

function apiBase() {
  const base = (process.env.QA_API_BASE || DEV_API).replace(/\/+$/, '');
  if (base.includes(PROD_API_MARKER)) die('QA_API_BASE points at the prod API. Dev only.');
  return base;
}

/** rds-data-api-utils-dev logs every statement; keep QA output readable. */
function quietQuery() {
  const { query } = require('../rds-data-api-utils-dev');
  return async (sql) => {
    const log = console.log;
    console.log = () => {};
    try {
      return await query(sql);
    } finally {
      console.log = log;
    }
  };
}

const lit = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const json = (v) => `${lit(JSON.stringify(v))}::jsonb`;
function num(v) {
  if (v == null) return 'NULL';
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Not a number: ${v}`);
  return String(n);
}

function isInt(v) {
  return v == null || (Number.isInteger(v) && v >= 0);
}

function benefitList(discount, cashback, defaultExpiry) {
  const out = [];
  if (discount && Number(discount.value) > 0) {
    out.push({
      type: 'DISCOUNT',
      mode: discount.mode || 'FIXED',
      value: Number(discount.value),
      ...(discount.max != null ? { maxAmount: Number(discount.max) } : {}),
    });
  }
  if (cashback && Number(cashback.value) > 0) {
    out.push({
      type: 'CASHBACK',
      mode: cashback.mode || 'FIXED',
      value: Number(cashback.value),
      ...(cashback.max != null ? { maxAmount: Number(cashback.max) } : {}),
      expiryDays: Number(cashback.expiryDays ?? defaultExpiry ?? 30),
      redeemScope: [],
    });
  }
  return out;
}

function modeOf(benefits) {
  const d = benefits.some((b) => b.type === 'DISCOUNT');
  const c = benefits.some((b) => b.type === 'CASHBACK');
  return d && c ? 'both' : c ? 'cashback' : d ? 'discount' : null;
}

function validateBenefitInput(name, b, errors) {
  if (!b) return;
  const v = Number(b.value);
  if (!Number.isFinite(v) || v < 0) errors.push(`${name}: value must be 0 or more`);
  if (b.mode && !['FIXED', 'PERCENT'].includes(b.mode)) errors.push(`${name}: mode must be FIXED or PERCENT`);
  if (b.mode === 'PERCENT' && v > 100) errors.push(`${name}: percent cannot exceed 100`);
  if (b.max != null && !(Number(b.max) >= 0)) errors.push(`${name}: max must be 0 or more`);
}

function validateLimits(name, limits, errors) {
  if (!limits) return;
  for (const k of ['perUser', 'perTransaction', 'dailyLimit', 'campaignLimit']) {
    if (!isInt(limits[k])) errors.push(`${name}: limits.${k} must be a whole number or null`);
  }
  if (limits.budgetLimit != null && !(Number(limits.budgetLimit) >= 0)) {
    errors.push(`${name}: limits.budgetLimit must be 0 or more`);
  }
}

/** Same bound rules as the admin API: sorted by floor, only the last open, no overlap. */
function validateRanges(code, ranges, errors) {
  if (ranges.length > MAX_RANGES) errors.push(`${code}: at most ${MAX_RANGES} ranges`);
  const labels = ranges.map((r) => r.label).filter(Boolean);
  if (new Set(labels).size !== labels.length) errors.push(`${code}: range labels must be unique`);
  const sorted = [...ranges].sort((a, b) => (a.min ?? 0) - (b.min ?? 0));
  sorted.forEach((r, i) => {
    const name = `${code} range ${r.label || i + 1}`;
    if (r.min != null && !(r.min >= 0)) errors.push(`${name}: min must be 0 or more`);
    if (r.max != null && !(r.max > (r.min ?? 0))) errors.push(`${name}: max must be above min`);
    if (r.max == null && i < sorted.length - 1) errors.push(`${name}: only the last range can have no max`);
    const prev = sorted[i - 1];
    if (prev && prev.max != null && (r.min ?? 0) < prev.max) errors.push(`${name}: overlaps the range below it`);
    validateBenefitInput(`${name} discount`, r.discount, errors);
    validateBenefitInput(`${name} cashback`, r.cashback, errors);
    if (r.active !== false && !modeOf(benefitList(r.discount, r.cashback))) {
      errors.push(`${name}: needs a discount or cashback above 0 (or "active": false)`);
    }
    validateLimits(name, r.limits, errors);
  });
}

function validateLoop(code, loop, errors) {
  if (!loop || !LOOP_KINDS.includes(loop.kind)) {
    errors.push(`${code}: visitLoop.kind must be one of ${LOOP_KINDS.join(', ')}`);
    return;
  }
  if (loop.kind !== 'every' && !(Number.isInteger(loop.n) && loop.n >= 1)) {
    errors.push(`${code}: visitLoop.n must be a whole number >= 1`);
  }
  if (loop.kind === 'between' && !(Number.isInteger(loop.m) && loop.m >= loop.n)) {
    errors.push(`${code}: visitLoop.m must be >= n`);
  }
}

function loadSpec(file) {
  if (!file) die('Pass a spec file, e.g. scripts/promo-qa/specs/example-paybill-visit-ranges.json');
  const full = path.resolve(file);
  if (!fs.existsSync(full)) die(`Spec not found: ${full}`);
  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (e) {
    die(`Spec is not valid JSON: ${e.message}`);
  }
  const errors = [];
  if (!UUID_RE.test(String(spec.vendorId || ''))) {
    errors.push('vendorId must be a dev vendor UUID (find one with: seed-dev.js --vendors <name>)');
  }
  const defaults = spec.defaults || {};
  const channels = defaults.channels || ['paybill'];
  if (!channels.every((c) => CHANNELS.includes(c))) errors.push(`defaults.channels must be from ${CHANNELS.join(', ')}`);
  const promos = Array.isArray(spec.promos) ? spec.promos : [];
  if (!promos.length) errors.push('promos[] is empty');
  const codes = new Set();
  for (const p of promos) {
    const code = String(p.code || '');
    if (!code.startsWith(CODE_PREFIX)) errors.push(`${code || '(no code)'}: code must start with ${CODE_PREFIX}`);
    if (codes.has(code)) errors.push(`${code}: duplicate code`);
    codes.add(code);
    validateLoop(code, p.visitLoop, errors);
    if (p.priority != null && !(Number.isInteger(p.priority) && p.priority >= 1 && p.priority <= 100)) {
      errors.push(`${code}: priority must be 1-100`);
    }
    if (p.status && !['ACTIVE', 'PAUSED'].includes(p.status)) errors.push(`${code}: status must be ACTIVE or PAUSED`);
    if (p.visitSource?.letter && !['F', 'V'].includes(p.visitSource.letter)) {
      errors.push(`${code}: visitSource.letter must be F (platform) or V (the spec vendor)`);
    }
    validateLimits(code, p.limits, errors);
    if (Array.isArray(p.ranges) && p.ranges.length) {
      if (p.discount || p.cashback) errors.push(`${code}: use either ranges[] or discount/cashback, not both`);
      validateRanges(code, p.ranges, errors);
    } else {
      validateBenefitInput(`${code} discount`, p.discount, errors);
      validateBenefitInput(`${code} cashback`, p.cashback, errors);
      if (!modeOf(benefitList(p.discount, p.cashback))) errors.push(`${code}: needs ranges[] or a discount/cashback above 0`);
    }
  }
  for (const [i, s] of (spec.scenarios || []).entries()) {
    const name = s.name || `scenario ${i + 1}`;
    if (!(Number.isInteger(s.visit) && s.visit >= 1)) errors.push(`${name}: visit must be a whole number >= 1`);
    if (!(Number(s.amount) > 0)) errors.push(`${name}: amount must be above 0`);
    const exp = s.expect || {};
    for (const key of ['winner', 'rejected']) {
      const ref = key === 'rejected' ? exp.rejected?.code : exp[key];
      if (ref && !codes.has(ref)) errors.push(`${name}: expect.${key} refers to unknown code ${ref}`);
    }
  }
  if (errors.length) die(`Spec has problems:\n  - ${errors.join('\n  - ')}`);
  return { ...spec, defaults: { ...defaults, channels }, file: full };
}

module.exports = {
  CODE_PREFIX,
  apiBase,
  assertDev,
  benefitList,
  die,
  json,
  lit,
  loadSpec,
  modeOf,
  num,
  quietQuery,
};
