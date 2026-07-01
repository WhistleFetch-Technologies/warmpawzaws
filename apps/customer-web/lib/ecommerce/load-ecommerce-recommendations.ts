import { apiClient } from '@/lib/api-client';
import { mapApiProductsList } from '@/components/shop/map-shop-product';
import type { ShopProduct } from '@/components/shop/shop-types';

export const ECOMMERCE_RECOMMENDATIONS_LIMIT = 15;

export type CartRecommendationInput = {
  productId: string;
  categoryId?: string;
  category?: string;
  quantity: number;
  price: number;
};

export async function loadEcommerceRecommendations(input: {
  context: 'cart' | 'product';
  productId?: string;
  items?: CartRecommendationInput[];
  limit?: number;
}): Promise<ShopProduct[]> {
  const limit = input.limit ?? ECOMMERCE_RECOMMENDATIONS_LIMIT;
  const res = await apiClient.post<{ products?: unknown[] }>('/ecommerce/recommendations', {
    context: input.context,
    productId: input.productId,
    items: input.items,
    limit,
  });
  return mapApiProductsList(res?.products ?? []);
}

export async function loadCartRecommendations(
  items: CartRecommendationInput[],
  limit = ECOMMERCE_RECOMMENDATIONS_LIMIT,
): Promise<ShopProduct[]> {
  return loadEcommerceRecommendations({ context: 'cart', items, limit });
}

export async function loadProductRecommendations(
  productId: string,
  limit = ECOMMERCE_RECOMMENDATIONS_LIMIT,
): Promise<ShopProduct[]> {
  return loadEcommerceRecommendations({ context: 'product', productId, limit });
}
