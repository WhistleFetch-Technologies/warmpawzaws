/**
 * URL safe for <img src>. Rejects bare S3 keys that render as a broken "?".
 */
export function sanitizeDisplayImageUrl(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  if (!s || s === 'null' || s === 'undefined' || s === 'NaN') return undefined;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^\/\//.test(s)) return `https:${s}`;
  if (s.startsWith('data:') || s.startsWith('blob:')) return s;
  return undefined;
}
