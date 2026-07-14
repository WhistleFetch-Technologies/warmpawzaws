import type { DiscountDomain } from '../enums/discount-domain';
import type { DiscountTrigger } from '../enums/discount-trigger';

export interface RecordDiscountUsageParams {
  discountId: string;
  customerId: string;
  domain: DiscountDomain;
  trigger: DiscountTrigger;
  referenceId: string;
  referenceType: 'booking' | 'order' | 'cart';
  discountAmount: number;
  metadata?: Record<string, unknown>;
}

export interface CountDiscountUsageParams {
  discountId: string;
  customerId: string;
  domain: DiscountDomain;
  vendorId?: string;
}

/**
 * Tracks discount usage limits and audit trail.
 * Phase 4+ will wire legacy usage recorders.
 */
export interface UsageTracker {
  recordUsage(params: RecordDiscountUsageParams): Promise<void>;
  countPriorUsage(params: CountDiscountUsageParams): Promise<number>;
}
