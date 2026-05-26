import { apiClient } from '@/lib/api-client';

export async function fetchVendorMealSubscriptionDeliveries(
  vendorId: string,
  opts?: { status?: string; dateFrom?: string; dateTo?: string; limit?: number; offset?: number },
) {
  const q = new URLSearchParams();
  if (opts?.status) q.set('status', opts.status);
  if (opts?.dateFrom) q.set('dateFrom', opts.dateFrom);
  if (opts?.dateTo) q.set('dateTo', opts.dateTo);
  if (opts?.limit != null) q.set('limit', String(opts.limit));
  if (opts?.offset != null) q.set('offset', String(opts.offset));
  const qs = q.toString();
  return apiClient.get<{ success: boolean; deliveries: Record<string, unknown>[]; total: number }>(
    `/vendor/${vendorId}/meal-subscription-deliveries${qs ? `?${qs}` : ''}`,
  );
}

export async function fetchVendorMealSubscriptionDelivery(vendorId: string, deliveryId: string) {
  return apiClient.get<{ success: boolean; delivery: Record<string, unknown> }>(
    `/vendor/${vendorId}/meal-subscription-deliveries/${deliveryId}`,
  );
}

export async function patchVendorMealDeliveryStatus(vendorId: string, deliveryId: string, status: string) {
  return apiClient.patch<{ success: boolean; delivery: Record<string, unknown> }>(
    `/vendor/${vendorId}/meal-subscription-deliveries/${deliveryId}/status`,
    { status },
  );
}

export async function dispatchVendorMealDelivery(vendorId: string, deliveryId: string, notes?: string) {
  return apiClient.post<{ success: boolean; delivery: Record<string, unknown> }>(
    `/vendor/${vendorId}/meal-subscription-deliveries/${deliveryId}/dispatch`,
    { notes },
  );
}

export async function fetchVendorMealSubscriptionsOverview(vendorId: string) {
  return apiClient.get<{ success: boolean; subscriptions: Record<string, unknown>[] }>(
    `/vendor/${vendorId}/meal-subscriptions-overview`,
  );
}
