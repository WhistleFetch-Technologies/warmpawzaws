const TEMPLATE_SPEC_DIM_KEYS = new Set([
  'length_cm',
  'breadth_cm',
  'height_cm',
  'length',
  'breadth',
  'height',
  'width',
]);

const PLACEHOLDER_SPEC_VALUES = new Set(['null', 'undefined']);

/** True when a product spec value should be shown on the customer PDP. */
export function isMeaningfulProductSpecValue(value: unknown): boolean {
  if (value == null) return false;
  if (value === 0) return false;
  const trimmed = String(value).trim();
  if (!trimmed) return false;
  return !PLACEHOLDER_SPEC_VALUES.has(trimmed.toLowerCase());
}

/** Format a spec value for display; returns empty string when not meaningful. */
export function displayProductSpecValue(value: unknown): string {
  if (!isMeaningfulProductSpecValue(value)) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Non-dimension specification entries suitable for template/inline display. */
export function meaningfulSpecEntries(
  specifications: Record<string, unknown> | undefined,
): [string, unknown][] {
  if (
    !specifications ||
    typeof specifications !== 'object' ||
    Array.isArray(specifications)
  ) {
    return [];
  }
  return Object.entries(specifications).filter(([key, value]) => {
    if (TEMPLATE_SPEC_DIM_KEYS.has(key)) return false;
    return isMeaningfulProductSpecValue(value);
  });
}
