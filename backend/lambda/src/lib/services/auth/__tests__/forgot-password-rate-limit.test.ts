import {
  computeRemainingCooldownSec,
  rateLimitError,
  rateLimitErrorForCooldown,
  rateLimitErrorForResetRecently,
  readRateLimitRetryAfterSeconds,
  rolling24hRetrySeconds,
  buildRateLimitResponse,
  RESET_RECENTLY_ERROR_CODE,
} from '../forgot-password-rate-limit';

describe('forgot-password-rate-limit', () => {
  it('computeRemainingCooldownSec returns remaining seconds', () => {
    const last = new Date(Date.now() - 18_000);
    const remaining = computeRemainingCooldownSec(last);
    expect(remaining).toBeGreaterThanOrEqual(41);
    expect(remaining).toBeLessThanOrEqual(42);
  });

  it('readRateLimitRetryAfterSeconds reads from rate limit error', () => {
    const err = rateLimitError(37);
    expect(readRateLimitRetryAfterSeconds(err)).toBe(37);
  });

  it('rateLimitErrorForCooldown embeds dynamic retry seconds', () => {
    const last = new Date(Date.now() - 10_000);
    const err = rateLimitErrorForCooldown(last);
    expect(readRateLimitRetryAfterSeconds(err)).toBeGreaterThanOrEqual(49);
  });

  it('buildRateLimitResponse sets Retry-After header and body field', () => {
    const out = buildRateLimitResponse({
      requestId: 'req-1',
      retryAfterSeconds: 42,
      message: 'Too many requests. Try again later.',
      errorBody: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' },
      },
    });
    expect(out.status).toBe(429);
    expect(out.headers?.['Retry-After']).toBe('42');
    expect(out.body.retryAfterSeconds).toBe(42);
  });

  it('rateLimitErrorForResetRecently uses rolling 24h retry and RESET_RECENTLY code', () => {
    const lastReset = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const err = rateLimitErrorForResetRecently(lastReset);
    expect((err as any).code).toBe(RESET_RECENTLY_ERROR_CODE);
    expect(readRateLimitRetryAfterSeconds(err)).toBe(rolling24hRetrySeconds(lastReset));
  });
});
