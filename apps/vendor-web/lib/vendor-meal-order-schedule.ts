import { formatBookingTime } from '@/components/vendor/dashboard/helpers';
import type { ScheduleItem } from '@/components/vendor/dashboard/types';

export type VendorScheduleTypeFilter = 'all' | 'clinic' | 'home' | 'tele' | 'meal_orders';

const TERMINAL_MEAL_STATUSES = new Set(['delivered', 'cancelled', 'failed']);

function mealOrderDateKey(order: Record<string, unknown>): string | null {
  const raw =
    order.scheduled_delivery_date ??
    order.delivery_date ??
    order.created_at;
  if (raw == null || raw === '') return null;
  return String(raw).slice(0, 10);
}

/** Filter active meal orders for Today / Week / Month dashboard tabs. */
export function filterMealOrdersByTimeframe(
  orders: Record<string, unknown>[],
  timeframe: 'today' | 'week' | 'month',
): Record<string, unknown>[] {
  const todayStr = new Date().toISOString().split('T')[0];
  const start = new Date();
  if (timeframe === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (timeframe === 'week') {
    start.setDate(start.getDate() - 7);
  } else {
    start.setMonth(start.getMonth() - 1);
  }
  const startStr = start.toISOString().split('T')[0];

  return orders.filter((order) => {
    const status = String(
      order.effective_delivery_status ?? order.status ?? '',
    ).toLowerCase();
    if (TERMINAL_MEAL_STATUSES.has(status)) return false;

    const dateKey = mealOrderDateKey(order);
    if (!dateKey) return timeframe !== 'today';

    if (timeframe === 'today') return dateKey === todayStr;
    return dateKey >= startStr;
  });
}

export function mapMealOrderToScheduleItem(order: Record<string, unknown>): ScheduleItem {
  const timeRaw = order.delivery_time ?? order.deliveryTime;
  const time =
    typeof timeRaw === 'string' && timeRaw.trim()
      ? formatBookingTime(timeRaw)
      : mealOrderDateKey(order)
        ? 'Scheduled'
        : '—';

  const mealName =
    (typeof order.meal_plan_name === 'string' && order.meal_plan_name) ||
    (typeof order.mealPlanName === 'string' && order.mealPlanName) ||
    (Array.isArray(order.items) &&
      typeof (order.items[0] as { name?: string })?.name === 'string' &&
      (order.items[0] as { name: string }).name) ||
    'Meal order';

  const orderNumber =
    typeof order.order_number === 'string'
      ? order.order_number
      : typeof order.orderNumber === 'string'
        ? order.orderNumber
        : '';

  const addressRaw = order.delivery_address ?? order.deliveryAddress;
  let address = '';
  if (typeof addressRaw === 'string') address = addressRaw;
  else if (addressRaw && typeof addressRaw === 'object' && 'address' in addressRaw) {
    address = String((addressRaw as { address?: string }).address ?? '');
  }

  const price = Number(order.vendor_meal_total ?? order.subtotal ?? 0) || 0;

  return {
    id: String(order.id ?? ''),
    bookingId: String(order.id ?? ''),
    time,
    duration: 0,
    petName:
      (typeof order.pet_name === 'string' && order.pet_name) ||
      (typeof order.petName === 'string' && order.petName) ||
      'Pet',
    customerName:
      (typeof order.customer_name === 'string' && order.customer_name) ||
      (typeof order.customerName === 'string' && order.customerName) ||
      'Customer',
    customerPhone:
      (typeof order.customer_phone === 'string' && order.customer_phone) ||
      (typeof order.customerPhone === 'string' && order.customerPhone) ||
      '',
    serviceName: orderNumber ? `#${orderNumber}` : mealName,
    serviceType: 'meal_order',
    status: String(order.effective_delivery_status ?? order.status ?? 'pending'),
    price,
    address,
  };
}

export function mapMealOrdersToSchedule(
  orders: unknown[],
  timeframe: 'today' | 'week' | 'month',
): ScheduleItem[] {
  const rows = orders.filter(
    (o): o is Record<string, unknown> => typeof o === 'object' && o != null,
  );
  return filterMealOrdersByTimeframe(rows, timeframe).map(mapMealOrderToScheduleItem);
}

/** Bookings + meal orders for nutritionist "All Types" on the home schedule. */
export function mergeAllTypesSchedule(
  bookings: ScheduleItem[],
  mealOrders: ScheduleItem[],
): ScheduleItem[] {
  return [...bookings, ...mealOrders];
}

export function isMealOrderScheduleItem(item: ScheduleItem): boolean {
  return item.serviceType === 'meal_order';
}
