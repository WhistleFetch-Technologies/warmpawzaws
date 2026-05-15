/**
 * Customer-facing label for pet care article categories.
 * Admin/CMS may still store legacy `marketing`; the app shows "General".
 */
export function getCustomerArticleCategoryLabel(category: string | undefined | null): string {
  if (category == null) return '';
  const raw = String(category).trim();
  if (!raw) return '';
  if (raw.toLowerCase() === 'marketing') return 'General';
  return raw;
}
