'use client';

import { useEffect, useState } from 'react';

export function formatPaymentHoldCountdown(secondsRemaining: number): string {
  const s = Math.max(0, secondsRemaining);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
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
  if (st === 'pending_payment') return true;
  if (st === 'confirmed' && ps === 'pending' && !paidLike) return true;
  return false;
}

export function isPaymentHoldActive(
  booking: { status?: string; paymentHoldExpiresAt?: string | null }
): boolean {
  if (!isBookingAwaitingPayment(booking)) return false;
  if (!booking.paymentHoldExpiresAt) return true;
  return new Date(booking.paymentHoldExpiresAt).getTime() > Date.now();
}
