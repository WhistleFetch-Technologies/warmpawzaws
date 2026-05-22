"""
Customer-web API call-site audit.
Produces:
  docs/migration/customer-web-api-calls.csv
  docs/migration/lambda-leakage-report.md
"""

import os
import re
import csv
import json
from pathlib import Path

REPO = Path(__file__).parent.parent
CW  = REPO / "apps" / "customer-web"
DOCS = REPO / "docs" / "migration"

# ── 1. Collect every API call line from customer-web ──────────────────────
URL_RE = re.compile(
    r"""(?:apiClient\.(get|post|put|delete|patch)\s*\()?"""
    r"""`(/(?:customer|customers|booking|bookings|pets|vendor/bookings|appointment|adoption|breeder|relocation|holidays)/[^`\n]*)"""
    r"""|"""
    r"""(?:apiClient\.(get|post|put|delete|patch)\s*\(\s*['"])(/(?:customer|customers|booking|bookings|pets|vendor/bookings|appointment|adoption|breeder|relocation|holidays)/[^'"\n]*)"""
)

METHOD_BEFORE = re.compile(r'apiClient\.(get|post|put|delete|patch)\s*\(\s*$', re.IGNORECASE)

def normalize_url(raw: str) -> str:
    """Replace ${expr} with {var}, strip query string, normalise."""
    url = re.sub(r'\$\{[^}]+\}', '{var}', raw)
    url = re.sub(r'\?.*$', '', url)        # drop query string
    url = re.sub(r'//+', '/', url)
    url = url.rstrip('/')
    return url

def infer_method(line: str, context_lines: list[str]) -> str:
    """Try to find the HTTP method from the current or nearby lines."""
    combined = '\n'.join(context_lines[-5:]) + '\n' + line
    m = re.search(r'apiClient\.(get|post|put|delete|patch)\s*\(', combined, re.IGNORECASE)
    if m:
        return m.group(1).upper()
    return "UNKNOWN"

rows = []

for fpath in CW.rglob("*.ts"):
    rel = fpath.relative_to(REPO).as_posix()
    lines = fpath.read_text(encoding='utf-8', errors='ignore').splitlines()
    for i, line in enumerate(lines):
        # Look for backtick template literal API paths
        for m in re.finditer(
            r'`(/(?:customer|customers|booking|bookings|pets|vendor/bookings|appointment|adoption|breeder|relocation|holidays)/[^`\n]*)`',
            line
        ):
            raw = m.group(1)
            norm = normalize_url(raw)
            method = infer_method(line, lines[max(0,i-5):i+1])
            rows.append({
                'normalized_url': norm,
                'method': method,
                'file': rel,
                'line': i+1,
                'raw_snippet': line.strip()[:120],
            })
        # Look for string literal API paths
        for m in re.finditer(
            r"""(?:apiClient\.(get|post|put|delete|patch)\s*\()\s*['"](/(?:customer|customers|booking|bookings|pets|vendor/bookings|appointment|adoption|breeder|relocation|holidays)/[^'"\n]*)""",
            line
        ):
            method = (m.group(1) or 'UNKNOWN').upper()
            raw = m.group(2)
            norm = normalize_url(raw)
            rows.append({
                'normalized_url': norm,
                'method': method,
                'file': rel,
                'line': i+1,
                'raw_snippet': line.strip()[:120],
            })

for fpath in CW.rglob("*.tsx"):
    rel = fpath.relative_to(REPO).as_posix()
    lines = fpath.read_text(encoding='utf-8', errors='ignore').splitlines()
    for i, line in enumerate(lines):
        for m in re.finditer(
            r'`(/(?:customer|customers|booking|bookings|pets|vendor/bookings|appointment|adoption|breeder|relocation|holidays)/[^`\n]*)`',
            line
        ):
            raw = m.group(1)
            norm = normalize_url(raw)
            method = infer_method(line, lines[max(0,i-5):i+1])
            rows.append({
                'normalized_url': norm,
                'method': method,
                'file': rel,
                'line': i+1,
                'raw_snippet': line.strip()[:120],
            })
        for m in re.finditer(
            r"""(?:apiClient\.(get|post|put|delete|patch)\s*\()\s*['"](/(?:customer|customers|booking|bookings|pets|vendor/bookings|appointment|adoption|breeder|relocation|holidays)/[^'"\n]*)""",
            line
        ):
            method = (m.group(1) or 'UNKNOWN').upper()
            raw = m.group(2)
            norm = normalize_url(raw)
            rows.append({
                'normalized_url': norm,
                'method': method,
                'file': rel,
                'line': i+1,
                'raw_snippet': line.strip()[:120],
            })

