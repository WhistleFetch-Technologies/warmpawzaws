import {
  resetCommerceSwitchContainerForTests,
} from '../di/commerce-switch-container';
import { bootstrapCommerceModels } from '../registry/bootstrap-models';
import { getCommerceModelRegistry } from '../registry/commerce-model-registry';

describe('CommerceModelRegistry', () => {
  beforeEach(() => {
    resetCommerceSwitchContainerForTests();
    bootstrapCommerceModels();
  });

  it('registers marketplace and warmpawz_pay descriptors', () => {
    const registry = getCommerceModelRegistry();
    expect(registry.has('marketplace')).toBe(true);
    expect(registry.has('warmpawz_pay')).toBe(true);
    expect(registry.list()).toHaveLength(2);
  });
});
