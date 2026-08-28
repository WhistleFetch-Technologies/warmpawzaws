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

export const MIXED_PACKAGE_SERVICE_BOOK_ERROR =
  'Packages must be booked separately from one-off services.';

export function findVendorServiceRowBySelectionId(
  rows: VendorServiceLike[] | null | undefined,
  selectionId: string
): VendorServiceLike | undefined {
  const sid = String(selectionId || '').trim();
  if (!sid || !rows?.length) return undefined;
  return rows.find((r) => {
    const id = r.id != null ? String(r.id) : '';
    const serviceId = r.serviceId != null ? String(r.serviceId) : '';
    return id === sid || serviceId === sid;
  });
}

export function partitionVendorServiceRowsByPackage<T extends VendorServiceLike>(
  rows: T[]
): { packages: T[]; services: T[] } {
  const packages: T[] = [];
  const services: T[] = [];
  for (const row of rows) {
    if (isVendorServicePackageRow(row)) packages.push(row);
    else services.push(row);
  }
  return { packages, services };
}

/** Package vs one-off: selecting a package is single-select; selecting a service drops packages. */
export function toggleExclusivePackageOrServiceSelection(
  current: Set<string>,
  toggledId: string,
  rows: VendorServiceLike[] | null | undefined
): Set<string> {
  const tid = String(toggledId || '').trim();
  if (!tid) return new Set(current);

  if (current.has(tid)) {
    const next = new Set(current);
    next.delete(tid);
    return next;
  }

  const row = findVendorServiceRowBySelectionId(rows, tid);
  if (!row) {
    const next = new Set(current);
    next.add(tid);
    return next;
  }

  if (isVendorServicePackageRow(row)) {
    return new Set([tid]);
  }

  const next = new Set<string>();
  for (const id of current) {
    const existing = findVendorServiceRowBySelectionId(rows, id);
    if (!existing || !isVendorServicePackageRow(existing)) {
      next.add(id);
    }
  }
  next.add(tid);
  return next;
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

  /** vendor_services row id (API `id`); prefer dedicated fields over catalog `serviceId`. */
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const idRaw = (normalized as Record<string, unknown>).id;
  const idStr = idRaw != null ? String(idRaw).trim() : '';
  const catalogSid = String(
    (normalized as Record<string, unknown>).serviceId ??
      (normalized as Record<string, unknown>).service_id ??
      ''
  ).trim();
  const explicitVsid = String(
    (normalized as Record<string, unknown>).vendorServiceId ??
      (normalized as Record<string, unknown>).vendor_service_id ??
      ''
  ).trim();
  const vsid = (
    explicitVsid ||
    (uuidRe.test(idStr) ? idStr : '') ||
    (idStr && idStr !== catalogSid ? idStr : '') ||
    // Package rows occasionally only expose a UUID on serviceId — allow as last resort.
    (Boolean(normalized.isPackage || meta?.isPackage) && uuidRe.test(catalogSid) ? catalogSid : '')
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

const SKIP_PKG_AUTO_REDIRECT_PREFIX = 'wp:skip-pkg-auto:';

/** Session key — skip booking-router package auto-redirect after user backs from purchase-package. */
export function packageAutoRedirectSkipKey(vendorId: string, serviceId: string): string {
  return `${SKIP_PKG_AUTO_REDIRECT_PREFIX}${String(vendorId).trim()}:${String(serviceId).trim()}`;
}

export function markSkipPackageAutoRedirect(vendorId: string, serviceId: string): void {
  if (typeof sessionStorage === 'undefined') return;
  const vid = String(vendorId || '').trim();
  const sid = String(serviceId || '').trim();
  if (!vid || !sid) return;
  sessionStorage.setItem(packageAutoRedirectSkipKey(vid, sid), '1');
}

export function shouldSkipPackageAutoRedirect(vendorId: string, serviceId: string): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  const vid = String(vendorId || '').trim();
  const sid = String(serviceId || '').trim();
  if (!vid || !sid) return false;
  return sessionStorage.getItem(packageAutoRedirectSkipKey(vid, sid)) === '1';
}

export function clearSkipPackageAutoRedirect(vendorId: string, serviceId: string): void {
  if (typeof sessionStorage === 'undefined') return;
  const vid = String(vendorId || '').trim();
  const sid = String(serviceId || '').trim();
  if (!vid || !sid) return;
  sessionStorage.removeItem(packageAutoRedirectSkipKey(vid, sid));
}

/** Booking wizards that only transit to purchase-package — must not remain under package on back. */
export const PACKAGE_PURCHASE_TRANSIT_SCREENS = new Set([
  'walker-booking',
  'vet-booking',
  'grooming-booking',
  'training-booking',
  'boarding-booking',
  'nutritionist-booking',
  'pet-sitter-booking',
]);

export function isPackagePurchaseTransitScreen(screen: string | undefined | null): boolean {
  return PACKAGE_PURCHASE_TRANSIT_SCREENS.has(String(screen || '').trim());
}

/** Drop package-purchase overlay fields; keep vendor profile context for back to provider profile. */
export function stripPackagePurchaseOverlayFields(
  data: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) return null;
  const {
    vendorServiceId: _vsid,
    vendor_service_id: _vsidSnake,
    serviceId: _serviceId,
    serviceName: _serviceName,
    totalSessions: _ts,
    sessionsPerDay: _spd,
    sessions_per_day: _spdSnake,
    sessionIntervalDays: _sid,
    session_interval_days: _sidSnake,
    packageType: _pt,
    packageDetails: _pd,
    ...rest
  } = data;
  return Object.keys(rest).length > 0 ? rest : null;
}
