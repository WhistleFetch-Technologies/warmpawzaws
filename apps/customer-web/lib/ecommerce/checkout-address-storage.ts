/** Unified checkout delivery address selection (cart + shop + checkout). */
export const WARMPAWZ_CHECKOUT_ADDRESS_ID_KEY = 'warmpawz_checkout_address_id';

/** Legacy shop key — read for migration, write both keys on select. */
export const WARMPAWZ_SHOP_DELIVERY_ADDRESS_ID_KEY = 'warmpawz_shop_delivery_address_id';

export function readCheckoutAddressId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return (
      sessionStorage.getItem(WARMPAWZ_CHECKOUT_ADDRESS_ID_KEY) ||
      sessionStorage.getItem(WARMPAWZ_SHOP_DELIVERY_ADDRESS_ID_KEY)
    );
  } catch {
    return null;
  }
}

export function writeCheckoutAddressId(addressId: string | null | undefined): void {
  if (typeof window === 'undefined' || !addressId) return;
  try {
    sessionStorage.setItem(WARMPAWZ_CHECKOUT_ADDRESS_ID_KEY, addressId);
    sessionStorage.setItem(WARMPAWZ_SHOP_DELIVERY_ADDRESS_ID_KEY, addressId);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearCheckoutAddressId(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(WARMPAWZ_CHECKOUT_ADDRESS_ID_KEY);
    sessionStorage.removeItem(WARMPAWZ_SHOP_DELIVERY_ADDRESS_ID_KEY);
  } catch {
    /* ignore */
  }
}
