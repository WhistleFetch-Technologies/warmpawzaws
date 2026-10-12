/** Warmpawz commission owed by an insurance vendor for one issued policy. */

export const COMMISSION_BASES = [
  'percent_of_premium',
  'percent_of_vendor_commission',
  'fixed_per_policy',
] as const;

export type CommissionBasis = (typeof COMMISSION_BASES)[number];

export interface CommissionTerms {
  readonly id?: string;
  readonly basis: CommissionBasis;
  /** % for percent bases, rupees for fixed_per_policy. */
  readonly rate: number;
  /** Vendor's expected insurer commission as % of premium; used when the actual is not recorded. */
  readonly vendorCommissionRate: number | null;
  readonly gstRate: number;
  /** "YYYY-MM-DD" */
  readonly effectiveFrom: string;
}

export interface IssuedPolicyAmounts {
  readonly premium: number;
  readonly vendorCommissionAmount: number | null;
}

export interface CommissionEstimate {
  /** Amount the rate applies to (premium, vendor commission, or 1 policy). */
  readonly base: number;
  readonly commission: number;
  readonly gst: number;
  readonly total: number;
  /** Base was derived from the expected vendor commission rate, not a recorded amount. */
  readonly isEstimate: boolean;
  /** Terms could not price this policy (no terms, or no vendor commission to apply a % to). */
  readonly missingBase: boolean;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function estimateCommission(
  terms: CommissionTerms | null,
  policy: IssuedPolicyAmounts,
): CommissionEstimate {
  if (!terms) {
    return { base: 0, commission: 0, gst: 0, total: 0, isEstimate: false, missingBase: true };
  }
  let base = 0;
  let isEstimate = false;
  let missingBase = false;
  let commission = 0;

  if (terms.basis === 'percent_of_premium') {
    base = policy.premium;
    commission = (base * terms.rate) / 100;
  } else if (terms.basis === 'percent_of_vendor_commission') {
    if (policy.vendorCommissionAmount != null) {
      base = policy.vendorCommissionAmount;
    } else if (terms.vendorCommissionRate != null) {
      base = (policy.premium * terms.vendorCommissionRate) / 100;
      isEstimate = true;
    } else {
      missingBase = true;
    }
    commission = (base * terms.rate) / 100;
  } else {
    base = 1;
    commission = terms.rate;
  }

  const roundedCommission = round2(commission);
  const gst = round2((roundedCommission * terms.gstRate) / 100);
  return {
    base: round2(base),
    commission: roundedCommission,
    gst,
    total: round2(roundedCommission + gst),
    isEstimate,
    missingBase,
  };
}

/** Terms in force on a date: latest effectiveFrom on or before it. */
export function termsInForce<T extends CommissionTerms>(terms: readonly T[], date: string): T | null {
  let best: T | null = null;
  for (const t of terms) {
    if (t.effectiveFrom <= date && (!best || t.effectiveFrom > best.effectiveFrom)) best = t;
  }
  return best;
}

export function describeTerms(terms: CommissionTerms): string {
  const gst = terms.gstRate > 0 ? ` + ${terms.gstRate}% GST` : '';
  if (terms.basis === 'percent_of_premium') return `${terms.rate}% of premium${gst}`;
  if (terms.basis === 'fixed_per_policy') return `₹${terms.rate} per policy${gst}`;
  const expected =
    terms.vendorCommissionRate != null ? ` (vendor earns ~${terms.vendorCommissionRate}% of premium)` : '';
  return `${terms.rate}% of vendor commission${expected}${gst}`;
}
