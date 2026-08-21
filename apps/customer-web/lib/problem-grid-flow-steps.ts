/**
 * Problem-grid flow: educational specialization detail, then existing vendor discovery.
 * Do not skip the article for WAPPT/Pay. Do not add vendor/pay actions to the article.
 */

export type ProblemGridFlowStep = 'service-style' | 'discovery';

/** Always start on the specialization educational page. */
export function initialProblemGridFlowStep(): ProblemGridFlowStep {
  return 'service-style';
}

/** WAPPT/Pay must not bypass specialization detail. */
export function shouldSkipSpecializationDetailForWappt(): boolean {
  return false;
}

/** After Continue, return to the article — never close the hub just because WAPPT is on. */
export function problemGridDiscoveryBackStep(): ProblemGridFlowStep {
  return 'service-style';
}

export function shouldUseExistingWapptVendorDiscovery(options: {
  wapptCategory: string | null | undefined;
  wapptHubEnabled: boolean;
}): boolean {
  return Boolean(options.wapptCategory && options.wapptHubEnabled);
}
