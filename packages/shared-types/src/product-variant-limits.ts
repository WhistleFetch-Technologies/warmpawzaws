/** Hard limits for e-commerce product variant axes and SKU rows. */

export const MAX_VARIANT_ATTRIBUTES = 3;

export const MAX_SKUS_PER_PRODUCT = 50;

export function assertMaxVariantAxes(axes: unknown[]): void {
  if (axes.length > MAX_VARIANT_ATTRIBUTES) {
    throw new Error(
      `Maximum ${MAX_VARIANT_ATTRIBUTES} variant attributes per product`,
    );
  }
}
