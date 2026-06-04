'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';

export const PAYMENT_HOLD_TTL_MS = 300_000;

export function formatPaymentHoldCountdown(secondsRemaining: number): string {
  const s = Math.max(0, secondsRemaining);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export function resolvePaymentHoldExpiresAt(entity: {
  paymentHoldExpiresAt?: string | null;
  createdAt?: string | null;
}): string | null {
  if (entity.paymentHoldExpiresAt) return entity.paymentHoldExpiresAt;
  if (entity.createdAt) {
    const t = new Date(entity.createdAt).getTime();
    if (!Number.isNaN(t)) {
      return new Date(t + PAYMENT_HOLD_TTL_MS).toISOString();
    }
  }
  return null;
}

export function usePaymentHoldCountdown(expiresAt: string | null | undefined): number {
  const [secondsRemaining, setSecondsRemaining] = useState(() => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!expiresAt) {
      setSecondsRemaining(0);
      return;
    }
    const tick = () => {
      setSecondsRemaining(
        Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  return secondsRemaining;
}

export function isBookingAwaitingPayment(booking: {
  status?: string;
  paymentStatus?: string;
  paymentHoldExpiresAt?: string | null;
}): boolean {
  const st = String(booking.status || '').toLowerCase();
  const ps = String(booking.paymentStatus || '').toLowerCase();
  const paidLike = ps === 'paid' || ps === 'completed';
  if (st === 'cancelled') return false;
  if (st === 'pending_payment') return true;
  if (st === 'confirmed' && ps === 'pending' && !paidLike) return true;
  return false;
}

export function isPaymentHoldActive(booking: {
  status?: string;
  paymentStatus?: string;
  paymentHoldExpiresAt?: string | null;
  createdAt?: string | null;
}): boolean {
  if (!isBookingAwaitingPayment(booking)) return false;
  const expiresAt = resolvePaymentHoldExpiresAt(booking);
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

/** Unpaid booking whose 5-minute hold window has elapsed (awaiting backend sweep). */
export function isPaymentHoldExpired(booking: {
  status?: string;
  paymentStatus?: string;
  paymentHoldExpiresAt?: string | null;
  createdAt?: string | null;
}): boolean {
  if (!isBookingAwaitingPayment(booking)) return false;
  const expiresAt = resolvePaymentHoldExpiresAt(booking);
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

export function isMealOrderUnpaidStatus(order: {
  status?: string;
  paymentStatus?: string;
}): boolean {
  const st = String(order.status || '').toLowerCase();
  if (st === 'cancelled' || st === 'delivered') return false;
  const ps = String(order.paymentStatus || '').toLowerCase();
  return ps !== 'paid' && ps !== 'completed' && ps !== 'expired' && ps !== 'refunded';
}

export function isMealOrderAwaitingPayment(order: {
  status?: string;
  paymentStatus?: string;
  paymentHoldExpiresAt?: string | null;
  createdAt?: string | null;
}): boolean {
  if (!isMealOrderUnpaidStatus(order)) return false;
  return !isMealPaymentHoldExpired(order);
}

/** Show countdown or expired banner for unpaid meal orders. */
export function isMealOrderPaymentHoldVisible(order: {
  status?: string;
  paymentStatus?: string;
  paymentHoldExpiresAt?: string | null;
  createdAt?: string | null;
}): boolean {
  if (!isMealOrderUnpaidStatus(order)) return false;
  return isMealPaymentHoldActive(order) || isMealPaymentHoldExpired(order);
}

export function isMealPaymentHoldActive(order: {
  status?: string;
  paymentStatus?: string;
  paymentHoldExpiresAt?: string | null;
  createdAt?: string | null;
}): boolean {
  if (!isMealOrderUnpaidStatus(order)) return false;
  if (isMealPaymentHoldExpired(order)) return false;
  const expiresAt = resolvePaymentHoldExpiresAt(order);
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

export function isMealPaymentHoldExpired(order: {
  status?: string;
  paymentStatus?: string;
  paymentHoldExpiresAt?: string | null;
  createdAt?: string | null;
}): boolean {
  const st = String(order.status || '').toLowerCase();
  if (st === 'cancelled' || st === 'delivered') return false;
  const ps = String(order.paymentStatus || '').toLowerCase();
  if (ps === 'paid' || ps === 'completed' || ps === 'expired' || ps === 'refunded') return false;
  const expiresAt = resolvePaymentHoldExpiresAt(order);
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

export function PaymentHoldBanner({
  expiresAt,
  onPayNow,
  onExpired,
  holdMessage = 'Your slot is held until the timer ends.',
}: {
  expiresAt: string | null | undefined;
  onPayNow: (e: MouseEvent) => void;
  onExpired?: () => void;
  holdMessage?: string;
}) {
  const secondsRemaining = usePaymentHoldCountdown(expiresAt);
  const active = secondsRemaining > 0;
  const prevActiveRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (prevActiveRef.current === true && !active) {
      onExpired?.();
    }
    prevActiveRef.current = active;
  }, [active, onExpired]);

  return (
    <div
      className={`mt-3 rounded-lg border p-3 ${active ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}
      onClick={(e) => e.stopPropagation()}
    >
      {active ? (
        <>
          <p className="text-sm font-medium text-amber-900">
            Complete payment in {formatPaymentHoldCountdown(secondsRemaining)}
          </p>
          <p className="text-xs text-amber-800 mt-0.5">{holdMessage}</p>
          <button
            type="button"
            onClick={onPayNow}
            className="mt-2 w-full rounded-lg bg-[#FF8C42] py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Pay now
          </button>
        </>
      ) : (
        <p className="text-sm text-gray-600">Payment window expired. This order was cancelled.</p>
      )}
    </div>
  );
}
