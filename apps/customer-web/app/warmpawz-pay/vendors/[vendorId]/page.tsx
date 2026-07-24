'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { fetchWpayVendorDetail, type WpayVendorDetail } from '@/lib/warmpawz-pay/wpay-api';
import { DiscoveryProviderAvatar } from '@/components/customer/shared/DiscoveryProviderAvatar';

const QUICK_AMOUNTS = [500, 1000, 1500, 2000];

function formatInr(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function WarmpawzPayVendorPage() {
  const router = useRouter();
  const params = useParams();
  const vendorId = String(params?.vendorId ?? '').trim();

  const [vendor, setVendor] = useState<WpayVendorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [quoteReady, setQuoteReady] = useState(false);

  useEffect(() => {
    if (!vendorId) return;
    setLoading(true);
    fetchWpayVendorDetail(vendorId)
      .then((v) => {
        setVendor(v);
        setError(v ? null : 'Vendor not found');
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load vendor');
        setVendor(null);
      })
      .finally(() => setLoading(false));
  }, [vendorId]);

  const billAmount = useMemo(() => {
    const n = parseFloat(amountInput.replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amountInput]);

  const discountAmount = useMemo(() => {
    if (!vendor || billAmount <= 0) return 0;
    const raw = (billAmount * vendor.discountPercent) / 100;
    if (vendor.maxDiscountAmount != null && raw > vendor.maxDiscountAmount) {
      return vendor.maxDiscountAmount;
    }
    return Math.round(raw * 100) / 100;
  }, [billAmount, vendor]);

  const payableAmount = useMemo(() => Math.max(0, billAmount - discountAmount), [billAmount, discountAmount]);

  const onGetDiscount = useCallback(() => {
    if (billAmount <= 0) return;
    setQuoteReady(true);
  }, [billAmount]);

  const onProceedToPay = useCallback(() => {
    // Bindu owns quote → initiate → Razorpay open timing
    alert('Payment flow API not wired yet (quote/initiate/verify). Preview only.');
  }, []);

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

  return (
    <div className="mx-auto w-full max-w-customer pb-28">
      <header className="bg-gradient-to-b from-[#FF8C42] to-[#FF6B00] px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="mb-2 p-1">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-bold">Warmpawz Pay</h1>
        <p className="text-sm text-white/90">Make a payment &amp; get exclusive discounts</p>
      </header>

      <div className="mx-4 -mt-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex gap-3">
          <DiscoveryProviderAvatar name={vendor.name} photo={vendor.photoUrl ?? undefined} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900">{vendor.name}</p>
            <p className="text-xs text-gray-500">{vendor.address}</p>
            {vendor.rating > 0 ? (
              <p className="mt-1 text-xs text-gray-600">
                {vendor.rating.toFixed(1)} ({vendor.reviewCount}) reviews
              </p>
            ) : null}
          </div>
        </div>
        {vendor.discountPercent > 0 ? (
          <div className="mt-3 rounded-xl border border-green-100 bg-green-50 p-3 text-sm">
            <p className="font-semibold text-green-800">{vendor.offerLabel}</p>
            {vendor.maxDiscountAmount != null ? (
              <p className="text-xs text-green-700">Upto {formatInr(vendor.maxDiscountAmount)}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mx-4 mt-4 space-y-4">
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

        {quoteReady ? (
          <div className="rounded-xl bg-gray-50 p-3 text-sm">
            <div className="flex justify-between">
              <span>Bill Amount</span>
              <span>{formatInr(billAmount)}</span>
            </div>
            <div className="flex justify-between text-green-700">
              <span>Offer Discount ({vendor.discountPercent}% OFF)</span>
              <span>- {formatInr(discountAmount)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-semibold">
              <span>You Pay</span>
              <span>{formatInr(payableAmount)}</span>
            </div>
            <p className="mt-2 rounded-lg bg-green-50 p-2 text-center text-xs text-green-800">
              You save {formatInr(discountAmount)} with this offer!
            </p>
          </div>
        ) : null}

        <button
          type="button"
          disabled={billAmount <= 0}
          onClick={quoteReady ? onProceedToPay : onGetDiscount}
          className="w-full rounded-xl bg-[#FF6B00] py-3 text-center font-semibold text-white disabled:opacity-50"
        >
          {quoteReady ? 'Proceed to Pay' : 'Get Discount'}
        </button>
      </div>
    </div>
  );
}
