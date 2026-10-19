/** Session progress for a purchased package. Completed means finished sessions only. */

export type PackageProgressInput = {
  totalSessions: number;
  completedSessions: number;
  remainingSessions?: number;
  unlimited?: boolean;
  status?: string;
};

export function packageProgressPercent(input: PackageProgressInput): number {
  if (input.unlimited) return 0;
  const total = Number(input.totalSessions) || 0;
  if (total <= 0) return 0;
  const completed = Math.max(0, Number(input.completedSessions) || 0);
  const pct = (completed / total) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export type PackageCardStatus = 'Active' | 'In Progress' | 'Completed' | 'Expired' | 'Cancelled';

/** Active only while sessions remain and the purchase has not expired or been cancelled. */
export function packageCardStatus(input: PackageProgressInput): PackageCardStatus {
  const status = String(input.status || 'active').toLowerCase();
  if (status === 'cancelled' || status === 'canceled') return 'Cancelled';
  if (status === 'expired') return 'Expired';
  if (input.unlimited) {
    return (Number(input.completedSessions) || 0) > 0 ? 'In Progress' : 'Active';
  }
  const total = Number(input.totalSessions) || 0;
  const completed = Math.max(0, Number(input.completedSessions) || 0);
  const remaining =
    input.remainingSessions == null
      ? Math.max(0, total - completed)
      : Math.max(0, Number(input.remainingSessions) || 0);
  if (
    status === 'exhausted' ||
    status === 'completed' ||
    status === 'used_up' ||
    (total > 0 && remaining <= 0)
  ) {
    return 'Completed';
  }
  if (completed > 0) return 'In Progress';
  return 'Active';
}

export function isPackageCountedActive(input: PackageProgressInput): boolean {
  const label = packageCardStatus(input);
  return label === 'Active' || label === 'In Progress';
}
