/**
 * Repair common UTF-8 ₹ (U+20B9) mojibake when bytes were interpreted as Windows-1252:
 * displays as "â‚¹" (U+00E2 U+201A U+00B9).
 */
const RUPEE = '\u20b9';
const MOJIBAKE_RUPEE = '\u00e2\u201a\u00b9';

export function fixRupeeMojibake(value: string | null | undefined): string {
  if (value == null || typeof value !== 'string') return '';
  if (!value.includes(MOJIBAKE_RUPEE)) return value;
  return value.split(MOJIBAKE_RUPEE).join(RUPEE);
}

export function fixRewardCatalogTextFields<T extends { name?: unknown; description?: unknown }>(
  row: T
): T {
  const name = fixRupeeMojibake(String(row.name ?? ''));
  const description = fixRupeeMojibake(String(row.description ?? ''));
  return { ...row, name, description };
}
