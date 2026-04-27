/**
 * Detect vendor_services rows sold as multi-session bundles (metadata.isPackage + packageDetails).
 * Used to route customers to purchase-package → PackageBookingPage instead of one-off booking.
 */

export type VendorServiceLike = Record<string, unknown>;

export function isVendorServicePackageRow(row: VendorServiceLike | null | undefined): boolean {
  if (!row || typeof row !== 'object') return false;
  if (Boolean(row.isPackage)) return true;
  const meta = row.metadata;
  if (meta && typeof meta === 'object' && !Array.isArray(meta) && Boolean((meta as Record<string, unknown>).isPackage)) {
    return true;
  }
  const pd = row.packageDetails;
  if (pd && typeof pd === 'object' && !Array.isArray(pd)) {
    const ts = Number((pd as Record<string, unknown>).totalSessions ?? (pd as Record<string, unknown>).total_sessions);
    if (Number.isFinite(ts) && ts > 0) return true;
  }
  return false;
}

/**
 * Payload for CustomerHomeWrapper `purchase-package`: must match walkerServiceData fields used there.
 * `vendorServiceId` = vendor_services.id (UUID in API).
 */
export function buildWalkerServiceDataForVendorPackagePurchase(opts: {
  vendorId: string;
  vendorName?: string;
  serviceRow: VendorServiceLike;
  serviceTypeCategory: string;
  serviceStyle?: string;
}): Record<string, unknown> | null {
  const { vendorId, vendorName, serviceRow, serviceTypeCategory, serviceStyle: styleOpt } = opts;
  const vid = String(vendorId || '').trim();
  if (!vid) return null;

  const meta =
    serviceRow.metadata && typeof serviceRow.metadata === 'object' && !Array.isArray(serviceRow.metadata)
      ? (serviceRow.metadata as Record<string, unknown>)
      : undefined;
  const pkg =
    (serviceRow.packageDetails as Record<string, unknown> | undefined) ||
    (meta?.packageDetails as Record<string, unknown> | undefined);

  const totalSessions =
    Number(pkg?.totalSessions ?? pkg?.total_sessions ?? serviceRow.totalSessions ?? 1) || 1;
  const sessionsPerDay = Math.max(
    1,
    Math.min(
      24,
      Number(
        pkg?.sessionsPerDay ??
          pkg?.sessions_per_day ??
          meta?.sessionsPerDay ??
          meta?.sessions_per_day
      ) || 1
    )
  );
  const sessionIntervalDays = Math.max(
    1,
    Number(
      pkg?.sessionIntervalDays ??
        pkg?.session_interval_days ??
        pkg?.frequencyDays ??
        meta?.sessionIntervalDays ??
        meta?.frequencyDays
    ) || 7
  );
  const price =
    Number(pkg?.price ?? pkg?.packagePrice ?? serviceRow.price ?? serviceRow.custom_price ?? 0) || 0;
  const duration =
    Number(serviceRow.duration ?? serviceRow.duration_minutes ?? serviceRow.durationMinutes ?? 60) || 60;
  const name = String(
    serviceRow.serviceName ?? serviceRow.name ?? serviceRow.service_name ?? 'Package'
  ).trim();

  /** vendor_services row id (API `id`); clinic UI may set only `vendorServiceId` when `id` is catalog `serviceId`. */
  const vsid = String(
    (serviceRow as Record<string, unknown>).vendorServiceId ?? serviceRow.id ?? ''
  ).trim();
  if (!vsid) return null;

  const serviceStyle = String(
    styleOpt ?? serviceRow.serviceStyle ?? serviceRow.service_style ?? 'at_home'
  ).trim() || 'at_home';

  const out: Record<string, unknown> = {
    vendorId: vid,
    vendorServiceId: vsid,
    serviceName: name,
    totalSessions,
    sessionsPerDay,
    sessionIntervalDays,
    price,
    duration,
    serviceType: serviceTypeCategory,
    serviceStyle,
    description: String(serviceRow.description ?? ''),
  };
  if (vendorName) out.walker = { name: vendorName };
  return out;
}

/** Map UniversalServicesByStyle / profile role to backend-friendly serviceType hint (catalog category). */
export function serviceTypeCategoryFromRoleId(roleId: string | undefined): string {
  const r = String(roleId || '').toLowerCase();
  if (r.includes('vet') || r === 'veterinarian') return 'vet';
  if (r.includes('groom')) return 'grooming';
  if (r.includes('train')) return 'training';
  if (r.includes('walk')) return 'walking';
  if (r.includes('board') || r.includes('sitt')) return 'boarding';
  if (r.includes('nutrition')) return 'nutrition';
  return 'walking';
}
