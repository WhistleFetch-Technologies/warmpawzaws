/**
 * Geocoding APIs sometimes append the postal code to {@code administrative_area_level_1}
 * even when a separate {@code postal_code} exists (e.g. "Karnataka 560068").
 * Strip that trailing duplicate only when it matches the parsed pincode digits.
 */
export function stripDuplicatePincodeFromState(
  state: string | null | undefined,
  pincode: string | null | undefined
): string {
  const s = typeof state === 'string' ? state.trim() : '';
  if (!s) return '';
  const pc = String(pincode ?? '').replace(/\D/g, '');
  if (pc.length < 4) return s;
  if (!s.endsWith(pc)) return s;
  const prefix = s.slice(0, s.length - pc.length);
  if (!prefix.trim()) return s;
  const last = prefix.charAt(prefix.length - 1);
  if (!/[\s,;\-–—]/.test(last)) return s;
  return prefix.replace(/[\s,;\-–—]+$/g, '').trimEnd();
}
