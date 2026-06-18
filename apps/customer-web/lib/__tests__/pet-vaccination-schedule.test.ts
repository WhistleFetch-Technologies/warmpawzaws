import {
  computeNextDueDate,
  getAgeInWeeks,
  getEarliestUpcomingDue,
  getJuvenileSchedule,
  getRowStatus,
  getScheduleVaccinationAlerts,
} from '../pet-vaccination-schedule';

function weeksAgo(weeks: number, ref = new Date('2026-06-18')): string {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - weeks * 7);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('pet-vaccination-schedule', () => {
  const refDate = new Date('2026-06-18');

  it('computes age in weeks from DOB', () => {
    const dob = weeksAgo(10, refDate);
    expect(getAgeInWeeks(dob, refDate)).toBe(10);
  });

  it('marks 10-week puppy schedule rows as overdue/due/upcoming', () => {
    const dob = weeksAgo(10, refDate);
    const schedule = getJuvenileSchedule('Dog');

    expect(getRowStatus(schedule[0], dob, undefined, refDate)).toBe('overdue');
    expect(getRowStatus(schedule[1], dob, undefined, refDate)).toBe('overdue');
    expect(getRowStatus(schedule[2], dob, undefined, refDate)).toBe('overdue');
    expect(getRowStatus(schedule[3], dob, undefined, refDate)).toBe('due');
    expect(getRowStatus(schedule[4], dob, undefined, refDate)).toBe('upcoming');
    expect(getRowStatus(schedule[5], dob, undefined, refDate)).toBe('upcoming');
    expect(getRowStatus(schedule[6], dob, undefined, refDate)).toBe('upcoming');
  });

  it('marks unrecorded juvenile rows overdue for 20-week puppy', () => {
    const dob = weeksAgo(20, refDate);
    const schedule = getJuvenileSchedule('Dog');

    for (const item of schedule.slice(0, 6)) {
      expect(getRowStatus(item, dob, undefined, refDate)).toBe('overdue');
    }
  });

  it('handles monthly deworm maintenance next due and not_applicable', () => {
    const dobYoung = weeksAgo(18, refDate);
    const monthly = getJuvenileSchedule('Dog')[6];
    const lastDate = weeksAgo(2, refDate);

    const nextDue = computeNextDueDate(monthly, dobYoung, lastDate, refDate);
    const expectedNext = new Date(lastDate);
    expectedNext.setDate(expectedNext.getDate() + 30);
    expect(nextDue).toBe(
      `${expectedNext.getFullYear()}-${String(expectedNext.getMonth() + 1).padStart(2, '0')}-${String(expectedNext.getDate()).padStart(2, '0')}`
    );

    const dobOld = weeksAgo(30, refDate);
    expect(getRowStatus(monthly, dobOld, undefined, refDate)).toBe('not_applicable');
  });

  it('returns earliest upcoming due across juvenile and adult schedules', () => {
    const dob = weeksAgo(10, refDate);
    const earliest = getEarliestUpcomingDue(dob, 'Dog', [], refDate);

    const scheduledWeek2 = new Date(dob);
    scheduledWeek2.setDate(scheduledWeek2.getDate() + 14);
    expect(earliest).toBe(
      `${scheduledWeek2.getFullYear()}-${String(scheduledWeek2.getMonth() + 1).padStart(2, '0')}-${String(scheduledWeek2.getDate()).padStart(2, '0')}`
    );
  });

  it('surfaces overdue and upcoming alerts within 30 days', () => {
    const dob = weeksAgo(10, refDate);
    const { overdue, upcoming } = getScheduleVaccinationAlerts(dob, 'Dog', [], refDate);

    expect(overdue.length).toBeGreaterThan(0);
    expect(upcoming.some((a) => a.name.includes('7-in-1'))).toBe(true);
  });
});
