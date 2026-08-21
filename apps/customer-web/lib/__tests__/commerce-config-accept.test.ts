import { shouldAcceptCommerceConfig } from '../commerce-switch-client';
import type { CommerceModelId } from '@warmpawz/commerce-switch-contracts';

describe('shouldAcceptCommerceConfig', () => {
  const warmpawzPayV4 = {
    activeModelId: 'warmpawz_pay' as const,
    version: 4,
    schemaVersion: '1.0',
    availableModels: ['marketplace', 'warmpawz_pay'] as CommerceModelId[],
    updatedAt: '2026-01-03T00:00:00.000Z',
  };

  it('accepts first config when no current exists', () => {
    expect(shouldAcceptCommerceConfig(warmpawzPayV4, null)).toBe(true);
    expect(shouldAcceptCommerceConfig(warmpawzPayV4, undefined)).toBe(true);
  });

  it('rejects downgrade from v4 warmpawz_pay to v3 marketplace', () => {
    expect(
      shouldAcceptCommerceConfig(
        {
          ...warmpawzPayV4,
          activeModelId: 'marketplace',
          version: 3,
        },
        warmpawzPayV4
      )
    ).toBe(false);
  });

  it('accepts newer version', () => {
    expect(
      shouldAcceptCommerceConfig(
        { ...warmpawzPayV4, version: 5 },
        warmpawzPayV4
      )
    ).toBe(true);
  });

  it('accepts same version with different activeModelId', () => {
    expect(
      shouldAcceptCommerceConfig(
        { ...warmpawzPayV4, activeModelId: 'marketplace' },
        warmpawzPayV4
      )
    ).toBe(true);
  });
});
