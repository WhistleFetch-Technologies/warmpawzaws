export type PlatformStatus =
  | 'Approved'
  | 'Pending'
  | 'Suspended'
  | 'Inactive'
  | 'Deleted';

export type WarmpawzAppointmentsStatus = 'Draft' | 'Published' | 'Hidden';

export type MerchantBusinessType = 'Solo' | 'Business' | 'Center';

export type ReadinessSeverity = 'blocker' | 'warning';

export interface ReadinessCheck {
  readonly key: string;
  readonly label: string;
  readonly passed: boolean;
  readonly severity: ReadinessSeverity;
  readonly detail?: string;
}

export interface MerchantReadiness {
  readonly checks: readonly ReadinessCheck[];
  readonly blockersPassed: number;
  readonly blockersTotal: number;
  readonly readyForAppointments: boolean;
}

export function formatReadinessScore(readiness: MerchantReadiness): string {
  return `${readiness.blockersPassed}/${readiness.blockersTotal}`;
}
