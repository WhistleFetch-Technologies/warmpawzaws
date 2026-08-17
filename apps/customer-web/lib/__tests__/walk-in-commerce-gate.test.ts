import { shouldShowWalkInNearYou } from '../walk-in-commerce-gate';

describe('shouldShowWalkInNearYou', () => {
  it('hides when commerce config is missing', () => {
    expect(shouldShowWalkInNearYou(null, true)).toBe(false);
    expect(shouldShowWalkInNearYou(undefined, true)).toBe(false);
  });

  it('hides while commerce config is still loading', () => {
    expect(
      shouldShowWalkInNearYou({ isLoaded: false, isWarmpawzPay: true }, true)
    ).toBe(false);
  });

  it('hides for marketplace (Warmpawz Marketplace)', () => {
    expect(
      shouldShowWalkInNearYou({ isLoaded: true, isWarmpawzPay: false }, true)
    ).toBe(false);
  });

  it('shows for warmpawz_pay when module is capable', () => {
    expect(
      shouldShowWalkInNearYou({ isLoaded: true, isWarmpawzPay: true }, true)
    ).toBe(true);
  });

  it('hides for warmpawz_pay when module kill-switch disables Pay', () => {
    expect(
      shouldShowWalkInNearYou({ isLoaded: true, isWarmpawzPay: true }, false)
    ).toBe(false);
  });
});
