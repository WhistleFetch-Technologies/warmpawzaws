import type { MerchantBusinessTypeInput } from './merchant-business-type.resolver';

export interface MerchantDisplayNameInput extends MerchantBusinessTypeInput {
  readonly businessName?: string | null;
  readonly ownerName?: string | null;
}

const PLACEHOLDER_NAMES = new Set(['business', 'vendor']);

function normalizeName(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isPlaceholderMerchantName(name: string | null | undefined): boolean {
  const normalized = normalizeName(name);
  if (!normalized) {
    return true;
  }
  return PLACEHOLDER_NAMES.has(normalized.toLowerCase());
}

/** @deprecated Use isPlaceholderMerchantName */
export const isPlaceholderBusinessName = isPlaceholderMerchantName;

export function resolveMerchantDisplayName(input: MerchantDisplayNameInput): string {
  const businessName = normalizeName(input.businessName);
  const ownerName = normalizeName(input.ownerName);

  if (businessName && !isPlaceholderMerchantName(businessName)) {
    return businessName;
  }
  if (ownerName && !isPlaceholderMerchantName(ownerName)) {
    return ownerName;
  }

  return 'Unknown';
}
