'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Calendar, Clock, UtensilsCrossed, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface MealOrderCheckoutProps {
  phone: string;
  mealPlanId: string;
  vendorId: string;
  onBack: () => void;
  onSuccess: (orderId: string) => void;
}

export function MealOrderCheckout({ phone, mealPlanId, vendorId, onBack, onSuccess }: MealOrderCheckoutProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mealPlan, setMealPlan] = useState<any>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [pets, setPets] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [preview, setPreview] = useState<{ subtotal: number; deliveryFee: number; platformFee: number; totalAmount: number; leadTimeHours: number } | null>(null);

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
    if (mealPlanId && quantity) {
      apiClient
        .get(`/meal-plans/${mealPlanId}/order-preview?quantity=${quantity}&logisticsType=warmpawz`)
        .then((res: any) => {
          if (res.success) setPreview(res);
        })
        .catch(() => setPreview(null));
    }
  }, [mealPlanId, quantity]);

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

  const mealPlanImageUrl =
    mealPlan?.mealImageUrl ||
    (mealPlan?.dietary_requirements &&
      typeof mealPlan.dietary_requirements === 'object' &&
      (mealPlan.dietary_requirements as { mealImageUrl?: string }).mealImageUrl) ||
    null;
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
      lat: coords?.lat ?? selectedAddress.latitude ?? 0,
      lng: coords?.lng ?? selectedAddress.longitude ?? 0,
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

      const options = {
        key: keyId,
        amount: razorpayRes.amount,
        currency: razorpayRes.currency || 'INR',
        name: 'Warmpawz',
        description: `Meal plan: ${mealPlan.name || 'Order'}`,
        order_id: razorpayRes.razorpayOrderId,
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
        prefill: { contact: phone },
        theme: { color: '#FF8C42' },
        modal: { ondismiss: () => setSubmitting(false) },
      };
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
              <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-orange-100 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mealPlanImageUrl} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-6 h-6 text-orange-600" />
            </div>
            )}
            <div>
              <h2 className="font-semibold text-slate-900">{mealPlan.name || mealPlan.plan_name || 'Meal Plan'}</h2>
              <p className="text-sm text-slate-600 line-clamp-2">{mealPlan.description || ''}</p>
              {preview && (
                <p className="text-sm font-medium text-orange-600 mt-1">
                  ₹{preview.subtotal} × {quantity} = ₹{(preview.subtotal * quantity).toFixed(0)}
                </p>
              )}
            </div>
          </div>
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
              <div className="flex justify-between"><span>Subtotal</span><span>₹{preview.subtotal * quantity}</span></div>
              <div className="flex justify-between"><span>Delivery</span><span>₹{preview.deliveryFee}</span></div>
              <div className="flex justify-between"><span>Platform fee</span><span>₹{preview.platformFee}</span></div>
              <div className="flex justify-between font-semibold text-slate-900 pt-2 border-t">
                <span>Total</span><span>₹{preview.totalAmount}</span>
              </div>
            </div>
          </Card>
        )}

        <Button
          type="submit"
          className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E]"
          disabled={submitting || !addressId || !scheduledDate || !scheduledTime || (pets.length > 0 && !petId)}
        >
          {submitting ? 'Opening payment...' : `Pay ₹${preview?.totalAmount ?? 0}`}
        </Button>
      </form>
    </div>
  );
}
