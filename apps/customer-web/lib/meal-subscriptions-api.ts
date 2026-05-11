/**
 * Canonical meal subscription API (customer).
 */

import { apiClient } from '@/lib/api-client';

export type MealLifecycleFilter =
  | 'all'
  | 'active'
  | 'paused'
  | 'completed'
  | 'expired'
  | 'cancelled'
  | 'pending_payment';

export async function fetchMealSubscriptions(customerId: string, lifecycle: MealLifecycleFilter = 'all') {
  const q = new URLSearchParams({ customerId, lifecycle });
  return apiClient.get<{ success: boolean; subscriptions: Record<string, unknown>[] }>(
    `/meal/subscriptions?${q.toString()}`,
  );
}

export async function fetchMealSubscription(subscriptionId: string, customerId: string) {
  const q = new URLSearchParams({ customerId });
  return apiClient.get<{ success: boolean; subscription: Record<string, unknown> }>(
    `/meal/subscriptions/${subscriptionId}?${q.toString()}`,
  );
}

export async function fetchMealSubscriptionDeliveries(
  subscriptionId: string,
  customerId: string,
  limit = 50,
  offset = 0,
) {
  const q = new URLSearchParams({ customerId, limit: String(limit), offset: String(offset) });
  return apiClient.get<{
    success: boolean;
    deliveries: Record<string, unknown>[];
    total: number;
  }>(`/meal/subscriptions/${subscriptionId}/deliveries?${q.toString()}`);
}

export async function pauseMealSubscription(subscriptionId: string, customerId: string) {
  return apiClient.post<{ success: boolean; subscription: Record<string, unknown> }>(
    `/meal/subscriptions/${subscriptionId}/pause`,
    { customerId },
  );
}

export async function resumeMealSubscription(subscriptionId: string, customerId: string) {
  return apiClient.post<{ success: boolean; subscription: Record<string, unknown> }>(
    `/meal/subscriptions/${subscriptionId}/resume`,
    { customerId },
  );
}

export async function skipMealDelivery(deliveryId: string, customerId: string, reason?: string) {
  return apiClient.post<{ success: boolean; delivery: Record<string, unknown> }>(
    `/meal/subscription-deliveries/${deliveryId}/skip`,
    { customerId, reason },
  );
}

export async function rescheduleMealDelivery(deliveryId: string, customerId: string, newDeliveryDate: string) {
  return apiClient.post<{ success: boolean; delivery: Record<string, unknown> }>(
    `/meal/subscription-deliveries/${deliveryId}/reschedule`,
    { customerId, newDeliveryDate },
  );
}

export async function confirmMealSubscriptionPayment(
  subscriptionId: string,
  customerId: string,
  razorpayPaymentId?: string,
) {
  return apiClient.post<{ success: boolean; subscription: Record<string, unknown> }>(
    `/meal/subscriptions/${subscriptionId}/confirm-payment`,
    { customerId, razorpayPaymentId },
  );
}
