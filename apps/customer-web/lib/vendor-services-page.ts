import { discoveryNextCursor } from '@/lib/discovery-list';
import { mergeCustomerVendorServicesPayload } from '@/lib/customer-vendor-services-merge';

export const VENDOR_SERVICES_PAGE_SIZE = 5;

export function buildVendorServicesPageUrl(opts: {
  vendorId: string;
  serviceStyle?: string;
  category?: string;
  customerPhone?: string;
  limit?: number;
  cursor?: string | null;
}): string {
  const limit = opts.limit ?? VENDOR_SERVICES_PAGE_SIZE;
  const q = new URLSearchParams();
  if (opts.serviceStyle) q.set('serviceStyle', opts.serviceStyle);
  if (opts.category) q.set('category', opts.category);
  if (opts.customerPhone) q.set('customerPhone', opts.customerPhone);
  q.set('limit', String(limit));
  if (opts.cursor) q.set('cursor', opts.cursor);
  return `/customer/vendor/${encodeURIComponent(opts.vendorId)}/services?${q.toString()}`;
}

export function vendorServicesNextCursor(data: unknown): string | null {
  return discoveryNextCursor(data);
}

export function vendorServicesRowsFromResponse(
  data: { services?: unknown[]; packages?: unknown[] } | null | undefined
): unknown[] {
  return mergeCustomerVendorServicesPayload(data);
}
