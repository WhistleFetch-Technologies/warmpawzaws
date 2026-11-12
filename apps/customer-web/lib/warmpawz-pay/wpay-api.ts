import { apiClient } from '@/lib/api-client';

export const WPAY_HISTORY_PATH = '/warmpawz-pay/history';

export type WpayVendorCard = {
  vendorId: string;
  name: string;
  phone: string | null;
  address: string;
  photoUrl: string | null;
  discountPercent: number;
  hasCashback?: boolean;
  category: string | null;
};

export type WpayVendorDetail = WpayVendorCard & {
  rating: number;
  reviewCount: number;
  maxDiscountAmount: number | null;
  offerLabel: string;
  commercialModel?: 'tier_commission' | 'withhold';
  platformFee?: number;
  platformFeeMode?: 'fixed' | 'percent';
  platformFeeGstRate?: number;
  convenienceFee?: number;
  convenienceFeeMode?: 'fixed' | 'percent';
  convenienceGstRate?: number;
};

export type WpayTransactionCard = {
  paymentId: string;
  vendorId: string;
  vendorName: string;
  originalAmount: number;
  discountPercent: number;
  discountAmount: number;
  servicePayableAmount?: number;
  platformFee?: number;
  platformFeeGstAmount?: number;
  platformFeeGstRate?: number;
  convenienceFee?: number;
  convenienceGstAmount?: number;
  convenienceGstRate?: number;
  payableAmount: number;
  walletAmount?: number;
  commercialModel?: string | null;
  paidAt: string;
};

export type WpayAppointmentContextBooking = {
  bookingId: string;
  status: string;
  serviceName: string;
  vendorName: string;
  bookingDate: string | null;
  bookingTime: string | null;
  bookingDatetime: string | null;
  appointmentFee: number;
  otpCode: string | null;
  completionOtp: string | null;
  otpVerified: boolean;
  creditEligible: boolean;
};

export type WpayAppointmentContext = {
  success: boolean;
  hasOpenAppointment: boolean;
  openAppointment: WpayAppointmentContextBooking | null;
  creditEligibleBooking: WpayAppointmentContextBooking | null;
};

type ListEnvelope<T> = {
  success?: boolean;
  vendors?: T[];
  transactions?: T[];
  nextCursor?: string | null;
  resolvedCategory?: string | null;
  searchText?: string;
  taxonomyHub?: string | null;
};

export function wpayVendorsFromResponse(data: unknown): WpayVendorCard[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as ListEnvelope<WpayVendorCard>;
  return Array.isArray(d.vendors) ? d.vendors : [];
}

export function wpayTransactionsFromResponse(data: unknown): WpayTransactionCard[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as ListEnvelope<WpayTransactionCard>;
  return Array.isArray(d.transactions) ? d.transactions : [];
}

export function wpayNextCursor(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const c = (data as { nextCursor?: unknown }).nextCursor;
  return c != null && String(c).trim() ? String(c) : null;
}

export function wpayResolvedCategory(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const raw = (data as { resolvedCategory?: unknown }).resolvedCategory;
  const s = raw != null ? String(raw).trim() : '';
  return s || null;
}

export function buildWpayVendorsUrl(opts: {
  limit: number;
  cursor?: string;
  category?: string;
  q?: string;
}): string {
  const params = new URLSearchParams();
  params.set('limit', String(opts.limit));
  if (opts.cursor) params.set('cursor', opts.cursor);
  if (opts.category && opts.category !== 'all') params.set('category', opts.category);
  const q = opts.q?.trim();
  if (q) params.set('q', q);
  return `/customer/warmpawz-pay/vendors?${params.toString()}`;
}

export function buildWpayTransactionsUrl(opts: {
  limit: number;
  cursor?: string;
  phone: string;
}): string {
  const params = new URLSearchParams();
  params.set('limit', String(opts.limit));
  params.set('phone', opts.phone);
  if (opts.cursor) params.set('cursor', opts.cursor);
  return `/customer/warmpawz-pay/transactions?${params.toString()}`;
}

export async function fetchWpayVendorDetail(vendorId: string): Promise<WpayVendorDetail | null> {
  const res = await apiClient.get<{ success?: boolean; vendor?: WpayVendorDetail }>(
    `/customer/warmpawz-pay/vendors/${encodeURIComponent(vendorId)}`
  );
  return res?.vendor ?? null;
}

export function buildWpayAppointmentContextUrl(vendorId: string, phone: string): string {
  const params = new URLSearchParams();
  params.set('vendorId', vendorId);
  params.set('phone', phone);
  return `/customer/warmpawz-pay/appointment-context?${params.toString()}`;
}

export async function fetchWpayAppointmentContext(
  vendorId: string,
  phone: string,
): Promise<WpayAppointmentContext | null> {
  const res = await apiClient.get<WpayAppointmentContext>(
    buildWpayAppointmentContextUrl(vendorId, phone),
  );
  return res?.success ? res : null;
}

export function readCustomerPhoneFromStorage(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('customerPhone') ||
    localStorage.getItem('customer_phone') ||
    ''
  ).trim();
}

/** Must match backend `PLATFORM_CUSTOMER_LEGAL_VERSION`. */
export const WPAY_PLATFORM_LEGAL_VERSION = 'platform_tos_privacy_v1';

export type WpayLegalAcceptanceStatus = {
  success?: boolean;
  accepted: boolean;
  policyVersion: string;
  acceptedAt?: string | null;
  source?: string | null;
  error?: string;
};

export async function fetchWpayLegalAcceptanceStatus(
  phone: string,
  policyVersion: string = WPAY_PLATFORM_LEGAL_VERSION,
): Promise<WpayLegalAcceptanceStatus> {
  const params = new URLSearchParams();
  params.set('phone', phone);
  params.set('policyVersion', policyVersion);
  const res = await apiClient.get<WpayLegalAcceptanceStatus>(
    `/customer/warmpawz-pay/legal-acceptance?${params.toString()}`,
  );
  return {
    success: res?.success,
    accepted: Boolean(res?.accepted),
    policyVersion: res?.policyVersion || policyVersion,
    acceptedAt: res?.acceptedAt ?? null,
    source: res?.source ?? null,
    error: res?.error,
  };
}

export async function recordWpayLegalAcceptance(params: {
  phone: string;
  policyVersion?: string;
  source?: string;
}): Promise<WpayLegalAcceptanceStatus> {
  const res = await apiClient.post<WpayLegalAcceptanceStatus>(
    '/customer/warmpawz-pay/legal-acceptance',
    {
      phone: params.phone,
      policyVersion: params.policyVersion || WPAY_PLATFORM_LEGAL_VERSION,
      source: params.source || 'warmpawz_pay',
    },
  );
  return {
    success: res?.success,
    accepted: Boolean(res?.accepted ?? res?.success),
    policyVersion: res?.policyVersion || params.policyVersion || WPAY_PLATFORM_LEGAL_VERSION,
    acceptedAt: res?.acceptedAt ?? null,
    source: res?.source ?? null,
    error: res?.error,
  };
}
