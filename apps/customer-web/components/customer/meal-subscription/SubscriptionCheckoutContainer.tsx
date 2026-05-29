'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { getMealPlanCatalogDisplay } from '@/lib/meal-plan-catalog-display';
import {
  vendorWeeklyDeliveryDaysFromPlan,
  vendorQuantityDefaultFromPlan,
  vendorLocksMealsQuantity,
  vendorMonthlyDeliveryFrequencyFromPlan,
} from '@/lib/meal-plan-vendor-constraints';
import { monthlyDeliveryFrequencyCustomerLabel } from '@/lib/meal-purchase-customer';
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
import { resolveCustomerPublicAssetUrl } from '@/lib/public-asset-url';
import { isMealKitchenClosed, mealKitchenClosedMessage } from '@/lib/meal-kitchen-availability';
import { MealKitchenStatusBanner } from '@/components/customer/nutrition/MealKitchenStatusBanner';

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
}: {
  phone: string;
  mealPlanId: string;
  vendorId: string;
  purchaseType: 'WEEKLY_PLAN' | 'MONTHLY_PLAN';
  onBack: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mealPlan, setMealPlan] = useState<Record<string, unknown> | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [pets, setPets] = useState<{ id: string; name: string }[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [preview, setPreview] = useState<{
    subtotal: number;
    deliveryFee: number | null;
    deliveryFeePendingAddress?: boolean;
    platformFee: number;
    convenienceFee?: number;
    totalAmount: number;
    leadTimeHours: number;
    subscriptionCheckout?: {
      deliveriesPerBillingCycle: number;
      suggestedTotalSessions: number;
      billingCycles: number;
      totalSessionsUsed: number;
      packageTotalAmount: number;
      upfrontTotalAmount: number;
      foodSubtotalUpfront?: number;
      platformFeeUpfront?: number;
      convenienceFeeUpfront?: number;
      subtotalPerCycle?: number;
    };
    gst?: {
      foodGstPct?: number;
      deliveryGstPct?: number;
      foodGstAmount?: number;
      deliveryGstAmount?: number;
      totalGstAmount?: number;
    };
    deliveryQuoteMessage?: string;
  } | null>(null);

  const sessionsManualRef = useRef(false);

  const [petId, setPetId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [addressId, setAddressId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [slotStart, setSlotStart] = useState('09:00');
  const [slotEnd, setSlotEnd] = useState('12:00');
  const [instructions, setInstructions] = useState('');
  const [weeklyPattern, setWeeklyPattern] = useState<SubscriptionDeliveryPattern>('weekly_default');
  const [weekdays, setWeekdays] = useState<string[]>([]);
  /** Placeholder until meal plan loads; weekly is recomputed from vendor days × plan weeks. */
  const [totalSessions, setTotalSessions] = useState(purchaseType === 'MONTHLY_PLAN' ? 12 : 1);
  const [autoRenew, setAutoRenew] = useState(false);
  const [monthlyMode, setMonthlyMode] = useState<'fixed_sessions' | 'recurring_monthly'>('fixed_sessions');

  const vendorOfferedDays = useMemo(
    () => (mealPlan ? vendorWeeklyDeliveryDaysFromPlan(mealPlan) : []),
    [mealPlan],
  );
  const vendorConstrainsWeekly = purchaseType === 'WEEKLY_PLAN' && vendorOfferedDays.length > 0;
  const mealsQuantityLocked = mealPlan ? vendorLocksMealsQuantity(mealPlan, purchaseType) : false;

  useEffect(() => {
    loadData();
  }, [phone, mealPlanId]);

  useEffect(() => {
    if (!mealPlan) return;
    sessionsManualRef.current = false;
    setQuantity(vendorQuantityDefaultFromPlan(mealPlan, purchaseType));
    if (purchaseType === 'WEEKLY_PLAN') {
      const vd = vendorWeeklyDeliveryDaysFromPlan(mealPlan);
      if (vd.length > 0) {
        setWeeklyPattern('specific_weekdays');
        const vf = String(vendorMonthlyDeliveryFrequencyFromPlan(mealPlan) || '').toUpperCase();
        if (vf === 'TWICE_WEEKLY') {
          setWeekdays(vd.slice(0, 2));
        } else {
          setWeekdays([...vd]);
        }
      }
    }
  }, [mealPlan, purchaseType]);

  useEffect(() => {
    sessionsManualRef.current = false;
  }, [monthlyMode]);

  useEffect(() => {
    if (!mealPlanId || !quantity) return;
    const selected = addresses.find((a) => a.id === addressId);
    const addrLat = selected?.coordinates?.lat ?? selected?.latitude ?? selected?.lat;
    const addrLng = selected?.coordinates?.lng ?? selected?.longitude ?? selected?.lng;
    const q = new URLSearchParams();
    q.set('quantity', String(quantity));
    q.set('logisticsType', 'warmpawz');
    q.set('totalSessions', String(Math.max(1, totalSessions)));
    if (purchaseType === 'WEEKLY_PLAN') {
      q.set('weekdays', weekdays.join(','));
      q.set(
        'weeklyPattern',
        vendorConstrainsWeekly ? 'specific_weekdays' : weeklyPattern,
      );
    }
    if (purchaseType === 'MONTHLY_PLAN') {
      q.set('monthlyMode', monthlyMode);
      const mf = String(vendorMonthlyDeliveryFrequencyFromPlan(mealPlan) || '').toUpperCase();
      if (mf === 'TWICE_WEEKLY' || mf === 'WEEKLY') {
        q.set('weekdays', weekdays.join(','));
      }
    }
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
  }, [
    mealPlanId,
    mealPlan,
    quantity,
    addressId,
    addresses,
    totalSessions,
    weekdays,
    weeklyPattern,
    purchaseType,
    vendorConstrainsWeekly,
    monthlyMode,
  ]);

  useEffect(() => {
    const sug = preview?.subscriptionCheckout?.suggestedTotalSessions;
    if (sug == null || !Number.isFinite(sug) || sessionsManualRef.current) return;
    setTotalSessions(Math.max(1, Math.floor(sug)));
  }, [preview?.subscriptionCheckout?.suggestedTotalSessions]);

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
      const addrList = (addrRes as any)?.addresses || [];
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
    const upfront = preview.subscriptionCheckout?.upfrontTotalAmount;
    if (upfront != null && Number.isFinite(upfront)) return Math.round(upfront * 100) / 100;
    return Math.round(preview.totalAmount * Math.max(1, totalSessions) * 100) / 100;
  }, [preview, totalSessions]);

  const kitchenClosed = isMealKitchenClosed(mealPlan);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (kitchenClosed) {
      toast.error(mealKitchenClosedMessage(mealPlan));
      return;
    }
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
    if (
      (weeklyPattern === 'specific_weekdays' || vendorConstrainsWeekly) &&
      weekdays.length === 0
    ) {
      toast.error('Pick at least one weekday the vendor offers');
      return;
    }
    if (needsTwiceWeeklyDays && weekdays.length !== 2) {
      toast.error('This plan delivers twice a week — please select exactly 2 weekdays');
      return;
    }
    if (needsWeeklyDay && weekdays.length !== 1) {
      toast.error('This plan delivers once a week — please select exactly 1 weekday');
      return;
    }
    if (purchaseType === 'WEEKLY_PLAN') {
      const wcf = String(vendorMonthlyDeliveryFrequencyFromPlan(mealPlan) || '').toUpperCase();
      const daysRelevant = vendorConstrainsWeekly || weeklyPattern === 'specific_weekdays';
      if (daysRelevant && wcf === 'TWICE_WEEKLY' && weekdays.length !== 2) {
        toast.error('This plan delivers twice a week — please select exactly 2 weekdays');
        return;
      }
      if (daysRelevant && wcf === 'WEEKLY' && weekdays.length !== 1) {
        toast.error('This plan delivers once a week — please select exactly 1 weekday');
        return;
      }
    }
    if (pets.length > 0 && !petId) {
      toast.error('Select a pet');
      return;
    }

    const clientRequestKey = newClientRequestKey();
    setSubmitting(true);
    try {
      const createRes = await apiClient.post<any>('/meal/subscriptions', {
        clientRequestKey,
        customerId,
        mealPlanId,
        purchaseType,
        deliveryAddress,
        firstDeliveryDate: startDate,
        deliveryTimeSlot: { start: slotStart, end: slotEnd },
        deliverySchedule: {
          weeklyPattern:
            purchaseType === 'WEEKLY_PLAN'
              ? vendorConstrainsWeekly
                ? 'specific_weekdays'
                : weeklyPattern
              : undefined,
          weekdays:
            purchaseType === 'WEEKLY_PLAN' &&
            (weeklyPattern === 'specific_weekdays' || vendorConstrainsWeekly)
              ? weekdays
              : (needsTwiceWeeklyDays || needsWeeklyDay)
                ? weekdays
                : undefined,
          customerInstructions: instructions || undefined,
          monthlyMode: purchaseType === 'MONTHLY_PLAN' ? monthlyMode : undefined,
        },
        totalSessions,
        autoRenew,
        paymentStatus: 'pending',
        quantity,
        petId: petId || null,
        initialPaymentAmount: estimatedTotal,
      });

      const subscription = createRes?.subscription;
      const subscriptionId = subscription?.id as string | undefined;
      if (!subscriptionId) throw new Error('Subscription not created');

      const q = new URLSearchParams({
        subscriptionId,
        customerId,
        phone,
        vendorId,
      });
      toast.success('Subscription created — complete payment');
      router.push(`/subscriptions/meal-pay?${q.toString()}`);
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
  const imageRaw =
    (mealPlan as any).mealImageUrl ||
    (mealPlan as any).thumbnail_url ||
    (typeof (mealPlan as any).dietary_requirements === 'object' &&
      (mealPlan as any).dietary_requirements?.mealImageUrl) ||
    null;
  const imageUrl = resolveCustomerPublicAssetUrl(imageRaw);

  const minDate = new Date();
  minDate.setHours(0, 0, 0, 0);
  const leadHours = preview?.leadTimeHours ?? 24;
  minDate.setTime(minDate.getTime() + leadHours * 60 * 60 * 1000);
  const minDateStr = minDate.toISOString().split('T')[0];

  const vendorMonthlyFreq =
    purchaseType === 'MONTHLY_PLAN' ? vendorMonthlyDeliveryFrequencyFromPlan(mealPlan) : null;
  const monthlyFreqUpper = (vendorMonthlyFreq || '').toUpperCase();
  const needsTwiceWeeklyDays = purchaseType === 'MONTHLY_PLAN' && monthlyFreqUpper === 'TWICE_WEEKLY';
  const needsWeeklyDay = purchaseType === 'MONTHLY_PLAN' && monthlyFreqUpper === 'WEEKLY';
  const recurrenceLabel =
    purchaseType === 'MONTHLY_PLAN'
      ? vendorMonthlyFreq
        ? `Monthly plan · ${monthlyDeliveryFrequencyCustomerLabel(vendorMonthlyFreq)}`
        : 'Monthly recurring'
      : vendorConstrainsWeekly
        ? `Weekly · your days among vendor offer (${weekdays.join(', ')})`
        : `Weekly · ${weeklyPattern.replace(/_/g, ' ')}`;

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
        {kitchenClosed ? (
          <MealKitchenStatusBanner message={mealKitchenClosedMessage(mealPlan)} />
        ) : null}
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
            {catalog?.packWeightLabel ? (
              <p className="text-xs font-medium text-slate-600 mt-1">{catalog.packWeightLabel}</p>
            ) : null}
          </div>
        </Card>

        {purchaseType === 'WEEKLY_PLAN' && vendorConstrainsWeekly ? (
          <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4 space-y-2">
            <Label className="text-sm font-medium text-slate-800">Delivery days</Label>
            <p className="text-xs text-slate-600 leading-snug">
              This vendor only delivers on the highlighted weekdays. Choose one or more for your subscription (subset
              is OK).
            </p>
            <DeliveryDaysPicker
              selected={weekdays}
              onChange={setWeekdays}
              allowedKeys={vendorOfferedDays}
            />
          </div>
        ) : (
          <SubscriptionScheduleSelector
            purchaseType={purchaseType}
            weeklyPattern={weeklyPattern}
            onWeeklyPatternChange={setWeeklyPattern}
            monthlyVendorFrequencyLabel={
              purchaseType === 'MONTHLY_PLAN' && vendorMonthlyFreq
                ? monthlyDeliveryFrequencyCustomerLabel(vendorMonthlyFreq)
                : null
            }
          />
        )}

        {purchaseType === 'MONTHLY_PLAN' && (
          <div>
            <Label className="text-sm font-medium">Monthly structure</Label>
            <Select value={monthlyMode} onValueChange={(v) => setMonthlyMode(v as typeof monthlyMode)}>
              <SelectTrigger className="mt-1 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed_sessions">Fixed session pack</SelectItem>
                <SelectItem value="recurring_monthly">Recurring monthly anchor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {purchaseType === 'WEEKLY_PLAN' && !vendorConstrainsWeekly && weeklyPattern === 'specific_weekdays' && (
          <div>
            <Label className="text-sm font-medium mb-2 block">Delivery weekdays</Label>
            <DeliveryDaysPicker selected={weekdays} onChange={setWeekdays} />
          </div>
        )}

        {/* Monthly – Twice Weekly: must pick exactly 2 days */}
        {needsTwiceWeeklyDays && (
          <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4 space-y-2">
            <Label className="text-sm font-medium text-slate-800">
              Choose 2 delivery weekdays
              <span className="ml-2 text-xs font-normal text-orange-600">(required — twice a week)</span>
            </Label>
            <p className="text-xs text-slate-500">
              Pick exactly 2 days per week. The system will schedule deliveries on those days every week of the month.
            </p>
            <DeliveryDaysPicker selected={weekdays} onChange={(d) => {
              if (d.length <= 2) setWeekdays(d);
            }} />
            {weekdays.length !== 2 && (
              <p className="text-xs text-red-500 mt-1">Select exactly 2 weekdays (currently {weekdays.length} selected)</p>
            )}
          </div>
        )}

        {/* Monthly – Weekly: must pick exactly 1 day */}
        {needsWeeklyDay && (
          <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4 space-y-2">
            <Label className="text-sm font-medium text-slate-800">
              Choose your delivery weekday
              <span className="ml-2 text-xs font-normal text-orange-600">(required — once a week)</span>
            </Label>
            <p className="text-xs text-slate-500">
              Pick 1 day per week. The plan delivers 4 times per month on that day.
            </p>
            <DeliveryDaysPicker selected={weekdays} onChange={(d) => {
              // Allow only 1 day for weekly
              if (d.length > 1) {
                const last = d[d.length - 1];
                setWeekdays([last]);
              } else {
                setWeekdays(d);
              }
            }} />
            {weekdays.length !== 1 && (
              <p className="text-xs text-red-500 mt-1">Select exactly 1 weekday (currently {weekdays.length} selected)</p>
            )}
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
          <Label>{purchaseType === 'MONTHLY_PLAN' ? 'Meals per day' : 'Meals per delivery'}</Label>
          <Input
            type="number"
            min={1}
            max={50}
            value={quantity}
            disabled={mealsQuantityLocked}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
          />
          {mealsQuantityLocked ? (
            <p className="text-xs text-slate-500 mt-1">Set by the vendor for this meal plan.</p>
          ) : (
            <p className="text-xs text-slate-500 mt-1">Vendor allows a custom amount for this plan.</p>
          )}
        </div>

        <div>
          <Label>Total deliveries (sessions) — this signup</Label>
          <Input
            type="number"
            min={1}
            max={500}
            value={totalSessions}
            onChange={(e) => {
              sessionsManualRef.current = true;
              setTotalSessions(Math.max(1, parseInt(e.target.value, 10) || 1));
            }}
          />
          <p className="text-xs text-slate-500 mt-1 leading-snug">
            Each session is one delivery. Total pay uses your vendor&apos;s weekly/monthly bundle price × how many billing
            cycles those sessions span (see pricing card). Defaults come from the API from vendor cadence and recommended
            length.
          </p>
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

        {preview?.deliveryQuoteMessage && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {preview.deliveryQuoteMessage}
          </p>
        )}

        <div>
          <Label>Dietary / delivery instructions</Label>
          <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} />
        </div>

        <SubscriptionPolicyInfo />

        {preview && (
          <SubscriptionPricingBreakdown
            purchaseTypeLabel={purchaseType === 'WEEKLY_PLAN' ? 'Weekly subscription' : 'Monthly subscription'}
            billingCycleLabel={purchaseType === 'WEEKLY_PLAN' ? 'Weekly cadence' : 'Monthly cadence'}
            mealsPerDelivery={quantity}
            subtotalPerCycle={
              preview.subscriptionCheckout?.subtotalPerCycle ??
              preview.subtotal
            }
            billingCycles={preview.subscriptionCheckout?.billingCycles ?? 1}
            deliveriesPerBillingCycle={
              preview.subscriptionCheckout?.deliveriesPerBillingCycle ?? Math.max(1, totalSessions)
            }
            totalSessions={Math.max(1, totalSessions)}
            foodSubtotalUpfront={
              preview.subscriptionCheckout?.foodSubtotalUpfront ??
              Math.round(preview.subtotal * (preview.subscriptionCheckout?.billingCycles ?? 1) * 100) / 100
            }
            deliveryFee={preview.deliveryFee}
            deliveryFeePendingAddress={preview.deliveryFeePendingAddress}
            platformFeePerCycle={preview.platformFee}
            platformFeeUpfront={
              preview.subscriptionCheckout?.platformFeeUpfront ??
              Math.round(preview.platformFee * (preview.subscriptionCheckout?.billingCycles ?? 1) * 100) / 100
            }
            convenienceFeePerCycle={preview.convenienceFee ?? 0}
            convenienceFeeUpfront={
              preview.subscriptionCheckout?.convenienceFeeUpfront ??
              Math.round((preview.convenienceFee ?? 0) * (preview.subscriptionCheckout?.billingCycles ?? 1) * 100) /
                100
            }
            upfrontTotal={estimatedTotal}
            gstPreview={preview.gst}
          />
        )}

        {startDate && (
          <UpcomingDeliveriesPreview
            firstDeliveryDate={startDate}
            purchaseType={purchaseType}
            weeklyPattern={
              vendorConstrainsWeekly ? 'specific_weekdays' : weeklyPattern
            }
            weekdays={
              purchaseType === 'WEEKLY_PLAN'
                ? weekdays
                : (needsTwiceWeeklyDays || needsWeeklyDay)
                  ? weekdays
                  : undefined
            }
            monthlyVendorFreq={vendorMonthlyFreq}
            previewCount={Math.min(4, Math.max(1, totalSessions))}
          />
        )}

        <SubscriptionProgressPreview totalSessions={Math.max(1, totalSessions)} completed={0} />

        <Button
          type="submit"
          className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E]"
          disabled={
            kitchenClosed ||
            submitting ||
            !addressId ||
            !preview ||
            !hasCoords ||
            !startDate ||
            (pets.length > 0 && !petId) ||
            (needsTwiceWeeklyDays && weekdays.length !== 2) ||
            (needsWeeklyDay && weekdays.length !== 1) ||
            Boolean(preview?.deliveryQuoteMessage)
          }
        >
          {submitting ? 'Opening payment…' : `Pay ₹${estimatedTotal}`}
        </Button>
      </form>
    </div>
  );
}
