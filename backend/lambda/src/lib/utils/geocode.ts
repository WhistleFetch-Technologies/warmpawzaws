/**
 * Google Maps Geocoding utility
 * Converts address text to latitude/longitude using Google Geocoding API
 */

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
}

let _apiKeyCache: string | null = null;
async function getApiKey(): Promise<string> {
  if (_apiKeyCache) return _apiKeyCache;

  // Tier 1: direct env var (fastest, no network call)
  if (process.env.GOOGLE_MAPS_API_KEY) {
    _apiKeyCache = process.env.GOOGLE_MAPS_API_KEY;
    return _apiKeyCache;
  }

  try {
    const { getSecret, getSecretJson } = await import('../../utils/aws/secrets-manager');

    // Tier 2: fetch by secret ARN when the env var is provided (avoids name-construction ambiguity)
    const secretArn = process.env.GOOGLE_MAPS_SECRET_ARN;
    if (secretArn) {
      const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
      const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'ap-south-1' });
      try {
        const resp = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
        if (resp.SecretString) {
          const parsed = JSON.parse(resp.SecretString) as { apiKey?: string; api_key?: string; key?: string };
          _apiKeyCache = parsed.apiKey || parsed.api_key || parsed.key || null;
          if (_apiKeyCache) return _apiKeyCache;
        }
      } catch (arnErr: any) {
        console.warn('[Geocode] GOOGLE_MAPS_SECRET_ARN fetch failed:', arnErr?.message);
      }
    }

    // Tier 3: fetch by conventional name (warmpawz/{stage}/google-maps)
    const secretJson = await getSecretJson<{ apiKey?: string; api_key?: string; key?: string }>('google-maps');
    if (secretJson?.apiKey) _apiKeyCache = secretJson.apiKey;
    if (!_apiKeyCache && secretJson?.api_key) _apiKeyCache = secretJson.api_key;
    if (!_apiKeyCache && secretJson?.key) _apiKeyCache = secretJson.key;
    if (!_apiKeyCache) {
      const key = await getSecret('google-maps/api-key');
      if (key) _apiKeyCache = key;
    }
  } catch (err: any) {
    console.warn('[Geocode] getApiKey Secrets Manager lookup failed:', err?.message);
  }

  if (!_apiKeyCache) {
    console.warn(
      '[Geocode] No Google Maps API key found. ' +
      'Set GOOGLE_MAPS_API_KEY env var on the Lambda, or ensure the secret at ' +
      `GOOGLE_MAPS_SECRET_ARN (${process.env.GOOGLE_MAPS_SECRET_ARN ?? 'unset'}) / ` +
      'warmpawz/{stage}/google-maps contains an apiKey / api_key / key field.'
    );
  }

  return _apiKeyCache || '';
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
