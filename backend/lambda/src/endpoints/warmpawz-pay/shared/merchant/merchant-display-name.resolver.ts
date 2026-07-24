import {
  resolveMerchantBusinessType,
  type MerchantBusinessTypeInput,
} from './merchant-business-type.resolver';

export interface MerchantDisplayNameInput extends MerchantBusinessTypeInput {
  readonly businessName?: string | null;
  readonly ownerName?: string | null;
}

const PLACEHOLDER_BUSINESS_NAMES = new Set(['business', 'vendor']);

function normalizeName(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isPlaceholderBusinessName(name: string | null | undefined): boolean {
  const normalized = normalizeName(name);
  if (!normalized) {
    return true;
  }
  return PLACEHOLDER_BUSINESS_NAMES.has(normalized.toLowerCase());
}

export function resolveMerchantDisplayName(input: MerchantDisplayNameInput): string {
  const businessName = normalizeName(input.businessName);
  const ownerName = normalizeName(input.ownerName);
  const businessType = resolveMerchantBusinessType(input);

  if (businessType === 'Solo' && isPlaceholderBusinessName(businessName)) {
    return ownerName ?? businessName ?? 'Unknown';
  }

  return businessName ?? ownerName ?? 'Unknown';
}
