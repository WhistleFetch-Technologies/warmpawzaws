/**
 * Shared package-row detection for vendor_services (metadata.isPackage / packageDetails).
 * Used by pricing lock exception, discovery price keep, and Pay package eligibility.
 */

export function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function isVendorServicePackageRow(row: Record<string, unknown> | null | undefined): boolean {
  if (!row) return false;
  if (Boolean(row.isPackage ?? row.is_package)) return true;

  const meta = parseJsonObject(row.metadata);
  if (meta) {
    if (Boolean(meta.isPackage)) return true;
    if (String(meta.type ?? '').toLowerCase() === 'package') return true;
    const pt = meta.packageType;
    if (pt != null && String(pt).trim() !== '') return true;
    const details = parseJsonObject(meta.packageDetails);
    if (details) {
      const sessions = Number(details.totalSessions ?? details.total_sessions);
      if (Number.isFinite(sessions) && sessions > 0) return true;
      const price = Number(details.packagePrice ?? details.price ?? 0);
      if (Number.isFinite(price) && price > 0) return true;
    }
  }

  const topDetails = parseJsonObject(row.packageDetails);
  if (topDetails) {
    const sessions = Number(topDetails.totalSessions ?? topDetails.total_sessions);
    if (Number.isFinite(sessions) && sessions > 0) return true;
  }

  return false;
}

export function isVendorServicePackagePayload(body: Record<string, unknown> | null | undefined): boolean {
  if (!body) return false;
  if (Boolean(body.isPackage ?? body.is_package)) return true;
  const details = parseJsonObject(body.packageDetails) || parseJsonObject(body.package_details);
  if (details && Number(details.totalSessions ?? details.total_sessions) > 0) return true;
  const meta = parseJsonObject(body.metadata);
  if (meta && Boolean(meta.isPackage)) return true;
  return isVendorServicePackageRow(body);
}

export const WARMPAWZ_PAY_PACKAGE_COMMERCE_MODE = 'warmpawz_pay' as const;
export const MARKETPLACE_PACKAGE_COMMERCE_MODE = 'marketplace' as const;

export type PackageCommerceMode =
  | typeof WARMPAWZ_PAY_PACKAGE_COMMERCE_MODE
  | typeof MARKETPLACE_PACKAGE_COMMERCE_MODE;

export function normalizePackageCommerceMode(raw: unknown): PackageCommerceMode {
  return String(raw ?? '').trim().toLowerCase() === WARMPAWZ_PAY_PACKAGE_COMMERCE_MODE
    ? WARMPAWZ_PAY_PACKAGE_COMMERCE_MODE
    : MARKETPLACE_PACKAGE_COMMERCE_MODE;
}
