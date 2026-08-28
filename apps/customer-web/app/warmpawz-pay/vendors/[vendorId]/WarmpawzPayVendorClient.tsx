'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode } from 'lucide-react';
import { useWpayVendorId } from '@/lib/warmpawz-pay/use-wpay-vendor-id';
import {
  fetchWpayAppointmentContext,
  fetchWpayVendorDetail,
  readCustomerPhoneFromStorage,
  type WpayAppointmentContext,
  type WpayVendorDetail,
} from '@/lib/warmpawz-pay/wpay-api';
import { previewWpayCommercialQuote, previewWpayQuote } from '@/lib/warmpawz-pay/wpay-quote';
import { runWpayRazorpayCheckout } from '@/lib/warmpawz-pay/wpay-razorpay-checkout';
import { consumeRestoredWpayPayBillAmount } from '@/lib/warmpawz-pay/wpay-guest-journey';
import {
  emitGuestAuthAnalytics,
  isGuestApplicationState,
  requestGuestAuthForWpayPay,
} from '@/lib/guest-auth-gate';
import { CUSTOMER_AUTH_COMPLETED_EVENT } from '@/lib/customer-auth-session-event';
import { VendorProfileDashboardHeader } from '@/components/customer/shared/VendorProfileDashboardHeader';
import { VendorHeroPhotoCarousel } from '@/components/customer/shared/VendorHeroPhotoCarousel';
import { DiscoveryProviderAvatar } from '@/components/customer/shared/DiscoveryProviderAvatar';
import { StarRating } from '@/components/customer/shared/StarRating';

const QUICK_AMOUNTS = [500, 1000, 1500, 2000];

