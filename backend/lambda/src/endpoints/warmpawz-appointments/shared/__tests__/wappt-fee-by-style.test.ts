import { pickWapptFeeForStyle, extractServiceStylesFromRoleConfig } from '../wappt-fee-by-style';

describe('pickWapptFeeForStyle', () => {
  it('returns centre fee for at_center', () => {
    expect(
      pickWapptFeeForStyle({ centreFee: 400, homeFee: 550, serviceStyle: 'at_center' }),
    ).toBe(400);
  });

  it('returns home fee for at_home when set', () => {
    expect(
      pickWapptFeeForStyle({ centreFee: 400, homeFee: 550, serviceStyle: 'at_home' }),
    ).toBe(550);
  });

  it('falls back to centre when home fee missing', () => {
    expect(
      pickWapptFeeForStyle({ centreFee: 400, homeFee: null, serviceStyle: 'at_home' }),
    ).toBe(400);
  });

  it('falls back to centre when home fee is zero', () => {
    expect(
      pickWapptFeeForStyle({ centreFee: 400, homeFee: 0, serviceStyle: 'home_visit' }),
    ).toBe(400);
  });

  it('defaults style to at_center', () => {
    expect(pickWapptFeeForStyle({ centreFee: 300, homeFee: 500 })).toBe(300);
  });
});

describe('extractServiceStylesFromRoleConfig', () => {
  it('reads serviceStyles array', () => {
    expect(extractServiceStylesFromRoleConfig({ serviceStyles: ['at_center', 'at_home'] })).toEqual([
      'at_center',
      'at_home',
    ]);
  });

  it('returns empty for missing config', () => {
    expect(extractServiceStylesFromRoleConfig(null)).toEqual([]);
  });
});
