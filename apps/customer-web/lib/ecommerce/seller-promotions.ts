/**
 * Seller (vendor) product promotions — customer marketplace only.
 * Uses public APIs; does not touch platform `/promotions` admin flows.
 */
import { apiClient } from '@/lib/api-client';

export type VendorProductPromotion = {
  id: string;
  name: string;
  description?: string;
  code?: string;
  promotion_type: string;
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  min_order_value?: number;
  max_discount_amount?: number;
  start_date?: string;
  end_date?: string;
  buy_quantity?: number;
  get_quantity?: number;
  get_discount_percent?: number;
  promo_category?: string;
};

export function resolveVendorIdFromProduct(product: Record<string, unknown> | null | undefined): string | undefined {
  if (!product) return undefined;
  const raw = product.vendor_id ?? product.vendorId ?? (product.vendor as { id?: string })?.id;
  const id = raw != null ? String(raw).trim() : '';
  return id && id !== 'default' ? id : undefined;
}

export function formatSellerPromoHeadline(promo: VendorProductPromotion): string {
  if (promo.promotion_type === 'buy_x_get_y') {
    const buy = promo.buy_quantity ?? 1;
    const get = promo.get_quantity ?? 1;
    const pct = promo.get_discount_percent ?? 100;
    if (pct >= 100) return `Buy ${buy} Get ${get} FREE`;
    return `Buy ${buy} Get ${get} at ${pct}% OFF`;
  }
  const val = promo.discount_value ?? 0;
  if (promo.discount_type === 'fixed') return `₹${val} OFF`;
  if (val > 0) return `${val}% OFF`;
  return promo.name || 'Special offer';
}

export async function fetchVendorProductPromotions(vendorId: string): Promise<VendorProductPromotion[]> {
  try {
    const res = await apiClient.get<{ promotions?: VendorProductPromotion[] }>(
      `/vendors/${vendorId}/active-promotions?type=product`
    );
    return (res as { promotions?: VendorProductPromotion[] })?.promotions ?? [];
  } catch {
    return [];
  }
}
