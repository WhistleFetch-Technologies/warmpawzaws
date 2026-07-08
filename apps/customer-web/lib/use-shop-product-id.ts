'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { normalizeShopProductId } from './shop-product-path';

/** Reactive product id for /shop/placeholder?productId=… (query changes must re-render PDP). */
export function useShopProductId(): string {
  const params = useParams();
  const searchParams = useSearchParams();
  const fromQuery = normalizeShopProductId(
    searchParams.get('productId') || searchParams.get('product_id'),
  );
  if (fromQuery) return fromQuery;
  return normalizeShopProductId(params?.productId as string | undefined);
}
