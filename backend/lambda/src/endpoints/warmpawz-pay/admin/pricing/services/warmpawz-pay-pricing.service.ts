import { PRICING_STATUS } from '../../../constants/merchant-pricing';
import type {
  CreatePricingInput,
  IMerchantPricingRepository,
  PricingRow,
  PricingRowWithMerchant,
  UpdatePricingInput,
  WpayPublishTierRow,
} from '../../../repositories/interfaces/IMerchantPricingRepository';
import { merchantPricingRepository } from '../../../repositories/merchant-pricing.repository';
import {
  resolveMerchantCategory,
  serviceCategoryFromRoleConfig,
} from '../../../shared/merchant/merchant-category.resolver';
import { resolveMerchantDisplayName } from '../../../shared/merchant/merchant-display-name.resolver';
import type { CreatePricingRequest, UpdatePricingRequest } from '../dto/pricing.requests';
import { PricingErrorCode } from '../dto/pricing.errors';
import type {
  DisablePricingResultDTO,
  PricingDetailDTO,
} from '../dto/pricing.responses';
import {
  PricingAuditService,
  toPricingAuditEntity,
  PricingAuditPersistenceError,
} from './pricing-audit.service';

export const WARMPAWZ_PAY_PRICING_LOG_PREFIX = '[warmpawz-pay-pricing]';

export class PricingAdminError extends Error {
  readonly code: PricingErrorCode;

  constructor(code: PricingErrorCode, message: string) {
    super(message);
    this.name = 'PricingAdminError';
    this.code = code;
  }
}

export function assertDiscountBelowCommission(discountValue: number, commissionRate: number): void {
  if (!(discountValue < commissionRate)) {
    throw new PricingAdminError(
      PricingErrorCode.VALIDATION_ERROR,
      `Discount must be strictly less than the selected tier commission (${commissionRate}%).`,
    );
  }
}

function assertWpayPublishTier(tier: WpayPublishTierRow | null): WpayPublishTierRow {
  if (!tier) {
    throw new PricingAdminError(PricingErrorCode.VALIDATION_ERROR, 'WPay tier not found');
  }
  if (!tier.isActive || !tier.warmpawzPayEnabled) {
    throw new PricingAdminError(
      PricingErrorCode.VALIDATION_ERROR,
      'Selected tier is not an active Warmpawz Pay tier',
    );
  }
  return tier;
}

function assertEffectiveDates(from: Date, until: Date | null): void {
  if (until && until.getTime() < from.getTime()) {
    throw new PricingAdminError(
      PricingErrorCode.VALIDATION_ERROR,
      'Effective until must be on or after effective from',
    );
  }
}

export class WarmpawzPayPricingService {
  constructor(
    private readonly pricingRepository: IMerchantPricingRepository = merchantPricingRepository,
    private readonly auditService: PricingAuditService = new PricingAuditService(),
  ) {}

  async getPricingByMerchantId(merchantId: string): Promise<PricingDetailDTO | null> {
    const row = await this.pricingRepository.findByVendorId(merchantId);
    return row ? this.mapDetail(row) : null;
  }

