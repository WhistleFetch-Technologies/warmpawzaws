export type PlatformStatus =
  | 'Approved'
  | 'Pending'
  | 'Suspended'
  | 'Inactive'
  | 'Deleted';

export interface MerchantPlatformStatusInput {
  readonly vendorStatus?: string | null;
  readonly isActive?: boolean | null;
  readonly isDeleted?: boolean | null;
}

export function resolvePlatformStatus(
  input: MerchantPlatformStatusInput,
): PlatformStatus {
  if (input.isDeleted === true) {
    return 'Deleted';
  }

  const status = String(input.vendorStatus ?? '').toLowerCase();

  if (status === 'suspended') {
    return 'Suspended';
  }

  if (status === 'pending') {
    return 'Pending';
  }

  if (input.isActive === false || status === 'inactive') {
    return 'Inactive';
  }

  if (status === 'approved' || status === 'active') {
    return 'Approved';
  }

  if (status.length > 0) {
    return 'Pending';
  }

  return 'Inactive';
}

export function isPlatformApproved(input: MerchantPlatformStatusInput): boolean {
  return resolvePlatformStatus(input) === 'Approved';
}
