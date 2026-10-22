export interface TeleWindow {
  dayOfWeek: number;
  startTime: string;
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function kolkataClock(now: Date): { dayOfWeek: number; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const day = WEEKDAY.indexOf((parts.weekday || 'Sun') as (typeof WEEKDAY)[number]);
  const hour = Number(parts.hour);
  return {
    dayOfWeek: day < 0 ? 0 : day,
    minutes: (hour === 24 ? 0 : hour) * 60 + Number(parts.minute || 0),
  };
}

function startMinutes(startTime: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(startTime.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function clockLabel(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export interface TeleSlot {
  date: string;
  time: string;
  label: string;
}

function kolkataYmd(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function addCalendarDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Next open tele windows as concrete dates. Each window belongs to one vendor. */
export function upcomingTeleSlots(windows: readonly TeleWindow[], now: Date, limit = 6): TeleSlot[] {
  const parsed = windows
    .map((window) => ({ dayOfWeek: window.dayOfWeek, minutes: startMinutes(window.startTime) }))
    .filter((window): window is { dayOfWeek: number; minutes: number } => window.minutes != null && window.dayOfWeek >= 0 && window.dayOfWeek <= 6);
  if (parsed.length === 0 || limit <= 0) return [];
  const clock = kolkataClock(now);
  const today = kolkataYmd(now);
  const slots: TeleSlot[] = [];
  for (let offset = 0; offset < 14 && slots.length < limit; offset += 1) {
    const day = (clock.dayOfWeek + offset) % 7;
    const opens = parsed
      .filter((window) => window.dayOfWeek === day && (offset > 0 || window.minutes > clock.minutes))
      .sort((a, b) => a.minutes - b.minutes);
    for (const open of opens) {
      if (slots.length >= limit) break;
      const time = clockLabel(open.minutes);
      const when = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : WEEKDAY[day];
      slots.push({ date: addCalendarDays(today, offset), time, label: `${when} ${time}` });
    }
  }
  return slots;
}

/** Next open tele window in Asia/Kolkata. Each window belongs to one vendor. */
export function nextTeleSlotLabel(windows: readonly TeleWindow[], now: Date): string | null {
  const parsed = windows
    .map((window) => ({ dayOfWeek: window.dayOfWeek, minutes: startMinutes(window.startTime) }))
    .filter((window): window is { dayOfWeek: number; minutes: number } => window.minutes != null && window.dayOfWeek >= 0 && window.dayOfWeek <= 6);
  if (parsed.length === 0) return null;
  const clock = kolkataClock(now);
  for (let offset = 0; offset < 7; offset += 1) {
    const day = (clock.dayOfWeek + offset) % 7;
    const opens = parsed
      .filter((window) => window.dayOfWeek === day && (offset > 0 || window.minutes > clock.minutes))
      .sort((a, b) => a.minutes - b.minutes);
    if (opens.length === 0) continue;
    const when = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : WEEKDAY[day];
    return `${when} ${clockLabel(opens[0].minutes)}`;
  }
  return null;
}

export function consultStep(vendorCount: number): 'unavailable' | 'direct' | 'choose-advisor' {
  if (vendorCount <= 0) return 'unavailable';
  if (vendorCount === 1) return 'direct';
  return 'choose-advisor';
}
