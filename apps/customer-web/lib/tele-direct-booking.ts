/**
 * Deep link for tele "Book Now" → /booking/tele with instant auto-pay flow.
 * Query contract: service=tele, mode=instant, autoPay=true
 * (+ optional serviceId, petId, roleId, category, vendorId).
 * Offer overlay: offerName, price, desc — payment page uses these for label and amount
 * (vendor/service IDs still come from API or static fallbacks).
 */
export function buildTeleInstantAutoPayBookingUrl(params?: {
  serviceId?: string;
  vendorId?: string;
  petId?: string;
  roleId?: string;
  category?: string;
  offerName?: string;
  price?: number;
  desc?: string;
}): string {
  const sp = new URLSearchParams();
  sp.set('service', 'tele');
  sp.set('mode', 'instant');
  sp.set('autoPay', 'true');
  if (params?.serviceId) sp.set('serviceId', params.serviceId);
  if (params?.vendorId) sp.set('vendorId', params.vendorId);
  if (params?.petId) sp.set('petId', params.petId);
  if (params?.roleId) sp.set('roleId', params.roleId);
  if (params?.category) sp.set('category', params.category);
  if (params?.offerName?.trim()) sp.set('offerName', params.offerName.trim());
  if (params?.price != null && Number.isFinite(params.price) && params.price >= 0) {
    sp.set('price', String(params.price));
  }
  if (params?.desc?.trim()) sp.set('desc', params.desc.trim());
  return `/booking/tele?${sp.toString()}`;
}

/** Fallback when leaving payment / errors: same flow without auto-pay (queue UI). */
export const TELE_BOOKING_FALLBACK_QUERY = 'service=tele&mode=instant' as const;
