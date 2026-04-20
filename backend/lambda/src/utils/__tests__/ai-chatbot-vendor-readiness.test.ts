import {
  buildVendorAvailabilityV2OpenPredicateSql,
  computeVendorReadinessMessages,
  formatVendorReadinessSection,
} from '../ai/ai-chatbot-vendor-readiness-core';

const base = (): Parameters<typeof computeVendorReadinessMessages>[0] => ({
  status: 'approved',
  isActive: true,
  isOnline: true,
  latitude: 12.34,
  longitude: 56.78,
  businessName: 'Paws Clinic',
  publishedForDiscoveryServices: 2,
  availabilityTotalRows: 3,
  availabilityOpenRows: 3,
});

describe('computeVendorReadinessMessages', () => {
  it('returns success summary when all checks pass', () => {
    const lines = computeVendorReadinessMessages(base());
    expect(lines[0]).toContain('pass');
    expect(lines.filter((l) => l.startsWith('- '))).toHaveLength(0);
  });

  it('flags non-live listing status (e.g. pending)', () => {
    const lines = computeVendorReadinessMessages({ ...base(), status: 'pending' });
    expect(lines.some((l) => l.includes('Account listing status'))).toBe(true);
  });

  it('does not flag status active as a listing problem', () => {
    const lines = computeVendorReadinessMessages({ ...base(), status: 'active' });
    expect(lines.some((l) => l.includes('Account listing status'))).toBe(false);
  });

  it('flags offline', () => {
    const lines = computeVendorReadinessMessages({ ...base(), isOnline: false });
    expect(lines.some((l) => l.toLowerCase().includes('offline'))).toBe(true);
  });

  it('flags missing map pin', () => {
    const lines = computeVendorReadinessMessages({ ...base(), latitude: null, longitude: null });
    expect(lines.some((l) => l.includes('Map location'))).toBe(true);
  });

  it('flags no published services', () => {
    const lines = computeVendorReadinessMessages({ ...base(), publishedForDiscoveryServices: 0 });
    expect(lines.some((l) => l.includes('published'))).toBe(true);
  });

  it('flags no availability rows', () => {
    const lines = computeVendorReadinessMessages({ ...base(), availabilityTotalRows: 0 });
    expect(lines.some((l) => l.includes('No saved schedule slots'))).toBe(true);
  });

  it('flags availability rows but none open', () => {
    const lines = computeVendorReadinessMessages({
      ...base(),
      availabilityTotalRows: 2,
      availabilityOpenRows: 0,
    });
    expect(lines.some((l) => l.includes('nothing is turned on for booking'))).toBe(true);
  });
});

describe('buildVendorAvailabilityV2OpenPredicateSql', () => {
  it('builds COALESCE chain with is_enabled before is_available', () => {
    expect(buildVendorAvailabilityV2OpenPredicateSql(new Set(['is_active']))).toBe('COALESCE(va.is_active, true) = true');
    expect(buildVendorAvailabilityV2OpenPredicateSql(new Set(['is_available', 'is_enabled', 'is_active']))).toBe(
      'COALESCE(va.is_enabled, va.is_available, va.is_active, true) = true'
    );
    expect(buildVendorAvailabilityV2OpenPredicateSql(new Set(['is_enabled', 'is_active']))).toBe(
      'COALESCE(va.is_enabled, va.is_active, true) = true'
    );
  });

  it('returns true when no flag columns', () => {
    expect(buildVendorAvailabilityV2OpenPredicateSql(new Set())).toBe('true');
  });
});

describe('formatVendorReadinessSection', () => {
  it('prefixes section title', () => {
    const s = formatVendorReadinessSection(['Summary: ok']);
    expect(s).toContain('VENDOR CUSTOMER VISIBILITY');
    expect(s).toContain('Summary: ok');
  });
});
