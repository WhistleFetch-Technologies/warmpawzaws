import { resolveEffectiveMealDeliveryState } from '@warmpawz/shared-types';
import type { MealKitchenProgressOptions } from '@/lib/meal-kitchen-progress';

export type MealTrackingHeroVariant = 'delivered' | 'preparing' | 'out_for_delivery' | 'cancelled' | 'default';

export function resolveMealTrackingHeroVariant(
  orderStatus: string,
  logisticsStatus: string | null | undefined,
  options: MealKitchenProgressOptions & { isCancelled?: boolean; isDelivered?: boolean },
): MealTrackingHeroVariant {
  if (options.isCancelled) return 'cancelled';
  if (options.isDelivered) return 'delivered';
  const eff = resolveEffectiveMealDeliveryState(orderStatus, logisticsStatus, options);
  if (eff === 'on_the_way' || eff === 'picked_up') return 'out_for_delivery';
  if (eff === 'preparing' || eff === 'ready_for_pickup' || eff === 'confirmed' || eff === 'pending') {
    return 'preparing';
  }
  return 'default';
}

export function formatTrackingTimestamp(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTrackingTimeOnly(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function formatTrackingDateLabel(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  if (sameDay) return 'Today';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Map step index (0–5) to optional ISO timestamps from tracking payload. */
export function buildMealTimelineTimestamps(
  order: Record<string, unknown>,
  tracking: Record<string, unknown> | null | undefined,
): Partial<Record<number, string>> {
  const t = tracking ?? {};
  const created = String(order.created_at ?? order.createdAt ?? '');
  const out: Partial<Record<number, string>> = {};
  if (created) out[0] = created;
  const preparing =
    (t.preparing_at as string) ||
    (t.preparingAt as string) ||
    (order.preparing_at as string);
  if (preparing) out[1] = preparing;
  const ready =
    (t.ready_at as string) ||
    (t.readyAt as string) ||
    (order.ready_at as string);
  if (ready) out[2] = ready;
  const picked = (t.pickedUpAt as string) || (t.picked_up_at as string);
  if (picked) out[3] = picked;
  const ofd =
    (t.out_for_delivery_at as string) ||
    (t.on_the_way_at as string) ||
    (t.assignedAt as string);
  if (ofd) out[4] = ofd;
  const delivered = (t.deliveredAt as string) || (t.delivered_at as string);
  if (delivered) out[5] = delivered;
  return out;
}

export function resolvePaymentMethodLabel(order: Record<string, unknown>): string | null {
  const raw =
    order.payment_method ??
    order.paymentMethod ??
    order.payment_mode ??
    order.paymentMode;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const lower = raw.trim().toLowerCase();
  if (lower === 'upi') return 'Paid via UPI';
  if (lower === 'card') return 'Paid via Card';
  if (lower === 'netbanking') return 'Paid via Net Banking';
  if (lower === 'wallet') return 'Paid via Wallet';
  if (lower === 'cod') return 'Cash on Delivery';
  if (lower.includes('razorpay')) return 'Paid online';
  return `Paid via ${raw.trim()}`;
}
