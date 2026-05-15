'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { UniversalPaymentPage } from '@/components/customer/payment/UniversalPaymentPage';
import { fetchCheckoutEmailForPrefill } from '@/lib/razorpay/build-standard-checkout-options';
import type { MealSubscriptionSummaryLine } from '@/components/customer/payment/MealSubscriptionPaymentSummary';
import { goBackOrHome } from '@/lib/go-back-or-replace';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'meal_one_time_pay_draft_v1';

export type MealOneTimePayDraft = {
  mealPlanId: string;
  customerId?: string;
  customerPhone: string;
  vendorId: string;
  quantity: number;
  petId?: string;
  specialInstructions?: string;
  deliveryAddress: Record<string, unknown>;
  scheduledDeliveryDate: string;
  scheduledDeliverySlot: { start: string; end: string };
  logisticsType?: string;
  foodSubtotalInr: number;
  foodGstPct: number;
  deliveryGstPct?: number;
  mealPlanGstCatalogCategoryId?: string;
  deliveryFeeInr: number;
  platformFeeInr: number;
  convenienceFeeInr: number;
};

function MealOneTimePayInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const planTitle = String(sp.get('mealPlanName') || 'Meal plan').trim() || 'Meal plan';

  const [draft, setDraft] = useState<MealOneTimePayDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefillEmail, setPrefillEmail] = useState<string | undefined>(undefined);

  useEffect(() => {
    try {
      const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null;
      if (!raw) {
        setError('Checkout session expired. Go back and try again.');
        setDraft(null);
        return;
      }
      const parsed = JSON.parse(raw) as MealOneTimePayDraft;
      if (!parsed?.mealPlanId || !parsed?.customerPhone || !parsed?.vendorId) {
        setError('Invalid checkout data.');
        setDraft(null);
        return;
      }
      setDraft(parsed);
      setError(null);
    } catch {
      setError('Could not read checkout data.');
      setDraft(null);
    }
  }, []);

  const phone = draft?.customerPhone || '';
  useEffect(() => {
    if (!phone) return;
    void fetchCheckoutEmailForPrefill(phone)
      .then((e) => setPrefillEmail(e || undefined))
      .catch(() => setPrefillEmail(undefined));
  }, [phone]);

  const baseAmount = useMemo(() => {
    if (!draft) return 0;
    const food = Number(draft.foodSubtotalInr) || 0;
    const d = Number(draft.deliveryFeeInr) || 0;
    const p = Number(draft.platformFeeInr) || 0;
    const c = Number(draft.convenienceFeeInr) || 0;
    const gstFood = (food * (Number(draft.foodGstPct) || 0)) / 100;
    const gstDelivery = (d * (Number(draft.deliveryGstPct) || 0)) / 100;
    return Math.round((food + d + p + c + gstFood + gstDelivery) * 100) / 100;
  }, [draft]);

  const summaryLines: MealSubscriptionSummaryLine[] = useMemo(() => {
    if (!draft) return [];
    const lines: MealSubscriptionSummaryLine[] = [
      { label: 'Purchase', valueText: 'Buy once' },
      { label: 'Delivery date', valueText: draft.scheduledDeliveryDate },
    ];
    if (draft.quantity > 1) {
      lines.push({ label: 'Quantity', valueText: String(draft.quantity) });
    }
    return lines;
  }, [draft]);

  const addressForTax = useMemo(() => {
    if (!draft?.deliveryAddress) return undefined;
    const a = draft.deliveryAddress;
    return {
      state: typeof a.state === 'string' ? a.state : undefined,
      city: typeof a.city === 'string' ? a.city : undefined,
      pincode: typeof a.pincode === 'string' ? a.pincode : undefined,
      addressLine1: typeof a.address === 'string' ? a.address : undefined,
    };
  }, [draft]);

  if (error || !draft) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-orange-50 p-6 text-center">
        <p className="text-slate-800">{error || 'Loading…'}</p>
        <Button type="button" variant="outline" onClick={() => goBackOrHome(router)}>
          Go back
        </Button>
      </div>
    );
  }

  if (!phone) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-orange-50 p-6 text-center">
        <p className="text-slate-800">Missing phone for checkout.</p>
        <Button type="button" variant="outline" onClick={() => goBackOrHome(router)}>
          Go back
        </Button>
      </div>
    );
  }

  if (baseAmount <= 0) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-orange-50 p-6 text-center">
        <p className="text-slate-800">No payable amount.</p>
        <Button type="button" variant="outline" onClick={() => goBackOrHome(router)}>
          Go back
        </Button>
      </div>
    );
  }

  return (
    <UniversalPaymentPage
      type="meal_one_time"
      mealOneTimeDraft={draft}
      vendorId={draft.vendorId}
      vendorName="Vendor"
      serviceName={planTitle}
      baseAmount={baseAmount}
      customerPhone={phone}
      customerEmail={prefillEmail}
      customerId={draft.customerId}
      address={addressForTax}
      mealSubscriptionSummaryLines={summaryLines}
      onBack={() => {
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
        goBackOrHome(router);
      }}
      onSuccess={(orderId) => {
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
        try {
          sessionStorage.setItem('meal_order_placed_id', String(orderId));
        } catch {
          /* ignore */
        }
        router.replace('/');
      }}
    />
  );
}

export default function MealPlanCheckoutPayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-orange-50">
          <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
        </div>
      }
    >
      <MealOneTimePayInner />
    </Suspense>
  );
}
