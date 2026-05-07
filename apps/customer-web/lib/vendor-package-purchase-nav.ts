/**
 * Detect vendor_services rows sold as multi-session bundles (metadata.isPackage + packageDetails).
 * Used to route customers to purchase-package → PackageBookingPage instead of one-off booking.
 */

export type VendorServiceLike = Record<string, unknown>;

function parseMetadataIfString(meta: unknown): Record<string, unknown> | undefined {
  if (meta == null) return undefined;
  if (typeof meta === 'object' && !Array.isArray(meta)) return meta as Record<string, unknown>;
  if (typeof meta === 'string') {
    try {
      const p = JSON.parse(meta) as unknown;
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

/** Merge JSON-string metadata + top-level fields so package detection matches PackageBookingPage. */
export function normalizeVendorServiceRowForPackage(row: VendorServiceLike | null | undefined): VendorServiceLike {
  if (!row || typeof row !== 'object') return {};
  const m = parseMetadataIfString(row.metadata);
  if (!m) return { ...row };
  return {
    ...row,
    metadata: m,
    isPackage: row.isPackage ?? m.isPackage,
    packageDetails: row.packageDetails ?? m.packageDetails,
    packageType: row.packageType ?? m.packageType,
  };
}

export function isVendorServicePackageRow(row: VendorServiceLike | null | undefined): boolean {
  const r = normalizeVendorServiceRowForPackage(row);
  if (!r || typeof r !== 'object') return false;
  if (Boolean(r.isPackage)) return true;
  const meta = r.metadata;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const m = meta as Record<string, unknown>;
    if (Boolean(m.isPackage)) return true;
    if (String(m.type ?? '').toLowerCase() === 'package') return true;
    const pt = m.packageType;
    if (pt !== undefined && pt !== null && String(pt).trim() !== '') return true;
    const mpd = m.packageDetails;
    if (mpd && typeof mpd === 'object' && !Array.isArray(mpd)) {
      const mp = mpd as Record<string, unknown>;
      if (Number(mp.totalSessions ?? mp.total_sessions) > 0) return true;
      if (Number(mp.packagePrice ?? mp.price ?? 0) > 0) return true;
    }
  }
  const pd = r.packageDetails;
  if (pd && typeof pd === 'object' && !Array.isArray(pd)) {
    const p = pd as Record<string, unknown>;
    const ts = Number(p.totalSessions ?? p.total_sessions);
    if (Number.isFinite(ts) && ts > 0) return true;
    const pr = Number(p.packagePrice ?? p.price ?? 0);
    if (Number.isFinite(pr) && pr > 0) return true;
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

  const normalized = normalizeVendorServiceRowForPackage(serviceRow);

  const meta =
    normalized.metadata && typeof normalized.metadata === 'object' && !Array.isArray(normalized.metadata)
      ? (normalized.metadata as Record<string, unknown>)
      : undefined;
  const pkg =
    (normalized.packageDetails as Record<string, unknown> | undefined) ||
    (meta?.packageDetails as Record<string, unknown> | undefined);

  const totalSessions =
    Number(pkg?.totalSessions ?? pkg?.total_sessions ?? normalized.totalSessions ?? 1) || 1;
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
    Number(pkg?.price ?? pkg?.packagePrice ?? normalized.price ?? normalized.custom_price ?? 0) || 0;
  const duration =
    Number(
      normalized.duration ??
        normalized.duration_minutes ??
        normalized.durationMinutes ??
        60
    ) || 60;
  const name = String(
    normalized.serviceName ?? normalized.name ?? normalized.service_name ?? 'Package'
  ).trim();

  /** vendor_services row id (API `id`); clinic UI may set only `vendorServiceId` when `id` is catalog `serviceId`. */
  const idRaw = (normalized as Record<string, unknown>).id;
  const idStr = idRaw != null ? String(idRaw).trim() : '';
  const idLooksUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      idStr
    );
  const vsid = String(
    (normalized as Record<string, unknown>).vendorServiceId ??
      (normalized as Record<string, unknown>).vendor_service_id ??
      (idLooksUuid ? idStr : '')
  ).trim();
  if (!vsid) return null;

  const serviceStyle = String(
    styleOpt ?? normalized.serviceStyle ?? normalized.service_style ?? 'at_home'
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
    description: String(normalized.description ?? ''),
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
