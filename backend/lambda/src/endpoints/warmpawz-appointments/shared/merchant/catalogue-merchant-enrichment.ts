import type { PublishStatus } from '../../constants/publish-status';
import type { MerchantBusinessType } from './merchant-business-type.resolver';
import type { PlatformStatus } from './merchant-platform-status.resolver';
import {
  evaluateMerchant,
  type MerchantReadinessDTO,
} from './merchant-readiness.service';
import type { WarmpawzAppointmentsStatus } from './merchant-warmpawz-appointments-status.resolver';

export interface CatalogueMerchantEnrichmentInput {
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
  readonly appointmentFee?: number | null;
}

export interface CatalogueMerchantEnrichmentDTO {
  readonly category: string;
  readonly businessType: MerchantBusinessType;
  readonly platformStatus: PlatformStatus;
  readonly WarmpawzAppointmentsStatus: WarmpawzAppointmentsStatus;
  readonly customerVisible: boolean;
  readonly readiness: MerchantReadinessDTO;
}

export function enrichCatalogueMerchant(
  input: CatalogueMerchantEnrichmentInput,
): CatalogueMerchantEnrichmentDTO {
  const appointmentFeeConfigured =
    input.appointmentFee !== null &&
    input.appointmentFee !== undefined &&
    input.appointmentFee > 0;

  const evaluation = evaluateMerchant({
    ...input,
    appointmentFeeConfigured,
  });

  return {
    category: evaluation.category,
    businessType: evaluation.businessType,
    platformStatus: evaluation.platformStatus,
    WarmpawzAppointmentsStatus: evaluation.WarmpawzAppointmentsStatus,
    customerVisible: evaluation.customerVisible,
    readiness: evaluation.readiness,
  };
}
