import type { PricingAuditAction } from '../../constants/merchant-pricing';

export interface PricingAuditRecord {
  readonly auditId: string;
  readonly pricingId: string;
  readonly vendorId: string;
  readonly action: PricingAuditAction;
  readonly performedBy: string;
  readonly performedAt: Date;
  readonly metadata?: Record<string, unknown>;
  readonly oldValue?: Record<string, unknown>;
  readonly newValue?: Record<string, unknown>;
}

export interface CreatePricingAuditInput {
  readonly pricingId: string;
  readonly vendorId: string;
  readonly action: PricingAuditAction;
  readonly performedBy: string;
  readonly metadata?: Record<string, unknown>;
  readonly oldValue?: Record<string, unknown>;
  readonly newValue?: Record<string, unknown>;
}

export interface IPricingAuditRepository {
  insert(input: CreatePricingAuditInput): Promise<PricingAuditRecord>;
}
