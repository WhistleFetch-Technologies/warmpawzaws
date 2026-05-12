/**
 * Geocoding APIs sometimes append the postal code to {@code administrative_area_level_1}
 * even when a separate {@code postal_code} exists (e.g. "Karnataka 560102").
 * - When {@code pincode} is known: strip it from the end of {@code state} only if separated by punctuation/space.
 * - When {@code pincode} is missing but state ends like {@code "Name 560102"} (India 6-digit PIN), strip that tail
 *   only if it matches {@code pincode} when provided, or when pincode is empty (common bad rows from older saves).
 */
export function stripDuplicatePincodeFromState(
  state: string | null | undefined,
  pincode: string | null | undefined
): string {
  const s = typeof state === 'string' ? state.trim() : '';
  if (!s) return '';
  const pc = String(pincode ?? '').replace(/\D/g, '');

  const stripKnownDigits = (digits: string): string | null => {
    if (digits.length < 4 || !s.endsWith(digits)) return null;
    const prefix = s.slice(0, s.length - digits.length);
    if (!prefix.trim()) return null;
    const last = prefix.charAt(prefix.length - 1);
    if (!/[\s,;\-–—]/.test(last)) return null;
    return prefix.replace(/[\s,;\-–—]+$/g, '').trimEnd();
  };

  if (pc.length >= 4) {
    const out = stripKnownDigits(pc);
    if (out != null) return out;
  }

  const in6 = s.match(/^(.+?)\s+(\d{6})$/);
  if (in6) {
    const digits = in6[2];
    if (!pc || digits === pc) {
      return in6[1].trim();
    }
  }

  return s;
}
