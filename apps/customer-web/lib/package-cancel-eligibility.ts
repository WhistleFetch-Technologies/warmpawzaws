/**
 * Customer may cancel a package parent only before session 1 has started.
 */
export function isPackageCustomerCancelAllowed(booking: {
  isPackage?: boolean;
  is_package?: boolean;
  canCancelPackage?: boolean;
  packageSessionOneStarted?: boolean;
  packageDetails?: {
    sessionOneStarted?: boolean;
    completedSessions?: number;
  } | null;
}): boolean {
  const isPackage = Boolean(
    booking?.isPackage || booking?.is_package || booking?.packageDetails
  );
  if (!isPackage) return true;
  if (booking.canCancelPackage === false) return false;
  if (booking.packageSessionOneStarted || booking.packageDetails?.sessionOneStarted) {
    return false;
  }
  const completed = Number(booking.packageDetails?.completedSessions ?? 0);
  if (Number.isFinite(completed) && completed > 0) return false;
  return true;
}
