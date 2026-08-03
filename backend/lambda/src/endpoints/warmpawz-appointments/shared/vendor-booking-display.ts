import {
  WAPPT_BOOKING_MODE,
  WAPPT_DISPLAY_SERVICE_NAME,
} from './wappt-booking-preflight';

export type VendorBookingDisplayLike = {
  commerce_mode?: string | null;
  commerceMode?: string | null;
  service_name?: string | null;
  serviceName?: string | null;
  service_type?: string | null;
  serviceType?: string | null;
  service_style?: string | null;
  serviceStyle?: string | null;
  communicationType?: string | null;
};

export function isWarmpawzAppointmentsCommerceMode(
  booking: VendorBookingDisplayLike,
): boolean {
  const mode = String(
    booking.commerce_mode ?? booking.commerceMode ?? '',
  ).toLowerCase();
  return mode === WAPPT_BOOKING_MODE;
}

/** Tele / video — tele wins over WAPPT display rules. */
export function isTeleServiceStyle(booking: VendorBookingDisplayLike): boolean {
  if (String(booking.communicationType || '').toLowerCase() === 'video') {
    return true;
  }
  const st = String(
    booking.service_style ??
      booking.serviceStyle ??
      booking.service_type ??
      booking.serviceType ??
      '',
  )
    .toLowerCase()
    .trim();
  return (
    st === 'tele' ||
    st === 'video_consultation' ||
    st === 'tele_consultation' ||
    st === 'teleconsultation' ||
    st.includes('tele')
  );
}

export function resolveVendorBookingServiceDisplayName(
  booking: VendorBookingDisplayLike,
  catalogFallback?: string | null,
): string {
  const catalog =
    String(catalogFallback || '').trim() ||
    String(booking.service_name ?? booking.serviceName ?? '').trim() ||
    'Service';

  if (isTeleServiceStyle(booking)) {
    return catalog;
  }

  if (isWarmpawzAppointmentsCommerceMode(booking)) {
    return WAPPT_DISPLAY_SERVICE_NAME;
  }

  return catalog;
}

/** Vendor UI/API: hide slot fee / catalog price for WAPPT non-tele appointments. */
export function shouldExposeVendorBookingPrice(
  booking: VendorBookingDisplayLike,
): boolean {
  if (isTeleServiceStyle(booking)) {
    return true;
  }
  return !isWarmpawzAppointmentsCommerceMode(booking);
}

export type VendorBookingDisplayPatch = {
  serviceName: string;
  service_name: string;
  price: number | null;
  totalAmount: number | null;
  total_amount: number | null;
  basePrice: number | null;
  base_price: number | null;
  commerceMode: string;
  commerce_mode: string;
};

export function applyVendorBookingDisplayFields(
  booking: VendorBookingDisplayLike,
  opts: {
    catalogServiceName?: string | null;
    vendorVisibleAmount?: number | null;
  } = {},
): VendorBookingDisplayPatch {
  const commerceMode = String(
    booking.commerce_mode ?? booking.commerceMode ?? 'marketplace',
  );
  const serviceLabel = resolveVendorBookingServiceDisplayName(
    booking,
    opts.catalogServiceName,
  );
  const exposePrice = shouldExposeVendorBookingPrice(booking);
  const amount =
    opts.vendorVisibleAmount != null &&
    Number.isFinite(Number(opts.vendorVisibleAmount))
      ? Math.round(Number(opts.vendorVisibleAmount) * 100) / 100
      : null;

  return {
    serviceName: serviceLabel,
    service_name: serviceLabel,
    price: exposePrice ? amount : null,
    totalAmount: exposePrice ? amount : null,
    total_amount: exposePrice ? amount : null,
    basePrice: exposePrice ? amount : null,
    base_price: exposePrice ? amount : null,
    commerceMode,
    commerce_mode: commerceMode,
  };
}

/** Notifications: WAPPT non-tele uses "Appointment"; tele uses catalog name. */
export function resolveBookingNotificationServiceName(
  booking: Record<string, unknown>,
  joinedServiceName?: string | null,
): string {
  return resolveVendorBookingServiceDisplayName(
    booking as VendorBookingDisplayLike,
    joinedServiceName ||
      String(booking.service_name || booking.serviceName || '').trim() ||
      null,
  );
}
