/** Why a plan cannot be published, or a vendor is not ready to sell it. */

export interface ReadinessInput {
  readonly companyActive: boolean;
  readonly onboardingApproved: boolean;
  readonly vendorActive: boolean;
  readonly linkActive: boolean;
  readonly teleAvailability: boolean;
  readonly publishedForm: boolean;
  readonly requirePublishedForm: boolean;
}

export function vendorReadinessBlockers(input: ReadinessInput): string[] {
  const blockers: string[] = [];
  if (!input.onboardingApproved) blockers.push('Vendor onboarding is not approved');
  if (!input.vendorActive) blockers.push('Vendor is not active');
  if (!input.linkActive) blockers.push('Vendor link is not active');
  if (!input.teleAvailability) blockers.push('No teleconsultation availability');
  if (input.requirePublishedForm && !input.publishedForm) {
    blockers.push('No published form template for this company');
  }
  return blockers;
}

export function planPublishBlockers(input: {
  readonly companyActive: boolean;
  readonly readyVendorCount: number;
}): string[] {
  const blockers: string[] = [];
  if (!input.companyActive) blockers.push('Company is not active');
  if (input.readyVendorCount < 1) blockers.push('At least one ready vendor is required');
  return blockers;
}
