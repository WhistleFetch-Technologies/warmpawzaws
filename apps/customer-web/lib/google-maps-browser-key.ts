import { apiClient } from '@/lib/api-client';

let cachedApiKey: string | null = null;

/**
 * Google Maps browser key for Geocoding / script load when NEXT_PUBLIC is unset.
 * Keys are normally provided by GET /config/google-maps-key (Secrets / DB / env on API).
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
    // allow retry on next call
  }
  return null;
}
