const IST = 'Asia/Kolkata';

/** Calendar date YYYY-MM-DD in Asia/Kolkata. */
export function ymdInIst(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** HH:mm in Asia/Kolkata for an instant. */
export function hmInIst(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const h = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

function parseDietary(plan: Record<string, unknown>): Record<string, unknown> {
  const raw = plan.dietary_requirements;
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      return typeof o === 'object' && o != null && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Accept HH:mm or HH:mm:ss (Postgres TIME). */
export function parseOrderCutoffHm(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export interface MealSchedulePolicy {
  leadTimeHours: number;
  orderCutoffTime: string;
  sameDayAllowed: boolean;
  earliestDeliveryAt: string;
}

export function extractMealSchedulePolicy(plan: Record<string, unknown>): MealSchedulePolicy | null {
  const diet = parseDietary(plan);
  const leadRaw =
    plan.lead_time_hours != null
      ? Number(plan.lead_time_hours)
      : plan.leadTimeHours != null
        ? Number(plan.leadTimeHours)
        : diet.leadTimeHours != null
          ? Number(diet.leadTimeHours)
          : NaN;
  if (!Number.isFinite(leadRaw) || leadRaw < 0 || leadRaw > 72) return null;

  const cutoff =
    parseOrderCutoffHm(plan.order_cutoff_time) ||
    parseOrderCutoffHm(plan.orderCutoffTime) ||
    parseOrderCutoffHm(diet.orderCutoffTime);
  if (!cutoff) return null;

  const leadTimeHours = Math.round(leadRaw);
  const now = new Date();
  const earliest = new Date(now.getTime() + leadTimeHours * 3600000);
  return {
    leadTimeHours,
    orderCutoffTime: cutoff,
    sameDayAllowed: leadTimeHours <= 24,
    earliestDeliveryAt: earliest.toISOString(),
  };
}

/** Earliest selectable delivery date (YYYY-MM-DD IST) for date input `min`. */
export function computeEarliestDeliveryYmd(policy: MealSchedulePolicy, now: Date = new Date()): string {
  const earliest = new Date(now.getTime() + policy.leadTimeHours * 3600000);
  const earliestYmd = ymdInIst(earliest);
  const today = ymdInIst(now);

  if (!policy.sameDayAllowed && earliestYmd === today) {
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    return ymdInIst(next);
  }

  if (
    policy.sameDayAllowed &&
    earliestYmd === today &&
    isPastCutoffForSameDay(now, policy.orderCutoffTime)
  ) {
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    return ymdInIst(next);
  }

  return earliestYmd;
}

export function earliestDeliveryYmd(earliestDeliveryAtIso: string | undefined, leadHours: number): string {
  if (earliestDeliveryAtIso) {
    try {
      return ymdInIst(new Date(earliestDeliveryAtIso));
    } catch {
      /* fall through */
    }
  }
  const t = new Date(Date.now() + leadHours * 3600000);
  return ymdInIst(t);
}

/** Min time (HH:mm) for same-day delivery from earliest instant. */
export function minDeliveryTimeHm(
  scheduledDateYmd: string,
  earliestDeliveryAtIso: string | undefined,
  leadHours: number,
): string | undefined {
  const today = ymdInIst();
  if (scheduledDateYmd !== today) return undefined;
  const earliest = earliestDeliveryAtIso
    ? new Date(earliestDeliveryAtIso)
    : new Date(Date.now() + leadHours * 3600000);
  return hmInIst(earliest);
}

function isPastCutoffForSameDay(now: Date, cutoffTime: string): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(cutoffTime);
  if (!m) return false;
  const cutoffMin = Number(m[1]) * 60 + Number(m[2]);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const min = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + min > cutoffMin;
}

/** Client-side mirror of backend evaluateMealBookingForPlan (ONE_OFF). */
export function evaluateMealDeliverySlot(
  scheduledDateYmd: string,
  scheduledTimeHm: string,
  policy: MealSchedulePolicy,
  now: Date = new Date(),
): { allowed: boolean; message?: string } {
  if (!scheduledDateYmd || !scheduledTimeHm) {
    return { allowed: false, message: 'Select delivery date and time.' };
  }

  const time = scheduledTimeHm.length === 5 ? scheduledTimeHm : scheduledTimeHm.slice(0, 5);
  const requestedDeliveryAt = `${scheduledDateYmd}T${time}:00`;
  const delivery = new Date(requestedDeliveryAt);
  if (Number.isNaN(delivery.getTime())) {
    return { allowed: false, message: 'Invalid delivery date or time.' };
  }

  const today = ymdInIst(now);
  const deliveryDay = ymdInIst(delivery);
  const isSameDay = deliveryDay === today;
  const earliest = new Date(policy.earliestDeliveryAt || now.getTime() + policy.leadTimeHours * 3600000);

  if (isSameDay && !policy.sameDayAllowed) {
    return {
      allowed: false,
      message: `Same-day delivery is not available for this plan. Order at least ${policy.leadTimeHours} hours ahead.`,
    };
  }
  if (isSameDay && policy.sameDayAllowed && isPastCutoffForSameDay(now, policy.orderCutoffTime)) {
    return {
      allowed: false,
      message: `Today's order cutoff (${policy.orderCutoffTime}) has passed. Choose a later delivery date.`,
    };
  }
  if (delivery.getTime() < earliest.getTime()) {
    return {
      allowed: false,
      message: `Place your order at least ${policy.leadTimeHours} hour${policy.leadTimeHours === 1 ? '' : 's'} before delivery.`,
    };
  }

  return { allowed: true };
}
