import { describe, expect, test } from '@jest/globals';
import {
  PAYMENT_HOLD_TTL_SECONDS,
  SQL_BOOKING_BLOCKS_SLOT,
  bookingConsumesCapacity,
  paymentHoldExpiresAt,
  secondsRemainingUntilHoldExpiry,
  isPaymentHoldActive,
} from '../payment-hold';

describe('payment-hold utility', () => {
  test('hold TTL is 5 minutes', () => {
    expect(PAYMENT_HOLD_TTL_SECONDS).toBe(300);
  });

  test('paymentHoldExpiresAt adds 5 minutes', () => {
    const start = new Date('2026-06-01T10:00:00.000Z');
    const exp = paymentHoldExpiresAt(start);
    expect(exp.toISOString()).toBe('2026-06-01T10:05:00.000Z');
  });

  test('SQL_BOOKING_BLOCKS_SLOT excludes expired pending_payment and rejected', () => {
    expect(SQL_BOOKING_BLOCKS_SLOT).toContain('pending_payment');
    expect(SQL_BOOKING_BLOCKS_SLOT).toContain('payment_hold_expires_at');
    expect(SQL_BOOKING_BLOCKS_SLOT).toContain('rejected');
  });

  test('bookingConsumesCapacity matches the status-to-capacity map', () => {
    expect(bookingConsumesCapacity({ status: 'pending' })).toBe(true);
    expect(bookingConsumesCapacity({ status: 'confirmed' })).toBe(true);
    expect(bookingConsumesCapacity({ status: 'completed' })).toBe(true);
    expect(bookingConsumesCapacity({ status: 'cancelled' })).toBe(false);
    expect(bookingConsumesCapacity({ status: 'rejected' })).toBe(false);
  });

  test('isPaymentHoldActive respects expiry', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isPaymentHoldActive({ status: 'pending_payment', payment_hold_expires_at: future })).toBe(true);
    expect(isPaymentHoldActive({ status: 'pending_payment', payment_hold_expires_at: past })).toBe(false);
    expect(isPaymentHoldActive({ status: 'confirmed', payment_hold_expires_at: future })).toBe(false);
  });

  test('secondsRemainingUntilHoldExpiry is non-negative', () => {
    const future = new Date(Date.now() + 90_000).toISOString();
    expect(secondsRemainingUntilHoldExpiry(future)).toBeGreaterThanOrEqual(89);
    expect(secondsRemainingUntilHoldExpiry(null)).toBe(0);
  });
});
