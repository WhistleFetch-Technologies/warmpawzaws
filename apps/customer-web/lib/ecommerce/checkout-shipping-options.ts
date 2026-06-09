import type { DeliverySpeed } from '@/lib/ecommerce/cart-pricing';

export type CheckoutShippingOption = {
  id: DeliverySpeed;
  label: string;
  description: string;
  eta: string;
  feeLabel: string;
};

/** Standard delivery only — express not offered yet. */
export const CHECKOUT_SHIPPING_OPTIONS: CheckoutShippingOption[] = [
  {
    id: 'standard',
    label: 'Standard delivery',
    description: 'Delivered in 2–3 business days',
    eta: '2–3 days',
    feeLabel: '₹60',
  },
];

export function getShippingOptionLabel(id: DeliverySpeed): string {
  return CHECKOUT_SHIPPING_OPTIONS.find((o) => o.id === id)?.label ?? 'Standard delivery';
}
