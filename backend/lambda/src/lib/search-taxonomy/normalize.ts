/** Collapse whitespace and lowercase for phrase matching. */
export function normalizeSearchPhrase(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Stable slug from spreadsheet Category column (logic key). */
export function slugifyCategoryLabel(label: string | null | undefined): string {
  return normalizeSearchPhrase(label)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
