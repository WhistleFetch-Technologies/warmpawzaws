import {
  sameWalkInCoords,
  walkInLocationCacheToken,
} from '../walk-in-discovery-location';

describe('walk-in discovery location cache identity', () => {
  it('normalizes coordinates so nearby GPS points share a cache key', () => {
    expect(walkInLocationCacheToken(12.97161, 77.59456)).toBe(
      walkInLocationCacheToken(12.9716, 77.5946)
    );
  });

  it('treats a new selected location as a different cache identity', () => {
    expect(walkInLocationCacheToken(12.9716, 77.5946)).not.toBe(
      walkInLocationCacheToken(13.0827, 80.2707)
    );
    expect(
      sameWalkInCoords(
        { latitude: 12.9716, longitude: 77.5946 },
        { latitude: 13.0827, longitude: 80.2707 }
      )
    ).toBe(false);
  });
});
