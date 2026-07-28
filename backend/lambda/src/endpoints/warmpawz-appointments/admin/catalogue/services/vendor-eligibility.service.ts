import type { EligibilityDTO } from '../dto/catalogue.responses';
import { PUBLISHED } from '../../../constants/publish-status';
import type {
  IVendorEligibilityRepository,
  VendorEligibilitySnapshot,
} from '../../../repositories/interfaces/IVendorEligibilityRepository';
import { vendorEligibilityRepository } from '../../../repositories/vendor-eligibility.repository';
import { isPlatformApproved } from '../../../shared/merchant/merchant-platform-status.resolver';

import type { IVendorEligibilityService } from './interfaces/IVendorEligibilityService';

export const EligibilityWarningCode = {
  VENDOR_NOT_APPROVED: 'VENDOR_NOT_APPROVED',
  VENDOR_DELETED: 'VENDOR_DELETED',
  NOT_PUBLISHED: 'NOT_PUBLISHED',
} as const;

export type EligibilityWarningCode =
  (typeof EligibilityWarningCode)[keyof typeof EligibilityWarningCode];

function isVendorPlatformEligible(snapshot: VendorEligibilitySnapshot): boolean {
  return isPlatformApproved({
    vendorStatus: snapshot.vendorStatus,
    isActive: snapshot.isActive,
    isDeleted: snapshot.isDeleted,
  });
}

export class VendorEligibilityService implements IVendorEligibilityService {
  constructor(
    private readonly eligibilityRepository: IVendorEligibilityRepository = vendorEligibilityRepository,
  ) {}

  computeCustomerVisible(snapshot: VendorEligibilitySnapshot): boolean {
    if (snapshot.publishStatus !== PUBLISHED) {
      return false;
    }

    return isVendorPlatformEligible(snapshot) && !snapshot.isDeleted;
  }

  buildWarnings(snapshot: VendorEligibilitySnapshot): readonly EligibilityWarningCode[] {
    const warnings: EligibilityWarningCode[] = [];

    if (snapshot.isDeleted) {
      warnings.push(EligibilityWarningCode.VENDOR_DELETED);
    }
    if (!isVendorPlatformEligible(snapshot)) {
      warnings.push(EligibilityWarningCode.VENDOR_NOT_APPROVED);
    }
    if (snapshot.publishStatus !== PUBLISHED) {
      warnings.push(EligibilityWarningCode.NOT_PUBLISHED);
    }

    return warnings;
  }

  buildEligibilityDto(snapshot: VendorEligibilitySnapshot): EligibilityDTO {
    return {
      bankVerified: snapshot.bankVerified,
      vendorStatus: snapshot.vendorStatus,
      customerVisible: this.computeCustomerVisible(snapshot),
    };
  }

  async getEligibilitySnapshot(vendorId: string): Promise<EligibilityDTO | null> {
    const snapshot = await this.eligibilityRepository.getSnapshot(vendorId);
    if (!snapshot) {
      return null;
    }
    return this.buildEligibilityDto(snapshot);
  }
}

export const vendorEligibilityService = new VendorEligibilityService();
