/**
 * True when package session #1 for this purchase has started or finished (vendor cannot decline parent).
 */
export function isPackageSessionOneStarted(packagePurchaseId: string, bookings: readonly any[]): boolean {
  const pid = String(packagePurchaseId || '').trim();
  if (!pid) return false;
  return bookings.some((b: any) => {
    if (String(b.packagePurchaseId ?? b.package_purchase_id ?? '').trim() !== pid) return false;
    if (!Boolean(b.isPackageSession ?? b.is_package_session)) return false;
    const sessionNo = Number(b.packageSessionNumber ?? b.package_session_number ?? 0);
    if (sessionNo !== 1) return false;
    const st = String(b.status ?? '').toLowerCase();
    const hasStartedStamp = Boolean(
      b.sessionStartedAt ?? b.session_started_at ?? b.startedAt ?? b.started_at
    );
    return (
      hasStartedStamp ||
      ['in_progress', 'arrived', 'completed', 'active', 'service_started', 'started'].includes(st)
    );
  });
}
