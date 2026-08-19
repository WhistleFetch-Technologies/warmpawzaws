/**
 * Vendor configured selling price is the customer-price authority.
 * Admin catalogue base_price is default/reference only — never use it once the
 * vendor row has custom_price or price.
 *
 * Platform commission / vendor net must never become:
 *   booking.base_price, package customer price, taxable amount, or payable.
 *
 * Client checkout must not persist a promo- or commission-reduced amount as the base.
 */

function money2(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

export type SelectedServiceListLine = {
  price?: unknown;
  originalPrice?: unknown;
  original_price?: unknown;
  quantity?: unknown;
};

export type ResolveBookingListPriceInput = {
  /** Boarding / swimming / pet sitting server-billed stay total. */
  stayOrServerBilledTotal?: number | null;
  vendorCustomPrice?: unknown;
  vendorPrice?: unknown;
  selectedServices?: SelectedServiceListLine[] | null;
};

export function vendorRowListPrice(vendorCustomPrice: unknown, vendorPrice: unknown): number {
  const custom = money2(vendorCustomPrice);
  if (custom > 0) return custom;
  return money2(vendorPrice);
}

/**
 * Authoritative customer selling price for a vendor service/package row.
 * Ignores Admin catalogue default when the vendor has configured a price.
 */
export function resolveVendorConfiguredSellingPrice(params: {
  vendorCustomPrice?: unknown;
  vendorPrice?: unknown;
  /** Admin/catalogue default — used only when the vendor has not configured a price. */
  adminDefaultPrice?: unknown;
}): number {
  const vendor = vendorRowListPrice(params.vendorCustomPrice, params.vendorPrice);
  if (vendor > 0) return vendor;
  return money2(params.adminDefaultPrice);
}

/**
 * Package customer purchase base: vendor row first, then packageDetails.price.
 * Never let a stale/commission-adjusted metadata price override custom_price.
 */
export function resolvePackageCustomerSellingPrice(params: {
  vendorCustomPrice?: unknown;
  vendorPrice?: unknown;
  packageDetailsPrice?: unknown;
  packagePrice?: unknown;
}): number {
  const vendor = vendorRowListPrice(params.vendorCustomPrice, params.vendorPrice);
  if (vendor > 0) return vendor;
  return vendorRowListPrice(params.packageDetailsPrice, params.packagePrice);
}

/**
 * If the client amount is below the vendor selling price, keep the vendor price.
 * Higher client amounts (add-ons / stay totals) are allowed.
 */
export function preferVendorSellingPriceOverClientUndercut(
  vendorSellingPrice: unknown,
  clientAmount: unknown
): number {
  const vendor = money2(vendorSellingPrice);
  const client = money2(clientAmount);
  if (vendor > 0) return client > vendor ? client : vendor;
  return client;
}

/** Customer taxable after legitimate discounts only — never after commission. */
export function customerTaxableAfterDiscount(
  vendorSellingPrice: unknown,
  customerDiscount: unknown
): number {
  const list = money2(vendorSellingPrice);
  const disc = money2(customerDiscount);
  return Math.max(0, Math.round((list - disc) * 100) / 100);
}

export function sumSelectedServicesListPrice(
  selectedServices?: SelectedServiceListLine[] | null
): number {
  if (!selectedServices?.length) return 0;
  const sum = selectedServices.reduce((acc, line) => {
    const qty = Math.max(1, parseInt(String(line.quantity ?? 1), 10) || 1);
    const list = money2(line.originalPrice ?? line.original_price) || money2(line.price);
    return acc + list * qty;
  }, 0);
  return money2(sum);
}

/**
 * List used as the customer service base (before promo / commission).
 * Stay totals win. Single-line bookings prefer the vendor row so a baked
 * selectedServices.price (e.g. 1485 vs list 1650) cannot undercut.
 */
export function resolveBookingListPrice(input: ResolveBookingListPriceInput): number {
  const stay = money2(input.stayOrServerBilledTotal);
  if (stay > 0) return stay;

  const vendorList = vendorRowListPrice(input.vendorCustomPrice, input.vendorPrice);
  const selectedList = sumSelectedServicesListPrice(input.selectedServices);
  const selectedCount = input.selectedServices?.length ?? 0;

  if (selectedCount > 1 && selectedList > 0) {
    return Math.max(selectedList, vendorList);
  }
  if (vendorList > 0) return vendorList;
  return selectedList;
}

export function resolvePersistedBookingBasePrice(params: {
  listPrice: number;
  clientServicePrice?: number | null;
  calculatedBasePrice: number;
}): number {
  const list = money2(params.listPrice);
  const client = money2(params.clientServicePrice);
  const calculated = money2(params.calculatedBasePrice);
  if (list > 0) return Math.max(list, client);
  if (client > 0) return client;
  return calculated;
}

/** Promo quote base: vendor list, never a client undercut. */
export function resolvePromoValidationAmount(params: {
  listPrice: number;
  clientServicePrice?: number | null;
  grossPayableBeforeWallet: number;
}): number {
  const list = money2(params.listPrice);
  if (list > 0) return list;
  const client = money2(params.clientServicePrice);
  if (client > 0) return client;
  return money2(params.grossPayableBeforeWallet);
}
