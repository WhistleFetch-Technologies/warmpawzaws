/**
 * Normalize product id from list/detail API rows.
 * Prefer a real UUID when multiple keys exist (some payloads use slug/sku in `id`).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function canonicalProductId(p: Record<string, unknown> | null | undefined): string {
  if (!p || typeof p !== 'object') return '';
  const keys: unknown[] = [
    p.uuid,
    p.product_uuid,
    p.id,
    p.product_id,
    p.productId,
    p._id,
  ];
  for (const raw of keys) {
    if (raw == null) continue;
    const s = String(raw).trim();
    if (s && UUID_RE.test(s)) return s;
  }
  for (const raw of keys) {
    if (raw == null) continue;
    const s = String(raw).trim();
    if (s) return s;
  }
  return '';
}
