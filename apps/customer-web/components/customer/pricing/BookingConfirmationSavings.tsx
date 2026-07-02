'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { BookingPricingSummary } from './BookingPricingSummary';
import { extractBookingFinancial } from '@/lib/pricing/booking-financial';
import type { BookingFinancialSnapshot } from '@/lib/pricing/booking-financial';

export type BookingConfirmationSavingsProps = {
  bookingId?: string;
  fallbackBasePrice?: number;
  className?: string;
};

export function BookingConfirmationSavings({
  bookingId,
  fallbackBasePrice = 0,
  className = '',
}: BookingConfirmationSavingsProps) {
  const [financial, setFinancial] = useState<BookingFinancialSnapshot | null>(null);
  const [loading, setLoading] = useState(Boolean(bookingId));

  useEffect(() => {
    if (!bookingId) {
      if (fallbackBasePrice > 0) {
        setFinancial(
          extractBookingFinancial({
            base_price: fallbackBasePrice,
            total_amount: fallbackBasePrice,
          })
        );
      }
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    apiClient
      .get<any>(`/bookings/${bookingId}`)
      .then((res) => {
        if (cancelled) return;
        const raw = res?.booking ?? res?.data ?? res;
        if (raw && typeof raw === 'object') {
          setFinancial(extractBookingFinancial(raw as Record<string, unknown>));
        } else if (fallbackBasePrice > 0) {
          setFinancial(
            extractBookingFinancial({
              base_price: fallbackBasePrice,
              total_amount: fallbackBasePrice,
            })
          );
        }
      })
      .catch(() => {
        if (!cancelled && fallbackBasePrice > 0) {
          setFinancial(
            extractBookingFinancial({
              base_price: fallbackBasePrice,
              total_amount: fallbackBasePrice,
            })
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bookingId, fallbackBasePrice]);

  if (loading) {
    return <p className={`text-sm text-gray-500 ${className}`}>Loading payment summary…</p>;
  }
  if (!financial || (financial.finalPaid <= 0 && financial.totalSavings <= 0)) {
    return null;
  }

  return (
    <BookingPricingSummary
      financial={financial}
      title="Payment summary"
      showSavingsBanner
      compact
      className={className}
    />
  );
}
