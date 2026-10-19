export const PACKAGE_HAS_BOOKINGS_DELETE_ERROR =
  'This package has existing bookings and cannot be deleted.';

export const SERVICE_HAS_BOOKINGS_DELETE_ERROR =
  'This service has existing bookings and cannot be deleted.';

export function vendorServiceRowIsPackage(metadata: unknown): boolean {
  let meta = metadata;
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta) as unknown;
    } catch {
      return false;
    }
  }
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
  return Boolean((meta as { isPackage?: unknown }).isPackage);
}

/** Any existing booking blocks deletion. Zero bookings allows a hard delete. */
export function vendorServiceDeleteIsBlocked(referencedBookingCount: number): boolean {
  return Number(referencedBookingCount) > 0;
}

export function vendorServiceDeleteBlockMessage(isPackage: boolean): string {
  return isPackage ? PACKAGE_HAS_BOOKINGS_DELETE_ERROR : SERVICE_HAS_BOOKINGS_DELETE_ERROR;
}
