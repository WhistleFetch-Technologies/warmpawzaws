# Customer discovery distance (production)

Distance on vendor/clinic cards comes from `GET /customer/services/by-style` (and related discovery endpoints). The API uses `DistanceResolver` only when it has **finite customer lat/lng**: from query params, or from `getCustomerCoordinates(customerPhone)`, which resolves (**in order**) `customers.latitude` / `customers.longitude`, then default `customer_addresses` JSON `coordinates`, then **6-digit pincode** centroid via Google Geocoding.

## Lambda (prod API) — maps key and pincode fallback

`backend/lambda/src/lib/utils/geocode.ts` resolves the Google Maps API key from (in order):

1. **`GOOGLE_MAPS_API_KEY` env var** (preferred for local dev / explicit override).
2. **`GOOGLE_MAPS_SECRET_ARN` env var** → fetch directly by ARN (already wired into prod Lambda; preferred in production because it skips STAGE-derived name composition). Secret value may be:
   - JSON: `{"apiKey":"AIza..."}` (also accepts `api_key` or `key`), or
   - Bare string: just the API key value.
3. **Secrets Manager name lookup**: `warmpawz/<stage>/google-maps` (JSON), then `warmpawz/<stage>/google-maps/api-key` (string).

> ⚠️ **2026-05-15 incident — empty secret value**: prod was missing distance everywhere because `warmpawz/prod/google-maps` contained `{"api_key": ""}` (created empty on bootstrap). The Lambda silently warned `[Geocode] No API key` on every request. Fix: put a real key into the secret with `aws secretsmanager put-secret-value --secret-id warmpawz/prod/google-maps --secret-string file://<json> --region ap-south-1`. Once filled, every customer discovery request lazily geocodes the missing vendors and persists `vendors.latitude/longitude` so subsequent requests are free.

4. **Key restrictions**: the key must allow **server-side** calls from Lambda (IP restriction for NAT egress, or unrestricted for testing). **Do not** use a browser-only HTTP referrer restriction for this path.

5. **Deploy** (from repo root, per workspace rules):

   ```bash
   LAMBDA_FUNCTION_NAME=warmpawz-prod-api-handler ./scripts/deploy-lambda-direct.sh
   ```

6. **CloudWatch**: filter logs for:
   - `[Geocode] No API key` — missing/invalid secret or env
   - `[Geocode] Secret <arn> is reachable but contains no api key` — secret exists but the JSON has no usable `apiKey`/`api_key`/`key` value (this is the 2026-05-15 failure mode)
   - `[Geocode] warmpawz/<stage>/google-maps secret exists but has no usable api key` — same case via name-lookup path
   - `[getCustomerCoordinates]` — no default address, bad coordinates JSON, or pincode geocode failed
   - `[by-style] No customer coordinates for distance` — no query lat/lng and DB fallback returned null

### Quick verification

```bash
# Should return non-null `distance` / `distanceText` for prod vendors:
curl -s "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/customer/services/by-style?style=at_center&category=vet&roleId=veterinarian&latitude=12.9716&longitude=77.5946" \
  | jq '.providers[] | {name, distance, distanceText}'
```

## Customer web

Deploy after code changes:

```bash
./scripts/deploy-customer-web.sh --prod --yes
```

(Use `--prod` and any flags your script supports for production; dev deploy omits `--prod`.)

## Customer data

For users who **deny** location and the app omits lat/lng on the request, the API uses **`getCustomerCoordinates`**. Ensure at least one of:

- **`customers.latitude` / `customers.longitude`** populated (same as profile; requires DB migration `1005_customers_latitude_longitude.sql` on prod if not already applied), or
- A **default address** with `coordinates` (`lat`/`lng` in JSON), or
- A **valid 6-digit Indian pincode** (needs **`GOOGLE_MAPS_API_KEY`** or `google-maps` secret for centroid geocoding).

**Note:** If profile has coords but there is **no default `customer_addresses` row**, the server could not infer a point before this change; extend `getCustomerCoordinates` + keep a default address when possible.

## Test plan (production build)

1. **Logged-in user with saved address** (coords or pincode): open vet/grooming style listing (clinic / by-style). Cards should show distance when vendors have lat/lng (or address geocode succeeds).

2. **Logged-in user without saved address** but **location allowed**: first load may request GPS; after grant, listings should refetch and show distance; `customer_latitude` / `customer_longitude` should populate in `localStorage`.

3. **Location denied**, no profile coords: distance appears only if server pincentroid/address fallback works (pincode + Maps key).

4. **API check**: call  
   `GET .../customer/services/by-style?style=at_center&category=vet&customerPhone=<digits>`  
   with and without `latitude`/`longitude`. JSON providers should include non-null `distance` / `distanceKm` when customer and vendor positions are resolvable.
