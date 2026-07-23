import {
  PRICING_STATUS,
  type PricingDiscountType,
  type PricingStatus,
} from '../constants/merchant-pricing';

export interface PricingRow {
  readonly id: string;
  readonly vendorId: string;
  readonly catalogueId: string | null;
  readonly discountType: PricingDiscountType;
  readonly discountValue: number;
  readonly status: PricingStatus;
  readonly effectiveFrom: Date;
  readonly effectiveUntil: Date | null;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PricingRowWithMerchant extends PricingRow {
  readonly businessName: string;
  readonly ownerName: string | null;
  readonly legacyCategory: string | null;
  readonly roleCategory: string | null;
  readonly customerService: string | null;
  readonly roleConfig: unknown;
}

export interface CreatePricingInput {
  readonly vendorId: string;
  readonly discountType: PricingDiscountType;
  readonly discountValue: number;
  readonly status: PricingStatus;
  readonly effectiveFrom: Date;
  readonly effectiveUntil: Date | null;
  readonly createdBy: string | null;
}

export interface UpdatePricingInput {
  readonly discountType?: PricingDiscountType;
  readonly discountValue?: number;
  readonly status?: PricingStatus;
  readonly effectiveFrom?: Date;
  readonly effectiveUntil?: Date | null;
}

export interface IMerchantPricingRepository {
  findByVendorId(vendorId: string): Promise<PricingRowWithMerchant | null>;

  findRowByVendorId(vendorId: string): Promise<PricingRow | null>;

  insert(input: CreatePricingInput, catalogueId: string | null): Promise<PricingRow>;

  update(vendorId: string, input: UpdatePricingInput): Promise<PricingRow | null>;

  disable(vendorId: string): Promise<PricingRow | null>;

  hasActiveConfiguredPricing(vendorId: string): Promise<boolean>;

  getActiveConfiguredVendorIds(vendorIds: readonly string[]): Promise<ReadonlySet<string>>;

  getAverageActiveDiscountPercent(): Promise<number>;

  assertCatalogueVendor(vendorId: string): Promise<{ catalogueId: string } | null>;
}
