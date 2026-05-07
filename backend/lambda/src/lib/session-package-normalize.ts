/**
 * Session package metadata: maps Session Type + Period count + Frequency → duration,
 * totals, and legacy fields (sessionsPerDay, packageDuration, sessionIntervalDays)
 * consumed by package booking / Razorpay flows.
 */

export type SessionPackageType = 'day' | 'weekly' | 'monthly' | 'yearly';

export const SESSION_PERIOD_UNIT_DAYS: Record<SessionPackageType, number> = {
  day: 1,
  weekly: 7,
  monthly: 30,
  yearly: 365,
};

export interface NormalizeSessionPackageInput {
  sessionType?: string;
  sessionFrequency?: number;
  packagePeriodCount?: number;
  sessionsPerDay?: number;
  packageDuration?: number;
}

export interface NormalizedSessionPackage {
  sessionType: SessionPackageType;
  sessionFrequency: number;
  packagePeriodCount: number;
  validityDays: number;
  totalSessions: number;
  sessionsPerDay: number;
  packageDuration: number;
  sessionIntervalDays: number;
}

function isSessionPackageType(v: string): v is SessionPackageType {
  return v === 'day' || v === 'weekly' || v === 'monthly' || v === 'yearly';
}

function usesNewSessionPackageModel(input: NormalizeSessionPackageInput): boolean {
  const t = String(input.sessionType ?? '').trim().toLowerCase();
  return isSessionPackageType(t);
}

export function normalizeSessionPackageDetails(
  input: NormalizeSessionPackageInput
): NormalizedSessionPackage {
  if (!usesNewSessionPackageModel(input)) {
    const spdRaw = Number(input.sessionsPerDay);
    const spd = Number.isFinite(spdRaw) && spdRaw > 0
      ? Math.max(1, Math.min(24, Math.floor(spdRaw)))
      : 1;
    const pdRaw = Number(input.packageDuration);
    const pd = Number.isFinite(pdRaw) && pdRaw > 0 ? Math.max(1, Math.floor(pdRaw)) : 7;
    return {
      sessionType: 'day',
      sessionFrequency: spd,
      packagePeriodCount: pd,
      validityDays: pd,
      totalSessions: spd * pd,
      sessionsPerDay: spd,
      packageDuration: pd,
      sessionIntervalDays: 1,
    };
  }

  const raw = String(input.sessionType ?? '').trim().toLowerCase();
  const st: SessionPackageType = isSessionPackageType(raw) ? raw : 'day';
  const freqRaw = Number(input.sessionFrequency);
  const freq =
    Number.isFinite(freqRaw) && freqRaw > 0 ? Math.max(1, Math.floor(freqRaw)) : 1;

  const countRaw = Number(input.packagePeriodCount);
  const periodCount =
    Number.isFinite(countRaw) && countRaw > 0 ? Math.max(1, Math.floor(countRaw)) : 1;

  const unitDays = SESSION_PERIOD_UNIT_DAYS[st];
  const validityDays = periodCount * unitDays;

  if (st === 'day') {
    const sessionsPerDay = Math.max(1, Math.min(24, freq));
    const totalSessions = sessionsPerDay * validityDays;
    return {
      sessionType: st,
      sessionFrequency: sessionsPerDay,
      packagePeriodCount: periodCount,
      validityDays,
      totalSessions,
      sessionsPerDay,
      packageDuration: validityDays,
      sessionIntervalDays: 1,
    };
  }

  const totalSessions = freq * periodCount;

  const sessionIntervalDays =
    st === 'weekly' ? 7 : st === 'monthly' ? 30 : 365;

  return {
    sessionType: st,
    sessionFrequency: freq,
    packagePeriodCount: periodCount,
    validityDays,
    totalSessions,
    sessionsPerDay: 1,
    packageDuration: validityDays,
    sessionIntervalDays,
  };
}
