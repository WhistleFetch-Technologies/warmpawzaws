import type { SkuInput } from './product-sku-service';

/** PUT sku sync: skip empty simple updates; reject empty when variants exist. */
export function putSkuSyncDecision(
  skuInputs: SkuInput[] | null,
  hasExistingSkuRows: boolean,
): 'skip' | 'run' | 'reject_empty_with_variants' {
  if (skuInputs === null) return 'skip';
  if (skuInputs.length === 0) {
    return hasExistingSkuRows ? 'reject_empty_with_variants' : 'skip';
  }
  return 'run';
}
