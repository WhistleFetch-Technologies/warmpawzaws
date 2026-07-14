import {
  getAnalyticsMode,
  isAnalyticsEnabled,
  isAnalyticsPubliclyExposed,
} from '../analytics-mode';

describe('analytics-mode', () => {
  const original = process.env.DISCOUNT_ENGINE_V2_ANALYTICS_MODE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DISCOUNT_ENGINE_V2_ANALYTICS_MODE;
    } else {
      process.env.DISCOUNT_ENGINE_V2_ANALYTICS_MODE = original;
    }
  });

  it('defaults to OFF', () => {
    delete process.env.DISCOUNT_ENGINE_V2_ANALYTICS_MODE;
    expect(getAnalyticsMode()).toBe('OFF');
    expect(isAnalyticsEnabled()).toBe(false);
  });

  it('parses SHADOW and AUTHORITATIVE', () => {
    process.env.DISCOUNT_ENGINE_V2_ANALYTICS_MODE = 'SHADOW';
    expect(getAnalyticsMode()).toBe('SHADOW');
    expect(isAnalyticsEnabled()).toBe(true);
    expect(isAnalyticsPubliclyExposed()).toBe(false);

    process.env.DISCOUNT_ENGINE_V2_ANALYTICS_MODE = 'AUTHORITATIVE';
    expect(isAnalyticsPubliclyExposed()).toBe(true);
  });
});
