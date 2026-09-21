export const PRODUCT_TEXT_PREVIEW_MAX = 90;

export function wordTrimProductText(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  let cut = trimmed.slice(0, maxLen).trimEnd();
  const sp = cut.lastIndexOf(' ');
  if (sp > 24) cut = cut.slice(0, sp);
  return cut;
}

export function productTextNeedsViewMore(text: string, maxLen: number = PRODUCT_TEXT_PREVIEW_MAX): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const lines = trimmed.split(/\n/).map((l) => l.trim()).filter(Boolean);
  return lines.length > 2 || trimmed.length > maxLen;
}

export function productTextPreview(text: string, maxLen: number = PRODUCT_TEXT_PREVIEW_MAX): {
  preview: string;
  showViewMore: boolean;
  full: string;
} {
  const full = text.trim();
  const showViewMore = productTextNeedsViewMore(full, maxLen);
  return {
    full,
    showViewMore,
    preview: showViewMore ? `${wordTrimProductText(full, maxLen)}…` : full,
  };
}
