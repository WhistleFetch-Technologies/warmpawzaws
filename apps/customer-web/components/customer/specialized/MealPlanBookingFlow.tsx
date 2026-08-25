'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { fetchCheckoutEmailForPrefill } from '@/lib/razorpay/build-standard-checkout-options';
import { openStandardRazorpayCheckout } from '@/lib/razorpay/open-standard-razorpay-checkout';
import { Utensils, Calendar, MapPin, Package, ArrowLeft, Key, Eye, EyeOff, Copy, Check, Phone, User, Truck, AlertCircle, CheckCircle } from 'lucide-react';
import { PolicyDisplay } from '../shared/PolicyDisplay';
import { toast } from 'sonner';
interface MealPlanBookingFlowProps {
  vendorId: string;
  customerPhone: string;
  onSuccess?: (orderId: string) => void;
  onCancel?: () => void;
}

interface MealPlan {
  id: string;
  name: string;
  description: string;
  pet_types: string[];
  duration_days: number;
  meals_per_day: number;
  price: number;
  is_active: boolean;
  mealImageUrl?: string | null;
}

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
}

interface Address {
  id: string;
  label: string;
  address: string;
  city: string;
  pincode: string;
}

export function MealPlanBookingFlow({ vendorId, customerPhone, onSuccess, onCancel }: MealPlanBookingFlowProps) {
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<string>('');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Order tracking state
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [showTracking, setShowTracking] = useState(false);
  const [deliveryOtp, setDeliveryOtp] = useState<string | null>(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [copiedOTP, setCopiedOTP] = useState(false);
  const [deliveryPartner, setDeliveryPartner] = useState<{ name?: string; phone?: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [vendorId, customerPhone]);

  // ✅ FIX GAP-9.1: Get customer location for 10km radius filter
  const [customerLocation, setCustomerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]); // ✅ FIX GAP-9.2: Meal plan filters

  useEffect(() => {
    // Get customer location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCustomerLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.warn('Geolocation error:', error);
        }
      );
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // ✅ FIX GAP-9.1: Build URL with maxRadius=10 and location
      let mealPlansUrl = `/vendor/${vendorId}/nutrition/meal-plans`;
      if (customerLocation) {
        mealPlansUrl += `?lat=${customerLocation.lat}&lng=${customerLocation.lng}&maxRadius=10`;
      }
      if (selectedFilters.length > 0) {
        mealPlansUrl += `${customerLocation ? '&' : '?'}filters=${selectedFilters.join(',')}`;
      }
      
      const [plansRes, customerRes] = await Promise.all([
        apiClient.get<any>(mealPlansUrl).catch(() => 
          apiClient.get<any>(`/vendor/${vendorId}/nutritionist/meal-plans`)
        ),
        apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`),
      ]);

      const plansList = plansRes?.mealPlans ?? plansRes?.plans;
      if (Array.isArray(plansList)) {
        setMealPlans(plansList);
      } else if (Array.isArray(plansRes)) {
        setMealPlans(plansRes);
      }

      if (customerRes.customer) {
        const customerId = customerRes.customer.id;
        const [petsRes, addressesRes] = await Promise.all([
          apiClient.get<any>(`/pets/customer/${customerId}`),
          apiClient.get<any>(`/addresses/customer/${customerId}`),
        ]);

        if (petsRes.pets || petsRes) {
          setPets(petsRes.pets || petsRes);
        }

        if (addressesRes.addresses || addressesRes) {
          setAddresses(addressesRes.addresses || addressesRes);
        }
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError('Failed to load meal plans');
    } finally {
      setLoading(false);
    }
  };

  // Load order tracking status
  const loadOrderTracking = async (orderIdToTrack: string) => {
    try {
      const res = await apiClient.get<any>(`/delivery/${orderIdToTrack}/status`);
      if (res.success || res.status) {
        setOrderStatus(res.status || res.delivery_status || 'pending');
        setDeliveryOtp(res.delivery_otp || res.deliveryOtp || res.otp || null);
        setOtpVerified(res.otp_verified || res.otpVerified || false);
        setDeliveryPartner({
          name: res.partner_name || res.partnerName,
          phone: res.partner_phone || res.partnerPhone,
        });
      }
    } catch (error) {
      console.error('Error loading order tracking:', error);
    }
  };

  // Copy OTP to clipboard
  const copyOTP = () => {
    if (deliveryOtp) {
      navigator.clipboard.writeText(deliveryOtp);
      setCopiedOTP(true);
      toast.success('OTP copied to clipboard');
      setTimeout(() => setCopiedOTP(false), 2000);
    }
  };

  // Check if order is out for delivery
  const isOutForDelivery = (status: string | null) => {
    if (!status) return false;
    return ['out_for_delivery', 'dispatched', 'in_transit', 'arriving', 'on_way', 'picked_up'].includes(status.toLowerCase());
  };

  // Poll for order status updates when tracking is shown
  useEffect(() => {
    if (showTracking && orderId) {
      loadOrderTracking(orderId);
      const interval = setInterval(() => loadOrderTracking(orderId), 15000); // Poll every 15 seconds
      return () => clearInterval(interval);
    }
  }, [showTracking, orderId]);

  const calculatePrice = (): number => {
    const plan = mealPlans.find(p => p.id === selectedPlan);
    if (!plan) return 0;
    return plan.price * quantity;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPlan) {
      setError('Please select a meal plan');
      return;
    }

    if (!selectedPet) {
      setError('Please select a pet');
      return;
    }

    if (!selectedAddress) {
      setError('Please select a delivery address');
      return;
    }

    if (!deliveryDate || !deliveryTime) {
      setError('Please select delivery date and time');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const customerResponse = await apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`);
      const customerId = customerResponse.customer?.id;

      if (!customerId) {
        throw new Error('Customer not found');
      }

      const plan = mealPlans.find(p => p.id === selectedPlan);
      const totalAmount = calculatePrice();

      const orderData = {
        vendorId,
        customerId,
        mealPlanId: selectedPlan,
        petId: selectedPet,
        addressId: selectedAddress,
        deliveryDate,
        deliveryTime,
        quantity,
        totalAmount,
        orderType: 'meal_plan_delivery',
      };

      const orderResponse = await apiClient.post<any>('/nutrition/delivery-orders', orderData);

      if (!orderResponse.success || !orderResponse.order) {
        throw new Error(orderResponse.error || 'Failed to create order');
      }

      const newOrderId = orderResponse.order.id || orderResponse.order_id;
      setOrderId(newOrderId);

      // Handle payment if amount > 0
      if (totalAmount > 0) {
        try {
          // Create Razorpay order
          const orderRes = await apiClient.post<any>('/payments/create-order', {
            order_id: orderId,
            amount: totalAmount,
            order_type: 'meal_plan',
          });

          if (!orderRes.order_id) {
            throw new Error('Failed to create payment order');
          }

          // Load Razorpay script if not loaded
          if (!window.Razorpay) {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            document.body.appendChild(script);
            await new Promise((resolve) => {
              script.onload = resolve;
            });
          }

          const checkoutEmail = await fetchCheckoutEmailForPrefill(customerPhone);
          await openStandardRazorpayCheckout({
            key: (orderRes.razorpay_key || process.env.NEXT_PUBLIC_RAZORPAY_KEY) as string,
            amountPaise: Math.max(1, Math.round(Number(totalAmount) * 100)),
            currency: 'INR',
            name: 'Warmpawz',
            description: `Meal Plan Order - ${plan?.name}`,
            order_id: orderRes.order_id,
            customerPhone,
            customerEmail: checkoutEmail,
            handler: async (response: any) => {
              try {
                // Verify payment
                await apiClient.post('/payments/verify', {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  order_id: newOrderId,
                  order_type: 'meal_plan',
                });

                // Show tracking after successful payment
                setShowTracking(true);
                loadOrderTracking(newOrderId);
                toast.success('Order placed successfully!');
                
                if (onSuccess) {
                  onSuccess(newOrderId);
                }
              } catch (err: any) {
                console.error('Payment verification failed:', err);
                setError('Payment verification failed. Please contact support.');
              }
            },
            theme: {
              color: '#FF8C42',
            },
            modal: {
              ondismiss: () => {
                setProcessing(false);
              },
            },
            onPaymentFailed: (err) => {
              setError(err.message);
              setProcessing(false);
            },
          });
        } catch (paymentErr: any) {
          console.error('Payment error:', paymentErr);
          setError(paymentErr.message || 'Payment failed. Please try again.');
          setProcessing(false);
        }
      } else {
        // Free order - no payment needed
        setShowTracking(true);
        loadOrderTracking(newOrderId);
        toast.success('Order placed successfully!');
        
        if (onSuccess) {
          onSuccess(newOrderId);
        }
      }
    } catch (err: any) {
      console.error('Error creating order:', err);
      setError(err.message || 'Failed to create order');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const selectedPlanData = mealPlans.find(p => p.id === selectedPlan);

  // Show tracking view after order is placed
  if (showTracking && orderId) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <button
          onClick={() => setShowTracking(false)}
          className="text-gray-600 hover:text-gray-900 mb-4 flex items-center gap-2"
        >
          <ArrowLeft size={20} />
          Back to Order Form
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Package className="text-orange-500" size={28} />
          Order Status
        </h2>

        {/* Order Status Card */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">Order ID</p>
              <p className="font-semibold text-gray-900">#{orderId.slice(-8)}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              orderStatus === 'delivered' ? 'bg-green-100 text-green-800' :
              isOutForDelivery(orderStatus) ? 'bg-orange-100 text-orange-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {orderStatus?.replace('_', ' ').toUpperCase() || 'PENDING'}
            </span>
          </div>

          {/* Status Timeline */}
          <div className="space-y-3">
            {['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'].map((step, idx) => {
              const stepOrder = ['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];
              const currentIdx = stepOrder.indexOf(orderStatus || 'placed');
              const isCompleted = idx <= currentIdx;
              const isCurrent = idx === currentIdx;
              
              return (
                <div key={step} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isCompleted ? 'bg-green-100 text-green-600' :
                    isCurrent ? 'bg-orange-500 text-white' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {isCompleted ? <Check size={16} /> : <span className="text-xs">{idx + 1}</span>}
                  </div>
                  <span className={isCompleted ? 'text-gray-900 font-medium' : 'text-gray-500'}>
                    {step.replace('_', ' ').charAt(0).toUpperCase() + step.replace('_', ' ').slice(1)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Delivery OTP Section - Show when out for delivery */}
        {isOutForDelivery(orderStatus) && deliveryOtp && !otpVerified && (
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-6 shadow-sm mb-4 border-2 border-orange-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Key className="w-6 h-6 text-orange-600" />
                <h3 className="text-lg font-bold text-orange-800">Your Delivery OTP</h3>
              </div>
              {deliveryPartner?.name && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <User className="w-4 h-4" />
                    <span>{deliveryPartner.name}</span>
                  </div>
                  {deliveryPartner.phone && (
                    <button
                      onClick={() => window.location.href = `tel:${deliveryPartner.phone}`}
                      className="p-2 bg-orange-100 rounded-full hover:bg-orange-200 transition"
                    >
                      <Phone className="w-4 h-4 text-orange-600" />
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {/* OTP Display */}
            <div className="flex justify-center gap-3 mb-4">
              {deliveryOtp.split('').map((digit, idx) => (
                <div
                  key={idx}
                  className="w-14 h-16 bg-white rounded-xl shadow-sm border-2 border-orange-300 flex items-center justify-center"
                >
                  <span className="text-3xl font-bold text-orange-600">
                    {showOTP ? digit : '•'}
                  </span>
                </div>
              ))}
            </div>
            
            {/* OTP Actions */}
            <div className="flex justify-center gap-4 mb-4">
              <button
                onClick={() => setShowOTP(!showOTP)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-orange-300 rounded-lg text-orange-700 hover:bg-orange-50 transition font-medium"
              >
                {showOTP ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    Hide OTP
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Show OTP
                  </>
                )}
              </button>
              <button
                onClick={copyOTP}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-orange-300 rounded-lg text-orange-700 hover:bg-orange-50 transition font-medium"
              >
                {copiedOTP ? (
                  <>
                    <Check className="w-4 h-4 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy OTP
                  </>
                )}
              </button>
            </div>
            
            {/* Instructions */}
            <div className="flex items-start gap-2 text-sm text-orange-700 bg-orange-100/50 rounded-lg p-3">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <p>Share this OTP with the delivery partner <strong>only after receiving your meal plan</strong>. This confirms delivery.</p>
            </div>
          </div>
        )}

        {/* Delivery Confirmed */}
        {otpVerified && orderStatus === 'delivered' && (
          <div className="bg-green-50 rounded-xl p-6 shadow-sm mb-4 border border-green-200 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-green-800 mb-1">Delivery Confirmed!</h3>
            <p className="text-green-600">Your meal plan has been delivered successfully.</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
          <button
            onClick={() => loadOrderTracking(orderId)}
            className="flex-1 px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600"
          >
            Refresh Status
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Utensils className="text-orange-500" size={28} />
        Order Meal Plan
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ✅ FIX GAP-9.1: 10KM Max Radius Filter Badge */}
        {customerLocation && (
          <div className="bg-teal-100 text-teal-700 rounded-full px-3 py-1 text-sm font-medium w-fit mb-4">
            Within 10km radius
          </div>
        )}

        {/* ✅ FIX GAP-9.2: Meal Plan Filtering Widgets */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3">Filter Plans</h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { id: 'weight_management', label: 'Weight Management', color: 'bg-purple-100 text-purple-700' },
              { id: 'daily_nutrition', label: 'Daily Nutrition', color: 'bg-green-100 text-green-700' },
              { id: 'fresh_food', label: 'Fresh Food', color: 'bg-blue-100 text-blue-700' },
              { id: 'frozen_food', label: 'Frozen Food', color: 'bg-gray-100 text-gray-700' },
            ].map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => {
                  setSelectedFilters(prev =>
                    prev.includes(filter.id)
                      ? prev.filter(f => f !== filter.id)
                      : [...prev, filter.id]
                  );
                  // Reload data with new filters
                  setTimeout(() => loadData(), 100);
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedFilters.includes(filter.id)
                    ? filter.color + ' ring-2 ring-offset-2 ring-[#FF8C42]'
                    : filter.color + ' opacity-60 hover:opacity-100'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Meal Plan Selection */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Select Meal Plan</h3>
          {mealPlans.length === 0 ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
              No meal plans available {customerLocation ? 'within 10km radius' : ''}
            </div>
          ) : (
            <div className="space-y-3">
              {mealPlans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`w-full p-4 text-left border-2 rounded-lg transition ${
                    selectedPlan === plan.id
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {plan.mealImageUrl ? (
                      <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-gray-100 bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={plan.mealImageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900">{plan.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>{plan.duration_days} days</span>
                        <span>{plan.meals_per_day} meals/day</span>
                        <span className="flex flex-wrap gap-1">
                          {plan.pet_types.map((type) => (
                            <span key={type} className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                              {type}
                            </span>
                          ))}
                        </span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-lg font-bold text-orange-600">₹{plan.price}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pet Selection */}
        {selectedPlan && (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Select Pet</h3>
            {pets.length === 0 ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
                No pets found. Please add a pet first.
              </div>
            ) : (
              <select
                value={selectedPet}
                onChange={(e) => setSelectedPet(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              >
                <option value="">Select a pet</option>
                {pets
                  .filter(pet => selectedPlanData?.pet_types.includes(pet.species))
                  .map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name} ({pet.species} - {pet.breed})
                    </option>
                  ))}
              </select>
            )}
          </div>
        )}

        {/* Delivery Address */}
        {selectedPet && (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Delivery Address</h3>
            {addresses.length === 0 ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
                No addresses found. Please add an address first.
              </div>
            ) : (
              <select
                value={selectedAddress}
                onChange={(e) => setSelectedAddress(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              >
                <option value="">Select delivery address</option>
                {addresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.label} - {address.address}, {address.city} {address.pincode}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Delivery Date & Time */}
        {selectedAddress && (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Delivery Date & Time</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="inline mr-2" size={16} />
                  Date *
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="inline mr-2" size={16} />
                  Time *
                </label>
                <input
                  type="time"
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
        )}

        {/* Price Summary */}
        {selectedPlan && selectedPet && selectedAddress && deliveryDate && deliveryTime && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">Order Summary</p>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedPlanData?.name} × {quantity}
                </p>
                <p className="text-sm text-gray-600">
                  Delivery: {deliveryDate} at {deliveryTime}
                </p>
              </div>
              <p className="text-2xl font-bold text-orange-600">₹{calculatePrice()}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* ✅ ENRICHED: Policy Display */}
        <PolicyDisplay 
          serviceType="nutrition" 
          showPolicies={['delivery', 'cancellation', 'refund', 'tax']}
        />

        {/* Actions */}
        <div className="flex gap-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={processing || !selectedPlan || !selectedPet || !selectedAddress || !deliveryDate || !deliveryTime}
            className="flex-1 px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {processing ? 'Processing...' : `Place Order - ₹${calculatePrice()}`}
          </button>
        </div>
      </form>
    </div>
  );
}

