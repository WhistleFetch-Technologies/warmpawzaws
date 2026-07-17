/**
 * T3-only: strip SQL-alias / column-name params from customer discovery/content/specialized/delivery-fee repos.
 * Keeps only identifiers referenced in bind arrays [$1,...] or as dynamic query args.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../src/endpoints/customer');
const MODULES = ['discovery', 'content', 'specialized', 'delivery-fee'];

const SQL_ALIAS_PARAMS = new Set([
  'text', 'v', 'r', 'vs', 'b', 's', 'p', 'o', 'c', 'o', 'st', 'br_svc',
  'va', 'int', 'uuid', 'information_schema', 'vendors', 'vendor',
  'business_name', 'status', 'is_active', 'phone', 'day_of_week', 'service_style',
  'service_type', 'is_available', 'name', 'role', 'experience_years',
  'title', 'subtitle', 'image_url', 'cta_text', 'cta_link', 'type', 'display_order',
  'metadata', 'start_date', 'description', 'discount_type', 'discount_value',
  'min_order_amount', 'applicable_services', 'content', 'category', 'is_published',
  'created_at', 'role_id', 'service_category', 'specialization_id', 'vsp', 'sm', 'vsp2',
  'fp', 'tp', 'fc', 'mr', 'hcr', 'package_id', 'JSON', 'interval',
  'SQL_BOOKING_SERVICE_LATERAL', 'SQL_PACKAGE_PURCHASE_JOIN', 'SQL_PACKAGE_PURCHASE_SELECT',
  'base_price', 'category_id', 'species', 'breed', 'age_years', 'weight_kg', 'price',
  'disclaimerPoints', 'jsonb', 'strictFromText', 'sc', 'oi',
]);

function walkRepos(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkRepos(p, acc);
    else if (e.isFile() && e.name.endsWith('.repo.ts')) acc.push(p);
  }
  return acc;
}

function extractBindIndices(fnBody) {
  const indices = new Set();
  const re = /\$(\d+)/g;
  let m;
  while ((m = re.exec(fnBody)) !== null) indices.add(parseInt(m[1], 10));
  return indices;
}

function inferRuntimeParams(fnSrc) {
  const open = fnSrc.indexOf('(');
  const close = fnSrc.indexOf(')', open);
  if (open < 0 || close < 0) return null;
  const params = fnSrc
    .slice(open + 1, close)
    .split(',')
    .map((p) => p.trim().split(':')[0].trim())
    .filter(Boolean);

  const bodyStart = fnSrc.indexOf('{', close);
  const body = fnSrc.slice(bodyStart);
  const bindCount = Math.max(0, ...extractBindIndices(body));
  if (bindCount === 0) {
    const kept = params.filter((p) => !SQL_ALIAS_PARAMS.has(p));
    return kept.length ? kept : [];
  }

  const kept = [];
  for (let i = 0; i < params.length && kept.length < bindCount; i++) {
    const p = params[i];
    if (!SQL_ALIAS_PARAMS.has(p)) kept.push(p);
  }
  if (kept.length >= bindCount) return kept.slice(0, bindCount);

  const dynamic = params.filter((p) => p.endsWith('Query') || p === 'params' || p === 'queryParams' || p === 'queryText' || p === 'sql' || p === 'vendorSql' || p === 'staffQuery' || p === 'servicesQuery' || p === 'petQuery' || p === 'puppyQuery' || p === 'packageQuery' || p === 'quotesQuery' || p === 'applicationsQuery' || p === 'petsQuery' || p === 'matchQuery' || p === 'requestsQuery' || p === 'countQuery' || p === 'serviceQuery' || p === 'pagesQuery' || p === 'placeholders' || p === 'updateData' || p === 'petData' || p === 'quoteRow' || p === 'fallbackRow' || p === 'vendorPatch' || p === 'vendorQuery' || p === 'styleClause' || p === 'vendorParamsDiscover' || p === 'vendorParamsByStyle' || p === 'fallbackQuery' || p === 'fallbackParams');
  if (dynamic.length) return dynamic;

  return kept.length ? kept : params.slice(0, bindCount);
}

function fixRepoFile(filePath) {
  let src = fs.readFileSync(filePath, 'utf8');
  const fnRe = /export async function (db\w+)\(([^)]*)\)\s*\{/g;
  let changed = false;
  const replacements = [];

  let m;
  while ((m = fnRe.exec(src)) !== null) {
    const name = m[1];
    const oldParams = m[2];
    const full = m[0];
    const inferred = inferRuntimeParams(full);
    if (!inferred) continue;
    const newSig = `export async function ${name}(${inferred.join(', ')}) {`;
    if (newSig !== full) {
      replacements.push({ old: full, neu: newSig });
    }
  }

  for (const { old, neu } of replacements) {
    if (src.includes(old)) {
      src = src.replace(old, neu);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, src);
    console.log('fixed repo:', path.relative(ROOT, filePath));
  }
}

for (const mod of MODULES) {
  const repos = walkRepos(path.join(ROOT, mod));
  for (const repo of repos) fixRepoFile(repo);
}

console.log('T3 repo param strip done');
