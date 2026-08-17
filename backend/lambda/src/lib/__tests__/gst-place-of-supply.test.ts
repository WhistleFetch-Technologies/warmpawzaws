import {
  classifyGstPlaceOfSupply,
  inferStateFromPlainAddressText,
  isGstInterstateSupply,
  locationFromStoredFields,
  resolveGstStateKey,
} from '../gst-place-of-supply';

describe('classifyGstPlaceOfSupply', () => {
  it('TEST A — same state is intra-state', () => {
    expect(classifyGstPlaceOfSupply('karnataka', 'karnataka')).toBe('intra_state');
    expect(isGstInterstateSupply('karnataka', 'karnataka')).toBe(false);
  });

  it('TEST B — different states are inter-state', () => {
    expect(classifyGstPlaceOfSupply('karnataka', 'tamil nadu')).toBe('inter_state');
    expect(isGstInterstateSupply('karnataka', 'tamil nadu')).toBe(true);
  });

  it('TEST D — missing state is unknown, not a silent same-state guess', () => {
    expect(classifyGstPlaceOfSupply(undefined, 'karnataka')).toBe('unknown');
    expect(classifyGstPlaceOfSupply('karnataka', undefined)).toBe('unknown');
    expect(classifyGstPlaceOfSupply(undefined, undefined)).toBe('unknown');
  });
});

describe('resolveGstStateKey — TEST C production representations', () => {
  it('normalizes Karnataka spellings that exist in prod data', () => {
    expect(resolveGstStateKey('Karnataka')).toBe('karnataka');
    expect(resolveGstStateKey('Karnataka ')).toBe('karnataka');
    expect(resolveGstStateKey('karnataka')).toBe('karnataka');
    expect(resolveGstStateKey('KA')).toBe('karnataka');
  });

  it('maps Bengaluru / Bangalore city to Karnataka', () => {
    expect(resolveGstStateKey(undefined, 'Bengaluru')).toBe('karnataka');
    expect(resolveGstStateKey(undefined, 'Bangalore')).toBe('karnataka');
    expect(resolveGstStateKey(undefined, 'Bangalore ')).toBe('karnataka');
  });

  it('does not invent Karnataka from an unrelated locality', () => {
    expect(resolveGstStateKey(undefined, 'K R Puram')).toBeUndefined();
  });
});

describe('locationFromStoredFields — Bangalore production rows', () => {
  it('uses vendors.state even when address is plain text without a state word', () => {
    const k9 = locationFromStoredFields({
      state: 'Karnataka',
      city: 'Bengaluru',
      address: 'K R Puram',
    });
    expect(resolveGstStateKey(k9?.state, k9?.city)).toBe('karnataka');

    const bindu = locationFromStoredFields({
      state: 'Karnataka',
      city: 'Bengaluru',
      address: 'Cubbon RoadMahatma Gandhi Road',
    });
    expect(resolveGstStateKey(bindu?.state, bindu?.city)).toBe('karnataka');
  });

  it('does not treat a Bangalore vendor as Karnataka unless a stored field maps', () => {
    const lost = locationFromStoredFields({
      state: '',
      city: '',
      address: 'K R Puram',
    });
    expect(lost).toBeUndefined();
    expect(inferStateFromPlainAddressText('K R Puram')).toBeNull();
  });

  it('infers Karnataka from a plain-text customer profile address', () => {
    const loc = locationFromStoredFields({
      address: '70, Vinayaka Layout, Hebbal Kempapura, Bengaluru, Karnataka 560024, India',
    });
    expect(resolveGstStateKey(loc?.state, loc?.city)).toBe('karnataka');
  });

  it('uses customer_addresses.state Karnataka with trailing-safe trim', () => {
    const loc = locationFromStoredFields({ state: 'Karnataka', city: 'Bengaluru' });
    expect(resolveGstStateKey(loc?.state, loc?.city)).toBe('karnataka');
  });
});
