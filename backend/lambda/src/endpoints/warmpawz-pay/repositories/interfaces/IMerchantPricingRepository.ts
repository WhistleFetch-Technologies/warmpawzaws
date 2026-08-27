import type {
  PricingDiscountType,
  PricingStatus,
} from '../../constants/merchant-pricing';

export interface WpayPublishTierRow {
  readonly id: string;
  readonly tierName: string;
  readonly displayName: string;
  readonly commissionRate: number;
  readonly isActive: boolean;
  readonly warmpawzPayEnabled: boolean;
}

export interface PricingRow {
  readonly id: string;
  readonly vendorId: string;
  readonly catalogueId: string | null;
  readonly tierId: string | null;
  readonly tierName: string | null;
  readonly tierDisplayName: string | null;
  readonly commissionRate: number | null;
  readonly discountType: PricingDiscountType;
  readonly discountValue: number;
  readonly platformWithholdPercent: number;
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
  readonly vendorType: string | null;
  readonly roleName: string | null;
  readonly isSoloProvider: boolean;
  readonly legacyCategory: string | null;
  readonly roleCategory: string | null;
  readonly customerService: string | null;
  readonly roleConfig: unknown;
}

export interface CreatePricingInput {
  readonly vendorId: string;
  readonly tierId: string;
  readonly discountType: PricingDiscountType;
  readonly discountValue: number;
  readonly platformWithholdPercent: number;
  readonly status: PricingStatus;
  readonly effectiveFrom: Date;
  readonly effectiveUntil: Date | null;
  readonly createdBy: string | null;
}

export interface UpdatePricingInput {
  readonly tierId?: string;
  readonly discountType?: PricingDiscountType;
  readonly discountValue?: number;
  readonly platformWithholdPercent?: number;
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

  findWpayPublishTier(tierId: string): Promise<WpayPublishTierRow | null>;
}
