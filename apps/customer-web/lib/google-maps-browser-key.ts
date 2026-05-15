import { apiClient } from '@/lib/api-client';

let cachedApiKey: string | null = null;

function isLocalCustomerWebHost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '[::1]' ||
    h.endsWith('.localhost')
  );
}

/**
 * Google Maps browser key for Geocoding / script load when NEXT_PUBLIC is unset.
 * Keys are normally provided by GET /config/google-maps-key (Secrets / DB / env on API).
 *
 * On localhost, if that request fails or returns no key, falls back to
 * NEXT_PUBLIC_GOOGLE_MAPS_API_KEY so autocomplete works in local dev without Lambda config.
 */
export async function getGoogleMapsBrowserApiKey(): Promise<string | null> {
  if (cachedApiKey) return cachedApiKey;
  try {
    const r = await apiClient.get<{ apiKey?: string; error?: string }>('/config/google-maps-key');
    if (r?.apiKey && !r.error) {
      cachedApiKey = r.apiKey;
      return cachedApiKey;
    }
  } catch {
    // allow retry on next call unless localhost env fallback applies below
  }

  const envKey =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.trim()
      : '';
  if (isLocalCustomerWebHost() && envKey) {
    console.warn(
      '[Google Maps] Using NEXT_PUBLIC_GOOGLE_MAPS_API_KEY on localhost (no usable key from /config/google-maps-key).'
    );
    cachedApiKey = envKey;
    return cachedApiKey;
  }

  return null;
}
