import type { MerchantListQuery } from '../dto/merchants.requests';
import type { MerchantListDataDTO, MerchantListItemDTO } from '../dto/merchants.responses';
import type {
  IMerchantAdminRepository,
  MerchantAdminRow,
} from '../../../repositories/interfaces/IMerchantAdminRepository';
import { merchantAdminRepository } from '../../../repositories/merchant-admin.repository';
import { evaluateMerchant } from '../../../shared/merchant/merchant-readiness.service';

export const WARMPAWZ_PAY_MERCHANTS_LOG_PREFIX = '[warmpawz-pay-merchants]';

export class MerchantListLoadError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'MerchantListLoadError';
    this.cause = cause;
  }
}

export class WarmpawzPayMerchantsService {
  constructor(
    private readonly merchantRepository: IMerchantAdminRepository = merchantAdminRepository,
  ) {}

  async listMerchants(query: MerchantListQuery): Promise<MerchantListDataDTO> {
    const filters = {
      page: query.page,
      pageSize: query.pageSize,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      q: query.q,
      category: query.category,
      businessType: query.businessType,
      platformStatus: query.platformStatus,
      warmpawzPayStatus: query.warmpawzPayStatus,
      customerVisible: query.customerVisible,
    };

    try {
      const [rows, total] = await Promise.all([
        this.merchantRepository.listMerchants(filters),
        this.merchantRepository.countMerchants(filters),
      ]);

      return {
        items: rows.map((row) => this.mapMerchantListItem(row)),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
        },
      };
    } catch (error) {
      throw new MerchantListLoadError('Failed to load merchants', error);
    }
  }

  private mapMerchantListItem(row: MerchantAdminRow): MerchantListItemDTO {
    const evaluation = evaluateMerchant({
      publishStatus: row.publishStatus,
      vendorStatus: row.vendorStatus,
      isActive: row.isActive,
      isOnline: row.isOnline,
      bankVerified: row.bankVerified,
      payBillEnabled: row.payBillEnabled,
      isDeleted: row.isDeleted,
      vendorType: row.vendorType,
      isSoloProvider: row.isSoloProvider,
      roleName: row.roleName,
      roleCategory: row.roleCategory,
      customerService: row.customerService,
      roleConfig: row.roleConfig,
      legacyCategory: row.legacyCategory,
      pricingConfigured: false,
    });

    return {
      catalogueId: row.id,
      vendorId: row.vendorId,
      vendorName: row.ownerName?.trim() || row.businessName,
      businessName: row.businessName,
      city: row.city,
      category: evaluation.category,
      businessType: evaluation.businessType,
      platformStatus: evaluation.platformStatus,
      warmpawzPayStatus: evaluation.warmpawzPayStatus,
      readiness: evaluation.readiness,
      customerVisible: evaluation.customerVisible,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
