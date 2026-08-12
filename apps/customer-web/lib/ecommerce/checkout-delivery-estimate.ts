import type { CheckoutAddress } from '@/components/customer/ecommerce/useEcommerceCheckout';
import type { CartItem } from '@/context/CartContext';
import {
  computeCartDeliverySlaEstimate,
  type DeliverySlaEstimate,
  type DeliverySlaVendorInput,
} from '@warmpawz/shared-types';
import type { WarmpawzCartProductSnapshot } from '@/lib/warmpawz-cart-storage';

function vendorGeoFromSnapshot(
  product: WarmpawzCartProductSnapshot | undefined,
): DeliverySlaVendorInput {
  if (!product) return {};
  return {
    state: product.vendor_state,
    pincode: product.vendor_pincode,
    shippingOriginPincode: product.vendor_shipping_origin_pincode,
  };
}

/** Extract vendor geo from a cart line for SLA calculation. */
export function deliverySlaVendorFromCartItem(item: CartItem): DeliverySlaVendorInput {
  const snap = item.warmpawzLine?.product;
  if (snap) return vendorGeoFromSnapshot(snap);

  const legacy = item as Record<string, unknown>;
  return {
    state: legacy.vendor_state as string | undefined,
    pincode: legacy.vendor_pincode as string | undefined,
    shippingOriginPincode: legacy.vendor_shipping_origin_pincode as string | undefined,
  };
}

/** Cart-wide delivery estimate using the slowest SLA among all lines. */
export function computeCheckoutDeliveryEstimate(
  cart: CartItem[],
  address: CheckoutAddress | null,
): DeliverySlaEstimate | null {
  if (!address?.pincode || cart.length === 0) return null;

  const customer = {
    pincode: address.pincode,
    state: address.state,
    city: address.city,
  };
  const vendors = cart.map(deliverySlaVendorFromCartItem);
  return computeCartDeliverySlaEstimate(vendors, customer);
}
