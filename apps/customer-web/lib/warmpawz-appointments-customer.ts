import { resolveServiceBookingCommerceRouteForNavigation } from '@/lib/commerce-switch-routing';

export const WAPPT_APPOINTMENT_SERVICE_ID = 'warmpawz_appointments';

export function isWarmpawzAppointmentsHubEnabled(category: string): boolean {
  const route = resolveServiceBookingCommerceRouteForNavigation({
    serviceKey: category,
    category,
  });
  return !route.useMarketplaceFlow && !route.excludedDomain;
}

export type WarmpawzAppointmentsBookingNav = {
  vendorId: string;
  vendorName?: string;
  serviceStyle: string;
  category: string;
  appointmentsMode: true;
  serviceId: typeof WAPPT_APPOINTMENT_SERVICE_ID;
  bookingMode: typeof WAPPT_APPOINTMENT_SERVICE_ID;
};

export function buildWarmpawzAppointmentsBookingNav(opts: {
  vendorId: string;
  vendorName?: string;
  serviceStyle: string;
  category: string;
}): WarmpawzAppointmentsBookingNav {
  return {
    vendorId: opts.vendorId,
    vendorName: opts.vendorName,
    serviceStyle: opts.serviceStyle,
    category: opts.category,
    appointmentsMode: true,
    serviceId: WAPPT_APPOINTMENT_SERVICE_ID,
    bookingMode: WAPPT_APPOINTMENT_SERVICE_ID,
  };
}

export function getWarmpawzAppointmentBookingTitle(category: string): {
  title: string;
  subtitle: string;
} {
  const label = category.charAt(0).toUpperCase() + category.slice(1);
  return { title: 'Book Appointment', subtitle: `${label} · schedule & pay flat fee` };
}
