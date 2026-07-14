import { HOME_POLL_PROFILE, pollBackoffMs, withPollJitter } from '../home-poll-profile';

describe('home-poll-profile', () => {
  it('keeps tele incoming aggressive in PR1', () => {
    expect(HOME_POLL_PROFILE.teleIncomingMs).toBe(5_000);
    expect(HOME_POLL_PROFILE.mealIdleMs).toBe(60_000);
    expect(HOME_POLL_PROFILE.mealLiveMs).toBe(15_000);
    expect(HOME_POLL_PROFILE.homeTickMs).toBe(30_000);
    expect(HOME_POLL_PROFILE.notifToastMs).toBe(60_000);
  });

  it('applies jitter within bounds', () => {
    const base = 30_000;
    for (let i = 0; i < 20; i++) {
      const v = withPollJitter(base, 3_000);
      expect(v).toBeGreaterThanOrEqual(base - 3_000);
      expect(v).toBeLessThanOrEqual(base + 3_000);
    }
  });

  it('backs off after failures and resets conceptually at zero failures', () => {
    const base = 10_000;
    const zero = pollBackoffMs(base, 0, 120_000);
    expect(zero).toBeGreaterThanOrEqual(base - HOME_POLL_PROFILE.jitterMs);
    expect(zero).toBeLessThanOrEqual(base + HOME_POLL_PROFILE.jitterMs);

    const failed = pollBackoffMs(base, 3, 120_000);
    expect(failed).toBeGreaterThanOrEqual(base);
    expect(failed).toBeLessThanOrEqual(120_000 + HOME_POLL_PROFILE.jitterMs);
  });
});