print(f"[scan] {len(rows)} raw call-site matches found")

# ── 2. De-duplicate (keep unique file+line, but preserve all rows) ─────────
# Remove exact duplicate lines
seen = set()
deduped = []
for r in rows:
    key = (r['file'], r['line'], r['normalized_url'], r['method'])
    if key not in seen:
        seen.add(key)
        deduped.append(r)
rows = deduped
print(f"[scan] {len(rows)} unique call-site rows after de-dup")

# ── 3. Build Java route key matcher ────────────────────────────────────────
CUSTOMER_ROUTES_RAW = """
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
""".strip().splitlines()

BOOKING_ROUTES_RAW = """
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
POST /followup/create
POST /vendor/bookings/{bookingId}/accept
POST /vendor/bookings/{bookingId}/cancel
POST /vendor/bookings/{bookingId}/confirm
POST /vendor/bookings/{bookingId}/decline
POST /vendor/bookings/{bookingId}/reject
PUT /booking/{bookingId}/status
PUT /bookings/{bookingId}/status
PUT /vendor/bookings/{bookingId}/status
""".strip().splitlines()

def parse_route_keys(lines):
    routes = []
    for l in lines:
        l = l.strip()
        if not l or l.startswith('#'):
            continue
        parts = l.split(' ', 1)
        if len(parts) == 2:
            routes.append((parts[0].upper(), parts[1]))
    return routes

customer_routes = parse_route_keys(CUSTOMER_ROUTES_RAW)
booking_routes  = parse_route_keys(BOOKING_ROUTES_RAW)
all_java_routes = customer_routes + booking_routes

def url_matches_template(url: str, template: str) -> bool:
    """Check if url matches route template (segments, {param} = wildcard)."""
    u_segs = url.strip('/').split('/')
    t_segs = template.strip('/').split('/')
    if len(u_segs) != len(t_segs):
        return False
    for u, t in zip(u_segs, t_segs):
        if t.startswith('{') and t.endswith('}'):
            continue
        if u != t and not (u.startswith('{') and u.endswith('}')):
            return False
    return True

def classify(method: str, norm_url: str) -> str:
    matches = []
    for route_method, route_path in all_java_routes:
        if route_method != 'ANY' and route_method != method and method != 'UNKNOWN':
            continue
        if url_matches_template(norm_url, route_path):
            matches.append(f"{route_method} {route_path}")
    if len(matches) == 0:
        return 'LAMBDA'
    if len(matches) == 1:
        return 'JAVA'
    return 'AMBIGUOUS'

for r in rows:
    r['classification'] = classify(r['method'], r['normalized_url'])

# ── 4. Write CSV ────────────────────────────────────────────────────────────
csv_path = DOCS / 'customer-web-api-calls.csv'
with open(csv_path, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=['normalized_url','method','classification','file','line','raw_snippet'])
    w.writeheader()
    w.writerows(rows)
print(f"[csv] wrote {csv_path} ({len(rows)} rows)")

# ── 5. Check Lambda endpoint coverage ──────────────────────────────────────
LAMBDA_ENDPOINTS = REPO / "backend" / "lambda" / "src" / "endpoints"

def lambda_has_handler(norm_url: str) -> bool:
    """Rough check: does Lambda endpoints folder have any file with a route segment."""
    segments = [s for s in norm_url.strip('/').split('/') if not (s.startswith('{') and s.endswith('}'))]
    for fpath in LAMBDA_ENDPOINTS.rglob("*.ts"):
        content = fpath.read_text(encoding='utf-8', errors='ignore')
        for seg in segments[:2]:  # top 2 path segments
            if seg in content:
                return True
    return False

