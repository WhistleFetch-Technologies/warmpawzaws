'use client';

/**
 * Large on-screen alert when a Warmpawz Pay (Pay Bill) payment completes.
 * Distinct from booking alerts — shows customer, vendor payable, and paid time.
 */

import { useEffect } from 'react';
import { IndianRupee, User, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { playOrderAlertSound } from '@/lib/audio-alerts';

export type WpayPaymentAlertData = {
  customerName?: string;
  vendorPayableAmount?: number | string;
  vendorEarnings?: number | string;
  paidAt?: string;
  quotedAmount?: number | string;
  paymentId?: string;
  flowType?: string;
};

interface VendorWpayPaymentAlertProps {
  notification: {
    type?: string;
    title?: string;
    message?: string;
    data?: string | WpayPaymentAlertData;
  };
  onViewEarnings: () => void;
  onDismiss: () => void;
  playSound?: boolean;
}

function parseData(
  raw: string | WpayPaymentAlertData | undefined,
): WpayPaymentAlertData | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as WpayPaymentAlertData;
    } catch {
      return null;
    }
  }
  return raw;
}

function money(value: number | string | undefined): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatPaidAt(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function VendorWpayPaymentAlert({
  notification,
  onViewEarnings,
  onDismiss,
  playSound = true,
}: VendorWpayPaymentAlertProps) {
  const data = parseData(notification.data);

  useEffect(() => {
    if (playSound) playOrderAlertSound();
  }, [playSound]);

  const customerName = data?.customerName || 'Customer';
  const payable = money(data?.vendorPayableAmount ?? data?.vendorEarnings);
  const paidAtLabel = formatPaidAt(data?.paidAt);
  const quoted = money(data?.quotedAmount);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B1A] px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium opacity-90">Warmpawz Pay</span>
            <button
              type="button"
              onClick={onDismiss}
              className="p-2 rounded-full hover:bg-white/20 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <h2 className="text-xl font-bold mt-2">Payment received</h2>
          <p className="text-sm opacity-90 mt-1">A customer paid their bill via Warmpawz Pay.</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
              <User className="w-6 h-6 text-[#FF8C42]" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{customerName}</p>
              <p className="text-sm text-gray-600">Pay Bill</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-700">
            <IndianRupee className="w-4 h-4 text-[#FF8C42]" />
            <span>
              You receive{' '}
              <span className="font-semibold text-green-700">
                ₹{payable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {quoted > 0 ? (
                <span className="text-gray-500"> (bill ₹{quoted.toLocaleString('en-IN')})</span>
              ) : null}
            </span>
          </div>

          {paidAtLabel ? (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4 text-[#FF8C42]" />
              <span>{paidAtLabel}</span>
            </div>
          ) : notification.message ? (
            <p className="text-sm text-gray-600">{notification.message}</p>
          ) : null}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onDismiss}>
              Dismiss
            </Button>
            <Button
              type="button"
              className="flex-1 bg-[#FF8C42] hover:bg-[#FF7829]"
              onClick={() => {
                onViewEarnings();
                onDismiss();
              }}
            >
              View earnings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
