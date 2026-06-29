'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  Clock,
  Loader2,
  Lock,
  MapPin,
  Minus,
  PawPrint,
  Plus,
  Shield,
  ShoppingBag,
  Star,
  UtensilsCrossed,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { rememberMealOneTimePayBackFromCheckout } from '@/lib/go-back-or-replace';
import { formatDeliveryAddressLine } from '@/lib/ecommerce/delivery-address-display';
import { ServiceDashboardHeader } from '@/components/customer/shared/ServiceDashboardHeader';
import { NUTRITION_HEADER_BANNER } from '@/components/customer/nutrition/constants/nutrition-hub-assets';
import { paymentCardClass, paymentPageBgClass } from '@/components/customer/payment/payment-page-styles';

const checkoutSelectTriggerClass =
  'h-auto w-full border-0 bg-transparent p-0 shadow-none focus:ring-0 [&_svg]:hidden';

const MEAL_ONE_TIME_PAY_DRAFT_KEY = 'meal_one_time_pay_draft_v1';

function CheckoutFieldCard({
  icon,
  label,
  children,
  trailing,
  className = '',
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${paymentCardClass} p-4 ${className}`.trim()}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF8C42]">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <div className="mt-0.5">{children}</div>
        </div>
        {trailing ?? <ChevronDown className="mt-2 h-4 w-4 shrink-0 text-slate-400" aria-hidden />}
      </div>
    </div>
  );
}

function MealCheckoutDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-medium text-slate-500">{label}: </span>
      <span className="text-slate-800">{value}</span>
    </p>
  );
}

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
    if (!mealPlanId || typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(MEAL_ONE_TIME_PAY_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        mealPlanId?: string;
        quantity?: number;
        petId?: string;
        addressId?: string;
        scheduledDeliveryDate?: string;
        scheduledDeliverySlot?: { start?: string };
        specialInstructions?: string;
      };
      if (String(draft.mealPlanId || '') !== String(mealPlanId)) return;
      if (draft.quantity != null && Number.isFinite(Number(draft.quantity))) {
        setQuantity(Math.max(1, Number(draft.quantity)));
      }
      if (draft.petId) setPetId(String(draft.petId));
      if (draft.addressId) setAddressId(String(draft.addressId));
      if (draft.scheduledDeliveryDate) setScheduledDate(String(draft.scheduledDeliveryDate));
      if (draft.scheduledDeliverySlot?.start) setScheduledTime(String(draft.scheduledDeliverySlot.start));
      if (draft.specialInstructions) setSpecialInstructions(String(draft.specialInstructions));
    } catch {
      /* ignore corrupt draft */
    }
  }, [mealPlanId]);

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
      addressId: addressId || undefined,
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
      sessionStorage.setItem(MEAL_ONE_TIME_PAY_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      toast.error('Could not start checkout. Enable site storage and try again.');
      return;
    }
    rememberMealOneTimePayBackFromCheckout();
    const name = mealPlan.name || mealPlan.plan_name || 'Meal plan';
    router.push(`/meal-plans/checkout-pay?mealPlanName=${encodeURIComponent(String(name))}`);
  };

  if (loading) {
    return (
      <div className={`mx-auto flex min-h-screen max-w-md items-center justify-center ${paymentPageBgClass}`}>
        <Loader2 className="h-10 w-10 animate-spin text-[#FF8C42]" />
      </div>
    );
  }

  if (!mealPlan) {
    return (
      <div className={`mx-auto min-h-screen max-w-md ${paymentPageBgClass} p-6`}>
        <ServiceDashboardHeader
          serviceName="Checkout – Meal Plan"
          serviceSubtitle="Review your meal plan and delivery details"
          serviceIcon={UtensilsCrossed}
          hideServiceIcon
          serviceNameClassName="truncate whitespace-nowrap text-base sm:text-lg"
          onBack={onBack}
          stats={[]}
          sheetToneClass={paymentPageBgClass}
        />
        <p className="mt-6 text-center text-red-600">Meal plan not found.</p>
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
    Boolean(scheduledDate && scheduledTime && preview?.deliveryAllowed === false);

  const handleScheduledDateChange = (value: string) => {
    setScheduledDate(value);
    if (scheduledTime && schedulePolicy) {
      const slot = evaluateMealDeliverySlot(value, scheduledTime, schedulePolicy);
      if (!slot.allowed) setScheduledTime('');
    }
  };

  const mealPlanName = mealPlan.name || mealPlan.plan_name || 'Meal Plan';
  const selectedPet = pets.find((p) => p.id === petId);
  const submitDisabled =
    kitchenClosed ||
    !addressId ||
    !preview ||
    !hasSelectedAddressCoordinates ||
    preview?.deliveryFee == null ||
    Boolean(preview?.deliveryQuoteMessage) ||
    !scheduledDate ||
    !scheduledTime ||
    (pets.length > 0 && !petId) ||
    checkoutBlocked;

  return (
    <div className={`mx-auto flex min-h-[100dvh] max-w-md flex-col ${paymentPageBgClass}`}>
      <ServiceDashboardHeader
        serviceName="Checkout – Meal Plan"
        serviceSubtitle="Review your meal plan and delivery details"
        serviceIcon={UtensilsCrossed}
        hideServiceIcon
        serviceNameClassName="truncate whitespace-nowrap text-base sm:text-lg"
        onBack={onBack}
        stats={[]}
        sheetToneClass={paymentPageBgClass}
        headerTrailingImage={NUTRITION_HEADER_BANNER}
        headerTrailingImageAlt="Dog and cat"
        clipHeaderTrailingImage
        headerTrailingImageClassName="pointer-events-none absolute bottom-0 right-0 top-[2.75rem] z-[5] flex w-[52%] max-w-[210px] items-end justify-end sm:top-12"
        headerTrailingImageImgClassName="block h-full w-auto max-w-full origin-bottom-right scale-[1.08] object-contain object-right object-bottom drop-shadow-lg"
      />

      <main className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4 pt-2">
        <form id="meal-checkout-form" onSubmit={handleSubmit} className="space-y-3">
          {kitchenClosed ? (
            <MealKitchenStatusBanner message={mealKitchenClosedMessage(mealPlan)} />
          ) : null}

          <div className={`${paymentCardClass} overflow-hidden p-4`}>
            <div className="flex gap-4">
              <div className="relative shrink-0">
                {mealPlanImageUrl ? (
                  <div className="h-24 w-24 overflow-hidden rounded-2xl border border-orange-100 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mealPlanImageUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-orange-100">
                    <UtensilsCrossed className="h-8 w-8 text-[#FF8C42]" />
                  </div>
                )}
                {catalog?.packWeightLabel ? (
                  <span className="absolute bottom-1 right-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                    {catalog.packWeightLabel}
                  </span>
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-slate-900">{mealPlanName}</h2>
                {mealPlan.description ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{mealPlan.description}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xl font-bold text-[#FF8C42]">
                    ₹{preview?.subtotal ?? mealPlan.price_per_meal ?? mealPlan.price ?? '—'}
                  </span>
                  {catalog?.customerPurchaseHeadline ? (
                    <span className="rounded-full border border-orange-100 bg-orange-50 px-2.5 py-0.5 text-[10px] font-semibold text-orange-800">
                      {catalog.customerPurchaseHeadline}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-600">
                  {catalog?.preparationLabel ? (
                    <span className="inline-flex items-center gap-1">
                      <UtensilsCrossed className="h-3.5 w-3.5 text-emerald-600" />
                      {catalog.preparationLabel}
                    </span>
                  ) : null}
                  {catalog?.shelfLifeDays != null ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-emerald-600" />
                      {catalog.shelfLifeDays} day{catalog.shelfLifeDays === 1 ? '' : 's'} shelf life
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {catalog ? (
              <>
                <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 text-xs sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <MealCheckoutDetailRow label="Plan" value={catalog.customerPurchaseHeadline} />
                    {catalog.packWeightLabel ? (
                      <MealCheckoutDetailRow label="Pack weight" value={catalog.packWeightLabel} />
                    ) : null}
                    {catalog.dietTypeLabel ? (
                      <MealCheckoutDetailRow label="Diet" value={catalog.dietTypeLabel} />
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    {catalog.customerPricingLine ? (
                      <MealCheckoutDetailRow label="Pricing" value={catalog.customerPricingLine} />
                    ) : null}
                    <MealCheckoutDetailRow
                      label="Shelf life"
                      value={catalog.shelfLifeDays != null ? `${catalog.shelfLifeDays} days` : '—'}
                    />
                    <MealCheckoutDetailRow label="Preparation" value={catalog.preparationLabel || '—'} />
                  </div>
                  {catalog.customerBenefits.length > 0 ? (
                    <div>
                      <p className="mb-1.5 flex items-center gap-1 font-semibold text-slate-700">
                        <Star className="h-3.5 w-3.5 text-[#FF8C42]" />
                        Why choose this?
                      </p>
                      <ul className="list-inside list-disc space-y-0.5 text-slate-700">
                        {catalog.customerBenefits.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>

                {(catalog.mealCategories.length > 0 ||
                  catalog.petTypes.length > 0 ||
                  catalog.ingredients.length > 0 ||
                  catalog.allergens.length > 0) && (
                  <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
                    {catalog.mealCategories.length > 0 ? (
                      <div>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Meal categories
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {catalog.mealCategories.map((c) => (
                            <span
                              key={c}
                              className="rounded-full border border-teal-100 bg-teal-50 px-2 py-0.5 text-[10px] text-teal-900"
                            >
                              {formatCategoryLabel(c)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {catalog.petTypes.length > 0 ? (
                      <div>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Pet types
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {catalog.petTypes.map((pt) => (
                            <span
                              key={pt}
                              className="rounded-full border border-violet-100 bg-violet-50 px-2 py-0.5 text-[10px] text-violet-900"
                            >
                              {pt}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {catalog.ingredients.length > 0 ? (
                      <div>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Ingredients
                        </p>
                        <p className="text-[11px] leading-relaxed text-slate-700">
                          {catalog.ingredients.join(', ')}
                        </p>
                      </div>
                    ) : null}
                    {catalog.allergens.length > 0 ? (
                      <div className="sm:col-span-3">
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Allergens
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {catalog.allergens.map((a) => (
                            <span
                              key={a}
                              className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-900"
                            >
                              {formatAllergenLabel(a)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </>
            ) : null}
          </div>

          {pets.length > 0 ? (
            <CheckoutFieldCard icon={<PawPrint className="h-5 w-5" />} label="Pet">
              <Select value={petId} onValueChange={setPetId}>
                <SelectTrigger className={checkoutSelectTriggerClass}>
                  <SelectValue placeholder="Select pet">
                    {selectedPet?.name ?? undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {pets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CheckoutFieldCard>
          ) : null}

          <CheckoutFieldCard
            icon={<ShoppingBag className="h-5 w-5" />}
            label="Quantity"
            trailing={
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-orange-200 hover:bg-orange-50"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-[1.5rem] text-center text-sm font-semibold text-slate-900">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-orange-200 hover:bg-orange-50"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            }
          >
            <span className="text-sm font-semibold text-slate-900">
              {quantity} meal{quantity === 1 ? '' : 's'}
            </span>
          </CheckoutFieldCard>

          {addresses.length === 0 ? (
            <div className={`${paymentCardClass} p-4 text-sm text-amber-800`}>
              Add a delivery address in your profile first.
            </div>
          ) : (
            <CheckoutFieldCard icon={<MapPin className="h-5 w-5" />} label="Delivery address">
              <Select value={addressId} onValueChange={setAddressId} required>
                <SelectTrigger
                  className={`${checkoutSelectTriggerClass} min-w-0 [&_[data-slot=select-value]]:line-clamp-2 [&_[data-slot=select-value]]:text-left`}
                >
                  <SelectValue placeholder="Select address">
                    {selectedAddress ? formatDeliveryAddressLine(selectedAddress) : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {addresses.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="items-start py-2">
                      <span className="line-clamp-2 break-words">{formatDeliveryAddressLine(a)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CheckoutFieldCard>
          )}
          {addressId && !hasSelectedAddressCoordinates ? (
            <p className="px-1 text-xs text-amber-700">
              This address has no latitude/longitude. Update the address with map location to get delivery fee.
            </p>
          ) : null}
          {preview?.deliveryQuoteMessage ? (
            <p className="px-1 text-xs text-red-700">{preview.deliveryQuoteMessage}</p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className={`${paymentCardClass} p-4`}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF8C42]">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-500">Date</p>
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => handleScheduledDateChange(e.target.value)}
                    min={minDateStr}
                    required
                    className="mt-0.5 h-auto border-0 bg-transparent p-0 text-sm font-semibold text-slate-900 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
            </div>
            <div className={`${paymentCardClass} p-4`}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF8C42]">
                  <Clock className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-500">Time</p>
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    min={minTimeStr}
                    required
                    className="mt-0.5 h-auto border-0 bg-transparent p-0 text-sm font-semibold text-slate-900 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
            </div>
          </div>
          <p className="px-1 text-xs leading-relaxed text-slate-600">
            Order at least {leadHours} hour{leadHours === 1 ? '' : 's'} before delivery.
            {orderCutoffDisplay ? ` Orders for today must be placed before ${orderCutoffDisplay}.` : ''}
            {sameDayHint}
          </p>
          {scheduleError ? <p className="px-1 text-xs text-red-700">{scheduleError}</p> : null}

          <div className={`${paymentCardClass} p-4`}>
            <p className="mb-2 text-sm font-semibold text-slate-900">Special instructions</p>
            <Textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="Allergies, notes..."
              rows={2}
              className="resize-none border-slate-100 bg-[#FAF6F0] focus-visible:ring-[#FF8C42]"
            />
          </div>

          {preview ? (
            <div className={`${paymentCardClass} p-4`}>
              <h3 className="mb-3 font-semibold text-slate-900">Order summary</h3>
              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex justify-between gap-3">
                  <span>Meal price</span>
                  <span className="font-medium text-slate-900">₹{preview.subtotal}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Delivery</span>
                  <span className="font-medium text-slate-900">
                    {preview.deliveryFeePendingAddress || preview.deliveryFee == null
                      ? 'Select address'
                      : `₹${preview.deliveryFee}`}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Platform fee</span>
                  <span className="font-medium text-slate-900">₹{preview.platformFee}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Convenience fee</span>
                  <span className="font-medium text-slate-900">₹{preview.convenienceFee ?? 0}</span>
                </div>
                {preview.gst && preview.gst.foodGstPct != null ? (
                  <div className="flex justify-between gap-3">
                    <span>GST on meal (food)</span>
                    <span className="font-medium text-slate-900">
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
                  <div className="flex justify-between gap-3">
                    <span>GST on delivery</span>
                    <span className="font-medium text-slate-900">
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
                <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-slate-900">
                  <span>Total</span>
                  <span>₹{preview.totalAmount}</span>
                </div>
              </div>
            </div>
          ) : null}
        </form>
      </main>

      <footer className="relative shrink-0 bg-[#FFF4EB] px-4 pb-[max(1rem,env(safe-area-inset-bottom,1rem))] pt-5 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
        <svg
          className="pointer-events-none absolute -top-3 left-0 block h-4 w-full"
          viewBox="0 0 1200 24"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M0 24 L1200 24 L1200 18 Q600 0 0 18 Z" fill="#FFF4EB" />
        </svg>

        <div className="mb-3 flex items-end justify-between gap-4">
          <div className="flex min-w-0 items-start gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <Shield className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Secure Checkout</p>
              <p className="text-[11px] text-slate-600">100% safe &amp; secure payments</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-slate-500">Total</p>
            <p className="text-xl font-bold text-[#FF8C42]">₹{preview?.totalAmount ?? 0}</p>
          </div>
        </div>

        <Button
          type="submit"
          form="meal-checkout-form"
          disabled={submitDisabled}
          className="h-auto w-full rounded-full bg-gradient-to-r from-[#FF8C42] to-[#FF7029] py-4 text-base font-bold text-white shadow-[0_8px_24px_rgba(255,107,53,0.35)] hover:from-[#E67A35] hover:to-[#D66A25] disabled:opacity-50"
        >
          <span className="flex w-full items-center justify-center gap-2">
            Proceed to Pay
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-[#FF8C42]">
              <ArrowRight className="h-4 w-4" />
            </span>
          </span>
        </Button>

        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500">
          <Lock className="h-3 w-3 shrink-0" aria-hidden />
          Your payment details are safe with us
        </p>
      </footer>
    </div>
  );
}
