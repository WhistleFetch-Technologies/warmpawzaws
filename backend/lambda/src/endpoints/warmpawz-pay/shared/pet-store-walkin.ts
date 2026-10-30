export const PET_STORE_WALKIN_ROLE = 'pet_store_walkin';

export const WPAY_BILL_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export function isPetStoreWalkinRole(roleName?: string | null): boolean {
  return String(roleName || '').trim().toLowerCase() === PET_STORE_WALKIN_ROLE;
}

export function readBillImageKey(breakup: Record<string, unknown> | null | undefined): string | null {
  if (!breakup) return null;
  const key = String(breakup.billImageKey ?? '').trim();
  return key || null;
}

export function readBillVerifiedAt(breakup: Record<string, unknown> | null | undefined): string | null {
  if (!breakup) return null;
  const at = String(breakup.billVerifiedAt ?? '').trim();
  return at || null;
}
