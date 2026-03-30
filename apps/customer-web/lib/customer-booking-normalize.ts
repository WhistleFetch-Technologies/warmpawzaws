/**
 * Normalize raw booking rows from customer APIs (mixed camelCase / snake_case)
 * so UI never calls .charAt / .toLowerCase on undefined.
 */

export function titleCaseBookingLabel(value: unknown, emptyLabel = 'Unknown'): string {
  const s = String(value ?? '').replace(/_/g, ' ').trim();
  const t = (s || String(emptyLabel)).trim();
  if (!t) return 'Unknown';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Shape used by pet booking history (CustomerPetDetails, PetProfileDashboard, etc.) */
export type NormalizedPetBookingListItem = {
  id: string;
  serviceType: string;
  serviceName?: string;
  petId: string;
  petName: string;
  vendorName: string;
  startDate: string;
  endDate?: string;
  totalSessions: number;
  completedSessions: number;
  upcomingSessions: number;
  status: string;
  price: number;
  requiresOTP?: boolean;
  completionOTP?: string;
  scheduledDate?: string;
  createdAt: string;
};

export function normalizePetBookingListItem(b: any): NormalizedPetBookingListItem {
  if (b == null || typeof b !== 'object') {
    return {
      id: '',
      serviceType: 'booking',
      petId: '',
      petName: 'Pet',
      vendorName: 'Vendor',
      startDate: '',
      totalSessions: 1,
      completedSessions: 0,
      upcomingSessions: 0,
      status: 'pending',
      price: 0,
      createdAt: new Date().toISOString(),
    };
  }
  const rawStatus = b.status ?? b.booking_status ?? b.bookingStatus ?? 'pending';
  return {
    id: String(b.id ?? b.booking_id ?? b.bookingId ?? ''),
    serviceType: String(b.serviceType ?? b.service_type ?? 'booking'),
    serviceName: b.serviceName ?? b.service_name ?? b.service?.name,
    petId: String(b.petId ?? b.pet_id ?? ''),
    petName: String(b.petName ?? b.pet_name ?? b.pet?.name ?? 'Pet'),
    vendorName: String(
      b.vendorName ?? b.vendor_name ?? b.vendor?.businessName ?? b.vendor?.business_name ?? 'Vendor'
    ),
    startDate: String(b.startDate ?? b.start_date ?? b.booking_date ?? b.scheduled_date ?? ''),
    endDate: b.endDate ?? b.end_date,
    totalSessions: Number(b.totalSessions ?? b.total_sessions ?? 1) || 1,
    completedSessions: Number(b.completedSessions ?? b.completed_sessions ?? 0) || 0,
    upcomingSessions: Number(b.upcomingSessions ?? b.upcoming_sessions ?? 0) || 0,
    status: String(rawStatus || 'pending'),
    price: Number(b.price ?? b.total_amount ?? b.totalAmount ?? b.amount ?? 0) || 0,
    requiresOTP: !!(b.requiresOTP ?? b.requires_otp),
    completionOTP: b.completionOTP ?? b.completion_otp ?? b.otp_code ?? b.otpCode,
    scheduledDate: b.scheduledDate ?? b.scheduled_date,
    createdAt: String(
      b.createdAt ?? b.created_at ?? b.booking_date ?? b.scheduled_date ?? new Date().toISOString()
    ),
  };
}

/** Sidebar / account list rows from GET /customer/bookings?phone= */
export function coerceCustomerBookingListRow(b: any): Record<string, any> {
  if (b == null || typeof b !== 'object') {
    return {
      id: '',
      serviceType: 'booking',
      status: 'pending',
      petId: '',
      petName: 'Pet',
      vendorId: '',
      vendorName: 'Vendor',
      startDate: '',
      endDate: '',
      duration: '',
      frequency: 'single',
      schedule: 'anytime',
      totalSessions: 1,
      completedSessions: 0,
      upcomingSessions: 0,
      price: 0,
    };
  }
  return {
    ...b,
    id: String(b.id ?? b.booking_id ?? b.bookingId ?? ''),
    serviceType: String(b.service_type ?? b.serviceType ?? 'booking'),
    status: String(b.status ?? b.booking_status ?? b.bookingStatus ?? 'pending'),
    petId: String(b.pet_id ?? b.petId ?? ''),
    petName: String(b.pet_name ?? b.petName ?? 'Pet'),
    vendorId: String(b.vendor_id ?? b.vendorId ?? ''),
    vendorName: String(
      b.vendor_name ?? b.vendorName ?? b.vendor?.businessName ?? b.vendor?.business_name ?? 'Vendor'
    ),
    startDate: String(b.startDate ?? b.start_date ?? b.booking_date ?? b.scheduled_date ?? ''),
    endDate: b.endDate ?? b.end_date ?? '',
    duration: String(b.duration ?? b.duration_minutes ?? ''),
    frequency: b.frequency ?? 'single',
    schedule: b.schedule ?? 'anytime',
    totalSessions: Number(b.totalSessions ?? b.total_sessions ?? 1) || 1,
    completedSessions: Number(b.completedSessions ?? b.completed_sessions ?? 0) || 0,
    upcomingSessions: Number(b.upcomingSessions ?? b.upcoming_sessions ?? 0) || 0,
    price: Number(b.price ?? b.total_amount ?? b.totalAmount ?? 0) || 0,
    requiresOTP: !!(b.requiresOTP ?? b.requires_otp),
    completionOTP: b.completionOTP ?? b.completion_otp ?? b.otp_code ?? b.otpCode,
    otpVerifiedAt: b.otpVerifiedAt ?? b.otp_verified_at,
  };
}

export type NormalizedServiceHistoryBooking = {
  id: string;
  serviceType: string;
  serviceName: string;
  serviceStyle: string;
  status: string;
  scheduledDate: string;
  scheduledTime: string;
  petName: string;
  petId: string;
  vendorName: string;
  price: number;
  completionOTP?: string;
  requiresOTP: boolean;
  otpVerifiedAt?: string;
  createdAt: string;
};

export function normalizeServiceHistoryBooking(b: any): NormalizedServiceHistoryBooking {
  const serviceType = String(b?.serviceType ?? b?.service_type ?? '');
  return {
    id: String(b?.id ?? b?.booking_id ?? b?.bookingId ?? ''),
    serviceType,
    serviceName: String(b?.serviceName ?? b?.service_name ?? b?.service?.name ?? 'Service'),
    serviceStyle: String(b?.serviceStyle ?? b?.service_style ?? b?.service_type ?? ''),
    status: String(b?.status ?? b?.booking_status ?? 'pending'),
    scheduledDate: String(b?.scheduledDate ?? b?.scheduled_date ?? b?.booking_date ?? ''),
    scheduledTime: String(b?.scheduledTime ?? b?.scheduled_time ?? b?.booking_time ?? ''),
    petName: String(b?.petName ?? b?.pet_name ?? 'Pet'),
    petId: String(b?.petId ?? b?.pet_id ?? ''),
    vendorName: String(
      b?.vendorName ?? b?.vendor_name ?? b?.vendor?.businessName ?? b?.vendor?.business_name ?? 'Vendor'
    ),
    price: Number(b?.price ?? b?.total_amount ?? b?.totalAmount ?? 0) || 0,
    completionOTP: b?.completionOTP ?? b?.completion_otp ?? b?.otp_code,
    requiresOTP: !!(b?.requiresOTP ?? b?.requires_otp),
    otpVerifiedAt: b?.otpVerifiedAt ?? b?.otp_verified_at,
    createdAt: String(b?.createdAt ?? b?.created_at ?? ''),
  };
}

/** Extract bookings array from various API envelope shapes */
export function extractBookingsArray(result: any): any[] {
  if (result == null) return [];
  if (Array.isArray(result)) return result.filter((x) => x != null && typeof x === 'object');
  if (Array.isArray(result.bookings)) return result.bookings.filter((x: any) => x != null && typeof x === 'object');
  if (Array.isArray(result.data?.bookings))
    return result.data.bookings.filter((x: any) => x != null && typeof x === 'object');
  if (Array.isArray(result.data)) return result.data.filter((x: any) => x != null && typeof x === 'object');
  return [];
}
