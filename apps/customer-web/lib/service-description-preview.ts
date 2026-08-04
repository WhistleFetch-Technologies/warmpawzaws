/** Below this length (collapsed to one line) we skip “View more” unless >2 newline lines. */
export const SERVICE_DESC_VIEW_MORE_MIN_LEN = 48;

/**
 * Max characters in the preview slice before `…` for long single-line copy.
 * Leave room for inline “ View more”.
 */
export const SERVICE_DESC_PREVIEW_CHAR_MAX = 66;

/**
 * Safer inline preview cap so preview + “ View more” fit in ~2 lines on narrow cards.
 */
export const SERVICE_DESC_INLINE_PREVIEW_MAX = 54;

/** Remove trailing runs of `.` / `…` from vendor copy so we don’t get `....` plus our `…`. */
export function stripTrailingEllipsisDots(s: string): string {
  return s.replace(/(?:\.{2,}|…)+$/gu, '').trimEnd();
}

export function countNonEmptyLines(text: string): number {
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
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
  /** Collapsed single-line copy (for measurement / truncation). */
  compact: string;
  /** Line count after stripping trailing ellipsis. */
  lineCount: number;
};

/** Heuristic: catalogue lists (>2 newline lines) or long collapsed copy needs “View more”. */
export function shouldShowServiceDescriptionViewMore(stripped: string, compact: string): boolean {
  if (!compact) return false;
  if (countNonEmptyLines(stripped) > 2) return true;
  return compact.length > SERVICE_DESC_VIEW_MORE_MIN_LEN;
}

function buildTruncatedPreview(compact: string): string {
  const maxLen = Math.min(SERVICE_DESC_PREVIEW_CHAR_MAX, SERVICE_DESC_INLINE_PREVIEW_MAX);
  if (compact.length <= maxLen) return compact;
  return `${wordTrimServiceDescription(compact, maxLen)}…`;
}

/**
 * Preview for service cards: plain text + optional `…` (no CSS line-clamp next to “View more”).
 */
export function buildServiceDescriptionPreview(raw: string): ServiceDescriptionPreview {
  const modalText = raw.trim();
  if (!modalText) {
    return { preview: '', showViewMore: false, modalText: '', compact: '', lineCount: 0 };
  }

  const stripped = stripTrailingEllipsisDots(modalText).trim();
  const compact = stripped.replace(/\s+/g, ' ').trim();
  const lineCount = countNonEmptyLines(stripped);
  const showViewMore = shouldShowServiceDescriptionViewMore(stripped, compact);

  if (!showViewMore) {
    return { preview: stripped, showViewMore: false, modalText, compact, lineCount };
  }

  return {
    preview: buildTruncatedPreview(compact),
    showViewMore: true,
    modalText,
    compact,
    lineCount,
  };
}
