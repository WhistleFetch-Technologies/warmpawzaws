import type { CandidateBenefitOutcome } from './types';
import type { UsagePreparedEntry } from './types';

/**
 * Prepares usage metadata for eligible candidates — no DB writes (settlement Phase 6).
 */
export function prepareUsageEntries(
  benefitOutcomes: CandidateBenefitOutcome[]
): UsagePreparedEntry[] {
  return benefitOutcomes
    .filter((o) => o.discountAmount > 0)
    .map((o) => ({
      candidateId: o.candidate.id,
      source: o.candidate.source,
      owner: o.candidate.owner,
      domain: o.candidate.domain,
      discountAmount: o.discountAmount,
      prepared: true,
      metadata: {
        trigger: o.candidate.trigger,
        code: o.candidate.code ?? null,
        benefitType: o.benefit.appliedBenefit,
      },
    }));
}