  async createPricing(
    input: CreatePricingRequest,
    adminUserId: string,
  ): Promise<PricingDetailDTO> {
    const catalogue = await this.pricingRepository.assertCatalogueVendor(input.vendorId);
    if (!catalogue) {
      throw new PricingAdminError(
        PricingErrorCode.VENDOR_NOT_IN_CATALOGUE,
        'Merchant must be in the Warmpawz Pay catalogue before pricing can be configured',
      );
    }

    const existing = await this.pricingRepository.findRowByVendorId(input.vendorId);
    if (existing) {
      throw new PricingAdminError(
        PricingErrorCode.DUPLICATE_PRICING,
        'Pricing already exists for this merchant. Use update instead.',
      );
    }

    const tier = assertWpayPublishTier(await this.pricingRepository.findWpayPublishTier(input.tierId));
    assertDiscountBelowCommission(input.discountValue, tier.commissionRate);

    const effectiveFrom = new Date(input.effectiveFrom);
    const effectiveUntil = input.effectiveUntil ? new Date(input.effectiveUntil) : null;
    assertEffectiveDates(effectiveFrom, effectiveUntil);

    if (input.status === PRICING_STATUS.ACTIVE) {
      await this.assertNoActiveConflict(input.vendorId);
    }

    const createInput: CreatePricingInput = {
      vendorId: input.vendorId,
      tierId: tier.id,
      discountType: input.discountType,
      discountValue: input.discountValue,
      platformWithholdPercent: 0,
      status: input.status,
      effectiveFrom,
      effectiveUntil,
      createdBy: adminUserId,
    };

    let inserted: PricingRow;
    try {
      inserted = await this.pricingRepository.insert(createInput, catalogue.catalogueId);
      await this.auditService.logCreated(toPricingAuditEntity(inserted), adminUserId);
    } catch (error) {
      throw this.mapMutationError(error);
    }

    const detail = await this.pricingRepository.findByVendorId(input.vendorId);
    if (!detail) {
      throw new PricingAdminError(
        PricingErrorCode.PRICING_NOT_FOUND,
        'Pricing not found after creation',
      );
    }

    return this.mapDetail(detail);
  }

  async updatePricing(
    merchantId: string,
    input: UpdatePricingRequest,
    adminUserId: string,
  ): Promise<PricingDetailDTO> {
    const existing = await this.pricingRepository.findRowByVendorId(merchantId);
    if (!existing) {
      throw new PricingAdminError(
        PricingErrorCode.PRICING_NOT_FOUND,
        'Pricing configuration not found for this merchant',
      );
    }

    const previousEntity = toPricingAuditEntity(existing);

    const effectiveFrom = input.effectiveFrom
      ? new Date(input.effectiveFrom)
      : existing.effectiveFrom;
    const effectiveUntil =
      input.effectiveUntil !== undefined
        ? input.effectiveUntil
          ? new Date(input.effectiveUntil)
          : null
        : existing.effectiveUntil;

    assertEffectiveDates(effectiveFrom, effectiveUntil);

    const nextStatus = input.status ?? existing.status;
    if (nextStatus === PRICING_STATUS.ACTIVE && existing.status !== PRICING_STATUS.ACTIVE) {
      await this.assertNoActiveConflict(merchantId);
    }

    const nextTierId = input.tierId ?? existing.tierId;
    if (!nextTierId) {
      throw new PricingAdminError(
        PricingErrorCode.VALIDATION_ERROR,
        'A WPay-enabled tier is required to update pricing',
      );
    }
    const tier = assertWpayPublishTier(await this.pricingRepository.findWpayPublishTier(nextTierId));
    const nextDiscount = input.discountValue ?? existing.discountValue;
    assertDiscountBelowCommission(nextDiscount, tier.commissionRate);

    const updateInput: UpdatePricingInput = {
      tierId: nextTierId,
      discountType: input.discountType,
      discountValue: input.discountValue,
      status: input.status,
      effectiveFrom: input.effectiveFrom ? effectiveFrom : undefined,
      effectiveUntil: input.effectiveUntil !== undefined ? effectiveUntil : undefined,
    };

    let updated: PricingRow | null;
    try {
      updated = await this.pricingRepository.update(merchantId, updateInput);
      if (!updated) {
        throw new PricingAdminError(
          PricingErrorCode.PRICING_NOT_FOUND,
          'Pricing configuration not found for this merchant',
        );
      }

      const currentEntity = toPricingAuditEntity(updated);
      if (input.status === PRICING_STATUS.ACTIVE && existing.status !== PRICING_STATUS.ACTIVE) {
        await this.auditService.logEnabled(currentEntity, adminUserId);
      } else if (input.status === PRICING_STATUS.DISABLED && existing.status !== PRICING_STATUS.DISABLED) {
        await this.auditService.logDisabled(previousEntity, adminUserId);
      } else {
        await this.auditService.logUpdated(previousEntity, currentEntity, adminUserId);
      }
    } catch (error) {
      throw this.mapMutationError(error);
    }

    const detail = await this.pricingRepository.findByVendorId(merchantId);
    if (!detail) {
      throw new PricingAdminError(
        PricingErrorCode.PRICING_NOT_FOUND,
        'Pricing not found after update',
      );
    }

    return this.mapDetail(detail);
  }

