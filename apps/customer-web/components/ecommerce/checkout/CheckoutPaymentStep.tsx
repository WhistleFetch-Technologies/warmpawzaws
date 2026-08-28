'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCheckout } from '@/context/CheckoutProvider';
import { CartPromotionSelect } from '@/components/ecommerce/cart/CartPromotionSelect';
import { apiClient } from '@/lib/api-client';
import { parseCartLineKey } from '@/lib/product-sku-client';

function formatINR(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

/**
 * Wallet redemption for the shop checkout is temporarily disabled (business decision).
 * Meal plans / subscriptions keep their own wallet flow (UniversalPaymentPage) — untouched.
 * Flip to true to restore the wallet toggle here.
 */
const ECOM_WALLET_ENABLED = false;

export function CheckoutPaymentStep() {
  const {
    phone,
    cart,
    pricing,
    goNext,
    primaryVendorId,
    coupon,
    applyCoupon,
    removeCoupon,
    walletAmountApplied,
    setWalletAmountApplied,
  } = useCheckout();

  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletEnabled, setWalletEnabled] = useState(false);

  // Fetch wallet balance on mount
  useEffect(() => {
    if (!ECOM_WALLET_ENABLED || !phone) return;
    apiClient
      .get<{ balance?: number; data?: { balance?: number } }>(`/customer/wallet?phone=${encodeURIComponent(phone)}`)
      .then((res) => {
        const bal = parseFloat(String(res?.balance ?? res?.data?.balance ?? '0'));
        setWalletBalance(isNaN(bal) ? 0 : bal);
      })
      .catch(() => setWalletBalance(0));
  }, [phone]);

  // Sync wallet amount applied with the context when toggle changes
  useEffect(() => {
    if (!ECOM_WALLET_ENABLED || !walletEnabled || walletBalance == null) {
      setWalletAmountApplied(0);
      return;
    }
    const maxApplicable = Math.min(walletBalance, pricing.total);
    setWalletAmountApplied(maxApplicable > 0 ? maxApplicable : 0);
  }, [walletEnabled, walletBalance, pricing.total, setWalletAmountApplied]);

  const selectedPromo = coupon
    ? {
        code: coupon.code,
        discountAmount: coupon.discountAmount,
        promotionId: coupon.promotionId,
        label: coupon.code,
        source: coupon.source ?? ('vendor' as const),
      }
    : null;

  const payableAfterWallet = Math.max(0, pricing.total - walletAmountApplied);
  const walletCoversOrder = walletAmountApplied > 0 && payableAfterWallet < 0.01;

  return (
    <div className="space-y-4">
      <CartPromotionSelect
        orderAmount={pricing.lineSubtotal}
        vendorId={primaryVendorId}
        cartItems={cart.map((item) => {
          const productId =
            parseCartLineKey(item.id).productId ||
            (item.warmpawzLine?.product?.id != null
              ? String(item.warmpawzLine.product.id)
              : item.id);
          return {
            productId,
            id: productId,
            quantity: item.quantity,
            price: item.price,
            categoryId: item.categoryId || item.category,
            category: item.categoryId || item.category,
          };
        })}
        selected={selectedPromo}
        onApply={(p) =>
          applyCoupon({
            code: p.code,
            discountAmount: p.discountAmount,
            promotionId: p.promotionId,
            source: p.source,
          })
        }
        onRemove={removeCoupon}
      />

      {/* Wallet balance section (hidden while ECOM_WALLET_ENABLED is false) */}
      {ECOM_WALLET_ENABLED && walletBalance != null && walletBalance > 0 && (
        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Wallet balance</p>
                <p className="text-sm text-slate-500">{formatINR(walletBalance)} available</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWalletEnabled((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                walletEnabled ? 'bg-emerald-500' : 'bg-slate-200'
              }`}
              role="switch"
              aria-checked={walletEnabled}
              aria-label="Use wallet balance"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ${
                  walletEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          {walletEnabled && walletAmountApplied > 0 && (
            <p className="mt-2 text-sm text-emerald-700 font-medium">
              {formatINR(walletAmountApplied)} will be deducted from your wallet.
              {walletCoversOrder
                ? ' Full order covered — no online payment needed.'
                : ` Remaining payable: ${formatINR(payableAfterWallet)}.`}
            </p>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-3">Payment method</h2>
        {walletCoversOrder ? (
          <div className="flex items-center gap-3 rounded-xl border-2 border-emerald-400 bg-emerald-50 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">Pay with wallet</p>
              <p className="text-xs text-slate-500">Full amount covered by your wallet balance</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border-2 border-[#FF8C42] bg-orange-50 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FF8C42] text-white">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">Pay online</p>
              <p className="text-xs text-slate-500">UPI, cards, netbanking via Razorpay</p>
            </div>
          </div>
        )}
      </section>

      <Button
        type="button"
        onClick={goNext}
        className="w-full h-12 bg-[#FF8C42] hover:bg-[#FF7A29] text-white font-semibold rounded-xl"
      >
        Continue to review
      </Button>
    </div>
  );
}
