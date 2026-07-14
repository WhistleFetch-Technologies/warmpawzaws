/**
 * Parse JSON blobs embedded in booking notes (wp_promo_meta, wp_financial_meta, etc.).
 * Uses brace-depth parsing so nested objects are handled correctly.
 */
export function parseJsonMetaFromNotes(
  notes: unknown,
  prefix: string
): Record<string, unknown> | null {
  if (!notes || typeof notes !== 'string') return null;
  const marker = `${prefix}:`;
  const idx = notes.indexOf(marker);
  if (idx < 0) return null;
  const slice = notes.slice(idx + marker.length);
  const brace = slice.indexOf('{');
  if (brace < 0) return null;
  let depth = 0;
  for (let i = brace; i < slice.length; i++) {
    if (slice[i] === '{') depth++;
    else if (slice[i] === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(slice.slice(brace, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
