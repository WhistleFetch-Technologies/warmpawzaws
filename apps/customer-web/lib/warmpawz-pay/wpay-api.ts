import { apiClient } from '@/lib/api-client';

export type WpayVendorCard = {
  vendorId: string;
  name: string;
  phone: string | null;
  address: string;
  photoUrl: string | null;
  discountPercent: number;
  category: string | null;
};

export type WpayVendorDetail = WpayVendorCard & {
  rating: number;
  reviewCount: number;
  maxDiscountAmount: number | null;
  offerLabel: string;
};

export type WpayTransactionCard = {
  paymentId: string;
  vendorId: string;
  vendorName: string;
  vendorCategory: string | null;
  originalAmount: number;
  discountPercent: number;
  discountAmount: number;
  payableAmount: number;
  paidAt: string;
};

type ListEnvelope<T> = {
  success?: boolean;
  vendors?: T[];
  transactions?: T[];
  nextCursor?: string | null;
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

export function buildWpayVendorsUrl(opts: {
  limit: number;
  cursor?: string;
  category?: string;
}): string {
  const params = new URLSearchParams();
  params.set('limit', String(opts.limit));
  if (opts.cursor) params.set('cursor', opts.cursor);
  if (opts.category && opts.category !== 'all') params.set('category', opts.category);
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
