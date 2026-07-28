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

/** Synthetic service id used for Warmpawz Appointments slot + checkout APIs */
export const WAPPT_APPOINTMENT_SERVICE_ID = 'warmpawz_appointments';

/** Default slot duration when no per-service selection (flat-fee catalogue booking). */
export const WAPPT_DEFAULT_SLOT_DURATION_MIN = 30;

export function resolveWarmpawzBookingCategory(serviceType?: string): string {
  const raw = String(serviceType || 'grooming').trim().toLowerCase();
  if (raw === 'vet' || raw === 'veterinarian') return 'vet';
  if (raw === 'training' || raw === 'trainer') return 'training';
  if (raw === 'sitting' || raw === 'walker' || raw === 'pet_sitter') return 'sitting';
  if (raw === 'boarding') return 'boarding';
  return raw || 'grooming';
}

export function getWarmpawzBookingHeaderInfo(opts: {
  category: string;
  serviceStyle: string;
}): { title: string; subtitle: string } {
  const cat = resolveWarmpawzBookingCategory(opts.category);
  const style = opts.serviceStyle;
  if (cat === 'vet') {
    if (style === 'tele') return { title: 'Tele Consultation', subtitle: 'Schedule, pet & details' };
    if (style === 'at_home') return { title: 'Home Visit', subtitle: 'Schedule, pet & address' };
    return { title: 'Clinic Visit', subtitle: 'Schedule, pet & location' };
  }
  if (cat === 'training') {
    if (style === 'at_home') return { title: 'Home Training', subtitle: 'Schedule, pet & address' };
    return { title: 'Training Session', subtitle: 'Schedule, pet & location' };
  }
  if (cat === 'sitting') {
    return { title: 'Pet Sitting', subtitle: 'Schedule, pet & address' };
  }
  if (style === 'at_home') {
    return { title: 'At-Home Appointment', subtitle: 'Schedule, pet & address' };
  }
  return { title: 'Book Appointment', subtitle: 'Schedule, pet & location' };
}

export function getWarmpawzLocationFallbackLabel(category: string): string {
  const cat = resolveWarmpawzBookingCategory(category);
  if (cat === 'vet') return 'Clinic';
  if (cat === 'training') return 'Training Center';
  return 'Service Location';
}

export function resolveWarmpawzBookingScreen(category?: string): string {
  const cat = resolveWarmpawzBookingCategory(category);
  if (cat === 'vet') return 'vet-booking';
  if (cat === 'training') return 'training-booking';
  if (cat === 'sitting') return 'sitting-booking';
  return 'grooming-booking';
}

export function getWarmpawzAppointmentServiceLabel(opts: {
  category: string;
  serviceStyle: string;
}): string {
  const cat = resolveWarmpawzBookingCategory(opts.category);
  const style = opts.serviceStyle;
  if (cat === 'vet') {
    if (style === 'tele') return 'Tele Consultation';
    if (style === 'at_home') return 'Home Visit Appointment';
    return 'Clinic Visit Appointment';
  }
  if (cat === 'training') return 'Training Appointment';
  if (cat === 'sitting') return 'Pet Sitting Appointment';
  if (style === 'at_home') return 'At-Home Appointment';
  return 'Appointment';
}
