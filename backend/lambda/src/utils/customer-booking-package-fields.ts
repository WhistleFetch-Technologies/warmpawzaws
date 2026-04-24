/**
 * Shared package enrichment for customer (and admin) booking list/detail rows.
 * Used by customer-booking-history and GET /customer/bookings?phone= for parity.
 */

export const SQL_PACKAGE_PURCHASE_JOIN = `
LEFT JOIN package_purchases pp ON pp.id = b.package_purchase_id`;

/** Aliased package_purchases columns (avoid collisions with b.*). */
export const SQL_PACKAGE_PURCHASE_SELECT = `
       pp.package_name AS pkg_pp_name,
       pp.total_sessions AS pkg_total_sessions,
       pp.remaining_sessions AS pkg_remaining_sessions,
       (pp.unlimited_usage IS TRUE) AS pkg_unlimited_usage`;

/**
 * Build additive package fields for customer booking list/detail responses.
 * Aligns with customer-web MyBookings / AppointmentDetails (packageDetails, isPackage).
 */
export function packageFieldsFromBookingRow(b: any) {
  const packagePurchaseId = b.package_purchase_id ?? null;
  const isPackageSession = Boolean(b.is_package_session);
  const isPackage = Boolean(packagePurchaseId || isPackageSession);
  const unlimited = Boolean(b.pkg_unlimited_usage);
  const totalSessionsNum =
    b.pkg_total_sessions != null && b.pkg_total_sessions !== ''
      ? Number(b.pkg_total_sessions)
      : null;
  const remainingSessionsNum =
    b.pkg_remaining_sessions != null && b.pkg_remaining_sessions !== ''
      ? Number(b.pkg_remaining_sessions)
      : null;
  const packageName = b.pkg_pp_name != null ? String(b.pkg_pp_name) : null;

  let packageDetails: Record<string, unknown> | undefined;
  if (packagePurchaseId) {
    const completedSessions =
      totalSessionsNum != null && remainingSessionsNum != null
        ? Math.max(0, totalSessionsNum - remainingSessionsNum)
        : 0;
    packageDetails = {
      packagePurchaseId,
      packageName: packageName || undefined,
      totalSessions: totalSessionsNum ?? undefined,
      remainingSessions:
        unlimited
          ? 'unlimited'
          : remainingSessionsNum != null
            ? remainingSessionsNum
            : undefined,
      completedSessions,
      unlimited,
      packageSessionNumber:
        b.package_session_number != null ? Number(b.package_session_number) : undefined,
    };
  }

  return {
    package_purchase_id: packagePurchaseId,
    packagePurchaseId,
    is_package_session: isPackageSession,
    isPackageSession,
    is_package: isPackage,
    isPackage,
    package_session_number:
      b.package_session_number != null ? Number(b.package_session_number) : undefined,
    packageSessionNumber:
      b.package_session_number != null ? Number(b.package_session_number) : undefined,
    ...(packageDetails ? { package_details: packageDetails, packageDetails } : {}),
  };
}
