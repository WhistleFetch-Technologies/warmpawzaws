export type MerchantBusinessType = 'Solo' | 'Business' | 'Center';

export interface MerchantBusinessTypeInput {
  readonly vendorType?: string | null;
  readonly isSoloProvider?: boolean | null;
  readonly roleName?: string | null;
}

export function resolveMerchantBusinessType(
  input: MerchantBusinessTypeInput,
): MerchantBusinessType {
  const roleName = String(input.roleName ?? '').toLowerCase();
  if (roleName.includes('center') || roleName.endsWith('_center')) {
    return 'Center';
  }

  const vendorType = String(input.vendorType ?? '').toLowerCase();
  if (vendorType === 'solo' || input.isSoloProvider === true) {
    return 'Solo';
  }

  if (vendorType === 'business') {
    return 'Business';
  }

  if (roleName.includes('solo')) {
    return 'Solo';
  }

  return 'Business';
}

export function isMerchantBusinessTypeResolved(
  businessType: MerchantBusinessType,
): boolean {
  return businessType === 'Solo' || businessType === 'Business' || businessType === 'Center';
}
