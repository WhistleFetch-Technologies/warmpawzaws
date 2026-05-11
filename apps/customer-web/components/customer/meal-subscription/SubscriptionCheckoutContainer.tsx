'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import {
  buildSanitizedStandardRazorpayCheckoutOptions,
  fetchCheckoutEmailForPrefill,
} from '@/lib/razorpay/build-standard-checkout-options';
import { confirmMealSubscriptionPayment } from '@/lib/meal-subscriptions-api';
import { toast } from 'sonner';
import { getMealPlanCatalogDisplay } from '@/lib/meal-plan-catalog-display';
import { SubscriptionScheduleSelector } from './SubscriptionScheduleSelector';
import { DeliveryDaysPicker } from './DeliveryDaysPicker';
import { DeliverySlotPicker } from './DeliverySlotPicker';
import { SubscriptionSummaryCard } from './SubscriptionSummaryCard';
import { UpcomingDeliveriesPreview } from './UpcomingDeliveriesPreview';
import { SubscriptionProgressPreview } from './SubscriptionProgressPreview';
import { SubscriptionPricingBreakdown } from './SubscriptionPricingBreakdown';
import { SubscriptionPolicyInfo } from './SubscriptionPolicyInfo';
import { AutoRenewToggle } from './AutoRenewToggle';
import type { SubscriptionDeliveryPattern } from './subscription-checkout-types';

function newClientRequestKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `meal-sub-${crypto.randomUUID()}`;
  }
  return `meal-sub-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function SubscriptionCheckoutContainer({
  phone,
  mealPlanId,
  vendorId,
  purchaseType,
  onBack,
  onSuccess,
}: {
  phone: string;
  mealPlanId: string;
  vendorId: string;
  purchaseType: 'WEEKLY_PLAN' | 'MONTHLY_PLAN';
  onBack: () => void;
  onSuccess: (subscriptionId: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mealPlan, setMealPlan] = useState<Record<string, unknown> | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [pets, setPets] = useState<{ id: string; name: string }[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [preview, setPreview] = useState<{
    subtotal: number;
    deliveryFee: number | null;
    platformFee: number;
    convenienceFee?: number;
    totalAmount: number;
    leadTimeHours: number;
  } | null>(null);

  const [petId, setPetId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [addressId, setAddressId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [slotStart, setSlotStart] = useState('09:00');
  const [slotEnd, setSlotEnd] = useState('12:00');
  const [instructions, setInstructions] = useState('');
  const [weeklyPattern, setWeeklyPattern] = useState<SubscriptionDeliveryPattern>('weekly_default');
  const [weekdays, setWeekdays] = useState<string[]>(['mon', 'wed', 'fri']);
  const [totalSessions, setTotalSessions] = useState(purchaseType === 'MONTHLY_PLAN' ? 12 : 8);
  const [autoRenew, setAutoRenew] = useState(false);
  const [monthlyMode, setMonthlyMode] = useState<'fixed_sessions' | 'recurring_monthly'>('recurring_monthly');

  useEffect(() => {
    loadData();
  }, [phone, mealPlanId]);

  useEffect(() => {
    if (!mealPlanId || !quantity) return;
    const selected = addresses.find((a) => a.id === addressId);
    const addrLat = selected?.coordinates?.lat ?? selected?.latitude ?? selected?.lat;
    const addrLng = selected?.coordinates?.lng ?? selected?.longitude ?? selected?.lng;
    const q = new URLSearchParams();
    q.set('quantity', String(quantity));
    q.set('logisticsType', 'warmpawz');
    if (addrLat != null && addrLng != null) {
      q.set('customerLat', String(addrLat));
      q.set('customerLng', String(addrLng));
    }
    apiClient
      .get(`/meal-plans/${mealPlanId}/order-preview?${q.toString()}`)
      .then((res: any) => {
        if (res.success) setPreview(res);
      })
      .catch(() => setPreview(null));
  }, [mealPlanId, quantity, addressId, addresses]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [planRes, profileRes, petsRes, addrRes] = await Promise.all([
        apiClient.get(`/meal-plans/${mealPlanId}`).catch(() => null),
        apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`).catch(() =>
          apiClient.get(`/customer/by-phone?phone=${encodeURIComponent(phone)}`),
        ),
        apiClient.get(`/customer/pets/${phone}`).catch(() => ({ pets: [] })),
        apiClient.get(`/customer/addresses?phone=${encodeURIComponent(phone)}`).catch(() => ({ addresses: [] })),
      ]);
      const planData = (planRes as any)?.mealPlan || planRes;
      if (planData) setMealPlan(planData as Record<string, unknown>);
      const profile = (profileRes as any)?.profile || (profileRes as any)?.customer || profileRes;
      const cid = profile?.id || (profileRes as any)?.id || (profileRes as any)?.customer?.id;
      if (cid) setCustomerId(String(cid));
      setPets(((petsRes as any)?.pets || []) as { id: string; name: string }[]);
      let addrList = (addrRes as any)?.addresses || [];
      const profileAddr = profile?.address ?? profile?.addressLine1 ?? profile?.address_line1;
      if (addrList.length === 0 && (profileAddr || profile?.pincode)) {
        addrList = [
          {
            id: 'profile',
            addressLine1: profileAddr || '',
            addressLine2: null,
            city: profile?.city || '',
            state: profile?.state || '',
            pincode: profile?.pincode || '',
          },
        ];
        setAddressId('profile');
      }
      setAddresses(addrList);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load subscription checkout');
    } finally {
      setLoading(false);
    }
  };

  const catalog = mealPlan ? getMealPlanCatalogDisplay(mealPlan) : null;
  const selectedAddress = addresses.find((a) => a.id === addressId);
  const lat =
    selectedAddress?.coordinates?.lat ?? selectedAddress?.latitude ?? selectedAddress?.lat ?? null;
  const lng =
    selectedAddress?.coordinates?.lng ?? selectedAddress?.longitude ?? selectedAddress?.lng ?? null;
  const hasCoords = lat != null && lng != null;

  const buildDeliveryAddress = () => {
    if (!selectedAddress) return null;
    const parts = [
      selectedAddress.addressLine1,
      selectedAddress.addressLine2,
      selectedAddress.city,
      selectedAddress.state,
      selectedAddress.pincode,
    ].filter(Boolean);
    return {
      address: parts.join(', '),
      lat,
      lng,
      landmark: selectedAddress.landmark || '',
      pincode: selectedAddress.pincode || '',
    };
  };

  const estimatedTotal = useMemo(() => {
    if (!preview) return 0;
    return Math.round(preview.totalAmount * Math.max(1, totalSessions) * 100) / 100;
  }, [preview, totalSessions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealPlan || !preview || !customerId) {
      toast.error('Missing plan or customer');
      return;
    }
    const deliveryAddress = buildDeliveryAddress();
    if (!deliveryAddress?.address || !hasCoords) {
      toast.error('Please select an address with map coordinates');
      return;
    }
    if (!startDate) {
      toast.error('Choose a start date');
      return;
    }
    if (weeklyPattern === 'specific_weekdays' && weekdays.length === 0) {
      toast.error('Pick at least one weekday');
      return;
    }
    if (pets.length > 0 && !petId) {
      toast.error('Select a pet');
      return;
    }

    const clientRequestKey = newClientRequestKey();
    setSubmitting(true);
    try {
      const razorpayRes = await apiClient.post<any>('/meal/orders/create-razorpay-order', {
        amountInRupees: estimatedTotal,
        notes: { customerId, mealPlanId, vendorId, kind: 'meal_subscription' },
      });
      if (!razorpayRes?.razorpayOrderId) {
        throw new Error(razorpayRes?.error || 'Failed to create payment order');
      }

      const createRes = await apiClient.post<any>('/meal/subscriptions', {
        clientRequestKey,
        customerId,
        mealPlanId,
        purchaseType,
        deliveryAddress,
        firstDeliveryDate: startDate,
        deliveryTimeSlot: { start: slotStart, end: slotEnd },
        deliverySchedule: {
          weeklyPattern: purchaseType === 'WEEKLY_PLAN' ? weeklyPattern : undefined,
          weekdays: weeklyPattern === 'specific_weekdays' ? weekdays : undefined,
          customerInstructions: instructions || undefined,
          monthlyMode: purchaseType === 'MONTHLY_PLAN' ? monthlyMode : undefined,
        },
        totalSessions,
        autoRenew,
        paymentStatus: 'pending',
        quantity,
        petId: petId || null,
        initialPaymentAmount: estimatedTotal,
        razorpayOrderId: razorpayRes.razorpayOrderId,
      });

      const subscription = createRes?.subscription;
      const subscriptionId = subscription?.id as string | undefined;
      if (!subscriptionId) throw new Error('Subscription not created');

      const keyId = razorpayRes.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY;
      if (!keyId) {
        toast.success('Subscription recorded. Complete payment from orders if needed.');
        onSuccess(subscriptionId);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
      await new Promise<void>((resolve) => {
        if ((window as any).Razorpay) return resolve();
        script.onload = () => resolve();
      });

      const checkoutEmail = await fetchCheckoutEmailForPrefill(phone);
      const options = buildSanitizedStandardRazorpayCheckoutOptions({
        key: keyId,
        amountPaise: Math.max(1, Math.round(Number(razorpayRes.amount))),
        currency: razorpayRes.currency || 'INR',
        name: 'Warmpawz',
        description: `Meal subscription — ${(mealPlan as any).name || 'Plan'}`,
        order_id: razorpayRes.razorpayOrderId,
        customerPhone: phone,
        customerEmail: checkoutEmail,
        includeInstrumentBlocks: true,
        handler: async (response: any) => {
          try {
            await confirmMealSubscriptionPayment(subscriptionId, customerId, response.razorpay_payment_id);
            toast.success('Subscription payment confirmed!');
            onSuccess(subscriptionId);
          } catch (err: any) {
            toast.error(err?.message || 'Payment confirmation failed');
          }
        },
        theme: { color: '#FF8C42' },
        modal: { ondismiss: () => setSubmitting(false) },
      });
      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (err: any) {
      toast.error(err?.message || 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !mealPlan) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center max-w-md mx-auto">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  const planName = String((mealPlan as any).name || (mealPlan as any).plan_name || 'Meal plan');
  const imageUrl =
    (mealPlan as any).mealImageUrl ||
    (typeof (mealPlan as any).dietary_requirements === 'object' &&
      (mealPlan as any).dietary_requirements?.mealImageUrl) ||
    null;

  const minDate = new Date();
  minDate.setHours(0, 0, 0, 0);
  const leadHours = preview?.leadTimeHours ?? 24;
  minDate.setTime(minDate.getTime() + leadHours * 60 * 60 * 1000);
  const minDateStr = minDate.toISOString().split('T')[0];

  const recurrenceLabel =
    purchaseType === 'WEEKLY_PLAN' ? `Weekly · ${weeklyPattern.replace(/_/g, ' ')}` : 'Monthly recurring';

  return (
    <div className="min-h-screen bg-orange-50 max-w-md mx-auto pb-28">
      <div className="sticky top-0 z-10 bg-gradient-to-r from-[#FF8C42] to-orange-500 text-white px-4 py-4 flex items-center gap-3">
        <button type="button" onClick={onBack} className="p-2 rounded-lg bg-white/20 hover:bg-white/30">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold leading-tight">Subscribe — Meal plan</h1>
          <p className="text-xs text-white/90">Recurring deliveries · session-based tracking</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <SubscriptionSummaryCard
          planName={planName}
          vendorLabel="Vendor linked to this meal plan"
          recurrenceLabel={recurrenceLabel}
          nextDeliveryLabel={startDate || minDateStr}
          autoRenew={autoRenew}
        />

        <Card className="p-4 flex gap-3">
          {imageUrl ? (
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-orange-100 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-7 h-7 text-orange-600" />
            </div>
          )}
          <div className="text-sm text-slate-700">
            {catalog?.customerPurchaseHeadline && <p className="font-medium">{catalog.customerPurchaseHeadline}</p>}
            {catalog?.dietTypeLabel && (
              <p className="text-xs text-slate-500 mt-1">Diet: {catalog.dietTypeLabel}</p>
            )}
          </div>
        </Card>

        <SubscriptionScheduleSelector
          purchaseType={purchaseType}
          weeklyPattern={weeklyPattern}
          onWeeklyPatternChange={setWeeklyPattern}
        />

        {purchaseType === 'MONTHLY_PLAN' && (
          <div>
            <Label className="text-sm font-medium">Monthly structure</Label>
            <Select value={monthlyMode} onValueChange={(v) => setMonthlyMode(v as typeof monthlyMode)}>
              <SelectTrigger className="mt-1 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recurring_monthly">Recurring monthly anchor</SelectItem>
                <SelectItem value="fixed_sessions">Fixed session pack</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {purchaseType === 'WEEKLY_PLAN' && weeklyPattern === 'specific_weekdays' && (
          <div>
            <Label className="text-sm font-medium mb-2 block">Delivery weekdays</Label>
            <DeliveryDaysPicker selected={weekdays} onChange={setWeekdays} />
          </div>
        )}

        <div>
          <Label>Start date</Label>
          <Input type="date" value={startDate} min={minDateStr} onChange={(e) => setStartDate(e.target.value)} required />
        </div>

        <DeliverySlotPicker start={slotStart} end={slotEnd} onStartChange={setSlotStart} onEndChange={setSlotEnd} />

        {pets.length > 0 && (
          <div>
            <Label>Pet</Label>
            <Select value={petId} onValueChange={setPetId}>
              <SelectTrigger>
                <SelectValue placeholder="Select pet" />
              </SelectTrigger>
              <SelectContent>
                {pets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <Label>Meals per delivery</Label>
          <Input
            type="number"
            min={1}
            max={50}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
          />
        </div>

        <div>
          <Label>Total sessions (this signup)</Label>
          <Input
            type="number"
            min={1}
            max={500}
            value={totalSessions}
            onChange={(e) => setTotalSessions(Math.max(1, parseInt(e.target.value, 10) || 1))}
          />
        </div>

        <AutoRenewToggle value={autoRenew} onChange={setAutoRenew} />

        <div>
          <Label>Delivery address</Label>
          {addresses.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">Add an address in your profile first.</p>
          ) : (
            <Select value={addressId} onValueChange={setAddressId}>
              <SelectTrigger>
                <SelectValue placeholder="Select address" />
              </SelectTrigger>
              <SelectContent>
                {addresses.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.addressLine1}, {a.city} {a.pincode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div>
          <Label>Dietary / delivery instructions</Label>
          <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} />
        </div>

        <SubscriptionPolicyInfo />

        {preview && (
          <SubscriptionPricingBreakdown
            purchaseTypeLabel={purchaseType === 'WEEKLY_PLAN' ? 'Weekly subscription' : 'Monthly subscription'}
            billingCycleLabel={purchaseType === 'WEEKLY_PLAN' ? 'Weekly cadence' : 'Monthly cadence'}
            perDeliveryTotal={preview.totalAmount}
            sessions={Math.max(1, totalSessions)}
            mealsPerDelivery={quantity}
          />
        )}

        {startDate && (
          <UpcomingDeliveriesPreview
            firstDeliveryDate={startDate}
            purchaseType={purchaseType}
            weeklyPattern={weeklyPattern}
            previewCount={Math.min(4, Math.max(1, totalSessions))}
          />
        )}

        <SubscriptionProgressPreview totalSessions={Math.max(1, totalSessions)} completed={0} />

        <Button
          type="submit"
          className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E]"
          disabled={
            submitting ||
            !addressId ||
            !preview ||
            !hasCoords ||
            !startDate ||
            (pets.length > 0 && !petId)
          }
        >
          {submitting ? 'Opening payment…' : `Pay ₹${estimatedTotal}`}
        </Button>
      </form>
    </div>
  );
}
