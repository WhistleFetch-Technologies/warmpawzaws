'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Calendar, Clock, UtensilsCrossed, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  formatAllergenLabel,
  formatCategoryLabel,
  getMealPlanCatalogDisplay,
} from '@/lib/meal-plan-catalog-display';
import { SubscriptionCheckoutContainer } from '@/components/customer/meal-subscription/SubscriptionCheckoutContainer';
import { resolveCustomerPublicAssetUrl } from '@/lib/public-asset-url';
import { isMealKitchenClosed, mealKitchenClosedMessage } from '@/lib/meal-kitchen-availability';
import { MealKitchenStatusBanner } from '@/components/customer/nutrition/MealKitchenStatusBanner';
import {
  computeEarliestDeliveryYmd,
  earliestDeliveryYmd,
  evaluateMealDeliverySlot,
  extractMealSchedulePolicy,
  minDeliveryTimeHm,
} from '@/lib/meal-checkout-schedule';

interface MealOrderCheckoutProps {
  phone: string;
  mealPlanId: string;
  vendorId: string;
  onBack: () => void;
  onSuccess: (orderId: string) => void;
}

export function MealOrderCheckout({ phone, mealPlanId, vendorId, onBack, onSuccess }: MealOrderCheckoutProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mealPlan, setMealPlan] = useState<any>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [pets, setPets] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [preview, setPreview] = useState<{
    subtotal: number;
    deliveryFee: number | null;
    deliveryFeePendingAddress?: boolean;
    platformFee: number;
    convenienceFee?: number;
    totalAmount: number;
    leadTimeHours: number;
    orderCutoffTime?: string;
    bookingPolicy?: {
      orderCutoffTime?: string;
      earliestDeliveryAt?: string;
      sameDayAllowed?: boolean;
      effectiveLeadTimeHours?: number;
    };
    deliveryPolicyMessage?: string;
    deliveryAllowed?: boolean;
    gst?: {
      foodGstPct: number;
      deliveryGstPct?: number;
      taxCategoryId?: string | null;
      catalogCategoryId?: string | null;
      foodGstAmount?: number;
      deliveryGstAmount?: number;
      totalGstAmount?: number;
    };
    deliveryQuoteMessage?: string;
  } | null>(null);

  const [petId, setPetId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [addressId, setAddressId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

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
    if (scheduledDate && scheduledTime) {
      q.set('scheduledDeliveryDate', scheduledDate);
      q.set('deliveryTime', scheduledTime);
    }

    apiClient
      .get(`/meal-plans/${mealPlanId}/order-preview?${q.toString()}`)
      .then((res: any) => {
        if (res.success) setPreview(res);
      })
      .catch(() => {
        if (!scheduledDate && !scheduledTime) setPreview(null);
      });
  }, [mealPlanId, quantity, addressId, addresses, scheduledDate, scheduledTime]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [planRes, profileRes, petsRes, addrRes] = await Promise.all([
        apiClient.get(`/meal-plans/${mealPlanId}`).catch(() => null),
        apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`).catch(() => apiClient.get(`/customer/by-phone?phone=${encodeURIComponent(phone)}`)),
        apiClient.get(`/customer/pets/${phone}`).catch(() => ({ pets: [] })),
        apiClient.get(`/customer/addresses?phone=${encodeURIComponent(phone)}`).catch(() => ({ addresses: [] })),
      ]);
      const planData = (planRes as any)?.mealPlan || planRes;
      if (planData) setMealPlan(planData);
      const profile = (profileRes as any)?.profile || (profileRes as any)?.customer || profileRes;
      const cid =
        profile?.id ||
        (profileRes as any)?.id ||
        (profileRes as any)?.customer?.id;
      if (cid) setCustomerId(String(cid));
      setPets((petsRes as any)?.pets || []);

      const addrList = (addrRes as any)?.addresses || [];
      setAddresses(addrList);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load checkout data');
    } finally {
      setLoading(false);
    }
  };

  const selectedAddress = addresses.find((a) => a.id === addressId);
  const selectedAddressLat =
    selectedAddress?.coordinates?.lat ?? selectedAddress?.latitude ?? selectedAddress?.lat ?? null;
  const selectedAddressLng =
    selectedAddress?.coordinates?.lng ?? selectedAddress?.longitude ?? selectedAddress?.lng ?? null;
  const hasSelectedAddressCoordinates = selectedAddressLat != null && selectedAddressLng != null;

  const photosArr = mealPlan?.photos && Array.isArray(mealPlan.photos) ? mealPlan.photos : [];
  const firstPhoto =
    typeof photosArr[0] === 'string'
      ? photosArr[0]
      : photosArr[0] && typeof photosArr[0] === 'object'
        ? String((photosArr[0] as { url?: string; src?: string }).url || (photosArr[0] as { url?: string; src?: string }).src || '')
        : '';
  const mealPlanImageRaw =
    mealPlan?.mealImageUrl ||
    (mealPlan as { thumbnail_url?: string })?.thumbnail_url ||
    (mealPlan?.dietary_requirements &&
      typeof mealPlan.dietary_requirements === 'object' &&
      (mealPlan.dietary_requirements as { mealImageUrl?: string }).mealImageUrl) ||
    firstPhoto ||
    null;
  const mealPlanImageUrl = resolveCustomerPublicAssetUrl(mealPlanImageRaw);

  const catalog = mealPlan ? getMealPlanCatalogDisplay(mealPlan as Record<string, unknown>) : null;
  const purchaseTypeForOrder = catalog?.purchaseType;
  const isRecurring =
    purchaseTypeForOrder === 'WEEKLY_PLAN' || purchaseTypeForOrder === 'MONTHLY_PLAN';
  const buildDeliveryAddress = () => {
    if (!selectedAddress) return null;
    const parts = [
      selectedAddress.addressLine1,
      selectedAddress.addressLine2,
      selectedAddress.city,
      selectedAddress.state,
      selectedAddress.pincode,
    ].filter(Boolean);
    const coords = selectedAddress.coordinates;
    return {
      address: parts.join(', '),
      lat: coords?.lat ?? selectedAddress.latitude ?? selectedAddress.lat ?? null,
      lng: coords?.lng ?? selectedAddress.longitude ?? selectedAddress.lng ?? null,
      landmark: selectedAddress.landmark || '',
      pincode: selectedAddress.pincode || '',
    };
  };

  const kitchenClosed = isMealKitchenClosed(mealPlan);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (kitchenClosed) {
      toast.error(mealKitchenClosedMessage(mealPlan));
      return;
    }
    if (!mealPlan?.id || !preview) {
      toast.error('Missing meal plan or price details');
      return;
    }
    if (!customerId && !phone) {
      toast.error('Missing customer details. Please refresh and try again.');
      return;
    }
    const deliveryAddress = buildDeliveryAddress();
    if (!deliveryAddress?.address) {
      toast.error('Please select a delivery address');
      return;
    }
    if (deliveryAddress.lat == null || deliveryAddress.lng == null) {
      toast.error('Selected address has no location coordinates. Please edit/add address with map pin.');
      return;
    }
    if (!scheduledDate || !scheduledTime) {
      toast.error('Please select delivery date and time');
      return;
    }
    if (preview.deliveryAllowed === false) {
      toast.error(preview.deliveryPolicyMessage || `Order must be at least ${preview.leadTimeHours} hours before delivery`);
      return;
    }
    if (schedulePolicy && scheduledDate && scheduledTime) {
      const slot = evaluateMealDeliverySlot(scheduledDate, scheduledTime, schedulePolicy);
      if (!slot.allowed) {
        toast.error(slot.message || 'Selected delivery time is not available');
        return;
      }
    }
    if (!petId && pets.length > 0) {
      toast.error('Please select a pet');
      return;
    }

    const gst = preview.gst || {};
    const addrObj = {
      ...deliveryAddress,
      state: selectedAddress?.state,
      city: selectedAddress?.city,
      pincode: selectedAddress?.pincode,
    };
    const draft = {
      mealPlanId: String(mealPlan.id),
      customerId: customerId || undefined,
      customerPhone: phone,
      vendorId,
      quantity,
      petId: petId || undefined,
      specialInstructions: specialInstructions || undefined,
      deliveryAddress: addrObj,
      scheduledDeliveryDate: scheduledDate,
      scheduledDeliverySlot: { start: scheduledTime, end: scheduledTime },
      logisticsType: 'warmpawz',
      foodSubtotalInr: preview.subtotal,
      foodGstPct: Number.isFinite(Number(gst.foodGstPct)) ? Number(gst.foodGstPct) : 0,
      deliveryGstPct: Number.isFinite(Number(gst.deliveryGstPct)) ? Number(gst.deliveryGstPct) : 0,
      mealPlanGstCatalogCategoryId:
        gst.catalogCategoryId != null ? String(gst.catalogCategoryId) : undefined,
      deliveryFeeInr: preview.deliveryFee ?? 0,
      platformFeeInr: preview.platformFee ?? 0,
      convenienceFeeInr: preview.convenienceFee ?? 0,
    };
    try {
      sessionStorage.setItem('meal_one_time_pay_draft_v1', JSON.stringify(draft));
    } catch {
      toast.error('Could not start checkout. Enable site storage and try again.');
      return;
    }
    const name = mealPlan.name || mealPlan.plan_name || 'Meal plan';
    router.push(`/meal-plans/checkout-pay?mealPlanName=${encodeURIComponent(String(name))}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center max-w-md mx-auto">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (!mealPlan) {
    return (
      <div className="min-h-screen bg-orange-50 max-w-md mx-auto p-6">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back
        </Button>
        <p className="text-red-600">Meal plan not found.</p>
      </div>
    );
  }

  if (isRecurring) {
    return (
      <SubscriptionCheckoutContainer
        phone={phone}
        mealPlanId={mealPlanId}
        vendorId={vendorId}
        purchaseType={purchaseTypeForOrder as 'WEEKLY_PLAN' | 'MONTHLY_PLAN'}
        onBack={onBack}
      />
    );
  }

  const schedulePolicy = mealPlan
    ? extractMealSchedulePolicy(mealPlan as Record<string, unknown>)
    : null;
  const leadHours = preview?.leadTimeHours ?? schedulePolicy?.leadTimeHours ?? 24;
  const earliestRaw = preview?.bookingPolicy?.earliestDeliveryAt ?? schedulePolicy?.earliestDeliveryAt;
  const minDateStr = schedulePolicy
    ? computeEarliestDeliveryYmd(schedulePolicy)
    : earliestDeliveryYmd(earliestRaw, leadHours);
  const orderCutoffDisplay =
    preview?.orderCutoffTime ||
    preview?.bookingPolicy?.orderCutoffTime ||
    schedulePolicy?.orderCutoffTime ||
    '';
  const sameDayAllowed =
    preview?.bookingPolicy?.sameDayAllowed ?? schedulePolicy?.sameDayAllowed ?? leadHours <= 24;
  const sameDayHint = sameDayAllowed
    ? ` Same-day delivery may be available${orderCutoffDisplay ? ` (order by ${orderCutoffDisplay} today)` : ''}.`
    : '';
  const minTimeStr =
    scheduledDate && (preview || schedulePolicy)
      ? minDeliveryTimeHm(scheduledDate, earliestRaw, leadHours)
      : undefined;
  const clientSlotCheck =
    scheduledDate && scheduledTime && schedulePolicy
      ? evaluateMealDeliverySlot(scheduledDate, scheduledTime, schedulePolicy)
      : null;
  const scheduleError =
    clientSlotCheck && !clientSlotCheck.allowed
      ? clientSlotCheck.message
      : preview?.deliveryAllowed === false
        ? preview.deliveryPolicyMessage
        : scheduledDate && !scheduledTime
          ? 'Select a delivery time.'
          : null;
  const checkoutBlocked =
    Boolean(scheduleError) ||
    (scheduledDate && scheduledTime && preview?.deliveryAllowed === false);

  const handleScheduledDateChange = (value: string) => {
    setScheduledDate(value);
    if (scheduledTime && schedulePolicy) {
      const slot = evaluateMealDeliverySlot(value, scheduledTime, schedulePolicy);
      if (!slot.allowed) setScheduledTime('');
    }
  };

  return (
    <div className="min-h-screen bg-orange-50 max-w-md mx-auto pb-24">
      <div className="sticky top-0 z-10 bg-gradient-to-r from-[#FF8C42] to-orange-500 text-white px-4 py-4 flex items-center gap-3">
        <button type="button" onClick={onBack} className="p-2 rounded-lg bg-white/20 hover:bg-white/30">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">Checkout – Meal Plan</h1>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {kitchenClosed ? (
          <MealKitchenStatusBanner message={mealKitchenClosedMessage(mealPlan)} />
        ) : null}
        <Card className="p-4">
          <div className="flex gap-3">
            {mealPlanImageUrl ? (
              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-orange-100 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mealPlanImageUrl} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
            <div className="w-16 h-16 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-7 h-7 text-orange-600" />
            </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-slate-900">{mealPlan.name || mealPlan.plan_name || 'Meal Plan'}</h2>
              <p className="text-sm text-slate-600 mt-0.5">{mealPlan.description || ''}</p>
              {preview && (
                <p className="text-sm font-medium text-orange-600 mt-1">
                  Meal price: ₹{preview.subtotal}
                </p>
              )}
              {catalog?.packWeightLabel ? (
                <p className="text-xs font-medium text-slate-600 mt-0.5">{catalog.packWeightLabel}</p>
              ) : null}
            </div>
          </div>

          {catalog && (
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-3 text-sm text-slate-800">
              <div className="grid grid-cols-1 gap-2 text-xs sm:text-sm">
                <p>
                  <span className="text-slate-500 font-medium">Plan: </span>
                  {catalog.customerPurchaseHeadline}
                </p>
                {catalog.customerPricingLine ? (
                  <p>
                    <span className="text-slate-500 font-medium">Pricing: </span>
                    {catalog.customerPricingLine}
                  </p>
                ) : null}
                {catalog.packWeightLabel ? (
                  <p>
                    <span className="text-slate-500 font-medium">Pack weight: </span>
                    {catalog.packWeightLabel}
                  </p>
                ) : null}
                {catalog.customerBenefits.length > 0 ? (
                  <ul className="list-disc list-inside text-slate-700 space-y-0.5">
                    {catalog.customerBenefits.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                ) : null}
                <p>
                  <span className="text-slate-500 font-medium">Shelf life: </span>
                  {catalog.shelfLifeDays != null ? `${catalog.shelfLifeDays} days` : '—'}
                </p>
                <p>
                  <span className="text-slate-500 font-medium">Preparation: </span>
                  {catalog.preparationLabel || '—'}
                </p>
                {catalog.dietTypeLabel ? (
                  <p>
                    <span className="text-slate-500 font-medium">Diet: </span>
                    {catalog.dietTypeLabel}
                  </p>
                ) : null}
              </div>

              {catalog.mealCategories.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Meal categories</p>
                  <div className="flex flex-wrap gap-1.5">
                    {catalog.mealCategories.map((c) => (
                      <span
                        key={c}
                        className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-900 text-xs border border-teal-100"
                      >
                        {formatCategoryLabel(c)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {catalog.petTypes.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Pet types</p>
                  <div className="flex flex-wrap gap-1.5">
                    {catalog.petTypes.map((pt) => (
                      <span
                        key={pt}
                        className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-900 text-xs border border-blue-100"
                      >
                        {pt}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {catalog.ingredients.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Ingredients</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{catalog.ingredients.join(', ')}</p>
                </div>
              ) : null}

              {catalog.allergens.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Allergens</p>
                  <div className="flex flex-wrap gap-1.5">
                    {catalog.allergens.map((a) => (
                      <span
                        key={a}
                        className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 text-xs border border-amber-100"
                      >
                        {formatAllergenLabel(a)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </Card>

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
          <Label>Quantity</Label>
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
          />
        </div>

        <div>
          <Label className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Delivery address</Label>
          {addresses.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">Add an address in your profile first.</p>
          ) : (
            <Select value={addressId} onValueChange={setAddressId} required>
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
          {addressId && !hasSelectedAddressCoordinates && (
            <p className="text-xs text-amber-700 mt-2">
              This address has no latitude/longitude. Update the address with map location to get delivery fee.
            </p>
          )}
          {preview?.deliveryQuoteMessage && (
            <p className="text-xs text-red-700 mt-2">{preview.deliveryQuoteMessage}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Date</Label>
            <Input
              type="date"
              value={scheduledDate}
              onChange={(e) => handleScheduledDateChange(e.target.value)}
              min={minDateStr}
              required
            />
          </div>
          <div>
            <Label className="flex items-center gap-2"><Clock className="w-4 h-4" /> Time</Label>
            <Input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              min={minTimeStr}
              required
            />
          </div>
        </div>
        <p className="text-xs text-slate-600 -mt-2">
          Order at least {leadHours} hour{leadHours === 1 ? '' : 's'} before delivery.
          {orderCutoffDisplay ? ` Orders for today must be placed before ${orderCutoffDisplay}.` : ''}
          {sameDayHint}
        </p>
        {scheduleError ? (
          <p className="text-xs text-red-700">{scheduleError}</p>
        ) : null}

        <div>
          <Label>Special instructions</Label>
          <Textarea
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            placeholder="Allergies, notes..."
            rows={2}
          />
        </div>

        {preview && (
          <Card className="p-4 bg-white">
            <h3 className="font-semibold text-slate-900 mb-2">Order summary</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Meal price</span><span>₹{preview.subtotal}</span></div>
              <div className="flex justify-between">
                <span>Delivery</span>
                <span>
                  {preview.deliveryFeePendingAddress || preview.deliveryFee == null
                    ? 'Select address'
                    : `₹${preview.deliveryFee}`}
                </span>
              </div>
              <div className="flex justify-between"><span>Platform fee</span><span>₹{preview.platformFee}</span></div>
              <div className="flex justify-between"><span>Convenience fee</span><span>₹{preview.convenienceFee ?? 0}</span></div>
              {preview.gst && preview.gst.foodGstPct != null ? (
                <div className="flex justify-between text-slate-700">
                  <span>GST on meal (food)</span>
                  <span>
                    ₹
                    {(preview.gst.foodGstAmount != null
                      ? Number(preview.gst.foodGstAmount).toFixed(2)
                      : ((preview.subtotal * (Number(preview.gst.foodGstPct) || 0)) / 100).toFixed(2))}{' '}
                    ({Number(preview.gst.foodGstPct)}%)
                  </span>
                </div>
              ) : null}
              {preview.gst &&
              preview.gst.deliveryGstPct != null &&
              preview.deliveryFee != null &&
              Number(preview.deliveryFee) > 0 ? (
                <div className="flex justify-between text-slate-700">
                  <span>GST on delivery</span>
                  <span>
                    ₹
                    {(preview.gst.deliveryGstAmount != null
                      ? Number(preview.gst.deliveryGstAmount).toFixed(2)
                      : (
                          (Number(preview.deliveryFee) * (Number(preview.gst.deliveryGstPct) || 0)) /
                          100
                        ).toFixed(2))}{' '}
                    ({Number(preview.gst.deliveryGstPct)}%)
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between font-semibold text-slate-900 pt-2 border-t">
                <span>Total</span><span>₹{preview.totalAmount}</span>
              </div>
            </div>
          </Card>
        )}

        <Button
          type="submit"
          className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E]"
          disabled={
            kitchenClosed ||
            !addressId ||
            !preview ||
            !hasSelectedAddressCoordinates ||
            preview.deliveryFee == null ||
            Boolean(preview.deliveryQuoteMessage) ||
            !scheduledDate ||
            !scheduledTime ||
            (pets.length > 0 && !petId) ||
            checkoutBlocked
          }
        >
          {`Continue to pay ₹${preview?.totalAmount ?? 0}`}
        </Button>
      </form>
    </div>
  );
}
