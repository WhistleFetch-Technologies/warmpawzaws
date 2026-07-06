import {
  getResolverMode,
  isResolverAuthoritative,
  isResolverEnabled,
  isResolverShadowMode,
} from '../resolver-mode';

describe('resolver-mode', () => {
  const original = process.env.DISCOUNT_ENGINE_V2_RESOLVER_MODE;

  afterEach(() => {
    if (original === undefined) delete process.env.DISCOUNT_ENGINE_V2_RESOLVER_MODE;
    else process.env.DISCOUNT_ENGINE_V2_RESOLVER_MODE = original;
  });

  it('defaults to OFF', () => {
    delete process.env.DISCOUNT_ENGINE_V2_RESOLVER_MODE;
    expect(getResolverMode()).toBe('OFF');
    expect(isResolverEnabled()).toBe(false);
  });

  it('supports SHADOW', () => {
    process.env.DISCOUNT_ENGINE_V2_RESOLVER_MODE = 'SHADOW';
    expect(getResolverMode()).toBe('SHADOW');
    expect(isResolverShadowMode()).toBe(true);
    expect(isResolverAuthoritative()).toBe(false);
  });

  it('supports AUTHORITATIVE', () => {
    process.env.DISCOUNT_ENGINE_V2_RESOLVER_MODE = 'AUTHORITATIVE';
    expect(isResolverAuthoritative()).toBe(true);
  });
});
