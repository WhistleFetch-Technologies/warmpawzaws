'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Copy, QrCode } from 'lucide-react';
import { useWpayVendorId } from '@/lib/warmpawz-pay/use-wpay-vendor-id';
import {
  fetchWpayAppointmentContext,
  fetchWpayVendorDetail,
  readCustomerPhoneFromStorage,
  type WpayAppointmentContext,
  type WpayAppointmentContextBooking,
  type WpayVendorDetail,
} from '@/lib/warmpawz-pay/wpay-api';
import { previewWpayQuote } from '@/lib/warmpawz-pay/wpay-quote';
import { runWpayRazorpayCheckout } from '@/lib/warmpawz-pay/wpay-razorpay-checkout';
import { VendorProfileDashboardHeader } from '@/components/customer/shared/VendorProfileDashboardHeader';
import { VendorHeroPhotoCarousel } from '@/components/customer/shared/VendorHeroPhotoCarousel';
import { DiscoveryProviderAvatar } from '@/components/customer/shared/DiscoveryProviderAvatar';
import { StarRating } from '@/components/customer/shared/StarRating';

const QUICK_AMOUNTS = [500, 1000, 1500, 2000];
const APPOINTMENT_POLL_MS = 4000;

function formatInr(n: number): string {
  const fractionDigits = Number.isInteger(n) ? 0 : 2;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`;
}

function formatAppointmentWhen(booking: WpayAppointmentContextBooking): string {
  if (booking.bookingDatetime) {
    try {
      return new Date(booking.bookingDatetime).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      /* fall through */
    }
  }
  const parts = [booking.bookingDate, booking.bookingTime].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Scheduled appointment';
}

function WpayAppointmentOtpCard({ booking }: { booking: WpayAppointmentContextBooking }) {
  const displayOtp = booking.completionOtp || booking.otpCode;
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    if (!displayOtp) return;
    try {
      await navigator.clipboard.writeText(displayOtp);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [displayOtp]);

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-white p-2 text-[#FF6B00]">
          <Calendar className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{booking.serviceName}</p>
          <p className="mt-0.5 text-xs text-gray-600">{formatAppointmentWhen(booking)}</p>
          <p className="mt-1 text-xs text-gray-500">
            Show this OTP to the vendor to complete your appointment before paying the bill.
          </p>
        </div>
      </div>
      {displayOtp ? (
        <div className="mt-3 rounded-lg bg-white p-3 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Your OTP</p>
          <p className="mt-1 text-2xl font-bold tracking-[0.2em] text-gray-900">{displayOtp}</p>
          <button
            type="button"
            onClick={() => void onCopy()}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#FF6B00]"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? 'Copied' : 'Copy OTP'}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-amber-800">OTP will appear when your appointment is ready.</p>
      )}
      <p className="mt-2 text-xs text-amber-800">
        Waiting for vendor to complete your appointment… This screen updates automatically.
      </p>
    </div>
  );
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

  const openAppointment = appointmentContext?.openAppointment ?? null;
  const creditEligibleBooking = appointmentContext?.creditEligibleBooking ?? null;

  useEffect(() => {
    if (!openAppointment || creditEligibleBooking) return;
    const id = window.setInterval(() => {
      void refreshAppointmentContext();
    }, APPOINTMENT_POLL_MS);
    return () => window.clearInterval(id);
  }, [openAppointment, creditEligibleBooking, refreshAppointmentContext]);

  const billAmount = useMemo(() => {
    const n = parseFloat(amountInput.replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amountInput]);

  const linkedBookingId = creditEligibleBooking?.bookingId ?? null;
  const appointmentFeeCredit = creditEligibleBooking?.appointmentFee ?? 0;

  const quote = useMemo(() => {
    if (!vendor || billAmount <= 0) return null;
    return previewWpayQuote({
      originalAmount: billAmount,
      discountPercent: vendor.discountPercent,
      maxDiscountAmount: vendor.maxDiscountAmount,
      appointmentFeeCredit: linkedBookingId ? appointmentFeeCredit : 0,
    });
  }, [billAmount, vendor, linkedBookingId, appointmentFeeCredit]);

  const onGetDiscount = useCallback(() => {
    if (billAmount <= 0) return;
    if (openAppointment && !creditEligibleBooking) {
      setPayError('Please complete your appointment with the vendor first (OTP).');
      return;
    }
    setPayError(null);
    setQuoteReady(true);
  }, [billAmount, openAppointment, creditEligibleBooking]);

  const onProceedToPay = useCallback(async () => {
    if (!vendor || !resolvedVendorId || billAmount <= 0 || !quote) return;
    const phone = readCustomerPhoneFromStorage();
    if (!phone) {
      setPayError('Please log in to continue');
      return;
    }

    setPaying(true);
    setPayError(null);
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
            {openAppointment ? <WpayAppointmentOtpCard booking={openAppointment} /> : null}

            {creditEligibleBooking && !openAppointment ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">
                <p className="font-semibold">Appointment completed</p>
                <p className="mt-1 text-xs text-green-800">
                  {formatInr(creditEligibleBooking.appointmentFee)} appointment fee will be credited to your bill.
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
                {quote.appointmentFeeCredit > 0 ? (
                  <div className="flex justify-between text-[#FF6B00]">
                    <span>Appointment fee credit</span>
                    <span>- {formatInr(quote.appointmentFeeCredit)}</span>
                  </div>
                ) : null}
                {quote.appointmentFeeCredit > 0 ? (
                  <div className="flex justify-between text-gray-600">
                    <span>After credit</span>
                    <span>{formatInr(quote.billBase)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-green-700">
                  <span>Offer discount ({vendor.discountPercent}% OFF)</span>
                  <span>- {formatInr(quote.discountAmount)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-semibold">
                  <span>You pay</span>
                  <span>{formatInr(quote.payableAmount)}</span>
                </div>
                <p className="mt-2 rounded-lg bg-green-50 p-2 text-center text-xs text-green-800">
                  You save {formatInr(quote.originalAmount - quote.payableAmount)} with this offer!
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
