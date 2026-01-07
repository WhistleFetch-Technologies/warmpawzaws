'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Utensils, Calendar, MapPin, Package } from 'lucide-react';

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

  useEffect(() => {
    loadData();
  }, [vendorId, customerPhone]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansRes, customerRes] = await Promise.all([
        apiClient.get<any>(`/vendor/${vendorId}/nutrition/meal-plans`).catch(() => 
          apiClient.get<any>(`/vendor/${vendorId}/nutritionist/meal-plans`)
        ),
        apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`),
      ]);

      if (plansRes.plans || plansRes) {
        setMealPlans(plansRes.plans || plansRes);
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

      const orderId = orderResponse.order.id || orderResponse.order_id;

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

          // Open Razorpay checkout
          const options = {
            key: orderRes.razorpay_key || process.env.NEXT_PUBLIC_RAZORPAY_KEY,
            amount: totalAmount * 100,
            currency: 'INR',
            name: 'Warmpawz',
            description: `Meal Plan Order - ${plan?.name}`,
            order_id: orderRes.order_id,
            handler: async (response: any) => {
              try {
                // Verify payment
                await apiClient.post('/payments/verify', {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  order_id: orderId,
                  order_type: 'meal_plan',
                });

                if (onSuccess) {
                  onSuccess(orderId);
                }
              } catch (err: any) {
                console.error('Payment verification failed:', err);
                setError('Payment verification failed. Please contact support.');
              }
            },
            prefill: {
              contact: customerPhone,
            },
            theme: {
              color: '#FF8C42',
            },
            modal: {
              ondismiss: () => {
                setProcessing(false);
              },
            },
          };

          const razorpay = new (window as any).Razorpay(options);
          razorpay.open();
        } catch (paymentErr: any) {
          console.error('Payment error:', paymentErr);
          setError(paymentErr.message || 'Payment failed. Please try again.');
          setProcessing(false);
        }
      } else {
        // Free order - no payment needed
        if (onSuccess) {
          onSuccess(orderId);
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

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Utensils className="text-orange-500" size={28} />
        Order Meal Plan
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Meal Plan Selection */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Select Meal Plan</h3>
          {mealPlans.length === 0 ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
              No meal plans available
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
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
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

