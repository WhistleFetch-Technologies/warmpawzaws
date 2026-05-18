import { getApiBaseUrl } from '@/lib/api-client';

/**
 * Meal/media URLs from the API are often absolute S3 URLs but may be stored as
 * site-relative paths (e.g. `/uploads/...`). The customer app is served from
 * CloudFront/S3, so relative paths must be resolved against the API gateway host.
 */
export function resolveCustomerPublicAssetUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  const base = getApiBaseUrl().replace(/\/+$/, '');
  if (s.startsWith('/')) return `${base}${s}`;
  return `${base}/${s.replace(/^\/+/, '')}`;
}
