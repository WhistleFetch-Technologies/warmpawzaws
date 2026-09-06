'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { readCustomerPhoneFromStorage } from '@/lib/warmpawz-pay/wpay-api';
import {
  confirmWpayPaymentFromSuccessPage,
  WPAY_CONFIRM_TIMEOUT_COPY,
  WPAY_CONFIRMING_COPY,
  type WpayConfirmOutcome,
} from '@/lib/warmpawz-pay/wpay-success-confirm';

function formatInr(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type SuccessView =
  | { kind: 'confirming' }
  | { kind: 'success'; saved: number; vendor: string }
  | { kind: 'timeout' }
  | { kind: 'message'; tone: 'error' | 'info'; text: string };

function outcomeToView(
  outcome: WpayConfirmOutcome,
  fallbackSaved: number,
  vendor: string,
): SuccessView | null {
  if (outcome.status === 'aborted') return null;
  if (outcome.status === 'success') {
    const saved = Number(outcome.result.savedAmount ?? outcome.result.discountAmount ?? fallbackSaved);
    return {
      kind: 'success',
      saved: Number.isFinite(saved) ? saved : 0,
      vendor,
    };
  }
  if (outcome.status === 'timeout' || outcome.status === 'pending') {
    return { kind: 'timeout' };
  }
  if (outcome.status === 'auth') {
    return { kind: 'message', tone: 'error', text: outcome.message || 'Please log in to continue' };
  }
  if (outcome.status === 'not_found') {
    return { kind: 'message', tone: 'error', text: outcome.message || 'Payment not found' };
  }
  return {
    kind: 'message',
    tone: 'error',
    text: outcome.message || 'We could not confirm this payment. Please check your payment history shortly.',
  };
}

export function WarmpawzPaySuccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = (searchParams.get('paymentId') ?? '').trim();
  const savedFromUrl = Number(searchParams.get('saved') ?? 0);
  const vendor = searchParams.get('vendor') ?? 'the merchant';
  const razorpayPaymentId = searchParams.get('razorpay_payment_id');
  const razorpayOrderId = searchParams.get('razorpay_order_id');
  const razorpaySignature = searchParams.get('razorpay_signature');

  const callbackKey = useMemo(
    () =>
      [paymentId, razorpayPaymentId ?? '', razorpayOrderId ?? '', razorpaySignature ?? ''].join('|'),
    [paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature],
  );

  const [view, setView] = useState<SuccessView>({ kind: 'confirming' });

  useEffect(() => {
    if (!paymentId) {
      setView({
        kind: 'message',
        tone: 'error',
        text: 'We could not find this payment. You can check your payment history shortly.',
      });
      return;
    }

    const phone = readCustomerPhoneFromStorage();
    if (!phone) {
      setView({
        kind: 'message',
        tone: 'error',
        text: 'Please log in to continue',
      });
      return;
    }

    const controller = new AbortController();
    setView({ kind: 'confirming' });

    void confirmWpayPaymentFromSuccessPage({
      paymentId,
      phone,
      callback: {
        razorpay_payment_id: razorpayPaymentId,
        razorpay_order_id: razorpayOrderId,
        razorpay_signature: razorpaySignature,
      },
      signal: controller.signal,
    })
      .then((outcome) => {
        if (controller.signal.aborted) return;
        const next = outcomeToView(outcome, savedFromUrl, vendor);
        if (next) setView(next);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setView({
          kind: 'message',
          tone: 'error',
          text: 'We could not confirm this payment. Please check your payment history shortly.',
        });
      });

    return () => {
      controller.abort();
    };
    // Query identity only — saved/vendor are display fallbacks, not confirm inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbackKey]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-customer flex-col items-center justify-center bg-gray-50 p-6 text-center">
      {view.kind === 'success' ? (
        <>
          <CheckCircle2 className="h-16 w-16 text-green-600" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Payment successful!</h1>
          {Number.isFinite(view.saved) && view.saved > 0 ? (
            <p className="mt-2 text-lg text-green-700">
              Congratulations, you saved {formatInr(view.saved)}!
            </p>
          ) : null}
          <p className="mt-2 text-sm text-gray-600">
            Thank you for paying {view.vendor} with Warmpawz Pay.
          </p>
        </>
      ) : view.kind === 'confirming' ? (
        <>
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-200 border-t-[#FF6B00]" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">{WPAY_CONFIRMING_COPY}</h1>
          <p className="mt-2 text-sm text-gray-600">
            Please wait while we confirm your payment with the bank.
          </p>
        </>
      ) : view.kind === 'timeout' ? (
        <>
          <h1 className="text-2xl font-bold text-gray-900">Still confirming your payment</h1>
          <p className="mt-3 max-w-md text-sm text-gray-600">{WPAY_CONFIRM_TIMEOUT_COPY}</p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-gray-900">Payment update</h1>
          <p
            className={`mt-3 max-w-md text-sm ${view.tone === 'error' ? 'text-red-600' : 'text-gray-600'}`}
          >
            {view.text}
          </p>
        </>
      )}
      <div className="mt-8 flex w-full flex-col gap-3">
        <button
          type="button"
          onClick={() => router.push('/warmpawz-pay/history')}
          className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium"
        >
          View payment history
        </button>
        <button
          type="button"
          onClick={() => router.push('/warmpawz-pay')}
          className="w-full rounded-xl bg-[#FF6B00] py-3 text-sm font-semibold text-white"
        >
          Back to Warmpawz Pay
        </button>
      </div>
    </div>
  );
}