function formatInr(n: number): string {
  const fractionDigits = Number.isInteger(n) ? 0 : 2;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`;
}

export function WarmpawzPayVendorClient({ vendorId }: { vendorId?: string }) {
  const router = useRouter();
  const resolvedVendorId = useWpayVendorId(vendorId);

  const [vendor, setVendor] = useState<WpayVendorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [quoteReady, setQuoteReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [appointmentContext, setAppointmentContext] = useState<WpayAppointmentContext | null>(null);

  useEffect(() => {
    if (!resolvedVendorId) return;
    setLoading(true);
    fetchWpayVendorDetail(resolvedVendorId)
      .then((v) => {
        setVendor(v);
        setError(v ? null : 'Vendor not found');
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load vendor');
        setVendor(null);
      })
      .finally(() => setLoading(false));
  }, [resolvedVendorId]);

  const refreshAppointmentContext = useCallback(async () => {
    if (!resolvedVendorId) return;
    const phone = readCustomerPhoneFromStorage();
    if (!phone) return;
    try {
      const ctx = await fetchWpayAppointmentContext(resolvedVendorId, phone);
      if (ctx) setAppointmentContext(ctx);
    } catch {
      /* non-fatal */
    }
  }, [resolvedVendorId]);

  useEffect(() => {
    void refreshAppointmentContext();
  }, [refreshAppointmentContext]);

  useEffect(() => {
    if (!resolvedVendorId) return;
    const restored = consumeRestoredWpayPayBillAmount(resolvedVendorId);
    if (restored == null) return;
    setAmountInput(String(restored));
    setQuoteReady(true);
    emitGuestAuthAnalytics('booking_resumed', { kind: 'pay_bill' });
    void refreshAppointmentContext();
  }, [resolvedVendorId, refreshAppointmentContext]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onAuth = () => {
      void refreshAppointmentContext();
    };
    window.addEventListener(CUSTOMER_AUTH_COMPLETED_EVENT, onAuth);
    return () => window.removeEventListener(CUSTOMER_AUTH_COMPLETED_EVENT, onAuth);
  }, [refreshAppointmentContext]);

  useEffect(() => {
    if (isGuestApplicationState()) {
      emitGuestAuthAnalytics('vendor_viewed', { source: 'pay_bill' });
    }
  }, [resolvedVendorId]);

  const creditEligibleBooking = appointmentContext?.creditEligibleBooking ?? null;

  const billAmount = useMemo(() => {
    const n = parseFloat(amountInput.replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amountInput]);

  const linkedBookingId = creditEligibleBooking?.bookingId ?? null;
  const appointmentFeeCredit = creditEligibleBooking?.appointmentFee ?? 0;

  const quote = useMemo(() => {
    if (!vendor || billAmount <= 0) return null;
    const credit = linkedBookingId ? appointmentFeeCredit : 0;
    if (vendor.commercialModel === 'tier_commission') {
      return previewWpayCommercialQuote({
        originalAmount: billAmount,
        discountPercent: vendor.discountPercent,
        maxDiscountAmount: vendor.maxDiscountAmount,
        appointmentFeeCredit: credit,
        convenienceFee: vendor.convenienceFee ?? 0,
        convenienceGstRate: vendor.convenienceGstRate ?? 18,
      });
    }
    return previewWpayQuote({
      originalAmount: billAmount,
      discountPercent: vendor.discountPercent,
      maxDiscountAmount: vendor.maxDiscountAmount,
      appointmentFeeCredit: credit,
    });
  }, [billAmount, vendor, linkedBookingId, appointmentFeeCredit]);

  const isTierQuote = quote != null && 'commercialModel' in quote && quote.commercialModel === 'tier_commission';

  const onGetDiscount = useCallback(() => {
    if (billAmount <= 0) return;
    setPayError(null);
    setQuoteReady(true);
  }, [billAmount]);

  const onProceedToPay = useCallback(async () => {
    if (!vendor || !resolvedVendorId || billAmount <= 0 || !quote) return;
    if (requestGuestAuthForWpayPay({ vendorId: resolvedVendorId, amount: billAmount })) return;
    const phone = readCustomerPhoneFromStorage();
    if (!phone) {
      setPayError('Please log in to continue');
      return;
    }

    setPaying(true);
    setPayError(null);
    emitGuestAuthAnalytics('payment_started', { source: 'pay_bill' });
    try {
      const result = await runWpayRazorpayCheckout({
        vendorId: resolvedVendorId,
        vendorName: vendor.name,
        originalAmount: billAmount,
        customerPhone: phone,
        bookingId: linkedBookingId,
      });
      const saved = Number(result.savedAmount ?? result.discountAmount ?? quote.discountAmount);
      const qs = new URLSearchParams({
        saved: String(saved),
        vendor: vendor.name,
      });
      router.push(`/warmpawz-pay/success?${qs.toString()}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Payment failed';
      if (msg !== 'Payment cancelled') {
        emitGuestAuthAnalytics('payment_failed', { source: 'pay_bill' });
        setPayError(msg);
      }
    } finally {
      setPaying(false);
    }
  }, [billAmount, linkedBookingId, quote, resolvedVendorId, router, vendor]);

  if (loading) {
    return <p className="p-8 text-center text-sm text-gray-500">Loading…</p>;
  }

  if (error || !vendor) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-red-600">{error ?? 'Vendor not found'}</p>
        <button type="button" onClick={() => router.back()} className="mt-4 text-sm text-[#FF6B00]">
          Go back
        </button>
      </div>
    );
  }

  const heroPhotos = vendor.photoUrl ? [vendor.photoUrl] : [];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-customer flex-col bg-gray-50 pb-28">
      <VendorProfileDashboardHeader
        className="!z-0 isolation-auto"
        serviceName="Warmpawz Pay"
        serviceSubtitle="Make a payment & get exclusive discounts"
        serviceIcon={QrCode}
        iconColor="text-white"
        showBackButton={true}
        onBack={() => router.back()}
        bottomEdge="flat"
      />

      <div className="relative z-0 w-full">
        {heroPhotos.length > 0 ? (
          <div className="relative w-full -mt-3">
            <div className="overflow-hidden rounded-t-[24px] bg-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] sm:rounded-t-[28px]">
              <VendorHeroPhotoCarousel
                photos={heroPhotos}
                name={vendor.name}
                frameClassName="relative aspect-[5/4] w-full max-h-[320px] overflow-hidden sm:aspect-auto sm:h-[240px] sm:max-h-none"
              />
            </div>
          </div>
        ) : (
          <div className="relative w-full -mt-3">
            <div className="overflow-hidden rounded-t-[24px] sm:rounded-t-[28px]">
              <div className="relative flex aspect-[5/4] w-full max-h-[320px] items-center justify-center bg-gradient-to-br from-orange-100 via-orange-50 to-white sm:aspect-auto sm:h-[200px] sm:max-h-none">
                <DiscoveryProviderAvatar name={vendor.name} photo={undefined} className="h-24 w-24 text-3xl" />
              </div>
            </div>
          </div>
        )}

        <div className="px-4">
          <div className="relative z-10 -mt-6 mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h1 className="text-xl font-bold text-gray-900">{vendor.name}</h1>
            <p className="mt-1 text-sm text-gray-500">{vendor.address}</p>
            {vendor.phone ? <p className="mt-0.5 text-sm text-gray-500">{vendor.phone}</p> : null}
            {vendor.rating > 0 ? (
              <div className="mt-2 inline-block rounded-lg bg-orange-50 px-3 py-1.5">
                <StarRating
                  rating={vendor.rating}
                  reviewCount={vendor.reviewCount}
                  starsClassName="h-4 w-4"
                  textClassName="text-xs text-gray-600"
                />
              </div>
            ) : null}
            {vendor.discountPercent > 0 ? (
              <div className="mt-3 rounded-xl border border-green-100 bg-green-50 p-3 text-sm">
                <p className="font-semibold text-green-800">{vendor.offerLabel}</p>
                {vendor.maxDiscountAmount != null ? (
                  <p className="text-xs text-green-700">Upto {formatInr(vendor.maxDiscountAmount)}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            {creditEligibleBooking ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">
                <p className="font-semibold">Appointment found</p>
                <p className="mt-1 text-xs text-green-800">
                  {formatInr(creditEligibleBooking.appointmentFee)} appointment fee credit will apply after your discount.
                </p>
              </div>
            ) : null}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Enter Bill Amount</label>
              <div className="flex items-center rounded-xl border border-gray-200 bg-white px-3 py-3">
                <span className="text-lg text-gray-500">₹</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(e) => {
                    setAmountInput(e.target.value);
                    setQuoteReady(false);
                  }}
                  placeholder="0.00"
                  className="ml-2 flex-1 bg-transparent text-lg outline-none"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => {
                      setAmountInput(String(a));
                      setQuoteReady(false);
                    }}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm"
                  >
                    {formatInr(a)}
                  </button>
                ))}
              </div>
            </div>

            {quoteReady && quote ? (
              <div className="rounded-xl bg-gray-50 p-3 text-sm">
                <div className="flex justify-between">
                  <span>Quoted bill</span>
                  <span>{formatInr(quote.originalAmount)}</span>
                </div>
                <div className="flex justify-between text-green-700">
                  <span>Offer discount ({vendor.discountPercent}% OFF)</span>
                  <span>- {formatInr(quote.discountAmount)}</span>
                </div>
                {isTierQuote ? (
                  <div className="flex justify-between text-gray-600">
                    <span>Service payable</span>
                    <span>{formatInr(quote.servicePayableAmount)}</span>
                  </div>
                ) : null}
                {quote.appointmentFeeCredit > 0 ? (
                  <div className="flex justify-between text-[#FF6B00]">
                    <span>Appointment fee credit</span>
                    <span>- {formatInr(quote.appointmentFeeCredit)}</span>
                  </div>
                ) : null}
                {!isTierQuote && quote.appointmentFeeCredit > 0 && 'billBase' in quote ? (
                  <div className="flex justify-between text-gray-600">
                    <span>After credit</span>
                    <span>{formatInr(quote.billBase)}</span>
                  </div>
                ) : null}
                {isTierQuote && quote.convenienceFee > 0 ? (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>Convenience fee</span>
                      <span>{formatInr(quote.convenienceFee)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Convenience GST ({vendor.convenienceGstRate}%)</span>
                      <span>{formatInr(quote.convenienceGstAmount)}</span>
                    </div>
                  </>
                ) : null}
                <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-semibold">
                  <span>You pay</span>
                  <span>{formatInr(quote.payableAmount)}</span>
                </div>
                <p className="mt-2 rounded-lg bg-green-50 p-2 text-center text-xs text-green-800">
                  You save {formatInr(quote.originalAmount - (isTierQuote ? quote.servicePayableAmount : quote.payableAmount))} with this offer!
                </p>
              </div>
            ) : null}

            <button
              type="button"
              disabled={billAmount <= 0 || paying}
              onClick={quoteReady ? () => void onProceedToPay() : onGetDiscount}
              className="w-full rounded-xl bg-[#FF6B00] py-3 text-center font-semibold text-white disabled:opacity-50"
            >
              {paying ? 'Opening payment…' : quoteReady ? 'Proceed to Pay' : 'Get Discount'}
            </button>
            {payError ? <p className="text-center text-sm text-red-600">{payError}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
