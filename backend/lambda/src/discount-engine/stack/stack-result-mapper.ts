import type { EligibleBenefit } from '../priority/priority-types';
import type { CandidateBenefitOutcome } from '../resolver/types';

/**
 * Maps Stack Engine applied set to resolver benefit outcomes with sequential amounts.
 */
export function mapStackAppliedToBenefitOutcomes(
  applied: EligibleBenefit[],
  benefitResults: CandidateBenefitOutcome[]
): CandidateBenefitOutcome[] {
  const byId = new Map(benefitResults.map((o) => [o.candidate.id, o]));
  return applied
    .map((s) => {
      const base = byId.get(s.candidate.id);
      if (!base) return null;
      return {
        ...base,
        discountAmount: s.discountAmount,
        benefit: {
          ...base.benefit,
          discountAmount: s.discountAmount,
        },
      };
    })
    .filter((o): o is CandidateBenefitOutcome => o != null);
}
