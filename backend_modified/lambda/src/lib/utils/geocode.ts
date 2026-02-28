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
  if (process.env.GOOGLE_MAPS_API_KEY) {
    _apiKeyCache = process.env.GOOGLE_MAPS_API_KEY;
    return _apiKeyCache;
  }
  try {
    const { getSecret, getSecretJson } = await import('../../utils/secrets-manager');
    const secretJson = await getSecretJson<{ apiKey?: string; api_key?: string; key?: string }>('google-maps');
    if (secretJson?.apiKey) _apiKeyCache = secretJson.apiKey;
    if (!(_apiKeyCache) && secretJson?.api_key) _apiKeyCache = secretJson.api_key;
    if (!(_apiKeyCache) && secretJson?.key) _apiKeyCache = secretJson.key;
    if (!(_apiKeyCache)) {
      const key = await getSecret('google-maps/api-key');
      if (key) _apiKeyCache = key;
    }
  } catch {
    // ignore
  }
  return _apiKeyCache || '';
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
