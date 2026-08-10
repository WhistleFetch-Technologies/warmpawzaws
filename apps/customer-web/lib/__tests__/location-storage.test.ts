import {
  haversineMeters,
  migrateLegacyLocationCache,
  readPersistedLocation,
  writePersistedLocation,
  LOCATION_STORAGE_KEY,
} from '../location-storage';
import { LOCATION_STALE_MS } from '../location-constants';

describe('location-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('migrates legacy customer_latitude/longitude', () => {
    localStorage.setItem('customer_latitude', '12.97');
    localStorage.setItem('customer_longitude', '77.59');
    const migrated = migrateLegacyLocationCache();
    expect(migrated?.latitude).toBeCloseTo(12.97);
    expect(migrated?.source).toBe('cached');
  });

  it('round-trips warmpawz_location_v1', () => {
    writePersistedLocation({
      v: 1,
      latitude: 12.97,
      longitude: 77.59,
      timestamp: Date.now(),
      source: 'gps',
      city: 'Bangalore',
    });
    const read = readPersistedLocation();
    expect(read?.city).toBe('Bangalore');
    expect(localStorage.getItem(LOCATION_STORAGE_KEY)).toBeTruthy();
    expect(localStorage.getItem('customer_latitude')).toBe('12.97');
  });

  it('haversine detects ~500m+ movement in Bangalore', () => {
    const d = haversineMeters(12.9716, 77.5946, 12.98, 77.5946);
    expect(d).toBeGreaterThan(500);
  });

  it('exposes LOCATION_STALE_MS as positive config', () => {
    expect(LOCATION_STALE_MS).toBeGreaterThan(60_000);
  });
});
