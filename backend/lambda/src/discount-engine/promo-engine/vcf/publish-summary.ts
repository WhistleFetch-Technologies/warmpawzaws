import type { Letter, SpendChannel } from './types';

const LETTERS: Letter[] = ['V', 'C', 'F'];
const SPEND: SpendChannel[] = ['tele', 'appointment', 'paybill', 'ecommerce'];

export interface PublishScopeSummary {
  letter: Letter;
  /** Vendor ids for V, service_categories ids for C, empty for F. */
  ids: string[];
  /** Display names saved by admin, aligned with `ids` (falls back to the id). */
  names: string[];
  /** Empty = every payment channel. */
  channels: SpendChannel[];
}

function strings(list: unknown, single: unknown): string[] {
  const raw = [...(Array.isArray(list) ? list : []), single];
  const out: string[] = [];
  for (const item of raw) {
    const s = item == null ? '' : String(item).trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

/** Who a V/C/F promotion is published to, for admin list display and filtering. */
export function summarizePublishScope(
  metadata: Record<string, unknown> | null | undefined
): PublishScopeSummary | null {
  const vcf = metadata?.vcf;
  if (!vcf || typeof vcf !== 'object') return null;
  const publish = (vcf as Record<string, unknown>).publish;
  if (!publish || typeof publish !== 'object') return null;
  const row = publish as Record<string, unknown>;
  const letter = String(row.letter || '').toUpperCase() as Letter;
  if (!LETTERS.includes(letter)) return null;

  const channels = Array.isArray(row.channels)
    ? [...new Set(row.channels.map(String).filter((c): c is SpendChannel => SPEND.includes(c as SpendChannel)))]
    : [];
  if (letter === 'F') return { letter, ids: [], names: [], channels };

  const isVendor = letter === 'V';
  const ids = isVendor
    ? strings(row.vendorIds, row.vendorId)
    : strings(row.categoryIds, row.categoryId);
  const rawNames = isVendor ? row.vendorNames : row.categoryNames;
  const listNames = Array.isArray(rawNames)
    ? rawNames.map((n) => (n == null ? '' : String(n).trim()))
    : [];
  const firstName = String((isVendor ? row.vendorName : row.categoryName) ?? '').trim();
  const names = ids.map((id, i) => listNames[i] || (i === 0 ? firstName : '') || id);
  return { letter, ids, names, channels };
}
