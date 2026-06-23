import type { CartItem } from '@/context/CartContext';
import type { WarmpawzCartProductSnapshot } from '@/lib/warmpawz-cart-storage';
import {
  deliveryBlockMessage,
  deliveryRegionsLabel,
  isProductDeliverableToCity,
  normalizeDeliveryRegionsList,
} from '@warmpawz/shared-types';

export {
  deliveryBlockMessage,
  deliveryRegionsLabel,
  isProductDeliverableToCity,
  normalizeDeliveryRegionsList,
};

export function deliveryRegionsFromSnapshot(
  snap: WarmpawzCartProductSnapshot | Record<string, unknown> | null | undefined,
): string[] {
  if (!snap || typeof snap !== 'object') return [];
  const row = snap as { delivery_regions?: unknown };
  return normalizeDeliveryRegionsList(row.delivery_regions);
}

export function deliveryRegionsFromCartItem(item: CartItem): string[] {
  const snap = item.warmpawzLine?.product;
  if (snap) return deliveryRegionsFromSnapshot(snap);
  const top = (item as { delivery_regions?: unknown }).delivery_regions;
  return normalizeDeliveryRegionsList(top);
}

export function isCartItemDeliverableToCity(
  item: CartItem,
  customerCity: string | null | undefined,
): boolean {
  return isProductDeliverableToCity(deliveryRegionsFromCartItem(item), customerCity);
}

export function findUndeliverableCartItems(
  cart: CartItem[],
  customerCity: string | null | undefined,
): CartItem[] {
  const city = String(customerCity ?? '').trim();
  if (!city) return [];
  return cart.filter((item) => !isCartItemDeliverableToCity(item, city));
}