# ── 6. Build leakage report ─────────────────────────────────────────────────
from collections import defaultdict, Counter

total = len(rows)
by_class = Counter(r['classification'] for r in rows)

lambda_rows = [r for r in rows if r['classification'] == 'LAMBDA']

# Group by normalized_url + method for Lambda
lambda_grouped = defaultdict(list)
for r in lambda_rows:
    key = f"{r['method']} {r['normalized_url']}"
    lambda_grouped[key].append(r)

lambda_sorted = sorted(lambda_grouped.items(), key=lambda x: -len(x[1]))

# Check Lambda handler coverage for top items
lambda_details = []
for key, sites in lambda_sorted[:30]:
    method, _, url = key.partition(' ')
    has_lambda = lambda_has_handler(url)
    status = 'Lambda handles' if has_lambda else 'BROKEN ON BOTH'
    lambda_details.append((key, len(sites), sites[0]['file'], status))

report_lines = [
    "# Customer-Web Lambda Leakage Report",
    "",
    f"Generated: 2026-05-22",
    "",
    "## Summary",
    "",
    f"| Metric | Count |",
    f"|---|---|",
    f"| Total call sites scanned | {total} |",
    f"| JAVA (routed to Java service) | {by_class['JAVA']} |",
    f"| LAMBDA (still hits Lambda via proxy) | {by_class['LAMBDA']} |",
    f"| AMBIGUOUS (multiple template matches) | {by_class['AMBIGUOUS']} |",
    f"| UNKNOWN method | {sum(1 for r in rows if r['method']=='UNKNOWN')} |",
    "",
    "## Top 20 LAMBDA Call Sites (backlog for next Java port wave)",
    "",
    "| Rank | Method + Normalized URL | Call-site count | Example file | Lambda handler? |",
    "|---|---|---|---|---|",
]

for i, (key, count, example_file, status) in enumerate(lambda_details[:20], 1):
    report_lines.append(f"| {i} | `{key}` | {count} | {example_file} | {status} |")

report_lines += [
    "",
    "## All LAMBDA URL Groups (full list)",
    "",
    "| Method + URL | Count |",
    "|---|---|",
]
for key, sites in lambda_sorted:
    report_lines.append(f"| `{key}` | {len(sites)} |")

report_lines += [
    "",
    "## Classification Notes",
    "",
    "- **JAVA**: the (method, normalized_url) matches a route_key in customer-java-route-keys or booking-java-route-keys",
    "- **LAMBDA**: no match; this call reaches Lambda via the `ANY /{proxy+}` catch-all integration",
    "- **AMBIGUOUS**: multiple Java route templates could match (e.g. overlapping template params)",
    "- **BROKEN ON BOTH**: classified as LAMBDA and Lambda endpoint scan found no matching handler file",
    "",
    "## Route Key Sources",
    f"- Customer service: {len(customer_routes)} route keys (`docs/migration/customer-java-route-keys.tf.fragment`)",
    f"- Booking service: {len(booking_routes)} route keys (`docs/migration/booking-java-route-keys.tf.fragment`)",
    f"- Total: {len(all_java_routes)} Java route keys",
]

report_path = DOCS / 'lambda-leakage-report.md'
report_path.write_text('\n'.join(report_lines), encoding='utf-8')
print(f"[report] wrote {report_path}")

# ── 7. Print top-10 for chat ────────────────────────────────────────────────
print("\n=== TOP-10 LAMBDA CALL SITES (backlog candidates) ===")
for i, (key, count, example_file, status) in enumerate(lambda_details[:10], 1):
    print(f"  {i:2d}. [{count:3d} sites] {key}  ({status})")

print(f"\n=== CLASSIFICATION SUMMARY ===")
print(f"  Total:     {total}")
print(f"  JAVA:      {by_class['JAVA']}")
print(f"  LAMBDA:    {by_class['LAMBDA']}")
print(f"  AMBIGUOUS: {by_class['AMBIGUOUS']}")
