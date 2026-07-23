import type { EligibilityDTO } from '../dto/catalogue.responses';
import type {
  IVendorEligibilityRepository,
  VendorEligibilitySnapshot,
} from '../../../repositories/interfaces/IVendorEligibilityRepository';
import { vendorEligibilityRepository } from '../../../repositories/vendor-eligibility.repository';

const ACTIVE_VENDOR_STATUS = 'active';

export const EligibilityWarningCode = {
  VENDOR_NOT_ACTIVE: 'VENDOR_NOT_ACTIVE',
  BANK_NOT_VERIFIED: 'BANK_NOT_VERIFIED',
  PAY_BILL_NOT_ENABLED: 'PAY_BILL_NOT_ENABLED',
  VENDOR_DELETED: 'VENDOR_DELETED',
} as const;

export type EligibilityWarningCode =
  (typeof EligibilityWarningCode)[keyof typeof EligibilityWarningCode];

export class VendorEligibilityService {
  constructor(
    private readonly eligibilityRepository: IVendorEligibilityRepository = vendorEligibilityRepository,
  ) {}

  computeCustomerVisible(snapshot: VendorEligibilitySnapshot): boolean {
    return (
      snapshot.vendorStatus === ACTIVE_VENDOR_STATUS &&
      snapshot.bankVerified &&
      snapshot.payBillEnabled &&
      !snapshot.isDeleted
    );
  }

  buildWarnings(snapshot: VendorEligibilitySnapshot): readonly EligibilityWarningCode[] {
    const warnings: EligibilityWarningCode[] = [];

    if (snapshot.isDeleted) {
      warnings.push(EligibilityWarningCode.VENDOR_DELETED);
    }
    if (snapshot.vendorStatus !== ACTIVE_VENDOR_STATUS) {
      warnings.push(EligibilityWarningCode.VENDOR_NOT_ACTIVE);
    }
    if (!snapshot.bankVerified) {
      warnings.push(EligibilityWarningCode.BANK_NOT_VERIFIED);
    }
    if (!snapshot.payBillEnabled) {
      warnings.push(EligibilityWarningCode.PAY_BILL_NOT_ENABLED);
    }

    return warnings;
  }

  buildEligibilityDto(snapshot: VendorEligibilitySnapshot): EligibilityDTO {
    return {
      payBillEnabled: snapshot.payBillEnabled,
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
