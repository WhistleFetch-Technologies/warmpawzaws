import { putSkuSyncDecision } from '../put-sku-sync-decision';

describe('putSkuSyncDecision', () => {
  it('skips sync when skus omitted (null)', () => {
    expect(putSkuSyncDecision(null, false)).toBe('skip');
    expect(putSkuSyncDecision(null, true)).toBe('skip');
  });

  it('skips sync for simple product with empty skus array', () => {
    expect(putSkuSyncDecision([], false)).toBe('skip');
  });

  it('rejects empty skus when product has existing variant rows', () => {
    expect(putSkuSyncDecision([], true)).toBe('reject_empty_with_variants');
  });

  it('runs sync when skus array has entries', () => {
    expect(
      putSkuSyncDecision(
        [{ option_values: { size: 'M' }, stock: 5 }],
        false,
      ),
    ).toBe('run');
    expect(
      putSkuSyncDecision(
        [{ option_values: { size: 'M' }, stock: 5 }],
        true,
      ),
    ).toBe('run');
  });
});
