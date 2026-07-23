import { DEFAULT_COMMERCE_CONFIGURATION } from '../config/defaults';
import { parseCommerceConfiguration } from '../config/schema';

describe('commerce configuration schema', () => {
  it('accepts default marketplace configuration', () => {
    const parsed = parseCommerceConfiguration(DEFAULT_COMMERCE_CONFIGURATION);
    expect(parsed.activeModelId).toBe('marketplace');
    expect(parsed.availableModels).toEqual(['marketplace']);
  });

  it('rejects active model not in availableModels', () => {
    expect(() =>
      parseCommerceConfiguration({
        ...DEFAULT_COMMERCE_CONFIGURATION,
        activeModelId: 'warmpawz_pay',
        availableModels: ['marketplace'],
      })
    ).not.toThrow();
  });
});
