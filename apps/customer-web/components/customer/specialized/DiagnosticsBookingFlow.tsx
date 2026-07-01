'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { formatCustomerApiFailure } from '@/lib/format-customer-api-failure';
import { isLegacyMockDiagnosticVendorId } from '@/lib/diagnostics-vendor-id';
import { TestTube, Calendar, Clock, FileText, Truck, Home, Building2, MapPin, CheckCircle2, Plus } from 'lucide-react';
import { ServiceDashboardHeader } from '../shared/ServiceDashboardHeader';
import { EMPTY_SERVICE_HEADER_STATS } from '@/lib/service-header-stats';
import { AddAddressModal } from '../shared/AddAddressModal';
import { UniversalPaymentPage } from '../payment/UniversalPaymentPage';
import { toast } from 'sonner';
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';

const inputClassName =
  'w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500';

export interface DiagnosticsPackageHint {
  /** Package display name (e.g. from Health Packages carousel) */
  name?: string;
  /** Short labels or codes shown on package cards (e.g. CBC, LFT) — used to pre-select matching catalog tests */
  testLabels?: string[];
}

interface DiagnosticsBookingFlowProps {
  vendorId: string;
  customerPhone: string;
  /** When set (e.g. user tapped Book on a health package), we try to pre-select matching published tests */
  packageHint?: DiagnosticsPackageHint | null;
  onSuccess?: (bookingId: string) => void;
  onCancel?: () => void;
  onBack?: () => void;
  /** Expose wizard back (payment step → form step) to parent hardware-back handler. */
  onInternalBackReady?: (handleBack: () => void) => void;
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

export function DiagnosticsBookingFlow({ vendorId, customerPhone, packageHint, onSuccess, onCancel, onBack, onInternalBackReady }: DiagnosticsBookingFlowProps) {
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
  const [vendorName, setVendorName] = useState('Diagnostic Lab');
  const [resolvedCustomerId, setResolvedCustomerId] = useState<string | undefined>();

  // Payment-before-booking: step 'form' | 'payment'; booking is created only after payment success
  const [step, setStep] = useState<'form' | 'payment'>('form');
  const [pendingBookingPayload, setPendingBookingPayload] = useState<Record<string, unknown> | null>(null);
  const pendingPayloadRef = useRef<Record<string, unknown> | null>(null);
  const packageHintAppliedRef = useRef(false);

  const goBackFromPaymentStep = useCallback(() => {
    setStep('form');
    setError(null);
    setPendingBookingPayload(null);
    pendingPayloadRef.current = null;
  }, []);

  const handleHeaderBack = useCallback(() => {
    if (step === 'payment') {
      goBackFromPaymentStep();
      return;
    }
    onBack?.();
  }, [step, goBackFromPaymentStep, onBack]);

  useEffect(() => {
    onInternalBackReady?.(handleHeaderBack);
  }, [handleHeaderBack, onInternalBackReady]);

  useEffect(() => {
    packageHintAppliedRef.current = false;
  }, [vendorId, packageHint?.name, packageHint?.testLabels?.join('|')]);

  useEffect(() => {
    loadTests();
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<any>(`/vendor/${vendorId}`);
        const name =
          res?.vendor?.business_name ||
          res?.vendor?.businessName ||
          res?.vendor?.name ||
          res?.businessName ||
          res?.name;
        if (!cancelled && name) setVendorName(String(name));
      } catch {
        // keep default label
      }
    })();
    return () => {
      cancelled = true;
    };
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
    if (isLegacyMockDiagnosticVendorId(vendorId)) {
      setError(
        'This lab listing is no longer valid. Go back to Diagnostic Labs, refresh if needed, and choose a lab from the list.'
      );
      toast.error('Invalid lab. Open Diagnostic Labs again and pick a real lab.');
      setTests([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setTests([]);
      // publishedOnly=true: only tests with is_available=true (published) for booking
      const response = await apiClient.get<any>(`/vendor/${vendorId}/diagnostics/tests?publishedOnly=true`);

      if (response && typeof response === 'object' && response.success === false) {
        const msg =
          (typeof response.error === 'string' && response.error) ||
          (typeof response.message === 'string' && response.message) ||
          'Could not load lab tests for this vendor.';
        setError(msg);
        toast.error(msg);
        return;
      }

      const list = Array.isArray(response?.tests) ? response.tests : [];
      setTests(list);

      if (list.length === 0) {
        setError(
          'No published tests are available for this lab. Choose another lab, or ask the lab to publish tests in their catalog.'
        );
      }
    } catch (err: any) {
      console.error('Error loading tests:', err);
      const msg =
        err?.message?.includes('403') || err?.statusCode === 403 || err?.status === 403
          ? 'This lab is not set up for online test booking.'
          : formatCustomerApiFailure(err, 'Could not load tests for this lab');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Pre-select tests when user opened booking from a health package (best-effort match on name/code)
  useEffect(() => {
    if (packageHintAppliedRef.current) return;
    const labels = (packageHint?.testLabels || []).map((l) => l.trim().toLowerCase()).filter(Boolean);
    if (!labels.length || tests.length === 0) return;

    const matched: string[] = [];
    for (const t of tests) {
      const name = (t.test_name || '').toLowerCase();
      const code = (t.test_code || '').toLowerCase();
      const hit = labels.some((l) => {
        if (!l) return false;
        if (code && (code === l || code.includes(l) || l.includes(code))) return true;
        if (name.includes(l)) return true;
        const tokens = name.split(/[\s,/+&()-]+/).filter(Boolean);
        return tokens.some((w) => w === l || w.startsWith(l) || l.startsWith(w));
      });
      if (hit) matched.push(t.id);
    }

    if (matched.length > 0) {
      setSelectedTests(matched);
      packageHintAppliedRef.current = true;
      if (packageHint?.name) {
        toast.success(`Selected matching tests for “${packageHint.name}”. Adjust if needed.`);
      }
    }
  }, [tests, packageHint]);

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
      setResolvedCustomerId(customerId);
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

  const dashboardStats = EMPTY_SERVICE_HEADER_STATS;

  if (loading) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-gray-50 max-w-customer mx-auto">
        {onBack && (
          <ServiceDashboardHeader
            serviceName="Diagnostic Labs"
            serviceSubtitle="Lab tests & diagnostics"
            serviceIcon={TestTube}
            iconColor="text-white"
            stats={dashboardStats}
            onBack={handleHeaderBack}
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

  // Payment step: same UniversalPaymentPage as vet / other services (wallet, coupons, secure checkout)
  if (step === 'payment' && pendingBookingPayload) {
    const total = getTotalPrice();
    const selectedTestDetails = selectedTests
      .map((id) => tests.find((t) => t.id === id))
      .filter((t): t is DiagnosticTest => !!t);
    const linkedPet = selectedPetId ? customerPets.find((p) => p.id === selectedPetId) : undefined;
    const testNames = selectedTestDetails.map((t) => t.test_name).filter(Boolean).join(', ');
    const totalDuration = selectedTestDetails.reduce(
      (sum, t) => sum + (Number(t.duration_minutes) || 30),
      0
    );
    const paymentCustomerId =
      (pendingBookingPayload.customerId as string | undefined) || resolvedCustomerId;

    return (
      <UniversalPaymentPage
        type="booking"
        layoutVariant="appShell"
        fillViewport
        category="diagnostics"
        serviceId="diagnostics"
        serviceName={
          selectedTests.length > 1
            ? `${selectedTests.length} Lab Tests`
            : selectedTestDetails[0]?.test_name || 'Diagnostic Tests'
        }
        serviceDescription={testNames || 'Lab tests & diagnostics'}
        serviceStyle={preferredSampleType === 'home' ? 'at_home' : 'at_center'}
        vendorId={vendorId}
        vendorName={vendorName}
        bookingDate={selectedDate}
        bookingTime={selectedTime}
        petId={selectedPetId || undefined}
        petName={linkedPet?.name || patientName || undefined}
        petBreed={linkedPet?.breed}
        addressId={preferredSampleType === 'home' ? selectedAddress?.id : undefined}
        address={
          preferredSampleType === 'home' && selectedAddress
            ? {
                id: selectedAddress.id,
                label: selectedAddress.label,
                addressLine1: selectedAddress.addressLine1 || selectedAddress.address,
                city: selectedAddress.city,
                pincode: selectedAddress.pincode,
                state: selectedAddress.state,
              }
            : undefined
        }
        baseAmount={total}
        duration={totalDuration || 30}
        selectedServices={selectedTestDetails.map((t) => ({
          id: t.id,
          serviceId: t.id,
          name: t.test_name,
          serviceName: t.test_name,
          price: Number(t.price) || 0,
          duration: Number(t.duration_minutes) || 30,
        }))}
        customerPhone={customerPhone}
        customerId={paymentCustomerId}
        prepaidBookingPayload={pendingBookingPayload}
        onBack={goBackFromPaymentStep}
        onSuccess={(bookingId) => {
          onSuccess?.(bookingId);
        }}
      />
    );
  }

  const categories = getCategories();
  const testsSubtotal = selectedTests.reduce(
    (sum, id) => sum + (Number(tests.find((t) => t.id === id)?.price) || 0),
    0
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-50">
      {/* ✅ FIX: Use ServiceDashboardHeader to match vet service UI frame */}
      {onBack && (
        <ServiceDashboardHeader
          serviceName="Diagnostic Labs"
          serviceSubtitle="Lab tests & diagnostics"
          serviceIcon={TestTube}
          iconColor="text-white"
          stats={dashboardStats}
          onBack={handleHeaderBack}
          showBackButton={true}
          headerColor="bg-[#FF8C42]"
        />
      )}
      
      <div className="mx-auto w-full max-w-customer overflow-x-hidden px-4 pb-[max(7rem,calc(5.5rem+env(safe-area-inset-bottom,0px)))]">
        <h2 className="mb-4 mt-4 text-xl font-bold text-gray-900 sm:text-2xl">Book Diagnostic Tests</h2>

        <form id="diagnostics-booking-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Search and Filter */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              placeholder="Search tests..."
              className={inputClassName}
            />
            {categories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('')}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    !categoryFilter
                      ? 'bg-[#FF8C42] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Categories
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      categoryFilter === cat
                        ? 'bg-[#FF8C42] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Test Selection */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900">Select Tests ({selectedTests.length} selected)</h3>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {filteredTests.length === 0 ? (
              <div className="p-8 text-center text-gray-500 space-y-2">
                <p className="font-medium text-gray-700">
                  {tests.length === 0
                    ? error || 'No published tests for this lab yet.'
                    : 'No tests match your search or category.'}
                </p>
                {tests.length === 0 && (
                  <p className="text-sm">
                    Labs must publish tests in their vendor catalog. Try another lab from the list or book individual tests from a lab card below.
                  </p>
                )}
              </div>
            ) : (
              filteredTests.map((test) => (
                <label
                  key={test.id}
                  className={`flex cursor-pointer items-start gap-3 p-4 hover:bg-gray-50 ${
                    selectedTests.includes(test.id) ? 'bg-orange-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTests.includes(test.id)}
                    onChange={() => toggleTest(test.id)}
                    className="mt-1 h-5 w-5 shrink-0 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <TestTube className="shrink-0 text-orange-500" size={18} />
                          <span className="font-semibold text-gray-900">{test.test_name}</span>
                          {test.test_code && (
                            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                              {test.test_code}
                            </span>
                          )}
                        </div>
                        {test.category && (
                          <span className="mt-1 block text-sm text-gray-500">{test.category}</span>
                        )}
                        {test.description && (
                          <p className="mt-1 text-sm text-gray-600">{test.description}</p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                          {test.sample_type && (
                            <span>Sample: {test.sample_type}</span>
                          )}
                          {test.duration_minutes ? (
                            <span className="flex items-center gap-1">
                              <Clock size={14} />
                              {test.duration_minutes} min
                            </span>
                          ) : null}
                        </div>
                        {test.preparation_instructions && (
                          <div className="mt-2 rounded bg-blue-50 p-2 text-xs text-blue-700">
                            <FileText size={12} className="mr-1 inline" />
                            {test.preparation_instructions}
                          </div>
                        )}
                        {preferredSampleType === 'home' && test.is_free_home_collection !== undefined && (
                          <div className="mt-1 flex items-center gap-1 text-xs">
                            <Truck size={12} />
                            {test.is_free_home_collection
                              ? <span className="text-green-600">Free home collection</span>
                              : <span className="text-gray-600">Home: +{formatPriceWithSymbol(test.home_collection_fee ?? 0)}</span>}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-bold text-orange-600">{formatPriceWithSymbol(test.price)}</p>
                        {preferredSampleType === 'home' && !test.is_free_home_collection && (test.home_collection_fee ?? 0) > 0 && (
                          <p className="text-xs text-gray-500">+{formatPriceWithSymbol(test.home_collection_fee)} home</p>
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
            <div className="mt-3 space-y-1 border-t border-orange-200 pt-3">
              <div className="flex justify-between text-sm">
                <span>Tests total</span>
                <span>{formatPriceWithSymbol(testsSubtotal)}</span>
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
                    <span>{formatPriceWithSymbol(homeFee)}</span>
                  </div>
                ) : homeFees.length === 0 ? (
                  <div className="flex justify-between text-sm text-green-600">
                    <span className="flex items-center gap-1"><Truck className="h-4 w-4" /> Home collection</span>
                    <span>Free</span>
                  </div>
                ) : null;
              })()}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-orange-200 pt-2">
              <span className="font-semibold">Total</span>
              <p className="text-xl font-bold text-orange-600">{formatPriceWithSymbol(getTotalPrice())}</p>
            </div>
          </div>
        )}

        {/* Patient Details */}
        <div className="space-y-5 rounded-xl bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-gray-900">Patient Details</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_96px]">
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Patient Name *
              </label>
              <input
                type="text"
                value={patientName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPatientName(e.target.value)}
                required
                className={inputClassName}
              />
            </div>
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Age
              </label>
              <input
                type="number"
                value={patientAge}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPatientAge(e.target.value)}
                className={inputClassName}
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
                className={inputClassName}
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
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPreferredSampleType('center')}
                className={`min-w-0 rounded-lg border-2 px-3 py-3 text-sm font-medium transition sm:text-base ${
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
                className={`min-w-0 rounded-lg border-2 px-3 py-3 text-sm font-medium transition sm:text-base ${
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                <Calendar className="mr-1.5 inline" size={16} />
                Preferred Date *
              </label>
              <div className="warmpawz-date-field-wrap">
              <input
                type="date"
                value={selectedDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
                className={`${inputClassName} block max-w-full`}
              />
              </div>
            </div>
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                <Clock className="mr-1.5 inline" size={16} />
                Preferred Time *
              </label>
              <div className="warmpawz-time-field-wrap">
              <input
                type="time"
                value={selectedTime}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedTime(e.target.value)}
                required
                className={`${inputClassName} block max-w-full`}
              />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}
      </form>
      </div>

      {/* Fixed bottom actions — avoids overlap with date/time fields on small screens */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center">
        <div className="pointer-events-auto w-full max-w-customer border-t border-gray-200 bg-white/95 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          <div className="flex gap-3 p-4">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="h-12 flex-1 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:text-base"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              form="diagnostics-booking-form"
              disabled={processing || selectedTests.length === 0}
              className="h-12 flex-[2] rounded-lg bg-orange-500 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-300 sm:text-base"
            >
              {processing ? 'Preparing...' : `Continue to Payment • ${formatPriceWithSymbol(getTotalPrice())}`}
            </button>
          </div>
        </div>
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

