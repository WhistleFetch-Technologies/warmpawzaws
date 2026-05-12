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
import {
  urlCustomerAddressesByPhone,
  urlCustomerPetsByPhonePath,
} from '@/lib/customer-service-list-urls';
import {
  buildSanitizedStandardRazorpayCheckoutOptions,
  fetchCheckoutEmailForPrefill,
} from '@/lib/razorpay/build-standard-checkout-options';
import { toast } from 'sonner';
import {
  formatAllergenLabel,
  formatCategoryLabel,
  getMealPlanCatalogDisplay,
} from '@/lib/meal-plan-catalog-display';
import { SubscriptionCheckoutContainer } from '@/components/customer/meal-subscription/SubscriptionCheckoutContainer';

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
  const [submitting, setSubmitting] = useState(false);
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
    const effectiveLat = addrLat;
    const effectiveLng = addrLng;

    const q = new URLSearchParams();
    q.set('quantity', String(quantity));
    q.set('logisticsType', 'warmpawz');
    if (effectiveLat != null && effectiveLng != null) {
      q.set('customerLat', String(effectiveLat));
      q.set('customerLng', String(effectiveLng));
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
        apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`).catch(() => apiClient.get(`/customer/by-phone?phone=${encodeURIComponent(phone)}`)),
        apiClient.get(urlCustomerPetsByPhonePath(phone)).catch(() => ({ pets: [] })),
        apiClient.get(urlCustomerAddressesByPhone(phone)).catch(() => ({ addresses: [] })),
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

      let addrList = (addrRes as any)?.addresses || [];
      // When no saved addresses, use profile address/pincode so checkout doesn't block
      const profileAddr = profile?.address ?? profile?.addressLine1 ?? profile?.address_line1;
      if (addrList.length === 0 && (profileAddr || profile?.pincode)) {
        addrList = [{
          id: 'profile',
          addressLine1: profileAddr || '',
          addressLine2: null,
          city: profile?.city || '',
          state: profile?.state || '',
          pincode: profile?.pincode || '',
        }];
        setAddressId('profile');
      }
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
  const mealPlanImageUrl =
    mealPlan?.mealImageUrl ||
    (mealPlan as { thumbnail_url?: string })?.thumbnail_url ||
    (mealPlan?.dietary_requirements &&
      typeof mealPlan.dietary_requirements === 'object' &&
      (mealPlan.dietary_requirements as { mealImageUrl?: string }).mealImageUrl) ||
    firstPhoto ||
    null;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    if (!petId && pets.length > 0) {
      toast.error('Please select a pet');
      return;
    }

    const totalAmount = preview.totalAmount;
    setSubmitting(true);
    try {
      const razorpayRes = await apiClient.post<any>('/meal/orders/create-razorpay-order', {
        amountInRupees: totalAmount,
        notes: { customerId, mealPlanId, vendorId },
      });
      if (!razorpayRes?.razorpayOrderId) {
        throw new Error(razorpayRes?.error || 'Failed to create payment order');
      }

      const createRes = await apiClient.post<any>('/meal/orders/create', {
        customerId: customerId || undefined,
        customerPhone: customerId ? undefined : phone,
        mealPlanId: mealPlan.id,
        petId: petId || undefined,
        quantity,
        purchaseType: purchaseTypeForOrder,
        specialInstructions: specialInstructions || undefined,
        deliveryAddress,
        scheduledDeliveryDate: scheduledDate,
        scheduledDeliverySlot: { start: scheduledTime, end: scheduledTime },
        logisticsType: 'warmpawz',
        razorpayOrderId: razorpayRes.razorpayOrderId,
      });
      const order = createRes?.order || createRes;
      const orderId = order?.id;
      if (!orderId) throw new Error('Order created but ID missing');

      const keyId = razorpayRes.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY;
      if (!keyId) {
        toast.success('Order created. Payment gateway not configured – contact support to complete payment.');
        onSuccess(orderId);
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
        description: `Meal plan: ${mealPlan.name || 'Order'}`,
        order_id: razorpayRes.razorpayOrderId,
        customerPhone: phone,
        customerEmail: checkoutEmail,
        includeInstrumentBlocks: true,
        handler: async (response: any) => {
          try {
            await apiClient.post(`/meal/orders/${orderId}/confirm-payment`, {
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success('Order confirmed!');
            onSuccess(orderId);
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
        onSuccess={(subscriptionId) => {
          toast.success('Subscription is active');
          router.push(`/subscriptions/detail?id=${encodeURIComponent(subscriptionId)}`);
        }}
      />
    );
  }

  const minDate = new Date();
  minDate.setHours(0, 0, 0, 0);
  const leadHours = preview?.leadTimeHours ?? 24;
  minDate.setTime(minDate.getTime() + leadHours * 60 * 60 * 1000);
  const minDateStr = minDate.toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-orange-50 max-w-md mx-auto pb-24">
      <div className="sticky top-0 z-10 bg-gradient-to-r from-[#FF8C42] to-orange-500 text-white px-4 py-4 flex items-center gap-3">
        <button type="button" onClick={onBack} className="p-2 rounded-lg bg-white/20 hover:bg-white/30">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">Checkout – Meal Plan</h1>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
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
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Date</Label>
            <Input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
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
              required
            />
          </div>
        </div>

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
            submitting ||
            !addressId ||
            !preview ||
            !hasSelectedAddressCoordinates ||
            !scheduledDate ||
            !scheduledTime ||
            (pets.length > 0 && !petId)
          }
        >
          {submitting ? 'Opening payment...' : `Pay ₹${preview?.totalAmount ?? 0}`}
        </Button>
      </form>
    </div>
  );
}
