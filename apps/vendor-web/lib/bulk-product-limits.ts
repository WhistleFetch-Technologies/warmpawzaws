/** Keep in sync with backend/lambda MAX_BULK_PRODUCT_ROWS */
export const MAX_BULK_PRODUCT_ROWS = 500;

export function countTitledBulkProducts(products: { name?: string; title?: string }[]): number {
  return products.filter((p) => {
    const t = String(p.name ?? p.title ?? '').trim();
    return t.length > 0;
  }).length;
}
