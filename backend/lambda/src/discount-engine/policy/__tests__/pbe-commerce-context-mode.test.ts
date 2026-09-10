import {
  getPbeCommerceContextMode,
  isPbeCommerceContextShadowEnabled,
} from '../pbe-commerce-context-mode';

describe('pbe-commerce-context-mode', () => {
  const original = process.env.PBE_COMMERCE_CONTEXT_MODE;

  afterEach(() => {
    if (original === undefined) delete process.env.PBE_COMMERCE_CONTEXT_MODE;
    else process.env.PBE_COMMERCE_CONTEXT_MODE = original;
  });

  it('defaults to OFF', () => {
    delete process.env.PBE_COMMERCE_CONTEXT_MODE;
    expect(getPbeCommerceContextMode()).toBe('OFF');
    expect(isPbeCommerceContextShadowEnabled()).toBe(false);
  });

  it('supports SHADOW', () => {
    process.env.PBE_COMMERCE_CONTEXT_MODE = 'SHADOW';
    expect(getPbeCommerceContextMode()).toBe('SHADOW');
    expect(isPbeCommerceContextShadowEnabled()).toBe(true);
  });

  it('treats AUTHORITATIVE as shadow-enabled without making V2 financial owner', () => {
    process.env.PBE_COMMERCE_CONTEXT_MODE = 'AUTHORITATIVE';
    expect(getPbeCommerceContextMode()).toBe('AUTHORITATIVE');
    expect(isPbeCommerceContextShadowEnabled()).toBe(true);
  });
});
