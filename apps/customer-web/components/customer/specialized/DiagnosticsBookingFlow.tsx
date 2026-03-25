'use client';

import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { TestTube, Calendar, Clock, FileText, Truck, CreditCard, Home, Building2, MapPin, CheckCircle2, Plus } from 'lucide-react';
import { ServiceDashboardHeader } from '../shared/ServiceDashboardHeader';
import { AddAddressModal } from '../shared/AddAddressModal';
import { toast } from 'sonner';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface DiagnosticsBookingFlowProps {
  vendorId: string;
  customerPhone: string;
  onSuccess?: (bookingId: string) => void;
  onCancel?: () => void;
  onBack?: () => void;
}

interface DiagnosticTest {
  id: string;
  test_name: string;
  test_code?: string;
  category: string;
  description?: string;
  price: number;
  duration_minutes: number;
  sample_type?: string;
  preparation_instructions?: string;
  is_available: boolean;
  is_free_home_collection?: boolean;
  home_collection_fee?: number;
}

export function DiagnosticsBookingFlow({ vendorId, customerPhone, onSuccess, onCancel, onBack }: DiagnosticsBookingFlowProps) {
  const [tests, setTests] = useState<DiagnosticTest[]>([]);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  
  // Booking details
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [selectedPetId, setSelectedPetId] = useState<string>('');
  const [customerPets, setCustomerPets] = useState<{ id: string; name: string; species?: string; breed?: string; age?: string }[]>([]);
  const [address, setAddress] = useState('');
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [preferredSampleType, setPreferredSampleType] = useState<'home' | 'center'>('center');

  // Payment-before-booking: step 'form' | 'payment'; booking is created only after payment success
  const [step, setStep] = useState<'form' | 'payment'>('form');
  const [pendingBookingPayload, setPendingBookingPayload] = useState<Record<string, unknown> | null>(null);
  const pendingPayloadRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    loadTests();
  }, [vendorId]);

  // Load customer pets for optional "Link to pet" (so vendor sees full pet info)
  useEffect(() => {
    if (!customerPhone) return;
    let cancelled = false;
    (async () => {
      try {
        const cust = await apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`);
        const customerId = cust.customer?.id;
        if (!customerId) return;
        const petsRes = await apiClient.get<any>(`/customer/${customerId}/pets`);
        const list = (petsRes.pets ?? petsRes.data ?? []).filter(Boolean);
        if (!cancelled) setCustomerPets(list.map((p: any) => ({ id: p.id, name: p.name || p.pet_name, species: p.species || p.type, breed: p.breed, age: (p.age || p.age_years?.[0]) ?? p.age_years })));
      } catch {
        if (!cancelled) setCustomerPets([]);
      }
    })();
    return () => { cancelled = true; };
  }, [customerPhone]);

  // Load customer addresses for home collection
  useEffect(() => {
    if (!customerPhone) return;
    let cancelled = false;
    (async () => {
      try {
        const addressResponse = await apiClient.get<any>(`/customer/addresses?phone=${encodeURIComponent(customerPhone)}`);
        if (addressResponse?.addresses && Array.isArray(addressResponse.addresses)) {
          if (!cancelled) {
            setAddresses(addressResponse.addresses);
            // Auto-select default address if available
            const defaultAddr = addressResponse.addresses.find((a: any) => a.isDefault || a.is_default);
            if (defaultAddr) {
              setSelectedAddress(defaultAddr);
              const formattedAddr = defaultAddr.formattedAddress || 
                `${defaultAddr.addressLine1 || defaultAddr.address || ''}, ${defaultAddr.city || ''}, ${defaultAddr.pincode || ''}`.trim();
              setAddress(formattedAddr);
            } else if (addressResponse.addresses.length === 1) {
              // Auto-select if only one address
              const addr = addressResponse.addresses[0];
              setSelectedAddress(addr);
              const formattedAddr = addr.formattedAddress || 
                `${addr.addressLine1 || addr.address || ''}, ${addr.city || ''}, ${addr.pincode || ''}`.trim();
              setAddress(formattedAddr);
            }
          }
        }
      } catch (error) {
        console.error('Error loading addresses:', error);
        if (!cancelled) setAddresses([]);
      }
    })();
    return () => { cancelled = true; };
  }, [customerPhone]);

  const loadTests = async () => {
    try {
      setLoading(true);
      // publishedOnly=true: only tests with is_available=true (published) for booking
      const response = await apiClient.get<any>(`/vendor/${vendorId}/diagnostics/tests?publishedOnly=true`);
      
      if (response.success && response.tests) {
        setTests(response.tests);
      }
    } catch (err: any) {
      console.error('Error loading tests:', err);
      setError('Failed to load diagnostic tests');
    } finally {
      setLoading(false);
    }
  };

  const toggleTest = (testId: string) => {
    setSelectedTests(prev => 
      prev.includes(testId) 
        ? prev.filter(id => id !== testId)
        : [...prev, testId]
    );
  };

  const getTotalPrice = (): number => {
    let total = selectedTests.reduce((sum, testId) => {
      const test = tests.find(t => t.id === testId);
      const price = Number(test?.price) || 0;
      return sum + price;
    }, 0);
    // Add home collection fee when customer selects home collection (one fee per visit - use max among selected tests)
    if (preferredSampleType === 'home') {
      const homeFees = selectedTests
        .map(id => tests.find(t => t.id === id))
        .filter((t): t is DiagnosticTest => !!t && t.is_free_home_collection === false && (Number(t.home_collection_fee) ?? 0) > 0)
        .map(t => Number(t.home_collection_fee) ?? 0);
      if (homeFees.length > 0) {
        total += Math.max(...homeFees);
      }
    }
    return total;
  };

  const getCategories = () => {
    const categories = new Set(tests.map(t => t.category).filter(Boolean));
    return Array.from(categories);
  };

  const filteredTests = tests.filter(test => {
    const matchesSearch = test.test_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         test.test_code?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || test.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Build booking payload (used for payment step and for create-after-payment)
  const buildBookingPayload = async (): Promise<{ payload: Record<string, unknown>; customerId: string }> => {
    const customerResponse = await apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`);
    const customerId = customerResponse.customer?.id;
    if (!customerId) {
      throw new Error('Customer not found');
    }
    const selectedTestDetails = selectedTests.map(id => tests.find(t => t.id === id)).filter(Boolean);
    const totalAmountNum = Number(getTotalPrice());
    const payload: Record<string, unknown> = {
      serviceId: 'diagnostics',
      vendorId,
      customerId,
      serviceType: preferredSampleType === 'home' ? 'at_home' : 'at_center',
      bookingType: 'scheduled',
      bookingDate: selectedDate,
      bookingTime: selectedTime,
      address: preferredSampleType === 'home' 
        ? (selectedAddress?.formattedAddress || 
           `${selectedAddress?.addressLine1 || selectedAddress?.address || ''}, ${selectedAddress?.city || ''}, ${selectedAddress?.pincode || ''}`.trim() || 
           address) 
        : undefined,
      amount: totalAmountNum,
      notes: JSON.stringify({
        tests: selectedTestDetails.map(t => ({
          id: t?.id,
          name: t?.test_name,
          code: t?.test_code,
          category: t?.category,
          price: t?.price,
          is_free_home_collection: t?.is_free_home_collection,
          home_collection_fee: t?.home_collection_fee,
        })),
        patientName,
        patientAge,
        preferredSampleType,
        ...(selectedPetId ? { petId: selectedPetId } : {}),
        homeCollectionFee: preferredSampleType === 'home' ? totalAmountNum - selectedTestDetails.reduce((s, t) => s + (Number(t?.price) ?? 0), 0) : 0,
        preparationInstructions: selectedTestDetails.map(t => t?.preparation_instructions).filter(Boolean),
      }),
      totalAmount: totalAmountNum,
    };
    if (selectedPetId) payload.petId = selectedPetId;
    return { payload, customerId };
  };

  // Form submit: go to payment step (do NOT create booking yet)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedTests.length === 0) {
      setError('Please select at least one test');
      return;
    }
    if (!selectedDate || !selectedTime) {
      setError('Please select date and time');
      return;
    }
    if (!patientName.trim()) {
      setError('Patient name is required');
      return;
    }
    if (preferredSampleType === 'home' && !selectedAddress && !address.trim()) {
      setError('Please select or enter a home address for collection');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const { payload, customerId } = await buildBookingPayload();
      setPendingBookingPayload(payload);
      pendingPayloadRef.current = payload;
      setStep('payment');
    } catch (err: any) {
      console.error('Error preparing payment:', err);
      setError(err.message || 'Failed to proceed');
    } finally {
      setProcessing(false);
    }
  };

  // Load Razorpay checkout script (required before opening checkout)
  const loadRazorpayScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Window not available'));
        return;
      }
      if (window.Razorpay) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay'));
      document.body.appendChild(script);
    });
  };

  // Preload Razorpay when user reaches payment step so Pay button works immediately
  useEffect(() => {
    if (step === 'payment' && typeof window !== 'undefined' && !window.Razorpay) {
      loadRazorpayScript().catch(() => {});
    }
  }, [step]);

  // Payment step: create Razorpay order (no booking yet), then on success create booking
  const handlePayNow = async () => {
    if (!pendingBookingPayload || !pendingPayloadRef.current) {
      setError('Booking details missing. Please go back and try again.');
      return;
    }

    const payload = pendingPayloadRef.current;
    const customerId = payload.customerId as string;
    const amount = Number(payload.amount ?? payload.totalAmount ?? 0);
    if (!customerId || amount <= 0) {
      setError('Invalid booking details.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const orderRes = await apiClient.post<any>('/razorpay/create-order', {
        type: 'diagnostics',
        amount,
        customerId,
        vendorId,
      }, undefined, 45000);

      const orderId = orderRes?.orderId ?? orderRes?.data?.orderId;
      const keyId = orderRes?.keyId ?? orderRes?.data?.keyId;
      if (!orderId) {
        throw new Error('Failed to create payment order');
      }

      const options = {
        key: keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY,
        amount: amount * 100,
        currency: 'INR',
        name: 'Warmpawz',
        description: 'Diagnostic tests booking',
        order_id: orderId,
        handler: async (response: any) => {
          try {
            // Verify payment with retry
            const MAX_RETRIES = 3;
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
              try {
                await apiClient.post('/razorpay/verify-payment', {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }, undefined, 30000);
                break;
              } catch (verifyErr: any) {
                console.error(`[VERIFY] Attempt ${attempt}/${MAX_RETRIES} failed:`, verifyErr?.message);
                if (attempt === MAX_RETRIES) throw verifyErr;
                await new Promise((r) => setTimeout(r, attempt * 1000));
              }
            }

            const createPayload = { ...pendingPayloadRef.current };
            let bookingResponse: any;
            try {
              bookingResponse = await apiClient.post<any>('/bookings/create', createPayload);
            } catch (createErr: any) {
              const statusCode = createErr?.statusCode ?? createErr?.status;
              const apiMessage =
                (typeof createErr?.response === 'object' && createErr.response?.error != null)
                  ? (typeof createErr.response.error === 'string' ? createErr.response.error : createErr.response.error?.message)
                  : createErr?.message;
              const message = apiMessage || (statusCode === 409 ? 'This time slot is already booked. Please select a different date or time.' : 'Failed to create booking.');
              setError(message);
              toast.error(message);
              setProcessing(false);
              return;
            }

            const bookingId =
              bookingResponse?.data?.bookingId ??
              bookingResponse?.bookingId ??
              bookingResponse?.booking?.id;
            if (bookingResponse?.success && bookingId) {
              toast.success('Payment successful! Booking confirmed.');
              if (onSuccess) onSuccess(bookingId);
            } else {
              const msg = (typeof bookingResponse?.error === 'string' ? bookingResponse.error : bookingResponse?.error?.message) ?? 'Failed to create booking';
              setError(msg);
              toast.error(msg);
            }
          } catch (err: any) {
            console.error('Payment verify or booking create failed:', err);
            const msg = err?.message || 'Payment verified but booking failed. Please contact support.';
            setError(msg);
            toast.error(msg);
          } finally {
            setProcessing(false);
          }
        },
        prefill: { contact: customerPhone },
        theme: { color: '#FF8C42' },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            toast.info('Payment cancelled');
          },
        },
      };

      if (!window.Razorpay) {
        await loadRazorpayScript();
      }
      if (window.Razorpay) {
        const razorpay = new window.Razorpay(options);
        razorpay.open();
      } else {
        throw new Error('Payment gateway not loaded');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err?.message || 'Failed to start payment');
      toast.error(err?.message || 'Failed to start payment');
    } finally {
      setProcessing(false);
    }
  };

  // Prepare stats for ServiceDashboardHeader
  const dashboardStats = [
    { value: `${tests.length}+`, label: 'Tests' },
    { value: '1K+', label: 'Bookings' },
    { value: '*4.7', label: 'Rating' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
        {onBack && (
          <ServiceDashboardHeader
            serviceName="Diagnostic Labs"
            serviceSubtitle="Lab tests & diagnostics"
            serviceIcon={TestTube}
            iconColor="text-white"
            stats={dashboardStats}
            onBack={onBack}
            showBackButton={true}
            headerColor="bg-[#FF8C42]"
          />
        )}
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-3"></div>
            <p className="text-gray-600">Loading diagnostic tests...</p>
          </div>
        </div>
      </div>
    );
  }

  // Payment step: show order summary and Pay button (booking created only after payment success)
  if (step === 'payment') {
    const total = getTotalPrice();
    return (
      <div className="min-h-screen bg-gray-50">
        {onBack && (
          <ServiceDashboardHeader
            serviceName="Diagnostic Labs"
            serviceSubtitle="Lab tests & diagnostics"
            serviceIcon={TestTube}
            iconColor="text-white"
            stats={dashboardStats}
            onBack={onBack}
            showBackButton={true}
            headerColor="bg-[#FF8C42]"
          />
        )}
        <div className="max-w-md mx-auto px-4 pb-24">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 mt-4">Payment</h2>
          <p className="text-gray-600 mb-4">
            Complete payment to confirm your diagnostic tests. Booking and time slot will be reserved only after successful payment.
          </p>
          <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
            <p className="font-semibold text-gray-900">{selectedTests.length} test(s) selected</p>
            <p className="text-sm text-gray-600 mt-1">
              {selectedTests.map(id => tests.find(t => t.id === id)?.test_name).filter(Boolean).join(', ')}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {selectedDate} • {selectedTime} • {preferredSampleType === 'home' ? 'Home collection' : 'At center'}
            </p>
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="text-xl font-bold text-orange-600">₹{total}</span>
            </div>
          </div>
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-4">
              {error}
              <p className="text-sm mt-2 text-red-600">Change date & time below and pay again to retry.</p>
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setStep('form'); setError(null); setPendingBookingPayload(null); pendingPayloadRef.current = null; }}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              {error ? 'Change date & time' : 'Back'}
            </button>
            <button
              type="button"
              onClick={handlePayNow}
              disabled={processing}
              className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Pay ₹{total}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ✅ FIX: Use ServiceDashboardHeader to match vet service UI frame */}
      {onBack && (
        <ServiceDashboardHeader
          serviceName="Diagnostic Labs"
          serviceSubtitle="Lab tests & diagnostics"
          serviceIcon={TestTube}
          iconColor="text-white"
          stats={dashboardStats}
          onBack={onBack}
          showBackButton={true}
          headerColor="bg-[#FF8C42]"
        />
      )}
      
      <div className="max-w-md mx-auto px-4 pb-24">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 mt-4">Book Diagnostic Tests</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
        {/* Search and Filter */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              placeholder="Search tests..."
              className="flex-1 px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <select
              value={categoryFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCategoryFilter(e.target.value)}
              className="px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">All Categories</option>
              {getCategories().map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Test Selection */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900">Select Tests ({selectedTests.length} selected)</h3>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {filteredTests.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No tests found
              </div>
            ) : (
              filteredTests.map((test) => (
                <label
                  key={test.id}
                  className={`p-4 flex items-start gap-4 cursor-pointer hover:bg-gray-50 ${
                    selectedTests.includes(test.id) ? 'bg-orange-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTests.includes(test.id)}
                    onChange={() => toggleTest(test.id)}
                    className="mt-0 w-5 h-5 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <TestTube className="text-orange-500" size={18} />
                          <span className="font-semibold text-gray-900">{test.test_name}</span>
                          {test.test_code && (
                            <span className="px-0 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                              {test.test_code}
                            </span>
                          )}
                        </div>
                        {test.category && (
                          <span className="text-sm text-gray-500 mt-0 block">{test.category}</span>
                        )}
                        {test.description && (
                          <p className="text-sm text-gray-600 mt-0">{test.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-0 text-sm text-gray-500">
                          {test.sample_type && (
                            <span>Sample: {test.sample_type}</span>
                          )}
                          {test.duration_minutes && (
                            <span className="flex items-center gap-3">
                              <Clock size={14} />
                              {test.duration_minutes} min
                            </span>
                          )}
                        </div>
                        {test.preparation_instructions && (
                          <div className="mt-0 p-0 bg-blue-50 rounded text-xs text-blue-700">
                            <FileText size={12} className="inline mr-2" />
                            {test.preparation_instructions}
                          </div>
                        )}
                        {preferredSampleType === 'home' && test.is_free_home_collection !== undefined && (
                          <div className="flex items-center gap-1 mt-1 text-xs">
                            <Truck size={12} />
                            {test.is_free_home_collection
                              ? <span className="text-green-600">Free home collection</span>
                              : <span className="text-gray-600">Home: +₹{test.home_collection_fee ?? 0}</span>}
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-lg font-bold text-orange-600">₹{test.price}</p>
                        {preferredSampleType === 'home' && !test.is_free_home_collection && (test.home_collection_fee ?? 0) > 0 && (
                          <p className="text-xs text-gray-500">+₹{test.home_collection_fee} home</p>
                        )}
                      </div>
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Selected Tests Summary */}
        {selectedTests.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div>
              <p className="font-semibold text-gray-900">{selectedTests.length} test(s) selected</p>
              <p className="text-sm text-gray-600 mt-0">
                {selectedTests.map(id => tests.find(t => t.id === id)?.test_name).filter(Boolean).join(', ')}
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-orange-200 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Tests total</span>
                <span>₹{selectedTests.reduce((s, id) => s + (tests.find(t => t.id === id)?.price || 0), 0)}</span>
              </div>
              {preferredSampleType === 'home' && (() => {
                const homeFees = selectedTests
                  .map(id => tests.find(t => t.id === id))
                  .filter((t): t is DiagnosticTest => !!t && t.is_free_home_collection === false && (t.home_collection_fee ?? 0) > 0)
                  .map(t => t.home_collection_fee ?? 0);
                const homeFee = homeFees.length > 0 ? Math.max(...homeFees) : 0;
                return homeFee > 0 ? (
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1"><Truck className="h-4 w-4" /> Home collection fee</span>
                    <span>₹{homeFee}</span>
                  </div>
                ) : homeFees.length === 0 ? (
                  <div className="flex justify-between text-sm text-green-600">
                    <span className="flex items-center gap-1"><Truck className="h-4 w-4" /> Home collection</span>
                    <span>Free</span>
                  </div>
                ) : null;
              })()}
            </div>
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-orange-200">
              <span className="font-semibold">Total</span>
              <p className="text-xl font-bold text-orange-600">₹{getTotalPrice()}</p>
            </div>
          </div>
        )}

        {/* Patient Details */}
        <div className="bg-white rounded-xl p-1 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900 mb-4">Patient Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Patient Name *
              </label>
              <input
                type="text"
                value={patientName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPatientName(e.target.value)}
                required
                className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Age
              </label>
              <input
                type="number"
                value={patientAge}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPatientAge(e.target.value)}
                className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>

          {/* Optional: Link to pet so vendor sees full pet profile */}
          {customerPets.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Link to my pet (optional)
              </label>
              <select
                value={selectedPetId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedPetId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">No pet linked</option>
                {customerPets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.species ? ` (${p.species})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Linking a pet helps the diagnostic center see breed and history.</p>
            </div>
          )}

          {/* Sample Collection Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sample Collection
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPreferredSampleType('center')}
                className={`px-4 py-3 rounded-lg border-2 transition ${
                  preferredSampleType === 'center'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                At Center
              </button>
              <button
                type="button"
                onClick={() => setPreferredSampleType('home')}
                className={`px-4 py-3 rounded-lg border-2 transition ${
                  preferredSampleType === 'home'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                Home Collection
              </button>
            </div>
            {preferredSampleType === 'home' && selectedTests.length > 0 && (
              <p className="text-xs text-gray-600 mt-2">
                {(() => {
                  const hasCharged = selectedTests.some(id => {
                    const t = tests.find(x => x.id === id);
                    return t && !t.is_free_home_collection && (t.home_collection_fee ?? 0) > 0;
                  });
                  return hasCharged
                    ? `Home collection fee will be added based on selected tests`
                    : `Free home collection for selected tests`;
                })()}
              </p>
            )}
          </div>

          {preferredSampleType === 'home' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Home Address *
              </label>
              {addresses.length > 0 ? (
                <div className="space-y-3">
                  {addresses.map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => {
                        setSelectedAddress(addr);
                        const formattedAddr = addr.formattedAddress || 
                          `${addr.addressLine1 || addr.address || ''}, ${addr.city || ''}, ${addr.pincode || ''}`.trim();
                        setAddress(formattedAddr);
                      }}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                        selectedAddress?.id === addr.id 
                          ? 'border-[#FF8C42] bg-orange-50' 
                          : 'border-gray-200 bg-white hover:border-[#FF8C42]/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                          {(addr.label || '').toLowerCase() === 'home' ? (
                            <Home className="w-4 h-4 text-blue-600" />
                          ) : (addr.label || '').toLowerCase() === 'work' ? (
                            <Building2 className="w-4 h-4 text-blue-600" />
                          ) : (
                            <MapPin className="w-4 h-4 text-blue-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{addr.label || 'Address'}</h3>
                            {addr.isDefault && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Default</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{addr.addressLine1 || addr.address}</p>
                          <p className="text-sm text-gray-500">{addr.city} - {addr.pincode}</p>
                          {addr.landmark && <p className="text-xs text-gray-400">Near: {addr.landmark}</p>}
                        </div>
                        {selectedAddress?.id === addr.id && (
                          <CheckCircle2 className="w-6 h-6 text-orange-500" />
                        )}
                      </div>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowAddAddressModal(true)}
                    className="w-full p-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-[#FF8C42] hover:text-[#FF8C42] transition flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Address
                  </button>
                </div>
              ) : (
                <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                  <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                    <MapPin className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-medium mb-2">No addresses saved</p>
                  <p className="text-sm text-gray-500 mb-4">Add an address to continue with home collection</p>
                  <button
                    type="button"
                    onClick={() => setShowAddAddressModal(true)}
                    className="px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition"
                  >
                    + Add Your Address
                  </button>
                </div>
              )}
              {/* Show selected address confirmation */}
              {selectedAddress && addresses.length > 0 && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800 font-medium">
                    ✓ Home collection will be at: {selectedAddress?.label || 'Selected Address'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Date and Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                <Calendar className="inline mr-2" size={16} />
                Preferred Date *
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
                className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                <Clock className="inline mr-2" size={16} />
                Preferred Time *
              </label>
              <input
                type="time"
                value={selectedTime}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedTime(e.target.value)}
                required
                className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-0 py-0 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={processing || selectedTests.length === 0}
            className="flex-1 px-0 py-0 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {processing ? 'Preparing...' : `Continue to Payment - ₹${getTotalPrice()}`}
          </button>
        </div>
      </form>
      </div>

      {/* Add Address Modal */}
      <AddAddressModal
        phone={customerPhone}
        isOpen={showAddAddressModal}
        onClose={() => setShowAddAddressModal(false)}
        onSuccess={(savedAddress) => {
          setShowAddAddressModal(false);
          if (savedAddress) {
            setSelectedAddress(savedAddress);
            const formattedAddr = savedAddress.formattedAddress || 
              `${savedAddress.addressLine1 || savedAddress.address || ''}, ${savedAddress.city || ''}, ${savedAddress.pincode || ''}`.trim();
            setAddress(formattedAddr);
            // Refresh addresses list
            (async () => {
              try {
                const addressResponse = await apiClient.get<any>(`/customer/addresses?phone=${encodeURIComponent(customerPhone)}`);
                if (addressResponse?.addresses && Array.isArray(addressResponse.addresses)) {
                  setAddresses(addressResponse.addresses);
                }
              } catch (error) {
                console.error('Error refreshing addresses:', error);
              }
            })();
          }
        }}
      />
    </div>
  );
}

