/**
 * Normalize session count from `service_packages` rows.
 * Vendors create packages with `session_count` (POST /vendor/:id/packages),
 * while older code paths read `total_sessions`; columns vary by migration.
 */

export function isServicePackageUnlimited(pkg: unknown): boolean {
  if (!pkg || typeof pkg !== 'object') return false;
  const p = pkg as Record<string, unknown>;
  if (p.unlimited_usage === true || p.unlimitedUsage === true) return true;
  const sc = Number(p.session_count ?? p.sessionCount);
  return Number.isFinite(sc) && sc < 0;
}

export function resolveServicePackageDisplayName(pkg: unknown): string {
  if (!pkg || typeof pkg !== 'object') return 'Package';
  const p = pkg as Record<string, unknown>;
  const n = String(p.name ?? p.package_name ?? p.packageName ?? '').trim();
  return n || 'Package';
}

/**
 * Positive session count for a finite package. Use 0 when unlimited.
 * Defaults to 1 only when the row has no usable session field (legacy rows).
 */
export function resolveFiniteSessionCountFromServicePackage(pkg: unknown): number {
  if (!pkg || typeof pkg !== 'object') return 1;
  if (isServicePackageUnlimited(pkg)) return 0;
  const p = pkg as Record<string, unknown>;
  let meta: Record<string, unknown> | null = null;
  const rawMeta = p.metadata ?? p.package_metadata;
  if (rawMeta && typeof rawMeta === 'string') {
    try {
      meta = JSON.parse(rawMeta) as Record<string, unknown>;
    } catch {
      meta = null;
    }
  } else if (rawMeta && typeof rawMeta === 'object') {
    meta = rawMeta as Record<string, unknown>;
  }
  const details = meta?.packageDetails ?? meta?.package_details;
  const fromMeta =
    details && typeof details === 'object'
      ? (details as Record<string, unknown>).totalSessions ??
        (details as Record<string, unknown>).total_sessions ??
        (details as Record<string, unknown>).sessionCount ??
        (details as Record<string, unknown>).session_count
      : undefined;
  const raw =
    p.total_sessions ??
    p.totalSessions ??
    p.session_count ??
    p.sessionCount ??
    p.sessions_included ??
    p.sessionsIncluded ??
    p.sessions_count ??
    p.sessionsCount ??
    fromMeta;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.min(Math.floor(n), 365);
  return 1;
}
