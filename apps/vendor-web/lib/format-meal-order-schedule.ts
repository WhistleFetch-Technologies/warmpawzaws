import { formatBookingTime } from '@/components/vendor/dashboard/helpers';
import { parseScheduledDeliverySlot } from '@warmpawz/shared-types';

function parseSlotStart(raw: unknown): string | null {
  const slot = parseScheduledDeliverySlot(raw);
  return slot?.start ?? null;
}

/** Commitment time (slot end, or start) for customer delivery display. */
function parseSlotCommitmentHm(raw: unknown): string | null {
  const slot = parseScheduledDeliverySlot(raw);
  if (!slot) return null;
  return slot.end || slot.start;
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

/** Format ISO timestamp or ms for vendor prep/delivery labels. */
export function formatMealSchedulingInstant(
  isoOrMs: string | number | null | undefined,
): string {
  if (isoOrMs == null || isoOrMs === '') return '—';
  const d =
    typeof isoOrMs === 'number'
      ? new Date(isoOrMs)
      : new Date(String(isoOrMs));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Customer-requested delivery date + commitment time (slot end when set). */
export function formatMealOrderCustomerDelivery(order: Record<string, unknown>): string {
  const ymd = scheduledYmd(order);
  const dateLabel = ymd
    ? formatCalendarDateFromYmd(ymd)
    : order.created_at
      ? new Date(String(order.created_at)).toLocaleDateString()
      : '—';

  const commitmentHm =
    parseSlotCommitmentHm(order.scheduled_delivery_slot) ??
    parseSlotCommitmentHm(
      order.delivery_time_slot != null
        ? order.delivery_time_slot
        : order.delivery_time,
    ) ??
    (typeof order.delivery_time === 'string' ? order.delivery_time : null) ??
    (typeof order.deliveryTime === 'string' ? order.deliveryTime : null);

  if (commitmentHm) {
    const timeLabel = formatBookingTime(commitmentHm);
    return `${dateLabel} · ${timeLabel}`;
  }
  return dateLabel;
}

/** Customer-requested delivery date + time for vendor order cards (slot start legacy). */
export function formatMealOrderDeliverySchedule(order: Record<string, unknown>): string {
  return formatMealOrderCustomerDelivery(order);
}

export function mealOrderSlotStartHm(order: Record<string, unknown>): string | null {
  return parseSlotStart(order.scheduled_delivery_slot);
}
