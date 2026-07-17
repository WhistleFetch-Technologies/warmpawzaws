export const MAX_BULK_PRODUCT_DELETE = 100;

export function getSelectableProductIds<T extends { id: string }>(
  products: T[],
  isRemoved: (product: T) => boolean,
): string[] {
  return products.filter((product) => !isRemoved(product)).map((product) => product.id);
}

export function toggleProductSelection(selectedIds: Set<string>, productId: string): Set<string> {
  const next = new Set(selectedIds);
  if (next.has(productId)) {
    next.delete(productId);
  } else {
    next.add(productId);
  }
  return next;
}

export function isAllSelectableSelected(
  selectableIds: string[],
  selectedIds: Set<string>,
): boolean {
  return selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
}
