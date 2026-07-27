import type { EligibilityDTO } from '../../dto/catalogue.responses';
import type { VendorEligibilitySnapshot } from '../../../../repositories/interfaces/IVendorEligibilityRepository';
import type { EligibilityWarningCode } from '../vendor-eligibility.service';

export interface IVendorEligibilityService {
  computeCustomerVisible(snapshot: VendorEligibilitySnapshot): boolean;

  buildWarnings(snapshot: VendorEligibilitySnapshot): readonly EligibilityWarningCode[];

  buildEligibilityDto(snapshot: VendorEligibilitySnapshot): EligibilityDTO;

  getEligibilitySnapshot(vendorId: string): Promise<EligibilityDTO | null>;
}
