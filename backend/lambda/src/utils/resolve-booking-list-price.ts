/**
 * Vendor list / stay total used as bookings.base_price and financialMeta.servicePrice.
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
