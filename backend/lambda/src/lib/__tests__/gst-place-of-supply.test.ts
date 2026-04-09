import { isGstInterstateSupply, resolveGstStateKey } from '../gst-place-of-supply';

describe('isGstInterstateSupply', () => {
  it('same state keys → intra-state (not inter-state)', () => {
    expect(isGstInterstateSupply('karnataka', 'karnataka')).toBe(false);
  });

  it('different state keys → inter-state', () => {
    expect(isGstInterstateSupply('karnataka', 'tamil nadu')).toBe(true);
  });

  it('missing customer → inter-state (IGST fallback)', () => {
    expect(isGstInterstateSupply(undefined, 'karnataka')).toBe(true);
  });

  it('missing vendor → inter-state (IGST fallback)', () => {
    expect(isGstInterstateSupply('karnataka', undefined)).toBe(true);
  });
});

describe('resolveGstStateKey', () => {
  it('normalizes KA and Karnataka to same key', () => {
    expect(resolveGstStateKey('KA')).toBe('karnataka');
    expect(resolveGstStateKey('Karnataka')).toBe('karnataka');
  });

  it('city Bengaluru maps to Karnataka', () => {
    expect(resolveGstStateKey(undefined, 'Bengaluru')).toBe('karnataka');
  });
});
