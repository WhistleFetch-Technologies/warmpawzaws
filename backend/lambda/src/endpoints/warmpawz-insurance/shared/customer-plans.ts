import { isTerminalInsuranceStatus, normalizeInsuranceStatus } from '@warmpawz/shared-types';

export interface CustomerPlanCandidate {
  readonly id: string;
  readonly status: string;
  readonly companyActive: boolean;
  readonly readyVendorCount: number;
}

export function isCustomerVisiblePlan(plan: CustomerPlanCandidate): boolean {
  return plan.status === 'published' && plan.companyActive && plan.readyVendorCount >= 1;
}

export function openApplicationBlocksAnother(status: string | null | undefined): boolean {
  const normalized = normalizeInsuranceStatus(status);
  if (!normalized) return false;
  return !isTerminalInsuranceStatus(normalized);
}
