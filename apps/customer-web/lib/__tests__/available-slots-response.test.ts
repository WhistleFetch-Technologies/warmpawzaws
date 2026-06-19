import {
  applyPastSlotGuard,
  normalizeAvailableSlotsResponse,
  sanitizeNextAvailable,
  resolveNextAvailableLabel,
  type NormalizedTimeSlot,
} from '../available-slots-response';

/** Fixed instant: 2026-06-19 22:00 IST = 2026-06-19T16:30:00.000Z */
const NOW_22_IST = new Date('2026-06-19T16:30:00.000Z');
const TODAY_YMD = '2026-06-19';
const TOMORROW_YMD = '2026-06-20';

describe('applyPastSlotGuard', () => {
  it('marks past slot unavailable on today at 22:00 IST', () => {
    const slots: NormalizedTimeSlot[] = [{ time: '15:00', available: true }];
    const out = applyPastSlotGuard(slots, TODAY_YMD, { now: NOW_22_IST });
    expect(out[0].available).toBe(false);
    expect(out[0].isPast).toBe(true);
  });

  it('keeps future slot available on today at 22:00 IST', () => {
    const slots: NormalizedTimeSlot[] = [{ time: '23:00', available: true }];
    const out = applyPastSlotGuard(slots, TODAY_YMD, { now: NOW_22_IST });
    expect(out[0].available).toBe(true);
    expect(out[0].isPast).toBeUndefined();
  });

  it('leaves slots unchanged for tomorrow', () => {
    const slots: NormalizedTimeSlot[] = [{ time: '15:00', available: true }];
    const out = applyPastSlotGuard(slots, TOMORROW_YMD, { now: NOW_22_IST });
    expect(out[0].available).toBe(true);
    expect(out[0].isPast).toBeUndefined();
  });

  it('respects 30 minute buffer at 22:00 IST for 21:00 slot', () => {
    const slots: NormalizedTimeSlot[] = [{ time: '21:00', available: true }];
    const out = applyPastSlotGuard(slots, TODAY_YMD, { now: NOW_22_IST, minNoticeMinutes: 30 });
    expect(out[0].available).toBe(false);
    expect(out[0].isPast).toBe(true);
  });

  it('preserves booked flag and never flips to available', () => {
    const slots: NormalizedTimeSlot[] = [
      { time: '15:00', available: false, booked: true },
    ];
    const out = applyPastSlotGuard(slots, TODAY_YMD, { now: NOW_22_IST });
    expect(out[0].booked).toBe(true);
    expect(out[0].available).toBe(false);
  });

  it('only changes past slots in a mixed list', () => {
    const slots: NormalizedTimeSlot[] = [
      { time: '15:00', available: true },
      { time: '23:00', available: true },
    ];
    const out = applyPastSlotGuard(slots, TODAY_YMD, { now: NOW_22_IST });
    expect(out[0].available).toBe(false);
    expect(out[0].isPast).toBe(true);
    expect(out[1].available).toBe(true);
  });
});

describe('normalizeAvailableSlotsResponse', () => {
  it('applies past guard when dateYmd is provided', () => {
    const raw = {
      success: true,
      slots: [{ time: '15:00', available: true }],
    };
    const { slots } = normalizeAvailableSlotsResponse(raw, TODAY_YMD, { now: NOW_22_IST });
    expect(slots[0].available).toBe(false);
    expect(slots[0].isPast).toBe(true);
  });
});

/** 2026-06-19 18:35 IST = 2026-06-19T13:05:00.000Z */
const NOW_1835_IST = new Date('2026-06-19T13:05:00.000Z');

describe('sanitizeNextAvailable', () => {
  it('hides past slot with date and time at 18:35 IST', () => {
    expect(
      sanitizeNextAvailable(
        { date: '2026-06-19', time: '13:30', display: 'Today 1:30 PM' },
        { now: NOW_1835_IST }
      )
    ).toBeUndefined();
  });

  it('hides Today display string when past at 18:35 IST', () => {
    expect(sanitizeNextAvailable({ display: 'Today 1:30 PM' }, { now: NOW_1835_IST })).toBeUndefined();
  });

  it('keeps tomorrow slot', () => {
    const r = sanitizeNextAvailable(
      { date: '2026-06-20', time: '09:00', display: 'Tomorrow 9:00 AM' },
      { now: NOW_1835_IST }
    );
    expect(r?.display).toContain('Tomorrow');
  });
});

describe('resolveNextAvailableLabel', () => {
  it('filters past nextAvailable on discovery payload', () => {
    expect(
      resolveNextAvailableLabel(
        {
          nextAvailable: { date: '2026-06-19', time: '13:30', display: 'Today 1:30 PM' },
        },
        { now: NOW_1835_IST }
      )
    ).toBeUndefined();
  });
});
