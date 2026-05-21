import {
  calculateOverlapSeconds,
  computeCallRemainingSeconds,
  computePausableCallRemaining,
  evaluateTeleQualification,
  MIN_OVERLAP_SECONDS,
} from '../tele-completion-service';

describe('computePausableCallRemaining', () => {
  it('returns full slot before consultation starts', () => {
    expect(computePausableCallRemaining(null, 1800)).toBe(1800);
  });

  it('pauses remaining when one party has left', () => {
    const now = new Date('2026-01-01T10:10:00Z');
    const session = {
      id: 's1',
      booking_id: 'b1',
      customer_joined_at: '2026-01-01T10:00:00Z',
      vendor_joined_at: '2026-01-01T10:00:00Z',
      customer_left_at: '2026-01-01T10:05:00Z',
      call_timer_remaining_seconds: 1500,
      call_timer_running_since: null,
    };
    expect(computePausableCallRemaining(session, 1800, now)).toBe(1500);
  });

  it('ticks down only while both are present', () => {
    const now = new Date('2026-01-01T10:05:00Z');
    const session = {
      id: 's1',
      booking_id: 'b1',
      customer_joined_at: '2026-01-01T10:00:00Z',
      vendor_joined_at: '2026-01-01T10:00:00Z',
      call_timer_remaining_seconds: 1800,
      call_timer_running_since: '2026-01-01T10:00:00Z',
    };
    expect(computePausableCallRemaining(session, 1800, now)).toBe(1500);
  });
});

describe('computeCallRemainingSeconds', () => {
  it('returns full slot when consultation has not started', () => {
    expect(computeCallRemainingSeconds(1800, null)).toBe(1800);
  });

  it('counts down from consultation start time', () => {
    const start = new Date('2026-01-01T10:00:00Z');
    const now = new Date('2026-01-01T10:05:00Z');
    expect(computeCallRemainingSeconds(1800, start, now)).toBe(1500);
  });

  it('never returns negative remaining time', () => {
    const start = new Date('2026-01-01T10:00:00Z');
    const now = new Date('2026-01-01T11:00:00Z');
    expect(computeCallRemainingSeconds(1800, start, now)).toBe(0);
  });
});

describe('calculateOverlapSeconds', () => {
  const t0 = new Date('2026-01-01T10:00:00Z');
  const t1 = new Date('2026-01-01T10:02:00Z');
  const t2 = new Date('2026-01-01T10:05:00Z');
  const t3 = new Date('2026-01-01T10:08:00Z');

  it('returns 0 when either party never joined', () => {
    expect(calculateOverlapSeconds(t0, t2, null, t3, t3)).toBe(0);
    expect(calculateOverlapSeconds(null, t2, t1, t3, t3)).toBe(0);
  });

  it('computes overlap when both joined and left', () => {
    // customer 10:00-10:08, vendor 10:02-10:05 => overlap 10:02-10:05 = 180s
    expect(calculateOverlapSeconds(t0, t3, t1, t2, t3)).toBe(180);
  });

  it('uses now when leave time missing', () => {
    const now = new Date('2026-01-01T10:10:00Z');
    // both joined at 10:00, neither left => 600s overlap
    expect(calculateOverlapSeconds(t0, null, t0, null, now)).toBe(600);
  });

  it('never returns negative overlap', () => {
    expect(
      calculateOverlapSeconds(t2, t0, t0, t1, t1)
    ).toBe(0);
  });
});

describe('evaluateTeleQualification', () => {
  const base = {
    customer_joined_at: '2026-01-01T10:00:00Z',
    vendor_joined_at: '2026-01-01T10:00:00Z',
    customer_left_at: '2026-01-01T10:05:00Z',
    vendor_left_at: '2026-01-01T10:05:00Z',
  };

  it('qualifies when overlap >= MIN_OVERLAP_SECONDS', () => {
    const r = evaluateTeleQualification(base);
    expect(r.qualified).toBe(true);
    expect(r.teleCompletionStatus).toBe('qualified');
    expect(r.overlapSeconds).toBeGreaterThanOrEqual(MIN_OVERLAP_SECONDS);
  });

  it('vendor_no_show when customer joined only', () => {
    const r = evaluateTeleQualification({
      customer_joined_at: base.customer_joined_at,
      vendor_joined_at: null,
      customer_left_at: base.customer_left_at,
      vendor_left_at: null,
    });
    expect(r.qualified).toBe(false);
    expect(r.teleCompletionStatus).toBe('vendor_no_show');
  });

  it('incomplete_call when overlap too short', () => {
    const r = evaluateTeleQualification({
      ...base,
      customer_left_at: '2026-01-01T10:01:00Z',
      vendor_left_at: '2026-01-01T10:01:30Z',
    });
    expect(r.qualified).toBe(false);
    expect(r.teleCompletionStatus).toBe('incomplete_call');
  });
});
