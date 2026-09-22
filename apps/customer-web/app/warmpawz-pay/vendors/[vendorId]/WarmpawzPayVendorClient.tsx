'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode } from 'lucide-react';
import { useWpayVendorId } from '@/lib/warmpawz-pay/use-wpay-vendor-id';
import {
  fetchWpayVendorDetail,
  readCustomerPhoneFromStorage,
  type WpayVendorDetail,
} from '@/lib/warmpawz-pay/wpay-api';
import { previewWpayCommercialQuote, previewWpayQuote } from '@/lib/warmpawz-pay/wpay-quote';
import { runWpayRazorpayCheckout } from '@/lib/warmpawz-pay/wpay-razorpay-checkout';
import { buildWpaySuccessPath } from '@/lib/warmpawz-pay/wpay-success-href';
import { consumeRestoredWpayPayBillAmount } from '@/lib/warmpawz-pay/wpay-guest-journey';
import { handleWpayPageBack } from '@/lib/go-back-or-replace';
import {
  emitGuestAuthAnalytics,
  isGuestApplicationState,
  requestGuestAuthForWpayPay,
} from '@/lib/guest-auth-gate';
import { VendorProfileDashboardHeader } from '@/components/customer/shared/VendorProfileDashboardHeader';
import { VendorHeroPhotoCarousel } from '@/components/customer/shared/VendorHeroPhotoCarousel';
import { DiscoveryProviderAvatar } from '@/components/customer/shared/DiscoveryProviderAvatar';
import { StarRating } from '@/components/customer/shared/StarRating';
import {
  PromoEarnPreview,
  type PromoEngineEarnPreviewData,
} from '@/components/customer/promo-engine/PromoEarnPreview';
import { CustomerWalletApply } from '@/components/customer/payment/CustomerWalletApply';
import { useCustomerWallet } from '@/hooks/use-customer-wallet';
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const QUICK_AMOUNTS = [500, 1000, 1500, 2000];
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readBookingIdFromQuery(): string | null {
  if (typeof window === 'undefined') return null;
  const id = new URLSearchParams(window.location.search).get('bookingId');
  return id && UUID_RE.test(id) ? id : null;
}

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
  const [showWaitForConfirmDialog, setShowWaitForConfirmDialog] = useState(false);
  const [promoEnginePreview, setPromoEnginePreview] =
    useState<PromoEngineEarnPreviewData | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const phone = readCustomerPhoneFromStorage();
  const { wallet } = useCustomerWallet(phone, {
    serviceCategory: vendor?.category,
    channel: 'paybill',
    vendorId: resolvedVendorId,
  });

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

  useEffect(() => {
    if (!resolvedVendorId) return;
    const restored = consumeRestoredWpayPayBillAmount(resolvedVendorId);
    if (restored == null) return;
    setAmountInput(String(restored));
    setQuoteReady(true);
    emitGuestAuthAnalytics('booking_resumed', { kind: 'pay_bill' });
  }, [resolvedVendorId]);

  useEffect(() => {
    if (isGuestApplicationState()) {
      emitGuestAuthAnalytics('vendor_viewed', { source: 'pay_bill' });
    }
  }, [resolvedVendorId]);

  const billAmount = useMemo(() => {
    const n = parseFloat(amountInput.replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amountInput]);

  const quote = useMemo(() => {
    if (!vendor || billAmount <= 0) return null;
    const engineD = Math.max(0, Number(promoEnginePreview?.engineDiscount) || 0);
    if (vendor.commercialModel === 'tier_commission') {
      return previewWpayCommercialQuote({
        originalAmount: billAmount,
        discountPercent: 0,
        discountAmountOverride: engineD,
        maxDiscountAmount: vendor.maxDiscountAmount,
        platformFee: vendor.platformFee ?? 0,
        platformFeeMode: vendor.platformFeeMode ?? 'fixed',
        platformFeeGstRate: vendor.platformFeeGstRate ?? 18,
        convenienceFee: vendor.convenienceFee ?? 0,
        convenienceFeeMode: vendor.convenienceFeeMode ?? 'fixed',
        convenienceGstRate: vendor.convenienceGstRate ?? 18,
      });
    }
    return previewWpayQuote({
      originalAmount: billAmount,
      discountPercent: 0,
      discountAmountOverride: engineD,
      maxDiscountAmount: vendor.maxDiscountAmount,
    });
  }, [billAmount, vendor, promoEnginePreview?.engineDiscount]);

  const isTierQuote = quote != null && 'commercialModel' in quote && quote.commercialModel === 'tier_commission';
  const displayPayable = quote != null ? quote.payableAmount : 0;
  const spendableWallet = Math.max(0, Number(wallet?.spendableBalance ?? wallet?.balance ?? 0) || 0);
  const walletAmountApplied =
    useWallet && spendableWallet > 0.009 && displayPayable > 0
      ? Math.min(spendableWallet, displayPayable)
      : 0;
  const displayAfterWallet = Math.max(0, Math.round((displayPayable - walletAmountApplied) * 100) / 100);

  const onGetDiscount = useCallback(() => {
    if (billAmount <= 0) return;
    setPayError(null);
    setQuoteReady(true);
  }, [billAmount]);

  useEffect(() => {
    if (!quoteReady || billAmount <= 0 || !resolvedVendorId) return;
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const userId =
            getResolvedCustomerId() ||
            (typeof window !== 'undefined'
              ? localStorage.getItem('customerId') || localStorage.getItem('customer_id')
              : null);
          if (!userId) {
            setPromoEnginePreview(null);
            return;
          }
          const ev = await apiClient.post<{
            evaluation_id?: string;
            evaluationId?: string;
            eligible?: boolean;
            summary?: { cashback?: number; discount?: number };
            data?: {
              evaluation_id?: string;
              eligible?: boolean;
              summary?: { cashback?: number; discount?: number };
              benefits?: Array<{
                benefit_type?: string;
                redeem_scope?: string[];
                expiry_days?: number;
                redeem?: { letter?: string; channels?: string[] };
              }>;
            };
            benefits?: Array<{
              benefit_type?: string;
              redeem_scope?: string[];
              expiry_days?: number;
              redeem?: { letter?: string; channels?: string[] };
            }>;
          }>('/promo-engine/evaluate', {
            user_id: userId,
            persist: false,
            transaction: {
              type: 'WPAY',
              channel: 'paybill',
              vendor_id: resolvedVendorId,
              vendorId: resolvedVendorId,
              amount: billAmount,
            },
          });
          const payload = ev?.data ?? ev;
          const cb = (payload?.benefits || ev?.benefits || []).find((b) => b.benefit_type === 'CASHBACK');
          const redeem = cb?.redeem;
          const redeemLabel = redeem
            ? redeem.letter === 'F'
              ? 'anywhere'
              : redeem.letter === 'V'
                ? 'this vendor'
                : 'this category'
            : undefined;
          setPromoEnginePreview({
            evaluationId: payload?.evaluation_id || ev?.evaluation_id || ev?.evaluationId,
            pendingCashback: payload?.summary?.cashback ?? ev?.summary?.cashback ?? 0,
            engineDiscount: payload?.summary?.discount ?? ev?.summary?.discount ?? 0,
            eligible: payload?.eligible ?? ev?.eligible,
            redeemScope: cb?.redeem_scope || (redeem?.channels ? redeem.channels : []),
            redeemLabel,
            expiryDays: cb?.expiry_days ?? null,
          });
        } catch {
          setPromoEnginePreview(null);
        }
      })();
    }, 300);
    return () => window.clearTimeout(handle);
  }, [quoteReady, billAmount, resolvedVendorId]);

  const runPaymentCheckout = useCallback(async () => {
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
        bookingId: readBookingIdFromQuery(),
        evaluationId: promoEnginePreview?.evaluationId || null,
        serviceCategory: vendor.category || null,
        walletAmount: walletAmountApplied,
      });
      const paymentId = String(result.paymentId ?? '').trim();
      if (!paymentId) {
        throw new Error(result.error || 'Payment confirmation is still pending');
      }
      const saved = Number(result.savedAmount ?? result.discountAmount ?? quote.discountAmount);
      router.push(
        buildWpaySuccessPath({
          paymentId,
          saved,
          vendor: vendor.name,
        }),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Payment failed';
      emitGuestAuthAnalytics('payment_failed', { source: 'pay_bill' });
      setPayError(msg);
    } finally {
      setPaying(false);
    }
  }, [billAmount, quote, resolvedVendorId, router, vendor, promoEnginePreview?.evaluationId, vendor?.category, walletAmountApplied]);

  const onProceedToPay = useCallback(() => {
    if (!vendor || !resolvedVendorId || billAmount <= 0 || !quote) return;
    if (requestGuestAuthForWpayPay({ vendorId: resolvedVendorId, amount: billAmount })) return;
    const phone = readCustomerPhoneFromStorage();
    if (!phone) {
      setPayError('Please log in to continue');
      return;
    }
    setPayError(null);
    setShowWaitForConfirmDialog(true);
  }, [billAmount, quote, resolvedVendorId, vendor]);

  const onConfirmWaitAndPay = useCallback(() => {
    setShowWaitForConfirmDialog(false);
    void runPaymentCheckout();
  }, [runPaymentCheckout]);

  if (loading) {
    return <p className="p-8 text-center text-sm text-gray-500">Loading…</p>;
  }

  if (error || !vendor) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-red-600">{error ?? 'Vendor not found'}</p>
        <button type="button" onClick={() => handleWpayPageBack(router)} className="mt-4 text-sm text-[#FF6B00]">
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
        onBack={() => handleWpayPageBack(router)}
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
          </div>

          <div className="space-y-4">
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
                {quote.discountAmount > 0 ? (
                  <div className="flex justify-between text-green-700">
                    <span>Promo discount</span>
                    <span>- {formatInr(quote.discountAmount)}</span>
                  </div>
                ) : null}
                {isTierQuote ? (
                  <div className="flex justify-between text-gray-600">
                    <span>Service payable</span>
                    <span>{formatInr(quote.servicePayableAmount)}</span>
                  </div>
                ) : null}
                {isTierQuote && quote.platformFee > 0 ? (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>Platform fee</span>
                      <span>{formatInr(quote.platformFee)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Platform fee GST ({vendor.platformFeeGstRate ?? 18}%)</span>
                      <span>{formatInr(quote.platformFeeGstAmount)}</span>
                    </div>
                  </>
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
                  <span>{formatInr(displayAfterWallet)}</span>
                </div>
                {walletAmountApplied > 0 ? (
                  <div className="mt-1 flex justify-between text-green-700">
                    <span>Wallet</span>
                    <span>- {formatInr(walletAmountApplied)}</span>
                  </div>
                ) : null}
                {quote.discountAmount > 0 ? (
                  <p className="mt-2 rounded-lg bg-green-50 p-2 text-center text-xs text-green-800">
                    You save {formatInr(quote.discountAmount)} with this offer!
                  </p>
                ) : null}
                {promoEnginePreview ? (
                  <div className="mt-2">
                    <PromoEarnPreview data={promoEnginePreview} />
                  </div>
                ) : null}
                <div className="mt-3">
                  <CustomerWalletApply
                    wallet={wallet}
                    useWallet={useWallet}
                    onToggleUseWallet={() => setUseWallet((prev) => !prev)}
                    walletAmountApplied={walletAmountApplied}
                  />
                </div>
              </div>
            ) : null}

            <button
              type="button"
              disabled={billAmount <= 0 || paying}
              onClick={quoteReady ? () => onProceedToPay() : onGetDiscount}
              className="w-full rounded-xl bg-[#FF6B00] py-3 text-center font-semibold text-white disabled:opacity-50"
            >
              {paying ? 'Opening payment…' : quoteReady ? 'Proceed to Pay' : 'Get Discount'}
            </button>
            {payError ? <p className="text-center text-sm text-red-600">{payError}</p> : null}
          </div>
        </div>
      </div>

      <Dialog
        open={showWaitForConfirmDialog}
        onOpenChange={(open) => {
          if (!paying) setShowWaitForConfirmDialog(open);
        }}
      >
        <DialogContent
          showCloseButton={false}
          overlayClassName="bg-black/55 backdrop-blur-[3px]"
          className="w-[calc(100%-2rem)] max-w-[420px] gap-0 overflow-hidden rounded-[20px] border-0 bg-white p-0 shadow-[0_16px_40px_rgba(0,0,0,0.18)] sm:max-w-[420px]"
          onPointerDownOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B1A] px-5 py-4 text-white">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-lg text-white">Stay on this screen</DialogTitle>
              <DialogDescription className="text-sm text-white/90">
                Please wait until you see Confirmed. Don&apos;t exit the app until payment is
                confirmed so your payment is registered in our system.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-4 px-5 py-5">
            <p className="text-sm text-gray-600">
              After you continue, complete payment in Razorpay and wait on the confirmation screen
              until it says your order / payment is confirmed.
            </p>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <button
                type="button"
                onClick={onConfirmWaitAndPay}
                className="w-full rounded-xl bg-[#FF6B00] py-3 text-center font-semibold text-white"
              >
                Continue to payment
              </button>
              <button
                type="button"
                onClick={() => setShowWaitForConfirmDialog(false)}
                className="w-full rounded-xl border border-gray-200 bg-white py-3 text-center font-medium text-gray-700"
              >
                Cancel
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