  async disablePricing(
    merchantId: string,
    adminUserId: string,
  ): Promise<DisablePricingResultDTO> {
    const existing = await this.pricingRepository.findRowByVendorId(merchantId);
    if (!existing) {
      throw new PricingAdminError(
        PricingErrorCode.PRICING_NOT_FOUND,
        'Pricing configuration not found for this merchant',
      );
    }

    if (existing.status === PRICING_STATUS.DISABLED) {
      return { disabled: true, vendorId: merchantId };
    }

    try {
      const disabled = await this.pricingRepository.disable(merchantId);
      if (!disabled) {
        throw new PricingAdminError(
          PricingErrorCode.PRICING_NOT_FOUND,
          'Pricing configuration not found for this merchant',
        );
      }
      await this.auditService.logDeleted(toPricingAuditEntity(existing), adminUserId);
    } catch (error) {
      throw this.mapMutationError(error);
    }

    return { disabled: true, vendorId: merchantId };
  }

  private async assertNoActiveConflict(vendorId: string): Promise<void> {
    const hasActive = await this.pricingRepository.hasActiveConfiguredPricing(vendorId);
    if (hasActive) {
      throw new PricingAdminError(
        PricingErrorCode.ACTIVE_PRICING_CONFLICT,
        'Merchant already has an active pricing configuration',
      );
    }
  }

  private mapDetail(row: PricingRowWithMerchant): PricingDetailDTO {
    const category = resolveMerchantCategory({
      roleCategory: row.roleCategory,
      customerService: row.customerService,
      serviceCategory: serviceCategoryFromRoleConfig(row.roleConfig),
      legacyCategory: row.legacyCategory,
    });

    const displayName = resolveMerchantDisplayName({
      businessName: row.businessName,
      ownerName: row.ownerName,
      vendorType: row.vendorType,
      isSoloProvider: row.isSoloProvider,
      roleName: row.roleName,
    });

    const commissionRate = row.commissionRate;
    const platformMargin =
      commissionRate != null ? Math.round((commissionRate - row.discountValue) * 100) / 100 : null;

    return {
      pricingId: row.id,
      vendorId: row.vendorId,
      merchantName: displayName,
      businessName: displayName,
      category,
      tierId: row.tierId,
      tierName: row.tierDisplayName ?? row.tierName,
      commissionRate,
      discountType: row.discountType,
      discountValue: row.discountValue,
      platformMargin,
      platformWithholdPercent: row.platformWithholdPercent,
      status: row.status,
      effectiveFrom: row.effectiveFrom.toISOString(),
      effectiveUntil: row.effectiveUntil ? row.effectiveUntil.toISOString() : null,
      updatedAt: row.updatedAt.toISOString(),
      catalogueId: row.catalogueId,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
    };
  }

  private mapMutationError(error: unknown): PricingAdminError {
    if (error instanceof PricingAdminError) {
      return error;
    }
    if (error instanceof PricingAuditPersistenceError) {
      return new PricingAdminError(
        PricingErrorCode.AUDIT_PERSISTENCE_ERROR,
        'Failed to persist audit record',
      );
    }

    const pgCode =
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof (error as { code: unknown }).code === 'string'
        ? (error as { code: string }).code
        : null;

    if (pgCode === '23505') {
      return new PricingAdminError(
        PricingErrorCode.ACTIVE_PRICING_CONFLICT,
        'Only one active pricing configuration is allowed per merchant',
      );
    }

    return new PricingAdminError(
      PricingErrorCode.VALIDATION_ERROR,
      error instanceof Error ? error.message : 'Pricing operation failed',
    );
  }
}
