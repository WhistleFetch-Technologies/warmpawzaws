/**
 * Google Maps Geocoding utility
 * Converts address text to latitude/longitude using Google Geocoding API
 */

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
}

/**
 * Resolve the Google Maps API key for server-side geocoding. Order:
 *   1. `GOOGLE_MAPS_API_KEY` env var (local dev / explicit override).
 *   2. `GOOGLE_MAPS_SECRET_ARN` env var → fetch directly by ARN (preferred in prod;
 *      avoids relying on STAGE-derived name lookup).
 *   3. `warmpawz/<stage>/google-maps` secret JSON ({apiKey|api_key|key}) or bare string.
 *   4. `warmpawz/<stage>/google-maps/api-key` secret string.
 *
 * Caches the resolved key for the lifetime of the Lambda container. We deliberately
 * do NOT cache an empty result so a fix in Secrets Manager is picked up on the next
 * invocation without a cold start.
 */
let _apiKeyCache: string | null = null;

function pickKeyFromSecretJson(parsed: unknown): string {
  if (!parsed || typeof parsed !== 'object') return '';
  const obj = parsed as { apiKey?: unknown; api_key?: unknown; key?: unknown };
  const candidates = [obj.apiKey, obj.api_key, obj.key];
  for (const v of candidates) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

async function getApiKey(): Promise<string> {
  if (_apiKeyCache) return _apiKeyCache;

  const envKey = (process.env.GOOGLE_MAPS_API_KEY || '').trim();
  if (envKey) {
    _apiKeyCache = envKey;
    return _apiKeyCache;
  }

  // 2. Direct ARN lookup — covers prod where Lambda env points GOOGLE_MAPS_SECRET_ARN
  // at the actual ARN. More reliable than relying on STAGE → name composition.
  const directArn = (process.env.GOOGLE_MAPS_SECRET_ARN || '').trim();
  if (directArn) {
    try {
      const { SecretsManagerClient, GetSecretValueCommand } = await import(
        '@aws-sdk/client-secrets-manager'
      );
      const client = new SecretsManagerClient({
        region: process.env.AWS_REGION || 'ap-south-1',
      });
      const res = await client.send(new GetSecretValueCommand({ SecretId: directArn }));
      const raw = (res.SecretString || '').trim();
      if (raw) {
        let pickedKey = '';
        try {
          pickedKey = pickKeyFromSecretJson(JSON.parse(raw));
        } catch {
          // not JSON — treat the whole value as the key (bare string secret)
          pickedKey = raw;
        }
        if (pickedKey) {
          _apiKeyCache = pickedKey;
          return _apiKeyCache;
        }
        console.warn(
          `[Geocode] Secret ${directArn} is reachable but contains no api key (apiKey/api_key/key all empty). ` +
            `Update the secret value to a valid Google Maps API key.`
        );
      } else {
        console.warn(`[Geocode] Secret ${directArn} returned an empty SecretString.`);
      }
    } catch (err) {
      console.warn(
        '[Geocode] Could not read GOOGLE_MAPS_SECRET_ARN secret:',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // 3 + 4. Fall back to STAGE-derived name lookups.
  try {
    const { getSecret, getSecretJson } = await import('../../utils/aws/secrets-manager');
    const secretJson = await getSecretJson<{ apiKey?: string; api_key?: string; key?: string }>(
      'google-maps'
    );
    const fromJson = pickKeyFromSecretJson(secretJson);
    if (fromJson) {
      _apiKeyCache = fromJson;
      return _apiKeyCache;
    }
    if (secretJson != null) {
      console.warn(
        "[Geocode] warmpawz/<stage>/google-maps secret exists but has no usable api key " +
          "(apiKey/api_key/key fields all empty). Update the secret value."
      );
    }
    const key = (await getSecret('google-maps/api-key'))?.trim();
    if (key) {
      _apiKeyCache = key;
      return _apiKeyCache;
    }
  } catch (err) {
    console.warn(
      '[Geocode] Secret lookup for google-maps failed:',
      err instanceof Error ? err.message : String(err)
    );
  }

  return '';
}

/**
 * Resolve an Indian postal code (6 digits) to its approximate centroid using Google Geocoding.
 * Returns null when the API key is unavailable or geocoding fails.
 */
export async function geocodeIndiaPincode(pincode: string): Promise<GeocodeResult | null> {
  const pin = String(pincode ?? '').replace(/\D/g, '');
  if (pin.length !== 6) return null;

  const apiKey = await getApiKey();
  if (!apiKey) {
    console.warn('[Geocode] No API key for pincode geocode');
    return null;
  }

  try {
    const components = encodeURIComponent(`country:IN|postal_code:${pin}`);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?components=${components}&key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const data = await response.json();
    if (data.status !== 'OK' || !data.results?.[0]) return null;

    const loc = data.results[0].geometry?.location;
    if (loc?.lat == null || loc?.lng == null) return null;

    return {
      latitude: parseFloat(String(loc.lat)),
      longitude: parseFloat(String(loc.lng)),
      formattedAddress: data.results[0].formatted_address,
    };
  } catch (err) {
    console.warn('[Geocode] Pincode geocode failed:', (err as Error).message);
    return null;
  }
}

/**
 * Geocode an address string to coordinates
 * Returns null if geocoding fails or API key unavailable
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const trimmed = (address || '').toString().trim();
  if (!trimmed) return null;

  const apiKey = await getApiKey();
  if (!apiKey) {
    console.warn('[Geocode] No Google Maps API key available');
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(trimmed)}&key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s to avoid Lambda timeout
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const data = await response.json();
    if (data.status !== 'OK' || !data.results?.[0]) return null;

    const result = data.results[0];
    const loc = result.geometry?.location;
    if (!loc?.lat || !loc?.lng) return null;

    return {
      latitude: parseFloat(loc.lat),
      longitude: parseFloat(loc.lng),
      formattedAddress: result.formatted_address,
    };
  } catch (err) {
    console.warn('[Geocode] Failed:', (err as Error).message);
    return null;
  }
}
