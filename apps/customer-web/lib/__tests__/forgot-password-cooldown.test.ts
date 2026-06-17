import {
  computeRemainingCooldownSec,
  forgotCooldownStorageKey,
  forgotResendCooldownSeconds,
  persistForgotCooldown,
  readForgotCooldownRemaining,
  FORGOT_PASSWORD_SEND_COOLDOWN_SEC,
} from '../forgot-password-cooldown';

describe('forgot-password-cooldown', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('forgotCooldownStorageKey scopes keys per username', () => {
    const a = forgotCooldownStorageKey('9876543210');
    const b = forgotCooldownStorageKey('9123456789');
    const aAgain = forgotCooldownStorageKey('9876543210');
    expect(a).not.toBe(b);
    expect(a).toBe(aAgain);
    expect(a).toMatch(/^warmpawz_customer_forgot_cooldown_/);
  });

  it('forgotResendCooldownSeconds caps UI spacing at 60s', () => {
    expect(forgotResendCooldownSeconds(3600)).toBe(FORGOT_PASSWORD_SEND_COOLDOWN_SEC);
    expect(forgotResendCooldownSeconds(45)).toBe(45);
  });

  it('persistForgotCooldown stores capped seconds for the username key', () => {
    const key = forgotCooldownStorageKey('8050107282');
    persistForgotCooldown(key, 3600);
    const remaining = readForgotCooldownRemaining(key);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(FORGOT_PASSWORD_SEND_COOLDOWN_SEC);
  });

  it('clears legacy global cooldown key on read', () => {
    sessionStorage.setItem('warmpawz_customer_forgot_cooldown_until', String(Date.now() + 60_000));
    const key = forgotCooldownStorageKey('9845234915');
    readForgotCooldownRemaining(key);
    expect(sessionStorage.getItem('warmpawz_customer_forgot_cooldown_until')).toBeNull();
  });
});
