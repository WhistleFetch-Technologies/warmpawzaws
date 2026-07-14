import {
  isMealOrderAwaitingPayment,
  isMealPaymentHoldExpired,
} from '@/lib/payment-hold-ui';
import type { MealPlanOrder } from '@/components/customer/meal-plans/MealPlanOrdersPanel';

export type MealOrderFilterId = 'all' | 'delivered' | 'upcoming' | 'cancelled';

export type MealOrderStatusTone = 'green' | 'blue' | 'red' | 'amber' | 'orange' | 'slate';

export function displayMealOrderStatusLabel(order: MealPlanOrder): string {
  if (
    isMealPaymentHoldExpired({
      status: order.status,
      paymentStatus: order.payment_status,
      paymentHoldExpiresAt: order.paymentHoldExpiresAt ?? order.payment_hold_expires_at,
      createdAt: order.created_at,
    })
  ) {
    return 'cancelled';
  }
  if (
    isMealOrderAwaitingPayment({
      status: order.status,
      paymentStatus: order.payment_status,
      paymentHoldExpiresAt: order.paymentHoldExpiresAt ?? order.payment_hold_expires_at,
      createdAt: order.created_at,
    })
  ) {
    return 'payment pending';
  }
  return order.status.replace(/_/g, ' ');
}

export function isMealOrderCancelled(order: MealPlanOrder): boolean {
  const label = displayMealOrderStatusLabel(order).toLowerCase();
  return label === 'cancelled' || order.status.toLowerCase() === 'cancelled';
}

export function isMealOrderDelivered(order: MealPlanOrder): boolean {
  return order.status.toLowerCase() === 'delivered';
}

export function isMealOrderOutForDelivery(order: MealPlanOrder): boolean {
  return ['out_for_delivery', 'dispatched', 'in_transit', 'arriving', 'on_way'].includes(
    order.status.toLowerCase(),
  );
}

export function isMealOrderUpcoming(order: MealPlanOrder): boolean {
  if (isMealOrderDelivered(order) || isMealOrderCancelled(order)) return false;
  return true;
}

export function matchesMealOrderFilter(order: MealPlanOrder, filter: MealOrderFilterId): boolean {
  if (filter === 'all') return true;
  if (filter === 'delivered') return isMealOrderDelivered(order);
  if (filter === 'cancelled') return isMealOrderCancelled(order);
  return isMealOrderUpcoming(order);
}

export function mealOrderStatusChipTone(order: MealPlanOrder): MealOrderStatusTone {
  if (isMealOrderCancelled(order)) return 'red';
  if (
    isMealOrderAwaitingPayment({
      status: order.status,
      paymentStatus: order.payment_status,
      paymentHoldExpiresAt: order.paymentHoldExpiresAt ?? order.payment_hold_expires_at,
      createdAt: order.created_at,
    })
  ) {
    return 'amber';
  }
  const status = order.status.toLowerCase();
  if (status === 'delivered') return 'green';
  if (isMealOrderOutForDelivery(order)) return 'orange';
  if (['preparing', 'confirmed', 'pending', 'ready'].includes(status)) return 'blue';
  return 'slate';
}

export function mealOrderStatusChipLabel(order: MealPlanOrder): string {
  const label = displayMealOrderStatusLabel(order);
  if (label === 'payment pending') return 'PAYMENT PENDING';
  if (isMealOrderOutForDelivery(order)) return 'OUT FOR DELIVERY';
  return label.toUpperCase();
}

export function mealOrderStatusMessage(order: MealPlanOrder): {
  tone: MealOrderStatusTone;
  title: string;
  subtitle?: string;
} {
  if (
    isMealOrderAwaitingPayment({
      status: order.status,
      paymentStatus: order.payment_status,
      paymentHoldExpiresAt: order.paymentHoldExpiresAt ?? order.payment_hold_expires_at,
      createdAt: order.created_at,
    })
  ) {
    return {
      tone: 'amber',
      title: 'Payment required to confirm your order.',
      subtitle: 'Complete payment within 5 minutes to confirm with the kitchen.',
    };
  }
  if (isMealOrderCancelled(order)) {
    return {
      tone: 'red',
      title: 'This order has been cancelled.',
    };
  }
  if (isMealOrderDelivered(order)) {
    return {
      tone: 'green',
      title: 'Delivered successfully',
      subtitle: "Hope your pet enjoyed today's meal.",
    };
  }
  if (isMealOrderOutForDelivery(order)) {
    return {
      tone: 'blue',
      title: 'Your rider is on the way.',
      subtitle: 'Track the delivery live.',
    };
  }
  return {
    tone: 'blue',
    title: 'Meal is being freshly prepared.',
    subtitle: "We'll notify you when it's on the way.",
  };
}

export function formatMealOrderDeliveryDate(raw: string | undefined): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatMealOrderDeliveryTime(raw: string | undefined): string {
  if (!raw?.trim()) return '—';
  return raw.trim();
}
