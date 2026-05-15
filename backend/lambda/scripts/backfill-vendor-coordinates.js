/**
 * Backfill latitude / longitude on the `vendors` table for every active
 * vendor that is missing coordinates. Distance computation in customer
 * discovery (clinic list, by-style, by-problem, search) requires the
 * vendor row to expose lat/lng — when both are NULL, customer cards
 * render without a distance line.
 *
 * The script:
 *   1. Selects every non-deleted vendor with NULL latitude or longitude.
 *   2. Tries Google Geocoding on the full address (address + city + state
 *      + pincode) — accurate to street level.
 *   3. Falls back to the Indian pincode centroid when the address
 *      geocode is unavailable or returns no result.
 *   4. Writes the resolved coordinates back to the row.
 *
 * Requires `GOOGLE_MAPS_API_KEY` in `.env.local`, **or** AWS credentials plus
 * the `warmpawz/<stage>/google-maps` secret (same pattern as Lambda `geocode.ts`).
 *
 * Usage:
 *   node scripts/backfill-vendor-coordinates.js              # dry-run
 *   node scripts/backfill-vendor-coordinates.js --apply      # write to DB
 *   node scripts/backfill-vendor-coordinates.js --apply --limit 50
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { Pool } = require('pg');

const APPLY = process.argv.includes('--apply');
const limitArgIdx = process.argv.indexOf('--limit');
const LIMIT =
  limitArgIdx >= 0 && process.argv[limitArgIdx + 1]
    ? parseInt(process.argv[limitArgIdx + 1], 10)
    : 1000;

/** Same resolution order as `src/lib/utils/geocode.ts`: env, then Secrets Manager. */
async function resolveGoogleMapsApiKey() {
  const fromEnv = (process.env.GOOGLE_MAPS_API_KEY || '').trim();
  if (fromEnv) return fromEnv;

  try {
    const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
    const STAGE_RAW = process.env.ENVIRONMENT || process.env.STAGE || process.env.NODE_ENV || 'dev';
    const STAGE =
      STAGE_RAW === 'production' ? 'prod' : STAGE_RAW === 'development' ? 'dev' : STAGE_RAW;
    const region = process.env.AWS_REGION || 'ap-south-1';
    const client = new SecretsManagerClient({ region });

    const readSecret = async (secretId) => {
      const res = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
      const s = res.SecretString;
      if (!s) return null;
      try {
        const j = JSON.parse(s);
        return j.apiKey || j.api_key || j.key || null;
      } catch {
        return s.trim() || null;
      }
    };

    const candidates = [
      `warmpawz/${STAGE}/google-maps`,
      `warmpawz/dev/google-maps`,
      `warmpawz/${STAGE}/google-maps/api-key`,
      `warmpawz/dev/google-maps/api-key`,
    ];
    for (const id of candidates) {
      try {
        const key = await readSecret(id);
        if (key) {
          console.log(`[backfill] Using Google Maps API key from Secrets Manager: ${id}`);
          return key;
        }
      } catch (e) {
        if (e?.name !== 'ResourceNotFoundException' && e?.name !== 'InvalidRequestException') {
          console.warn(`[backfill] Secret ${id}:`, e?.message || e);
        }
      }
    }
  } catch (e) {
    console.warn('[backfill] Secrets Manager unavailable:', e?.message || e);
  }
  return null;
}

async function geocode(apiKey, query) {
  if (!apiKey) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    query
  )}&key=${apiKey}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.status !== 'OK' || !data.results?.[0]) return null;
    const loc = data.results[0].geometry?.location;
    if (loc?.lat == null || loc?.lng == null) return null;
    return { lat: parseFloat(String(loc.lat)), lng: parseFloat(String(loc.lng)) };
  } catch (err) {
    console.warn('  ! geocode failed:', err.message || err);
    return null;
  }
}

async function geocodePincode(apiKey, pin) {
  if (!apiKey) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?components=${encodeURIComponent(
    `country:IN|postal_code:${pin}`
  )}&key=${apiKey}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.status !== 'OK' || !data.results?.[0]) return null;
    const loc = data.results[0].geometry?.location;
    if (loc?.lat == null || loc?.lng == null) return null;
    return { lat: parseFloat(String(loc.lat)), lng: parseFloat(String(loc.lng)) };
  } catch (err) {
    console.warn('  ! pincode geocode failed:', err.message || err);
    return null;
  }
}

async function main() {
  const apiKey = await resolveGoogleMapsApiKey();
  if (!apiKey) {
    console.error(
      'ERROR: No Google Maps API key found. Set GOOGLE_MAPS_API_KEY in backend/lambda/.env.local,\n' +
        'or configure AWS credentials and the warmpawz/<stage>/google-maps secret (same as Lambda runtime).'
    );
    process.exit(1);
  }

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    const { rows: vendors } = await pool.query(
      `SELECT id, business_name, address, city, state, pincode, latitude, longitude
         FROM vendors
        WHERE COALESCE(is_deleted, false) = false
          AND (latitude IS NULL OR longitude IS NULL)
        ORDER BY created_at DESC
        LIMIT $1`,
      [LIMIT]
    );

    console.log(`Found ${vendors.length} vendor(s) missing coordinates.`);
    console.log(`Mode: ${APPLY ? 'APPLY (writing to DB)' : 'DRY-RUN (no writes)'}\n`);

    let success = 0;
    let skipped = 0;
    for (const v of vendors) {
      const parts = [];
      const seen = new Set();
      const push = (raw) => {
        if (raw == null) return;
        const s = String(raw).trim();
        if (!s) return;
        const key = s.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        parts.push(s);
      };
      push(v.address);
      push(v.city);
      push(v.state);
      const pinDigits = String(v.pincode || '').replace(/\D/g, '');
      if (pinDigits.length === 6) push(pinDigits);
      push('India');
      const fullAddress = parts.join(', ');

      console.log(`• ${v.business_name || v.id}: "${fullAddress}"`);

      let coords = null;
      if (parts.length > 1) {
        coords = await geocode(apiKey, fullAddress);
      }
      if (!coords && pinDigits.length === 6) {
        coords = await geocodePincode(apiKey, pinDigits);
        if (coords) console.log('  ↳ used pincode centroid');
      }

      if (!coords) {
        console.log('  ↳ no coordinates resolved (skipping)');
        skipped++;
        continue;
      }

      console.log(`  ↳ lat=${coords.lat}, lng=${coords.lng}`);
      success++;

      if (APPLY) {
        await pool.query(
          `UPDATE vendors SET latitude = $1, longitude = $2, updated_at = NOW() WHERE id = $3`,
          [coords.lat, coords.lng, v.id]
        );
      }

      // Light throttling so we don't burst the Geocoding API quota.
      await new Promise((r) => setTimeout(r, 120));
    }

    console.log('\n────────────────────────────────────────');
    console.log(`Resolved : ${success}`);
    console.log(`Skipped  : ${skipped}`);
    console.log(`Total    : ${vendors.length}`);
    if (!APPLY) {
      console.log('\nRe-run with --apply to persist the resolved coordinates.');
    }
  } catch (err) {
    console.error('ERROR:', err.message || err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
