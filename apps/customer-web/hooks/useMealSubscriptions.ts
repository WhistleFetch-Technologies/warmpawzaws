'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchMealSubscription,
  fetchMealSubscriptionDeliveries,
  fetchMealSubscriptions,
  type MealLifecycleFilter,
} from '@/lib/meal-subscriptions-api';

export const mealSubscriptionKeys = {
  root: ['meal-subscriptions'] as const,
  list: (customerId: string, lifecycle: MealLifecycleFilter) =>
    [...mealSubscriptionKeys.root, 'list', customerId, lifecycle] as const,
  detail: (customerId: string, subscriptionId: string) =>
    [...mealSubscriptionKeys.root, 'detail', customerId, subscriptionId] as const,
  deliveries: (customerId: string, subscriptionId: string) =>
    [...mealSubscriptionKeys.root, 'deliveries', customerId, subscriptionId] as const,
};

export function useMealSubscriptionsList(customerId: string | null, lifecycle: MealLifecycleFilter = 'all') {
  return useQuery({
    queryKey: customerId ? mealSubscriptionKeys.list(customerId, lifecycle) : ['meal-subscriptions', 'noop'],
    queryFn: async () => {
      if (!customerId) return [];
      const res = await fetchMealSubscriptions(customerId, lifecycle);
      return res.subscriptions || [];
    },
    enabled: !!customerId,
  });
}

export function useMealSubscriptionDetail(customerId: string | null, subscriptionId: string) {
  return useQuery({
    queryKey: customerId ? mealSubscriptionKeys.detail(customerId, subscriptionId) : ['meal-subscriptions', 'noop-detail'],
    queryFn: async () => {
      if (!customerId) return null;
      const res = await fetchMealSubscription(subscriptionId, customerId);
      return res.subscription || null;
    },
    enabled: !!customerId && !!subscriptionId,
  });
}

export function useMealSubscriptionDeliveriesQuery(customerId: string | null, subscriptionId: string) {
  return useQuery({
    queryKey: customerId
      ? mealSubscriptionKeys.deliveries(customerId, subscriptionId)
      : ['meal-subscriptions', 'noop-deliveries'],
    queryFn: async () => {
      if (!customerId) return { deliveries: [], total: 0 };
      const res = await fetchMealSubscriptionDeliveries(subscriptionId, customerId, 100, 0);
      return { deliveries: res.deliveries || [], total: res.total ?? 0 };
    },
    enabled: !!customerId && !!subscriptionId,
  });
}

export function useInvalidateMealSubscriptions() {
  const qc = useQueryClient();
  return (customerId?: string) => {
    if (customerId) {
      qc.invalidateQueries({ queryKey: [...mealSubscriptionKeys.root, 'list', customerId] });
    } else {
      qc.invalidateQueries({ queryKey: mealSubscriptionKeys.root });
    }
  };
}
