import {
  initialProblemGridFlowStep,
  problemGridDiscoveryBackStep,
  shouldSkipSpecializationDetailForWappt,
  shouldUseExistingWapptVendorDiscovery,
} from '../problem-grid-flow-steps';

describe('problem-grid flow steps', () => {
  it('always starts on specialization educational detail', () => {
    expect(initialProblemGridFlowStep()).toBe('service-style');
  });

  it('never skips the article because Warmpawz Pay / WAPPT is enabled', () => {
    expect(shouldSkipSpecializationDetailForWappt()).toBe(false);
  });

  it('returns from vendor discovery to the article, not out of the hub', () => {
    expect(problemGridDiscoveryBackStep()).toBe('service-style');
  });

  it('Continue still uses the existing WAPPT vendor list when that hub is on', () => {
    expect(
      shouldUseExistingWapptVendorDiscovery({
        wapptCategory: 'vet',
        wapptHubEnabled: true,
      }),
    ).toBe(true);
  });

  it('falls through to marketplace discovery when WAPPT is off', () => {
    expect(
      shouldUseExistingWapptVendorDiscovery({
        wapptCategory: 'vet',
        wapptHubEnabled: false,
      }),
    ).toBe(false);
  });
});
