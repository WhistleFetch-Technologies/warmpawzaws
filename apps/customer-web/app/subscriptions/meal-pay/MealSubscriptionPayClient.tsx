'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { UniversalPaymentPage } from '@/components/customer/payment/UniversalPaymentPage';
import { fetchMealSubscription } from '@/lib/meal-subscriptions-api';
import { fetchCheckoutEmailForPrefill } from '@/lib/razorpay/build-standard-checkout-options';
import {
  buildMealSubscriptionSummaryLinesFromRow,
  upfrontTotalInrFromSubscriptionRow,
  parsePricingSnapshot,
  n,
} from '@/lib/meal-subscription-payment-summary-lines';
import { goBackOrHome } from '@/lib/go-back-or-replace';
import { Button } from '@/components/ui/button';

function deliveryAddressToPaymentAddress(
  raw: unknown,
): { state?: string; city?: string; pincode?: string; addressLine1?: string } | undefined {
  if (raw == null) return undefined;
  let o: Record<string, unknown> | null = null;
  if (typeof raw === 'object' && !Array.isArray(raw)) o = raw as Record<string, unknown>;
  else if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === 'object' && !Array.isArray(p)) o = p as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
  if (!o) return undefined;
  const line =
    typeof o.address === 'string'
      ? o.address
      : typeof o.addressLine1 === 'string'
        ? o.addressLine1
        : undefined;
  return {
    state: typeof o.state === 'string' ? o.state : undefined,
    city: typeof o.city === 'string' ? o.city : undefined,
    pincode: typeof o.pincode === 'string' ? o.pincode : undefined,
    addressLine1: line,
  };
}

function MealSubscriptionPayInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const subscriptionId = String(sp.get('subscriptionId') || '').trim();
  const customerId = String(sp.get('customerId') || '').trim();
  const phone = String(sp.get('phone') || '').trim();
  const vendorIdParam = String(sp.get('vendorId') || '').trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sub, setSub] = useState<Record<string, unknown> | null>(null);
  const [prefillEmail, setPrefillEmail] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!phone) return;
    void fetchCheckoutEmailForPrefill(phone)
      .then((e) => setPrefillEmail(e || undefined))
      .catch(() => setPrefillEmail(undefined));
  }, [phone]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!subscriptionId || !customerId) {
        setError('Missing subscription or customer.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetchMealSubscription(subscriptionId, customerId);
        const row = res?.subscription as Record<string, unknown> | undefined;
        if (!row) {
          setError('Subscription not found.');
          setSub(null);
          return;
        }
        if (!cancelled) setSub(row);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load subscription';
        if (!cancelled) {
          setError(msg);
          setSub(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [subscriptionId, customerId]);

  const vendorId = useMemo(() => {
    const fromSub = sub?.vendor_id != null ? String(sub.vendor_id) : '';
    return vendorIdParam || fromSub;
  }, [sub, vendorIdParam]);

  const vendorName = String(sub?.vendor_name || 'Vendor');
  const planTitle = String(sub?.meal_plan_name || 'Meal plan');
  const lifecycle = String(sub?.lifecycle_status || '');
  const summaryLines = useMemo(() => (sub ? buildMealSubscriptionSummaryLinesFromRow(sub) : []), [sub]);
  const baseAmount = useMemo(() => (sub ? upfrontTotalInrFromSubscriptionRow(sub) : 0), [sub]);

  const snap = useMemo(() => (sub ? parsePricingSnapshot(sub) : null), [sub]);
  const mealPlanFoodTaxableInr = useMemo(() => {
    if (!snap) return 0;
    const direct = n(snap.foodSubtotalUpfront);
    if (direct > 0.009) return direct;
    const per = n(snap.perSessionFoodSubtotal);
    const ts = n(snap.totalSessionsUsed);
    if (per > 0 && ts > 0) return Math.round(per * ts * 100) / 100;
    return 0;
  }, [snap]);
  const mealPlanGstCatalogCategoryId = useMemo(() => {
    const id = snap?.mealPlanGstCatalogCategoryId;
    return id != null && String(id).trim() ? String(id).trim() : undefined;
  }, [snap]);
  const mealSubscriptionFeeTotals = useMemo(() => {
    if (!snap) return undefined;
    return {
      platformFee: n(snap.platformFeeUpfront),
      convenienceFee: n(snap.convenienceFeeUpfront),
      deliveryFee: n(snap.totalDeliveryFeeUpfront),
    };
  }, [snap]);
  const subscriptionPayAddress = useMemo(
    () => deliveryAddressToPaymentAddress(sub?.delivery_address),
    [sub],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-orange-50">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error || !sub || !vendorId) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-orange-50 p-6 text-center">
        <p className="text-slate-800">{error || 'Could not open payment.'}</p>
        <Button type="button" variant="outline" onClick={() => goBackOrHome(router)}>
          Go back
        </Button>
      </div>
    );
  }

  if (lifecycle && lifecycle !== 'pending_payment') {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-orange-50 p-6 text-center">
        <p className="text-slate-800">This subscription is not awaiting payment ({lifecycle}).</p>
        <Button type="button" onClick={() => router.push(`/subscriptions/detail?id=${encodeURIComponent(subscriptionId)}`)}>
          View subscription
        </Button>
      </div>
    );
  }

  if (!phone) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-orange-50 p-6 text-center">
        <p className="text-slate-800">Missing phone for wallet and checkout. Open payment from the meal checkout flow.</p>
        <Button type="button" variant="outline" onClick={() => goBackOrHome(router)}>
          Go back
        </Button>
      </div>
    );
  }

  if (baseAmount <= 0) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-orange-50 p-6 text-center">
        <p className="text-slate-800">No payable amount found on this subscription.</p>
        <Button type="button" onClick={() => router.push(`/subscriptions/detail?id=${encodeURIComponent(subscriptionId)}`)}>
          View subscription
        </Button>
      </div>
    );
  }

  return (
    <UniversalPaymentPage
      type="meal_subscription"
      mealSubscriptionId={subscriptionId}
      mealSubscriptionSummaryLines={summaryLines}
      mealPlanFoodTaxableInr={mealPlanFoodTaxableInr}
      mealPlanGstCatalogCategoryId={mealPlanGstCatalogCategoryId}
      mealSubscriptionFeeTotals={mealSubscriptionFeeTotals}
      address={subscriptionPayAddress}
      vendorId={vendorId}
      vendorName={vendorName}
      serviceName={planTitle}
      baseAmount={baseAmount}
      customerPhone={phone}
      customerEmail={prefillEmail}
      customerId={customerId}
      onBack={() => goBackOrHome(router)}
      onSuccess={(id) => {
        router.push(`/subscriptions/detail?id=${encodeURIComponent(id)}`);
      }}
    />
  );
}

export default function MealSubscriptionPayClient() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-orange-50">
          <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
        </div>
      }
    >
      <MealSubscriptionPayInner />
    </Suspense>
  );
}
