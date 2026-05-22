// Customer-web API call-site audit — Node.js version
// Produces:
//   docs/migration/customer-web-api-calls.csv
//   docs/migration/lambda-leakage-report.md

const fs   = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const CW   = path.join(REPO, 'apps', 'customer-web');
const DOCS = path.join(REPO, 'docs', 'migration');

// ── 1. Walk all .ts/.tsx files ──────────────────────────────────────────────
function walkSync(dir, ext, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules' && e.name !== '.next') {
      walkSync(full, ext, out);
    } else if (e.isFile() && ext.some(x => e.name.endsWith(x))) {
      out.push(full);
    }
  }
  return out;
}

const files = walkSync(CW, ['.ts', '.tsx']);
console.log(`[scan] ${files.length} TS/TSX files found`);

// ── 2. Extract API call lines ───────────────────────────────────────────────
// Match template-literal paths: /customer/..., /booking/..., /bookings/..., /pets/..., etc.
const PATH_RE = /`(\/(?:customer|customers|booking|bookings|pets|vendor\/bookings|appointment|adoption|breeder|relocation|holidays)\/[^`\n]*)`/g;
// Match string literal paths following apiClient.METHOD(
const STR_RE  = /apiClient\.(get|post|put|delete|patch)\s*\(\s*['"](\/(customer|customers|booking|bookings|pets|vendor\/bookings|appointment|adoption|breeder|relocation|holidays)\/[^'"\n]*)['"]/gi;

function normalizeUrl(raw) {
  let u = raw.replace(/\$\{[^}]+\}/g, '{var}');
  u = u.replace(/\?.*$/, '');
  u = u.replace(/\/\/+/g, '/');
  u = u.replace(/\/$/, '');
  return u;
}

function inferMethod(line, contextLines, filePath) {
  const combined = [...contextLines.slice(-5), line].join('\n');

  // 1. Direct apiClient.verb( or axios.verb( call
  let m = combined.match(/(?:apiClient|axios)\.(get|post|put|delete|patch)\s*\(/i);
  if (m) return m[1].toUpperCase();

  // 2. fetch(..., { method: 'VERB' }) or method: 'VERB' in options object
  m = combined.match(/\bmethod\s*:\s*['"]([A-Za-z]+)['"]/i);
  if (m) return m[1].toUpperCase();

  // 3. Mutation / submit context → POST
  if (/handleSubmit\b|useMutation\b|\.mutate\s*\(|onSubmit\s*[=({]|mutation\s*\(/i.test(combined)) {
    return 'POST';
  }

  // 4. File/component name hints → GET
  if (filePath) {
    const base = path.basename(filePath, path.extname(filePath));
    if (/(?:Page|View|List|Display|Show)$/i.test(base)) return 'GET';
  }

  return 'UNKNOWN';
}

const rows = [];

for (const fpath of files) {
  const rel = fpath.replace(REPO + path.sep, '').replace(/\\/g, '/');
  let src;
  try { src = fs.readFileSync(fpath, 'utf8'); }
  catch { continue; }
  const lines = src.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // template literal paths
    let m;
    PATH_RE.lastIndex = 0;
    while ((m = PATH_RE.exec(line)) !== null) {
      const raw  = m[1];
      const norm = normalizeUrl(raw);
      const method = inferMethod(line, lines.slice(Math.max(0, i-5), i+1), rel);
      rows.push({ normalized_url: norm, method, file: rel, line: i+1,
                  raw_snippet: line.trim().slice(0, 120) });
    }

    // string literal paths after apiClient.METHOD
    STR_RE.lastIndex = 0;
    while ((m = STR_RE.exec(line)) !== null) {
      const method = m[1].toUpperCase();
      const raw    = m[2];
      const norm   = normalizeUrl(raw);
      rows.push({ normalized_url: norm, method, file: rel, line: i+1,
                  raw_snippet: line.trim().slice(0, 120) });
    }
  }
}

// de-dup by file+line+url+method
const seen = new Set();
const deduped = [];
for (const r of rows) {
  const k = `${r.file}|${r.line}|${r.normalized_url}|${r.method}`;
  if (!seen.has(k)) { seen.add(k); deduped.push(r); }
}
console.log(`[scan] ${deduped.length} unique call-site rows`);

// ── 3. Java route keys ──────────────────────────────────────────────────────
const CUSTOMER_ROUTES = `
ANY /customer/addresses/{addressId}
ANY /customer/{customerId}
ANY /customer/{customerRef}/addresses/{addressId}
ANY /customers/addresses/{addressId}
ANY /customers/{customerId}
ANY /customers/{customerRef}/addresses/{addressId}
ANY /pets/{petId}
DELETE /customer/{segment}/pets/{petId}
DELETE /customers/pets/{petId}
GET /customer/addresses
GET /customer/by-phone
GET /customer/by-phone/{phone}/pets/{petId}/bookings
GET /customer/pets
GET /customer/pets/{phone}
GET /customer/profile
GET /customer/profile/unified/{phone}
GET /customer/profile/{identifier}
GET /customer/{customerId}/addresses
GET /customer/{customerId}/pets
GET /customer/{phone}/pets/{petId}
GET /customer/{phone}/preferences
GET /customers/addresses
GET /customers/by-phone
GET /customers/profile
GET /customers/profile/unified/{phone}
GET /customers/profile/{identifier}
GET /customers/{customerId}/addresses
GET /customers/{customerId}/preferences
GET /customers/{customerId}/profile-completion
GET /pets/customer/{customerId}
POST /customer
POST /customer/addresses
POST /customer/customers
POST /customer/pets
POST /customer/profile
POST /customer/{customerId}/addresses
POST /customer/{customerId}/pets
POST /customer/{phone}/preferences
POST /customers
POST /customers/addresses
POST /customers/customers
POST /customers/profile
POST /customers/{customerId}/addresses
POST /customers/{customerId}/complete/address
POST /customers/{customerId}/complete/basic
POST /customers/{customerId}/complete/pet
POST /customers/{customerId}/complete/preferences
POST /customers/{customerId}/pets
POST /customers/{customerId}/preferences
POST /pets
PUT /customer/profile/{identifier}
PUT /customer/{segment}/pets/{petId}
PUT /customers/pets/{petId}
PUT /customers/profile/{identifier}
`.trim();

const BOOKING_ROUTES = `
GET /booking/{bookingId}
GET /booking/{bookingId}/history
GET /bookings/available-slots
GET /bookings/{bookingId}
GET /bookings/{bookingId}/history
GET /customer/bookings/{bookingId}
GET /customer/{customerId}/bookings
GET /customer/{customerId}/bookings/follow-up-eligible
GET /customer/{customerId}/bookings/{bookingId}
GET /customer/{customerId}/pets/{petId}/bookings
GET /vendor/available-slots
GET /vendor/bookings/{bookingId}/details
GET /vendor/bookings/{vendorId}
GET /vendor/reschedule-policy
GET /vendor/{vendorId}/bookings
GET /vendor/{vendorId}/bookings/today
POST /booking/create
POST /booking/customer/bookings/refund-preview
POST /booking/{bookingId}/calculate-refund
POST /booking/{bookingId}/cancel
POST /booking/{bookingId}/cancel-with-refund
POST /booking/{bookingId}/reschedule
POST /bookings/create
POST /bookings/customer/bookings/refund-preview
POST /bookings/generate-otp
POST /bookings/verify-otp
POST /bookings/{bookingId}/calculate-refund
POST /bookings/{bookingId}/cancel
POST /bookings/{bookingId}/cancel-with-refund
POST /bookings/{bookingId}/reschedule
POST /customer/booking/create
POST /customer/bookings/create
POST /customer/bookings/refund-preview
POST /followup/create
POST /vendor/bookings/{bookingId}/accept
POST /vendor/bookings/{bookingId}/cancel
POST /vendor/bookings/{bookingId}/confirm
POST /vendor/bookings/{bookingId}/decline
POST /vendor/bookings/{bookingId}/reject
PUT /booking/{bookingId}/status
PUT /bookings/{bookingId}/status
PUT /vendor/bookings/{bookingId}/status
`.trim();

function parseRoutes(block) {
  return block.split('\n')
    .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(l => { const [m, ...rest] = l.split(' '); return [m, rest.join(' ')]; });
}

const allJavaRoutes = [...parseRoutes(CUSTOMER_ROUTES), ...parseRoutes(BOOKING_ROUTES)];

function urlMatchesTemplate(url, template) {
  const u = url.replace(/\?.*$/, '').split('/').filter(Boolean);
  const t = template.split('/').filter(Boolean);
  if (u.length !== t.length) return false;
  for (let i = 0; i < u.length; i++) {
    // Template param matches any call-site segment (literal or {var})
    if (t[i].startsWith('{') && t[i].endsWith('}')) continue;
    // Literal in template: call-site segment must match exactly.
    // {var} in the call-site does NOT match a literal template segment —
    // that would allow e.g. /customer/{var}/pets to match /customer/by-phone/pets.
    if (u[i] !== t[i]) return false;
  }
  return true;
}

function classify(method, normUrl) {
  const url = normUrl.replace(/\?.*$/, '');
  const matches = allJavaRoutes.filter(([rm, rp]) => {
    if (rm !== 'ANY' && rm !== method && method !== 'UNKNOWN') return false;
    return urlMatchesTemplate(url, rp);
  });
  if (matches.length === 0) return 'LAMBDA';
  if (matches.length === 1) return 'JAVA';
  return 'AMBIGUOUS';
}

for (const r of deduped) {
  r.classification = classify(r.method, r.normalized_url);
}

// ── 4. Write CSV ────────────────────────────────────────────────────────────
const csvPath = path.join(DOCS, 'customer-web-api-calls.csv');
const csvHeader = 'normalized_url,method,classification,file,line,raw_snippet\n';
const csvRows = deduped.map(r => [
  r.normalized_url, r.method, r.classification, r.file, r.line,
  '"' + r.raw_snippet.replace(/"/g, '""') + '"'
].join(','));
fs.writeFileSync(csvPath, csvHeader + csvRows.join('\n'), 'utf8');
console.log(`[csv] wrote ${csvPath} (${deduped.length} rows)`);

// ── 5. Check Lambda endpoint coverage ──────────────────────────────────────
const LAMBDA_ENDPOINTS = path.join(REPO, 'backend', 'lambda', 'src', 'endpoints');
const lambdaFiles = walkSync(LAMBDA_ENDPOINTS, ['.ts']);
const lambdaContent = lambdaFiles.map(f => {
  try { return fs.readFileSync(f, 'utf8'); } catch { return ''; }
}).join('\n');

function lambdaHasHandler(normUrl) {
  const segs = normUrl.replace(/\?.*$/, '').split('/').filter(s => s && !s.startsWith('{'));
  return segs.slice(0, 2).some(s => lambdaContent.includes('/' + s + '/') || lambdaContent.includes('"' + s));
}

// ── 6. Build leakage report ─────────────────────────────────────────────────
const total = deduped.length;
const byClass = {};
for (const r of deduped) {
  byClass[r.classification] = (byClass[r.classification] || 0) + 1;
}

const lambdaRows = deduped.filter(r => r.classification === 'LAMBDA');

// Group by method + normalized_url
const lambdaGrouped = {};
for (const r of lambdaRows) {
  const key = `${r.method} ${r.normalized_url}`;
  if (!lambdaGrouped[key]) lambdaGrouped[key] = [];
  lambdaGrouped[key].push(r);
}
const lambdaSorted = Object.entries(lambdaGrouped).sort((a, b) => b[1].length - a[1].length);

const lambdaDetails = lambdaSorted.slice(0, 30).map(([key, sites]) => {
  const [method, ...urlParts] = key.split(' ');
  const url = urlParts.join(' ');
  const hasLambda = lambdaHasHandler(url);
  return { key, count: sites.length, exampleFile: sites[0].file, status: hasLambda ? 'Lambda handles' : 'BROKEN ON BOTH' };
});

const reportLines = [
  '# Customer-Web Lambda Leakage Report',
  '',
  'Generated: 2026-05-22',
  '',
  '## Summary',
  '',
  '| Metric | Count |',
  '|---|---|',
  `| Total call sites scanned | ${total} |`,
  `| JAVA (routed to Java service) | ${byClass['JAVA'] || 0} |`,
  `| LAMBDA (still hits Lambda via proxy) | ${byClass['LAMBDA'] || 0} |`,
  `| AMBIGUOUS (multiple template matches) | ${byClass['AMBIGUOUS'] || 0} |`,
  `| UNKNOWN method | ${deduped.filter(r => r.method === 'UNKNOWN').length} |`,
  '',
  '## Top 20 LAMBDA Call Sites (backlog for next Java port wave)',
  '',
  '| Rank | Method + Normalized URL | Call-site count | Example file | Lambda handler? |',
  '|---|---|---|---|---|',
  ...lambdaDetails.slice(0, 20).map((d, i) =>
    `| ${i+1} | \`${d.key}\` | ${d.count} | ${d.exampleFile} | ${d.status} |`
  ),
  '',
  '## All LAMBDA URL Groups (full list)',
  '',
  '| Method + URL | Count |',
  '|---|---|',
  ...lambdaSorted.map(([key, sites]) => `| \`${key}\` | ${sites.length} |`),
  '',
  '## Classification Notes',
  '',
  '- **JAVA**: the (method, normalized_url) matches a route_key in customer-java-route-keys or booking-java-route-keys',
  '- **LAMBDA**: no match; this call reaches Lambda via the `ANY /{proxy+}` catch-all integration',
  '- **AMBIGUOUS**: multiple Java route templates could match (e.g. overlapping template params)',
  '- **BROKEN ON BOTH**: classified as LAMBDA and Lambda endpoint scan found no matching handler file',
  '',
  '## Route Key Sources',
  `- Customer service: ${parseRoutes(CUSTOMER_ROUTES).length} route keys (\`docs/migration/customer-java-route-keys.tf.fragment\`)`,
  `- Booking service: ${parseRoutes(BOOKING_ROUTES).length} route keys (\`docs/migration/booking-java-route-keys.tf.fragment\`)`,
  `- Total: ${allJavaRoutes.length} Java route keys`,
];

const reportPath = path.join(DOCS, 'lambda-leakage-report.md');
fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf8');
console.log(`[report] wrote ${reportPath}`);

// ── 7. Print top-10 for chat ────────────────────────────────────────────────
console.log('\n=== TOP-10 LAMBDA CALL SITES (backlog candidates) ===');
lambdaDetails.slice(0, 10).forEach((d, i) => {
  console.log(`  ${String(i+1).padStart(2)}. [${String(d.count).padStart(3)} sites] ${d.key}  (${d.status})`);
});

console.log('\n=== CLASSIFICATION SUMMARY ===');
console.log(`  Total:     ${total}`);
console.log(`  JAVA:      ${byClass['JAVA'] || 0}`);
console.log(`  LAMBDA:    ${byClass['LAMBDA'] || 0}`);
console.log(`  AMBIGUOUS: ${byClass['AMBIGUOUS'] || 0}`);
