/** Below this length (collapsed to one line) we skip “View more”. */
export const SERVICE_DESC_VIEW_MORE_MIN_LEN = 48;

/**
 * Max characters in the preview slice before `…` (~2 lines on a narrow card).
 * Leave room for inline “ View more”.
 */
export const SERVICE_DESC_PREVIEW_CHAR_MAX = 66;

/** Remove trailing runs of `.` / `…` from vendor copy so we don’t get `....` plus our `…`. */
export function stripTrailingEllipsisDots(s: string): string {
  return s.replace(/(?:\.{2,}|…)+$/gu, '').trimEnd();
}

export function wordTrimServiceDescription(singleLine: string, maxLen: number): string {
  if (singleLine.length <= maxLen) return singleLine;
  let cut = singleLine.slice(0, maxLen).trimEnd();
  const sp = cut.lastIndexOf(' ');
  if (sp > 20) cut = cut.slice(0, sp);
  return cut;
}

export type ServiceDescriptionPreview = {
  preview: string;
  showViewMore: boolean;
  /** Full text for modal / expand — trimmed original. */
  modalText: string;
};

/**
 * Preview for service cards: plain text + optional `…` (no CSS line-clamp next to “View more”).
 */
export function buildServiceDescriptionPreview(raw: string): ServiceDescriptionPreview {
  const modalText = raw.trim();
  if (!modalText) return { preview: '', showViewMore: false, modalText: '' };

  const stripped = stripTrailingEllipsisDots(modalText).trim();
  const compact = stripped.replace(/\s+/g, ' ').trim();

  if (compact.length <= SERVICE_DESC_VIEW_MORE_MIN_LEN) {
    return { preview: stripped, showViewMore: false, modalText };
  }

  if (compact.length <= SERVICE_DESC_PREVIEW_CHAR_MAX) {
    return { preview: compact, showViewMore: true, modalText };
  }

  const cut = wordTrimServiceDescription(compact, SERVICE_DESC_PREVIEW_CHAR_MAX);
  return { preview: `${cut}…`, showViewMore: true, modalText };
}
