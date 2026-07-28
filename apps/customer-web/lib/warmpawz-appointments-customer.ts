/** Customer Warmpawz Appointments — runtime feature flag (mirrors Lambda WARMPAWZ_APPOINTMENTS_ENABLED). */
export function isWarmpawzAppointmentsCustomerEnabled(): boolean {
  if (typeof window !== 'undefined') {
    const runtime = (
      window as unknown as {
        __WARMPAWZ_RUNTIME_CONFIG__?: { warmpawzAppointmentsEnabled?: boolean | string };
      }
    ).__WARMPAWZ_RUNTIME_CONFIG__?.warmpawzAppointmentsEnabled;
    if (runtime === true || runtime === 'true') return true;
    if (runtime === false || runtime === 'false') return false;
  }
  return process.env.NEXT_PUBLIC_WARMPAWZ_APPOINTMENTS_ENABLED === 'true';
}

export function isWarmpawzAppointmentsVendor(row: Record<string, unknown> | null | undefined): boolean {
  if (!row) return false;
  return row.warmpawzAppointments === true;
}

export type WarmpawzAppointmentsBookingNav = {
  vendorId: string;
  vendorName: string;
  appointmentsMode: true;
  serviceStyle: string;
  serviceType: string;
};

export function buildWarmpawzAppointmentsBookingNav(opts: {
  vendorId: string;
  vendorName: string;
  serviceStyle: string;
  category: string;
}): WarmpawzAppointmentsBookingNav {
  return {
    vendorId: opts.vendorId,
    vendorName: opts.vendorName,
    appointmentsMode: true,
    serviceStyle: opts.serviceStyle,
    serviceType: opts.category,
  };
}
