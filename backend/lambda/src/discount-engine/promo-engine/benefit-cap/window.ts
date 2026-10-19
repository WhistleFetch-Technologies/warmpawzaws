import { benefitCapWindowHours, type BenefitCapConfig } from './config';

const HOUR_MS = 60 * 60 * 1000;
const IST_OFFSET_MS = 330 * 60 * 1000;

function windowMs(cfg: BenefitCapConfig): number {
  return benefitCapWindowHours(cfg) * HOUR_MS;
}

/**
 * Calendar windows are fixed blocks of the window length, aligned to reset_time (IST) on
 * Monday 1 Jan 2024. So 1 day = each day from reset_time, 1 week = Monday to Monday,
 * 6 hours = four fixed blocks a day starting at reset_time.
 */
function calendarAnchorMs(resetTime: string): number {
  const [h, m] = resetTime.split(':').map((x) => Number(x));
  return Date.UTC(2024, 0, 1, h || 0, m || 0) - IST_OFFSET_MS;
}

/** Earliest benefit payment time that still counts toward the cap. */
export function benefitCapWindowStart(now: Date, cfg: BenefitCapConfig): Date {
  const len = windowMs(cfg);
  if (cfg.window_type === 'rolling') return new Date(now.getTime() - len);
  const anchor = calendarAnchorMs(cfg.reset_time);
  const blocks = Math.floor((now.getTime() - anchor) / len);
  return new Date(anchor + blocks * len);
}

/**
 * When the customer can get benefits again.
 * Calendar: the next reset. Rolling: when enough counted payments age out to drop below the cap.
 * countedAtAsc = created times of counted payments, oldest first.
 */
export function benefitCapResumeAt(
  now: Date,
  cfg: BenefitCapConfig,
  countedAtAsc: Date[],
): Date | null {
  const len = windowMs(cfg);
  if (cfg.window_type === 'calendar') {
    return new Date(benefitCapWindowStart(now, cfg).getTime() + len);
  }
  const idx = countedAtAsc.length - cfg.max_benefit_payments;
  if (idx < 0) return null;
  return new Date(countedAtAsc[idx].getTime() + len);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "10 Oct at 12:00 AM" in IST — no ICU dependency. */
export function formatIstResumeTime(at: Date): string {
  const ist = new Date(at.getTime() + IST_OFFSET_MS);
  const h24 = ist.getUTCHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = String(ist.getUTCMinutes()).padStart(2, '0');
  const ampm = h24 < 12 ? 'AM' : 'PM';
  return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]} at ${h12}:${mm} ${ampm}`;
}
