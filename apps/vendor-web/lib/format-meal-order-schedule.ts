import { formatBookingTime } from '@/components/vendor/dashboard/helpers';

function parseSlotStart(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  let slot: { start?: string; end?: string } | null = null;
  if (typeof raw === 'string') {
    try {
      slot = JSON.parse(raw) as { start?: string };
    } catch {
      return null;
    }
  } else if (typeof raw === 'object' && !Array.isArray(raw)) {
    slot = raw as { start?: string };
  }
  const start = slot?.start;
  return typeof start === 'string' && start.trim() ? start.trim() : null;
}

function scheduledYmd(order: Record<string, unknown>): string | null {
  const raw = order.scheduled_delivery_date ?? order.delivery_date;
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(raw);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const t = new Date(s);
  if (!Number.isNaN(t.getTime())) {
    const y = t.getFullYear();
    const mo = String(t.getMonth() + 1).padStart(2, '0');
    const day = String(t.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
  }
  return null;
}

function formatCalendarDateFromYmd(ymd: string): string {
  const [y, mo, d] = ymd.split('-').map((x) => parseInt(x, 10));
  return new Date(y, mo - 1, d).toLocaleDateString();
}

/** Customer-requested delivery date + time for vendor order cards. */
export function formatMealOrderDeliverySchedule(order: Record<string, unknown>): string {
  const ymd = scheduledYmd(order);
  const dateLabel = ymd
    ? formatCalendarDateFromYmd(ymd)
    : order.created_at
      ? new Date(String(order.created_at)).toLocaleDateString()
      : '—';

  const slotStart =
    parseSlotStart(order.scheduled_delivery_slot) ??
    (typeof order.delivery_time === 'string' ? order.delivery_time : null) ??
    (typeof order.deliveryTime === 'string' ? order.deliveryTime : null);

  if (slotStart) {
    const timeLabel = formatBookingTime(slotStart);
    return `${dateLabel} · ${timeLabel}`;
  }
  return dateLabel;
}

export function mealOrderSlotStartHm(order: Record<string, unknown>): string | null {
  return parseSlotStart(order.scheduled_delivery_slot);
}
