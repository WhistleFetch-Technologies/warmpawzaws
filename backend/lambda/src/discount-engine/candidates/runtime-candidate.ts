import { DiscountDomain } from '../enums/discount-domain';
import { DiscountOwner } from '../enums/discount-owner';
import { DiscountSource } from '../enums/discount-source';
import { DiscountStatus } from '../enums/discount-status';
import { DiscountTrigger } from '../enums/discount-trigger';
import type { DiscountCandidate, DiscountCandidateBenefits } from './types';

/** Builds a minimal candidate for benefit-only runtime params (legacy adapter bridge). */
export function buildRuntimeBenefitCandidate(input: {
  domain: DiscountDomain;
  owner: DiscountOwner;
  source?: DiscountSource;
  benefits: DiscountCandidateBenefits;
}): DiscountCandidate {
  return {
    id: 'runtime',
    name: 'runtime',
    source: input.source ?? DiscountSource.VENDOR_PROMOTION,
    owner: input.owner,
    domain: input.domain,
    trigger: DiscountTrigger.AUTO,
    status: DiscountStatus.ACTIVE,
    rules: {},
    benefits: input.benefits,
    originalEntity: {},
  };
}
