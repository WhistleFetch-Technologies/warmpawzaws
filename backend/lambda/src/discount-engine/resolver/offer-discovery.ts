/**
 * Offer Discovery — loads and evaluates eligible discount candidates.
 * Separated from Offer Resolution (policy-driven winner selection).
 */
import { evaluateCandidateBenefit } from '../candidates/bridges/candidate-to-benefit-context';
import { evaluateCandidateEligibility } from '../rules/engine';

export interface OfferDiscoveryResult {
  candidates: DiscountCandidate[];
  providerBreakdown: Record<string, number>;
  ruleResults: CandidateRuleOutcome[];
  eligibleCandidates: DiscountCandidate[];
  rejectedCandidates: DiscountCandidate[];
  benefitResults: CandidateBenefitOutcome[];
  discoveryTimeMs: number;
}

export class OfferDiscovery {
  constructor(
    private readonly repository: DefaultCandidateRepository = getCandidateRepository()
  ) {}

  async discover(context: DiscountContext): Promise<OfferDiscoveryResult> {
    const started = Date.now();
    const { candidates, providerBreakdown } = await this.repository.loadCandidates(context);
    const ruleRuntime = discountContextToRuleRuntime(context);
    const benefitRuntime = discountContextToBenefitRuntime(context);

    const ruleResults: CandidateRuleOutcome[] = [];
    const eligibleCandidates: DiscountCandidate[] = [];
    const rejectedCandidates: DiscountCandidate[] = [];

    for (const candidate of candidates) {
      const eligibility = this.evaluateRulesForCandidate(candidate, context, ruleRuntime);
      ruleResults.push({ candidate, eligibility });
      if (eligibility.eligible) {
        eligibleCandidates.push(candidate);
      } else {
        rejectedCandidates.push(candidate);
      }
    }

    const benefitResults: CandidateBenefitOutcome[] = [];
    for (const candidate of eligibleCandidates) {
      const benefit = evaluateCandidateBenefit(candidate, benefitRuntime);
      benefitResults.push({
        candidate,
        benefit,
        discountAmount: benefit.discountAmount,
      });
    }

    return {
      candidates,
      providerBreakdown,
      ruleResults,
      eligibleCandidates,
      rejectedCandidates,
      benefitResults,
      discoveryTimeMs: Date.now() - started,
    };
  }

  private evaluateRulesForCandidate(
    candidate: DiscountCandidate,
    context: DiscountContext,
    ruleRuntime: ReturnType<typeof discountContextToRuleRuntime>
  ): EligibilityResult {
    return evaluateCandidateEligibility(candidate, ruleRuntime);
  }
}

let defaultDiscovery: OfferDiscovery | null = null;

export function getOfferDiscovery(): OfferDiscovery {
  if (!defaultDiscovery) defaultDiscovery = new OfferDiscovery();
  return defaultDiscovery;
}
