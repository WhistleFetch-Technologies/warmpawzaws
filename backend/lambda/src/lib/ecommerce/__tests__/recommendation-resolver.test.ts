import { clampRecommendationLimit } from '../recommendation-resolver';

describe('clampRecommendationLimit', () => {
  it('defaults to 15 when invalid', () => {
    expect(clampRecommendationLimit(undefined)).toBe(15);
    expect(clampRecommendationLimit('')).toBe(15);
    expect(clampRecommendationLimit(0)).toBe(15);
  });

  it('clamps to max 15', () => {
    expect(clampRecommendationLimit(5)).toBe(5);
    expect(clampRecommendationLimit(15)).toBe(15);
    expect(clampRecommendationLimit(99)).toBe(15);
  });
});
