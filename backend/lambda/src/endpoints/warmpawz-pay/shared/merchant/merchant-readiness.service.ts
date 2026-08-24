import type { PublishStatus } from '../../constants/publish-status';
import { PUBLISHED } from '../../constants/publish-status';
import {
  isMerchantBusinessTypeResolved,
  resolveMerchantBusinessType,
  type MerchantBusinessType,
} from './merchant-business-type.resolver';
import {
  isServiceCategoryConfigured,
  resolveMerchantServiceCategory,
} from './merchant-service-category.resolver';
import {
  isPlatformApproved,
  resolvePlatformStatus,
  type PlatformStatus,
} from './merchant-platform-status.resolver';
import { resolveWarmpawzPayStatus, type WarmpawzPayStatus } from './merchant-warmpawz-pay-status.resolver';

export type ReadinessSeverity = 'blocker' | 'warning';

export interface ReadinessCheck {
  readonly key: string;
  readonly label: string;
  readonly passed: boolean;
  readonly severity: ReadinessSeverity;
  readonly detail?: string;
}

export interface MerchantReadinessDTO {
  readonly checks: readonly ReadinessCheck[];
  readonly blockersPassed: number;
  readonly blockersTotal: number;
  readonly readyForPayBill: boolean;
}

export interface MerchantReadinessInput {
  readonly publishStatus: PublishStatus;
  readonly vendorStatus: string;
  readonly isActive: boolean;
  readonly isOnline: boolean;
  readonly bankVerified: boolean;
  readonly isDeleted: boolean;
  readonly vendorType?: string | null;
  readonly isSoloProvider?: boolean | null;
  readonly roleName?: string | null;
  readonly roleDisplayName?: string | null;
  readonly roleCategory?: string | null;
  readonly customerService?: string | null;
  readonly roleConfig?: unknown;
  readonly legacyCategory?: string | null;
  readonly pricingConfigured?: boolean;
}

export interface MerchantEvaluationDTO {
  readonly category: string;
  readonly businessType: MerchantBusinessType;
  readonly platformStatus: PlatformStatus;
  readonly warmpawzPayStatus: WarmpawzPayStatus;
  readonly customerVisible: boolean;
  readonly readiness: MerchantReadinessDTO;
}

function countBlockers(checks: readonly ReadinessCheck[]): {
  readonly blockersPassed: number;
  readonly blockersTotal: number;
} {
  const blockers = checks.filter((check) => check.severity === 'blocker');
  return {
    blockersPassed: blockers.filter((check) => check.passed).length,
    blockersTotal: blockers.length,
  };
}

export function buildMerchantReadiness(input: MerchantReadinessInput): MerchantReadinessDTO {
  const serviceCategory = resolveMerchantServiceCategory({
    customerService: input.customerService,
    roleCategory: input.roleCategory,
    roleConfig: input.roleConfig,
    legacyCategory: input.legacyCategory,
    roleName: input.roleName,
    roleDisplayName: input.roleDisplayName,
  });
  const businessType = resolveMerchantBusinessType({
    vendorType: input.vendorType,
    isSoloProvider: input.isSoloProvider,
    roleName: input.roleName,
  });

  const checks: ReadinessCheck[] = [
    {
      key: 'VENDOR_APPROVED',
      label: 'Vendor Approved',
      passed: isPlatformApproved({
        vendorStatus: input.vendorStatus,
        isActive: input.isActive,
        isDeleted: input.isDeleted,
      }),
      severity: 'blocker',
    },
    {
      key: 'ACCOUNT_ACTIVE',
      label: 'Account Active',
      passed: input.isActive === true && input.isDeleted !== true,
      severity: 'blocker',
    },
    {
      key: 'BANK_VERIFIED',
      label: 'Bank Verified',
      passed: input.bankVerified === true,
      severity: 'warning',
      detail: input.bankVerified
        ? undefined
        : 'Settlement may fail until the vendor bank account is verified',
    },
    {
      key: 'CATALOGUE_PUBLISHED',
      label: 'Published in Catalogue',
      passed: input.publishStatus === PUBLISHED,
      severity: 'blocker',
      detail:
        input.publishStatus === PUBLISHED
          ? undefined
          : 'Admin must publish to enable Pay Bill for customers',
    },
    {
      key: 'PROFILE_ENABLED',
      label: 'Profile Enabled',
      passed: input.isOnline === true,
      severity: 'warning',
      detail: input.isOnline ? undefined : 'Vendor profile is offline',
    },
    {
      key: 'CATEGORY_CONFIGURED',
      label: 'Category Configured',
      passed: isServiceCategoryConfigured(serviceCategory),
      severity: 'warning',
      detail: isServiceCategoryConfigured(serviceCategory)
        ? undefined
        : 'Category could not be resolved',
    },
    {
      key: 'BUSINESS_TYPE_RESOLVED',
      label: 'Business Type Resolved',
      passed: isMerchantBusinessTypeResolved(businessType),
      severity: 'warning',
    },
    {
      key: 'PRICING_CONFIGURED',
      label: 'Pricing Configured',
      passed: input.pricingConfigured === true,
      severity: 'warning',
      detail:
        input.pricingConfigured === true
          ? undefined
          : 'No pricing rule — customers pay full bill amount',
    },
  ];

  const { blockersPassed, blockersTotal } = countBlockers(checks);

  return {
    checks,
    blockersPassed,
    blockersTotal,
    readyForPayBill: blockersPassed === blockersTotal && blockersTotal > 0,
  };
}

export function computeCustomerVisible(
  input: MerchantReadinessInput,
  readiness: MerchantReadinessDTO,
): boolean {
  if (input.publishStatus !== PUBLISHED) {
    return false;
  }

  if (input.isDeleted) {
    return false;
  }

  return readiness.readyForPayBill;
}

export function evaluateMerchant(input: MerchantReadinessInput): MerchantEvaluationDTO {
  const serviceCategory = resolveMerchantServiceCategory({
    customerService: input.customerService,
    roleCategory: input.roleCategory,
    roleConfig: input.roleConfig,
    legacyCategory: input.legacyCategory,
    roleName: input.roleName,
    roleDisplayName: input.roleDisplayName,
  });
  const category = serviceCategory.serviceCategory;
  const businessType = resolveMerchantBusinessType({
    vendorType: input.vendorType,
    isSoloProvider: input.isSoloProvider,
    roleName: input.roleName,
  });
  const platformStatus = resolvePlatformStatus({
    vendorStatus: input.vendorStatus,
    isActive: input.isActive,
    isDeleted: input.isDeleted,
  });
  const readiness = buildMerchantReadiness(input);
  const customerVisible = computeCustomerVisible(input, readiness);
  const warmpawzPayStatus = resolveWarmpawzPayStatus(input.publishStatus, customerVisible);

  return {
    category,
    businessType,
    platformStatus,
    warmpawzPayStatus,
    customerVisible,
    readiness,
  };
}
