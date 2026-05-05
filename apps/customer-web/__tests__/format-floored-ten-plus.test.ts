import {
  formatFlooredTenPlus,
  formatDiscoveryCountStat,
} from '@/lib/format-floored-ten-plus';

describe('formatFlooredTenPlus', () => {
  it('returns null for non-positive or invalid', () => {
    expect(formatFlooredTenPlus(0)).toBeNull();
    expect(formatFlooredTenPlus(-1)).toBeNull();
    expect(formatFlooredTenPlus(NaN as unknown as number)).toBeNull();
  });

  it('uses exact small counts with plus', () => {
    expect(formatFlooredTenPlus(1)).toBe('1+');
    expect(formatFlooredTenPlus(9)).toBe('9+');
  });

  it('floors to tens for 10+', () => {
    expect(formatFlooredTenPlus(10)).toBe('10+');
    expect(formatFlooredTenPlus(44)).toBe('40+');
    expect(formatFlooredTenPlus(36)).toBe('30+');
    expect(formatFlooredTenPlus(99)).toBe('90+');
    expect(formatFlooredTenPlus(100)).toBe('100+');
  });
});

describe('formatDiscoveryCountStat', () => {
  it('reflects loading and error', () => {
    expect(formatDiscoveryCountStat(44, 'loading')).toBe('…');
    expect(formatDiscoveryCountStat(undefined, 'error')).toBe('—');
  });

  it('formats success with exact integer counts', () => {
    expect(formatDiscoveryCountStat(44, 'success')).toBe('44');
    expect(formatDiscoveryCountStat(0, 'success')).toBe('0');
  });
});
