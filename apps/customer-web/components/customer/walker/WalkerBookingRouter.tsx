"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, Video, Home, Building2, Calendar, Clock, MapPin, User, CreditCard, CheckCircle2, ChevronRight, Package, Gift, Plus, X, Upload, Dog, Cat, Locate, Bike, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { getGoogleMapsBrowserApiKey } from '@/lib/google-maps-browser-key';
import { toast } from 'sonner';
import { UniversalPaymentPage } from '../payment/UniversalPaymentPage';
import { catalogPriceIncludesTax } from '@/lib/booking-display-utils';
import { EnhancedAddPetModal } from '../EnhancedAddPetModal';
import { ServiceDashboardHeader, StepInfo } from '../shared/ServiceDashboardHeader';
import { PrePaymentBookingReview } from '../booking/PrePaymentBookingReview';
import {
  getWalkerRouterOfferingsForStyle,
  mapWalkerApiRowToOption,
  type WalkerServiceOption,
} from '@/lib/walker-vendor-offerings';

interface WalkerBookingRouterProps {
  phone: string;
  vendorId?: string;
  walker?: any;
  selectedService?: string;
  serviceType?: string;
  serviceId?: string; // ✅ FIX: Add serviceId to handle specific service selection
  serviceName?: string; // ✅ FIX: Add serviceName
  serviceStyle?: string; // ✅ FIX: Add serviceStyle to preserve context
  price?: number; // ✅ FIX: Add price
  duration?: number; // ✅ FIX: Add duration
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string) => void;
  onInternalBackReady?: (handleBack: () => void) => void; // ✅ NEW: Expose internal handleBack to parent
}

type BookingStep = 'service' | 'datetime' | 'pet' | 'address' | 'payment' | 'confirmation';

interface TimeSlot {
  time: string;
  available: boolean;
}

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
}

/** Booking location/mode for GET /available-slots — never a catalog service UUID */
const KNOWN_BOOKING_STYLES = new Set([
  'at_home',
  'at_center',
  'tele',
  'outdoor',
  'at_vendor',
  'home',
  'online',
  'video_consultation',
]);

function isLikelyUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim());
}

function normalizeBookingStyle(raw?: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const t = raw.trim();
  if (isLikelyUuid(t)) return null;
  if (t === 'home') return 'at_home';
  if (KNOWN_BOOKING_STYLES.has(t)) return t;
  return null;
}

function initialBookingServiceStyle(style?: string): string {
  return normalizeBookingStyle(style) ?? 'at_home';
}

export function WalkerBookingRouter({ 
  phone, 
  vendorId, 
  walker, 
  selectedService, 
  serviceType,
  serviceId,
  serviceName,
  serviceStyle,
  price,
  duration,
  onBack, 
  onNavigate, 
  onViewBooking,
  onInternalBackReady // ✅ NEW: Callback to expose internal handleBack
}: WalkerBookingRouterProps) {
  // ✅ FIX: If serviceType/serviceStyle is provided, skip service selection and go to datetime
  // This preserves the service-style context when coming from service listing
  const hasServiceContext = (serviceType || serviceStyle) && (serviceId || selectedService);
  const initialStep: BookingStep = hasServiceContext ? 'datetime' : 'service';
  const [step, setStep] = useState<BookingStep>(initialStep);
  
  // ✅ FIX: Prevent step from resetting to 'service' if we have service context
  // Use a ref to track if we've already initialized to avoid loops
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current && hasServiceContext && step === 'service') {
      // If we have service context but step is 'service', move to datetime
      setStep('datetime');
      initializedRef.current = true;
    }
  }, [serviceId, serviceType, serviceStyle, step]);
  const [loading, setLoading] = useState(false);
  /** Passed to available-slots only — must be at_home | outdoor | … never a vendor service UUID */
  const [bookingServiceStyle, setBookingServiceStyle] = useState(() => initialBookingServiceStyle(serviceStyle));
  /** Vendor catalog row id (UUID or default walk_30min / walk_60min) */
  const [selectedVendorServiceId, setSelectedVendorServiceId] = useState<string>(() =>
    serviceId ? String(serviceId) : selectedService ? String(selectedService) : ''
  );
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  /** Raw GET /customer/vendor/:id/services { services, packages } for style filtering + package rows. */
  const [vendorCatalog, setVendorCatalog] = useState<{ services: any[]; packages: any[] } | null>(null);
  // ✅ FIX: Initialize selectedVendorService with passed service data if available
  const [selectedVendorService, setSelectedVendorService] = useState<any>(
    serviceId ? {
      id: serviceId,
      serviceId: serviceId,
      name: serviceName,
      price: price,
      duration: duration,
      serviceStyle: initialBookingServiceStyle(serviceStyle),
    } : null
  );
  
  // Package awareness state
  const [activePackage, setActivePackage] = useState<any>(null);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [usePackageSession, setUsePackageSession] = useState(false);
  const [showPackageOffer, setShowPackageOffer] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  
  // Add Pet/Address modal states
  const [showAddPetModal, setShowAddPetModal] = useState(false);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  
  // Payment integration state
  const [showPaymentPage, setShowPaymentPage] = useState(false);

  // Default walk service options (used when no specific services loaded)
  const defaultServiceTypeOptions: WalkerServiceOption[] = useMemo(
    () => [
      {
        id: 'walk_30min',
        serviceId: 'walk_30min',
        name: '30 Min Walk',
        price: 199,
        duration: 30,
        desc: '30-minute walk session',
        serviceStyle: bookingServiceStyle,
        isPackage: false,
        priceLabel: '₹199',
        iconColor: 'green',
      },
      {
        id: 'walk_60min',
        serviceId: 'walk_60min',
        name: '60 Min Walk',
        price: 349,
        duration: 60,
        desc: '60-minute walk session',
        serviceStyle: bookingServiceStyle,
        isPackage: false,
        priceLabel: '₹349',
        iconColor: 'orange',
      },
    ],
    [bookingServiceStyle]
  );

  const serviceOptions: WalkerServiceOption[] = useMemo(() => {
    if (!vendorCatalog) return defaultServiceTypeOptions;
    const rows = getWalkerRouterOfferingsForStyle(
      { services: vendorCatalog.services, packages: vendorCatalog.packages },
      bookingServiceStyle
    );
    if (rows.length === 0) return [];
    return rows.map((r) => mapWalkerApiRowToOption(r, bookingServiceStyle));
  }, [vendorCatalog, bookingServiceStyle, defaultServiceTypeOptions]);

  const singleWalkOptions = useMemo(
    () => serviceOptions.filter((o) => !o.isPackage),
    [serviceOptions]
  );
  const bundleOptions = useMemo(
    () => serviceOptions.filter((o) => o.isPackage),
    [serviceOptions]
  );

  const generateDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      dates.push({
        date: `${y}-${m}-${d}`,
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: date.getDate(),
        month: date.toLocaleDateString('en-US', { month: 'short' }),
      });
    }
    return dates;
  };

  // ✅ FIX B6: Generate time slots based on vendor operating hours
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Load slots when date is selected and vendor is known
  useEffect(() => {
    if (selectedDate && vendorId) {
      loadTimeSlots(selectedDate);
    } else {
      // Reset slots when date is cleared
      setTimeSlots([]);
    }
  }, [selectedDate, vendorId, bookingServiceStyle]);

  const loadTimeSlots = async (date: string) => {
    if (!vendorId) return;
    
    try {
      setLoadingSlots(true);
      const response = await apiClient.get(
        `/customer/vendor/${vendorId}/available-slots?date=${encodeURIComponent(date)}&serviceStyle=${encodeURIComponent(bookingServiceStyle)}`
      ) as any;

      if (response.success && response.slots) {
        setTimeSlots(response.slots);
      } else {
        // Fallback to default slots if API fails
        const defaultSlots: TimeSlot[] = [
          '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
          '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
        ].map(time => ({ time, available: true }));
        setTimeSlots(defaultSlots);
      }
    } catch (error) {
      console.error('Error loading time slots:', error);
      // Fallback to default slots on error
      const defaultSlots: TimeSlot[] = [
        '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
      ].map(time => ({ time, available: true }));
      setTimeSlots(defaultSlots);
    } finally {
      setLoadingSlots(false);
    }
  };

  const [dates] = useState(generateDates());

  useEffect(() => {
    loadCustomerData();
    if (vendorId) {
      loadVendorServices();
    }
  }, [phone, vendorId]);

  const loadVendorServices = async () => {
    if (!vendorId) return;
    
    try {
      setLoading(true);
      // Load actual vendor walk services
      const servicesResponse = await apiClient.get(`/customer/vendor/${vendorId}/services?category=walking`) as any;
      if (servicesResponse.success) {
        setVendorCatalog({
          services: Array.isArray(servicesResponse.services) ? servicesResponse.services : [],
          packages: Array.isArray(servicesResponse.packages) ? servicesResponse.packages : [],
        });
        const n =
          (servicesResponse.services?.length || 0) + (servicesResponse.packages?.length || 0);
        console.log('Loaded vendor services + packages:', n);
      }
    } catch (error) {
      console.error('Error loading vendor services:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerData = async () => {
    try {
      // Load pets from API
      const petsResponse = await apiClient.get(`/customer/pets/${phone}`) as any;
      if (petsResponse.pets && petsResponse.pets.length > 0) {
        setPets(petsResponse.pets.map((p: any) => ({
          id: p.id,
          name: p.name,
          species: p.species || p.type,
          breed: p.breed,
        })));
      }
      
      // Load customer addresses from API
      try {
        const addressResponse = await apiClient.get(`/customer/addresses?phone=${encodeURIComponent(phone)}`) as any;
        if (addressResponse.addresses && addressResponse.addresses.length > 0) {
          setAddresses(addressResponse.addresses);
        }
      } catch (addrErr) {
        // If no addresses saved, leave empty - user can enter manually
        setAddresses([]);
      }
      // Get customer ID for package checking
      try {
        const profileResponse = await apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`) as any;
        if (profileResponse?.profile?.id || profileResponse?.id) {
          setCustomerId(profileResponse?.profile?.id || profileResponse?.id);
        }
      } catch (profileErr) {
        console.log('Could not get customer ID for package checking');
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
      // Don't use mock data - show empty state instead
      setPets([]);
      setAddresses([]);
    }
  };
  
  // Refresh pets after adding new one
  const refreshPets = async () => {
    try {
      const petsResponse = await apiClient.get(`/customer/pets/${phone}`) as any;
      if (petsResponse.pets && petsResponse.pets.length > 0) {
        const mappedPets = petsResponse.pets.map((p: any) => ({
          id: p.id,
          name: p.name,
          species: p.species || p.type,
          breed: p.breed,
        }));
        setPets(mappedPets);
        // Auto-select newly added pet
        if (mappedPets.length > 0) {
          setSelectedPet(mappedPets[mappedPets.length - 1]);
        }
      }
    } catch (err) {
      console.error('Error refreshing pets:', err);
    }
  };
  
  // Refresh addresses after adding new one
  const refreshAddresses = async () => {
    try {
      const addressResponse = await apiClient.get(`/customer/addresses?phone=${encodeURIComponent(phone)}`) as any;
      if (addressResponse.addresses && addressResponse.addresses.length > 0) {
        setAddresses(addressResponse.addresses);
        // Auto-select newly added address
        const defaultAddr = addressResponse.addresses.find((a: any) => a.isDefault);
        if (defaultAddr) {
          setSelectedAddress(defaultAddr);
        } else if (addressResponse.addresses.length > 0) {
          setSelectedAddress(addressResponse.addresses[addressResponse.addresses.length - 1]);
        }
      }
    } catch (err) {
      console.error('Error refreshing addresses:', err);
    }
  };

  // Check for active packages when customer and vendor are known
  const checkForActivePackages = async () => {
    if (!customerId || !vendorId) return;
    
    try {
      const response = await apiClient.get<any>(
        `/packages/check-for-booking?customerId=${customerId}&vendorId=${vendorId}&serviceType=${encodeURIComponent(serviceType || 'walking')}`
      );

      if (response?.hasActivePackage && response?.package) {
        setActivePackage(response.package);
        setShowPackageModal(true);
      }
    } catch (error: any) {
      // Silently fail - no packages is not an error, just means normal booking flow
      console.log('No active packages found or error checking packages:', error?.message);
      // Don't show error toast - this is expected for customers without packages
    }
  };

  useEffect(() => {
    if (customerId && vendorId && step === 'service') {
      checkForActivePackages();
    }
  }, [customerId, vendorId, step]);

  // Handle using a package session
  const handleUsePackageSession = async () => {
    if (!activePackage) return;
    
    setUsePackageSession(true);
    setShowPackageModal(false);
    toast.success('Using package session - No payment required!');
    // Proceed to datetime selection
    setStep('datetime');
  };

  // Handle booking new (skip package)
  const handleBookNew = () => {
    setShowPackageModal(false);
    setUsePackageSession(false);
    // Proceed with normal booking
  };

  const handleNext = () => {
    if (step === 'service') {
      const sel = serviceOptions.find((s) => s.id === selectedVendorServiceId);
      if (sel?.isPackage) {
        onNavigate?.('purchase-package', {
          vendorId,
          vendorServiceId: sel.id,
          serviceType: 'walking',
          serviceName: sel.name,
          totalSessions: sel.totalSessions ?? 1,
          sessionsPerDay: sel.sessionsPerDay,
          sessionIntervalDays: sel.sessionIntervalDays,
          price: sel.price,
          duration: sel.duration,
          description: sel.desc,
          serviceStyle: sel.serviceStyle,
        });
        return;
      }
    }
    const steps: BookingStep[] = ['service', 'datetime', 'pet', 'address', 'payment', 'confirmation'];
    const currentIdx = steps.indexOf(step);
    
    // Skip address for tele consultations
    if (step === 'pet' && bookingServiceStyle === 'tele') {
      setStep('payment');
      return;
    }
    
    if (currentIdx < steps.length - 1) {
      setStep(steps[currentIdx + 1]);
    }
  };

  const handleBack = useCallback(() => {
    const steps: BookingStep[] = ['service', 'datetime', 'pet', 'address', 'payment', 'confirmation'];
    const currentIdx = steps.indexOf(step);
    
    // Handle back from payment for tele
    if (step === 'payment' && bookingServiceStyle === 'tele') {
      setStep('pet');
      return;
    }
    
    if (currentIdx > 0) {
      setStep(steps[currentIdx - 1]);
    } else {
      onBack();
    }
  }, [step, bookingServiceStyle, onBack]);

  // ✅ NEW: Expose handleBack to parent for header navigation
  useEffect(() => {
    if (onInternalBackReady) {
      onInternalBackReady(handleBack);
    }
  }, [handleBack, onInternalBackReady]);

  // ✅ Proceed to UniversalPaymentPage
  const handleProceedToPayment = () => {
    setShowPaymentPage(true);
  };

  // ✅ Handle payment success from UniversalPaymentPage
  const handlePaymentSuccess = (newBookingId: string, orderId?: string, otpCode?: string) => {
    setBookingId(newBookingId);
    setShowPaymentPage(false);
    setStep('confirmation');
    toast.success('Booking confirmed successfully!');
  };

  const handleConfirmBooking = async () => {
    setProcessing(true);
    try {
      // If using package session, create session instead of booking
      if (usePackageSession && activePackage) {
        try {
          const sessionData = {
            packagePurchaseId: activePackage.id,
            scheduledStartTime: `${selectedDate}T${selectedTime}:00`,
            petId: selectedPet?.id,
            staffId: vendorId,
            location: selectedAddress,
            notes,
          };
          
          const response = await apiClient.post('/package-sessions', sessionData) as any;
          setBookingId(response.session?.id || response.id || 'PS-' + Date.now());
          toast.success('Package session scheduled successfully!');
          setStep('confirmation');
        } catch (err: any) {
          console.error('Error creating package session:', err);
          const errorMessage = err?.response?.data?.error || err?.message || 'Failed to create package session';
          toast.error(errorMessage);
          setProcessing(false);
          return;
        }
      } else {
        // For regular booking, use UniversalPaymentPage
        handleProceedToPayment();
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to proceed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const selectedServiceOption = serviceOptions.find((s) => s.id === selectedVendorServiceId);

  // ✅ FIX: Prepare stats for ServiceDashboardHeader
  const dashboardStats = [
    { value: '30+', label: 'Walkers' },
    { value: '2K+', label: 'Walks' },
    { value: '—', label: 'Rating' }
  ];

  const getServiceTitle = () => {
    if (walker?.name) return `Book with ${walker.name}`;
    return 'Dog Walking';
  };

  const getServiceSubtitle = () => {
    if (bookingServiceStyle === 'at_home') return 'Walker comes to you';
    return 'Professional pet walking services';
  };

  // ✅ FIX: Header copy for booking steps (pre-payment review uses PrePaymentBookingReview)

  const getStepIndicators = (): StepInfo[] | undefined => {
    if (step === 'payment' || step === 'confirmation') return undefined;
    
    const stepLabels = bookingServiceStyle === 'tele' 
      ? ['Service', 'Date/Time', 'Pet', 'Payment']
      : ['Service', 'Date/Time', 'Pet', 'Address', 'Payment'];
    const currentStepMap: Record<BookingStep, number> = {
      service: 0, datetime: 1, pet: 2, address: 3, payment: bookingServiceStyle === 'tele' ? 3 : 4, confirmation: 5
    };
    const currentIdx = currentStepMap[step];
    
    return stepLabels.map((label, idx) => ({
      label,
      isCompleted: idx < currentIdx,
      isCurrent: idx === currentIdx
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {step !== 'payment' && (
        <ServiceDashboardHeader
          serviceName={getServiceTitle()}
          serviceSubtitle={getServiceSubtitle()}
          serviceIcon={Bike}
          iconColor="text-white"
          stats={dashboardStats}
          steps={getStepIndicators()}
          onBack={handleBack}
          showBackButton={true}
          headerColor="bg-[#FF8C42]"
        />
      )}

      {step === 'payment' && !showPaymentPage && (
        <PrePaymentBookingReview
          title="Booking Summary"
          subtitle="Review before payment"
          headerIcon={Bike}
          stats={dashboardStats}
          onBack={handleBack}
          lead={{
            icon: Home,
            iconContainerClassName: 'bg-orange-100 text-[#FF8C42]',
            title: selectedServiceOption?.name || serviceName || 'Pet Walking',
            subtitle: (() => {
              const d = selectedServiceOption?.duration ?? duration ?? 0;
              return d > 0 ? `${d} mins` : undefined;
            })(),
            trailing: (
              <span>
                ₹{(selectedServiceOption?.price ?? price ?? 0).toLocaleString('en-IN')}
              </span>
            ),
          }}
          rows={[
            {
              id: 'datetime',
              icon: Calendar,
              label: 'Date & Time',
              primary: `${new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })} at ${selectedTime}`,
            },
            {
              id: 'pet',
              icon: User,
              label: 'Pet',
              primary: `${selectedPet?.name} (${selectedPet?.breed})`,
            },
          ]}
          notes={{
            value: notes,
            onChange: setNotes,
            placeholder: 'Walking route preferences, behavior notes...',
            showNotes: true,
          }}
          total={{
            label: 'Total',
            amountFormatted: `₹${(selectedServiceOption?.price ?? price ?? 0).toLocaleString('en-IN')}`,
          }}
          primaryButton={{
            label: 'Proceed to Payment',
            onClick: handleProceedToPayment,
            disabled: processing,
            loading: processing,
          }}
        />
      )}

      {/* Main Content */}
      {(step !== 'payment' || showPaymentPage) && (
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Step indicator moved to header */}

        {/* Service Selection */}
        {step === 'service' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Choose a walk or bundle</h2>
            <p className="text-sm text-gray-500">Single sessions are priced per walk. Bundles are multi-session packages (total price shown).</p>
            {[
              { title: 'Single walks', list: singleWalkOptions },
              { title: 'Walk bundles (packages)', list: bundleOptions },
            ].map(({ title, list }) =>
              list.length === 0 ? null : (
                <div key={title} className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h3>
                  <div className="space-y-3">
                    {list.map((service) => {
                      const Icon = service.isPackage ? Package : Home;
                      const isSelected = selectedVendorServiceId === service.id;
                      const colorBox =
                        service.iconColor === 'blue'
                          ? 'bg-blue-100 text-blue-600'
                          : service.iconColor === 'purple'
                            ? 'bg-purple-100 text-purple-700'
                            : service.iconColor === 'green'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-orange-100 text-[#FF8C42]';
                      return (
                        <button
                          key={service.id}
                          onClick={() => {
                            setSelectedVendorServiceId(service.id);
                            setSelectedVendorService({
                              id: service.serviceId || service.id,
                              serviceId: service.serviceId || service.id,
                              name: service.name,
                              price: service.price,
                              duration: service.duration,
                              isPackage: service.isPackage,
                              serviceStyle: service.serviceStyle || bookingServiceStyle,
                            });
                            const rowStyle = normalizeBookingStyle(service.serviceStyle);
                            if (rowStyle) setBookingServiceStyle(rowStyle);
                          }}
                          className={`w-full p-4 rounded-xl border-2 transition-all ${
                            isSelected
                              ? 'border-[#FF8C42] bg-orange-50'
                              : 'border-gray-200 bg-white hover:border-orange-200'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${colorBox}`}>
                              <Icon className="w-7 h-7" />
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-gray-900">{service.name}</h3>
                                <span
                                  className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                                    service.isPackage
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {service.isPackage ? 'Package' : 'Service'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500 line-clamp-2">{service.desc || ' '}</p>
                              {service.subPriceHint ? (
                                <p className="text-xs text-gray-500 mt-0.5">{service.subPriceHint}</p>
                              ) : null}
                              <div className="flex items-center gap-2 mt-1">
                                <Clock className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-sm text-gray-500">
                                  {service.isPackage
                                    ? `${service.duration} min / session${service.totalSessions != null ? ` · ${service.totalSessions} sessions` : ''}`
                                    : `${service.duration} mins`}
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-lg text-gray-900">{service.priceLabel}</p>
                              {isSelected && (
                                <CheckCircle2 className="w-6 h-6 text-[#FF8C42] mt-1 ml-auto" />
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            )}
            {singleWalkOptions.length === 0 && bundleOptions.length === 0 && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                No published walks for this style. Try another location style or another walker.
              </p>
            )}
            <Button
              onClick={handleNext}
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A35] mt-4"
              disabled={!selectedVendorServiceId}
            >
              {selectedServiceOption?.isPackage ? 'Buy bundle' : 'Continue'}
            </Button>
          </div>
        )}

        {/* Date & Time Selection */}
        {step === 'datetime' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-3">Select Date</h2>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {dates.map((d) => (
                  <button
                    key={d.date}
                    onClick={() => setSelectedDate(d.date)}
                    className={`flex-shrink-0 w-16 p-3 rounded-xl text-center transition-all ${
                      selectedDate === d.date 
                        ? 'bg-[#FF8C42] text-white' 
                        : 'bg-white border border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <p className="text-xs opacity-75">{d.day}</p>
                    <p className="text-xl font-bold">{d.dayNum}</p>
                    <p className="text-xs opacity-75">{d.month}</p>
                  </button>
                ))}
              </div>
            </div>

            {selectedDate && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-3">Select Time</h2>
                {loadingSlots ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42] mx-auto mb-2"></div>
                      <p className="text-sm text-gray-500">Loading available slots...</p>
                    </div>
                  </div>
                ) : timeSlots.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No slots available for this date</p>
                    <p className="text-sm mt-2">Please select another date</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.time}
                        onClick={() => slot.available && setSelectedTime(slot.time)}
                        disabled={!slot.available}
                        className={`p-3 rounded-xl text-center transition-all ${
                          selectedTime === slot.time 
                            ? 'bg-[#FF8C42] text-white' 
                            : slot.available
                              ? 'bg-white border border-gray-200 hover:border-orange-300'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button 
              onClick={handleNext} 
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A35]"
              disabled={!selectedDate || !selectedTime}
            >
              Continue
            </Button>
          </div>
        )}

        {/* Pet Selection */}
        {step === 'pet' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Select Your Pet</h2>
              <button
                onClick={() => setShowAddPetModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-orange-100 text-[#FF8C42] rounded-lg text-sm font-medium hover:bg-orange-200 transition"
              >
                <Plus className="w-4 h-4" />
                Add Pet
              </button>
            </div>
            
            {/* Required notice */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
              <Dog className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                A pet profile is required for this service to provide the best care.
              </p>
            </div>
            
            <div className="space-y-3">
              {pets.length > 0 ? (
                pets.map((pet) => (
                  <button
                    key={pet.id}
                    onClick={() => setSelectedPet(pet)}
                    className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                      selectedPet?.id === pet.id 
                        ? 'border-[#FF8C42] bg-orange-50' 
                        : 'border-gray-200 bg-white hover:border-orange-200'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
                      {pet.species === 'dog' || (pet.species || '').toLowerCase().includes('dog') ? (
                        <Dog className="w-7 h-7 text-orange-600" />
                      ) : pet.species === 'cat' || (pet.species || '').toLowerCase().includes('cat') ? (
                        <Cat className="w-7 h-7 text-orange-600" />
                      ) : (
                        <User className="w-7 h-7 text-orange-600" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold text-gray-900">{pet.name}</h3>
                      <p className="text-sm text-gray-500 capitalize">{pet.breed}</p>
                    </div>
                    {selectedPet?.id === pet.id && (
                      <CheckCircle2 className="w-6 h-6 text-[#FF8C42]" />
                    )}
                  </button>
                ))
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                  <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                    <Dog className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-medium mb-2">No pets added yet</p>
                  <p className="text-sm text-gray-500 mb-4">Add your pet to continue with the booking</p>
                  <button
                    onClick={() => setShowAddPetModal(true)}
                    className="px-6 py-3 bg-[#FF8C42] text-white rounded-xl font-medium hover:bg-[#FF7A35] transition"
                  >
                    + Add Your First Pet
                  </button>
                </div>
              )}
            </div>
            <Button 
              onClick={handleNext} 
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A35]"
              disabled={!selectedPet}
            >
              {selectedPet ? 'Continue' : 'Select a Pet to Continue'}
            </Button>
          </div>
        )}

        {/* Address Selection (not for tele) */}
        {step === 'address' && bookingServiceStyle !== 'tele' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {bookingServiceStyle === 'at_home' ? 'Select Your Address' : 'Confirm Clinic Address'}
              </h2>
              {(bookingServiceStyle === 'at_home' || bookingServiceStyle === 'home') && (
                <button
                  onClick={() => setShowAddAddressModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-200 transition"
                >
                  <Plus className="w-4 h-4" />
                  Add Address
                </button>
              )}
            </div>
            
            {/* Required notice for home services */}
            {(bookingServiceStyle === 'at_home' || bookingServiceStyle === 'home') && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <p className="text-sm text-blue-800">
                  An address is required for home service delivery.
                </p>
              </div>
            )}
            
            <div className="space-y-3">
              {(bookingServiceStyle === 'at_home' || bookingServiceStyle === 'home') ? (
                addresses.length > 0 ? (
                  addresses.map((addr) => (
                    <button
                      key={addr.id}
                      onClick={() => setSelectedAddress(addr)}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                        selectedAddress?.id === addr.id 
                          ? 'border-orange-500 bg-orange-50' 
                          : 'border-gray-200 bg-white hover:border-orange-200'
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
                              <span className="px-2 py-0.5 bg-orange-100 text-[#FF7A35] text-xs rounded-full">Default</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{addr.addressLine1 || addr.address}</p>
                          <p className="text-sm text-gray-500">{addr.city} - {addr.pincode}</p>
                          {addr.landmark && <p className="text-xs text-gray-400">Near: {addr.landmark}</p>}
                        </div>
                        {selectedAddress?.id === addr.id && (
                          <CheckCircle2 className="w-6 h-6 text-[#FF8C42]" />
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                    <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                      <MapPin className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-600 font-medium mb-2">No addresses saved</p>
                    <p className="text-sm text-gray-500 mb-4">Add an address to continue with the booking</p>
                    <button
                      onClick={() => setShowAddAddressModal(true)}
                      className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition"
                    >
                      + Add Your Address
                    </button>
                  </div>
                )
              ) : (
                <div className="p-4 rounded-xl border-2 border-[#FF8C42] bg-orange-50">
                  <div className="flex items-start gap-3">
                    <Building2 className="w-5 h-5 text-[#FF8C42] mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-gray-900">{walker?.name || 'Walker'}</h3>
                      <p className="text-sm text-gray-600">Walk service will be provided at your location</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Confirm selected address */}
            {bookingServiceStyle === 'at_home' && selectedAddress && addresses.length > 0 && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-[#FF6B35] font-medium">
                  ✓ Service will be delivered to: {selectedAddress?.label || 'Selected Address'}
                </p>
              </div>
            )}
            
            <Button 
              onClick={() => {
                if (bookingServiceStyle === 'at_center') setSelectedAddress({ id: 'clinic' });
                handleNext();
              }} 
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A35]"
              disabled={bookingServiceStyle === 'at_home' && !selectedAddress}
            >
              {bookingServiceStyle === 'at_home' && !selectedAddress ? 'Select an Address to Continue' : 'Continue'}
            </Button>
          </div>
        )}

        {/* ✅ UniversalPaymentPage Integration - Full screen overlay */}
        {step === 'payment' && showPaymentPage && (
          <div className="fixed inset-0 z-50 bg-white">
            <UniversalPaymentPage
            type="booking"
            serviceId={selectedVendorService?.service_id || selectedVendorService?.serviceId || selectedVendorService?.id || serviceId}
            serviceName={selectedServiceOption?.name || serviceName || 'Pet Walking'}
            serviceDescription={`Walk by ${walker?.name || 'professional walker'}`}
            serviceStyle={
              (bookingServiceStyle === 'outdoor' ? 'at_home' : bookingServiceStyle) as
                | 'at_home'
                | 'at_center'
                | 'at_vendor'
                | 'tele'
                | 'ecom'
                | 'hybrid'
                | 'product'
            }
            category="walking"
            vendorId={vendorId || ''}
            vendorName={walker?.name || 'Walker Professional'}
            bookingDate={selectedDate}
            bookingTime={selectedTime}
            petId={selectedPet?.id}
            petName={selectedPet?.name}
            petBreed={selectedPet?.breed}
            addressId={selectedAddress?.id}
            address={selectedAddress}
            showAddressSelection={true}
            baseAmount={selectedServiceOption?.price || price || 299}
            priceIncludesTax={catalogPriceIncludesTax(selectedServiceOption)}
            duration={selectedServiceOption?.duration || duration || 30}
            quantity={1}
            customerPhone={phone}
            customerId={customerId || undefined}
            onBack={() => setShowPaymentPage(false)}
            onPaymentAbandoned={() => {
              if (selectedDate) void loadTimeSlots(selectedDate);
            }}
            onSuccess={handlePaymentSuccess}
          />
          </div>
        )}

        {/* Confirmation */}
        {step === 'confirmation' && (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-[#FF8C42]" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
            <p className="text-gray-500 mb-6">Your appointment has been scheduled successfully</p>
            
            <div className="bg-white rounded-xl p-4 mb-6 text-left">
              <div className="text-center mb-4">
                <p className="text-sm text-gray-500">Booking ID</p>
                <p className="font-mono font-bold text-lg">{bookingId}</p>
              </div>
              <div className="space-y-3 pt-4 border-t">
                <div className="flex justify-between">
                  <span className="text-gray-500">Service</span>
                  <span className="font-medium">{selectedServiceOption?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date</span>
                  <span className="font-medium">{new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Time</span>
                  <span className="font-medium">{selectedTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Pet</span>
                  <span className="font-medium">{selectedPet?.name}</span>
                </div>
              </div>
            </div>

            {/* Package upsell offer - show if this was a single booking (not using package) */}
            {!usePackageSession && !showPackageOffer && (
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 mb-6 border border-purple-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <Gift className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-purple-900">Save with a Package!</h3>
                    <p className="text-sm text-purple-600">Get up to 30% off with walk packages</p>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  className="w-full border-purple-200 text-purple-700 hover:bg-purple-50"
                  onClick={() => setShowPackageOffer(true)}
                >
                  <Package className="w-4 h-4 mr-2" />
                  View Packages
                </Button>
              </div>
            )}

            {showPackageOffer && (
              <div className="bg-white rounded-xl p-4 mb-6 border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">Available Packages</h3>
                  <button onClick={() => setShowPackageOffer(false)} className="text-gray-400 hover:text-gray-600">
                    ✕
                  </button>
                </div>
                
                <div className="space-y-3">
                  {/* Package options */}
                  <div className="border rounded-lg p-3 hover:border-orange-300 cursor-pointer transition-colors" onClick={() => onNavigate('purchase-package', { vendorId: vendorId, packageType: 'walk-weekly' })}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">Weekly Walk Pack</h4>
                        <p className="text-sm text-gray-500">7 walks • Valid 1 week</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-[#FF8C42]">₹1,799</span>
                        <p className="text-xs text-gray-400 line-through">₹2,495</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-orange-100 text-[#FF7A35] text-xs rounded-full">Save 28%</span>
                    </div>
                  </div>
                  
                  <div className="border rounded-lg p-3 hover:border-orange-300 cursor-pointer transition-colors" onClick={() => onNavigate('purchase-package', { vendorId: vendorId, packageType: 'walk-monthly' })}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">Monthly Walk Pack</h4>
                        <p className="text-sm text-gray-500">30 walks • Valid 1 month</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-[#FF8C42]">₹2,999</span>
                        <p className="text-xs text-gray-400 line-through">₹4,990</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-orange-100 text-[#FF7A35] text-xs rounded-full">Save 40%</span>
                      <span className="px-2 py-0.5 bg-orange-100 text-[#FF7A35] text-xs rounded-full">Best Value</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Button 
                onClick={() => onViewBooking?.(bookingId || '')}
                className="w-full bg-[#FF8C42] hover:bg-[#FF7A35]"
              >
                View Booking Details
              </Button>
              <Button 
                onClick={onBack}
                variant="outline"
                className="w-full"
              >
                Back to Home
              </Button>
            </div>
          </div>
        )}

        {/* Package Selection Modal */}
        {showPackageModal && activePackage && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-[#FF8C42]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Active Package Found!</h2>
                  <p className="text-sm text-gray-500">You have sessions available</p>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <h3 className="font-semibold mb-2">{activePackage.packageName}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sessions Remaining</span>
                    <span className="font-medium text-[#FF8C42]">
                      {activePackage.isUnlimited ? 'Unlimited' : `${activePackage.remainingSessions} of ${activePackage.totalSessions}`}
                    </span>
                  </div>
                  {activePackage.expiresAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Expires</span>
                      <span className="font-medium">{new Date(activePackage.expiresAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-3">
                <Button 
                  onClick={handleUsePackageSession}
                  className="w-full bg-[#FF8C42] hover:bg-[#FF7A35]"
                >
                  Use Package Session (Free)
                </Button>
                <Button 
                  onClick={handleBookNew}
                  variant="outline"
                  className="w-full"
                >
                  Book New (Pay ₹{selectedServiceOption?.price || 499})
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Add Pet Modal - Enhanced with Photo & Vaccinations */}
        <EnhancedAddPetModal
          phone={phone}
          isOpen={showAddPetModal}
          onClose={() => setShowAddPetModal(false)}
          onSuccess={() => {
            refreshPets();
            setShowAddPetModal(false);
          }}
        />
        
        {/* Add Address Modal */}
        {showAddAddressModal && (
          <AddAddressModalInline
            phone={phone}
            onClose={() => setShowAddAddressModal(false)}
            onSuccess={() => {
              refreshAddresses();
              setShowAddAddressModal(false);
            }}
          />
        )}
      </div>
      )}
    </div>
  );
}

// Inline Add Pet Modal Component
function AddPetModalInline({ phone, onClose, onSuccess }: { phone: string; onClose: () => void; onSuccess: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  
  const [petData, setPetData] = useState({
    id: `pet_${Date.now()}`,
    name: '',
    type: 'Dog',
    breed: '',
    age: '',
    gender: '',
    weight: '',
    color: '',
    photo: '',
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
        setPetData({ ...petData, photo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSavePet = async () => {
    if (!petData.name || !petData.type || !petData.breed || !petData.age) {
      toast.error('Please fill in all required fields (Name, Type, Breed, Age)');
      return;
    }
    
    setLoading(true);
    try {
      // Get existing pets
      const getPetsData = await apiClient.get(`/customer/pets/${phone}`) as any;
      let existingPets = [];
      if (Array.isArray(getPetsData)) {
        existingPets = getPetsData;
      } else if (Array.isArray(getPetsData.pets)) {
        existingPets = getPetsData.pets;
      } else if (getPetsData.pets?.pets && Array.isArray(getPetsData.pets.pets)) {
        existingPets = getPetsData.pets.pets;
      }
      
      const updatedPets = [...existingPets, petData];
      
      await apiClient.post('/customer/pets', {
        phone: phone,
        pets: updatedPets
      });
      
      toast.success(`${petData.name} added successfully!`);
      onSuccess();
    } catch (error) {
      console.error('Error saving pet:', error);
      toast.error(`Failed to save pet. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={onClose}>
      <div 
        className="bg-white rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 rounded-t-3xl sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Dog className="w-5 h-5 text-white" />
              <h3 className="text-lg font-bold text-white">Add New Pet</h3>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
        
        <div className="p-5 space-y-4">
          {/* Photo Upload */}
          <div className="flex flex-col items-center">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 bg-orange-100 rounded-full overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-80 border-4 border-white shadow-lg"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Pet" className="w-full h-full object-cover" />
              ) : (
                <Upload className="w-8 h-8 text-[#FF8C42]" />
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            <p className="text-xs text-gray-500 mt-1">Upload photo (Optional)</p>
          </div>

          {/* Pet Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pet Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={petData.name}
              onChange={(e) => setPetData({ ...petData, name: e.target.value })}
              placeholder="e.g., Oreo, Max, Bella"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
            />
          </div>

          {/* Pet Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pet Type <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {['Dog', 'Cat', 'Other'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPetData({ ...petData, type })}
                  className={`py-2.5 px-3 border-2 rounded-xl transition font-medium text-sm ${
                    petData.type === type ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]' : 'border-gray-200 text-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {type === 'Dog' ? <Dog className="w-4 h-4" /> : type === 'Cat' ? <Cat className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    {type}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Breed */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Breed <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={petData.breed}
              onChange={(e) => setPetData({ ...petData, breed: e.target.value })}
              placeholder="e.g., Golden Retriever, Persian"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
            />
          </div>

          {/* Age and Gender */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age (years) <span className="text-red-500">*</span></label>
              <input
                type="number"
                value={petData.age}
                onChange={(e) => setPetData({ ...petData, age: e.target.value })}
                placeholder="e.g., 3"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                value={petData.gender}
                onChange={(e) => setPetData({ ...petData, gender: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>

          {/* Weight and Color */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                value={petData.weight}
                onChange={(e) => setPetData({ ...petData, weight: e.target.value })}
                placeholder="e.g., 12.5"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input
                type="text"
                value={petData.color}
                onChange={(e) => setPetData({ ...petData, color: e.target.value })}
                placeholder="e.g., Golden"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 border-2 border-gray-300 rounded-xl font-medium text-gray-700"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleSavePet}
              disabled={loading}
              className="flex-1 py-3 bg-[#FF8C42] hover:bg-[#FF7A35] rounded-xl text-white font-medium disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Add Pet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline Add Address Modal Component
function AddAddressModalInline({ phone, onClose, onSuccess }: { phone: string; onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  
  const [formData, setFormData] = useState({
    id: `addr_${Date.now()}`,
    label: 'Home',
    name: '',
    phone: phone,
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
    isDefault: true,
    latitude: 0,
    longitude: 0,
  });

  const detectCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setDetectingLocation(true);

    // ✅ FIX: Request location with proper error handling
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setFormData(prev => ({ ...prev, latitude, longitude }));
        
        // Try reverse geocoding
        try {
          const apiKey =
            (await getGoogleMapsBrowserApiKey()) ||
            process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
            '';
          if (!apiKey) {
            console.warn('Google Maps API key not configured');
            toast.error('Location services not configured. Please enter address manually.');
            setDetectingLocation(false);
            return;
          }

          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
          );
          const data = await response.json();

          if (data.results && data.results[0]) {
            const addressComponents = data.results[0].address_components;
            let street = '', city = '', state = '', pincode = '';

            addressComponents.forEach((component: any) => {
              if (component.types.includes('street_number') || component.types.includes('route')) {
                street += component.long_name + ' ';
              }
              if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
                city = component.long_name;
              }
              if (component.types.includes('administrative_area_level_1')) {
                state = component.long_name;
              }
              if (component.types.includes('postal_code')) {
                pincode = component.long_name;
              }
            });

            setFormData(prev => ({
              ...prev,
              addressLine1: street.trim(),
              city,
              state,
              pincode
            }));
            toast.success('Location detected successfully!');
          } else {
            toast.error('Could not determine address from location. Please enter manually.');
          }
        } catch (error) {
          console.error('Error reverse geocoding:', error);
          toast.error('Error processing location. Please enter address manually.');
        } finally {
          setDetectingLocation(false);
        }
      },
      (error) => {
        setDetectingLocation(false);
        // ✅ FIX: Provide specific error messages
        if (error.code === error.PERMISSION_DENIED) {
          toast.error('Location permission denied. Please enable location access or enter address manually.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          toast.error('Location unavailable. Please enter address manually.');
        } else if (error.code === error.TIMEOUT) {
          toast.error('Location request timed out. Please enter address manually.');
        } else {
          toast.error('Unable to get location. Please enter address manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveAddress = async () => {
    if (!formData.name || !formData.addressLine1 || !formData.city || !formData.state || !formData.pincode) {
      toast.error('Please fill in required fields (Name, Address, City, State, Pincode)');
      return;
    }
    
    setLoading(true);
    try {
      // Get existing addresses
      const getAddressData = await apiClient.get(`/customer/addresses?phone=${encodeURIComponent(phone)}`) as any;
      let existingAddresses = [];
      if (Array.isArray(getAddressData)) {
        existingAddresses = getAddressData;
      } else if (Array.isArray(getAddressData.addresses)) {
        existingAddresses = getAddressData.addresses;
      }
      
      // If this is default, unset other defaults
      if (formData.isDefault) {
        existingAddresses = existingAddresses.map((a: any) => ({ ...a, isDefault: false }));
      }
      
      // ✅ FIX B5: Send address in the correct format expected by the API
      // The API expects individual fields, not an addresses array
      await apiClient.post('/customer/addresses', {
        phone: phone,
        name: formData.name,
        fullName: formData.name,
        addressLine1: formData.addressLine1,
        addressLine2: formData.addressLine2 || null,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        landmark: formData.landmark || null,
        coordinates: (formData.latitude && formData.longitude ? { lat: formData.latitude, lng: formData.longitude } : null),
        isDefault: formData.isDefault || (existingAddresses.length === 0),
        label: formData.label || 'home'
      });
      
      toast.success('Address added successfully!');
      onSuccess();
    } catch (error: any) {
      console.error('Error saving address:', error);
      // ✅ FIX: Show specific error message from API
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to save address';
      const missingFields = error?.response?.data?.missingFields;
      if (missingFields && missingFields.length > 0) {
        toast.error(`Missing required fields: ${missingFields.join(', ')}`);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={onClose}>
      <div 
        className="bg-white rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ✅ STANDARD HEADER - Exact match with CustomerHomeComplete */}
        {/* Header is provided by renderScreenWithLayout wrapper (StandardizedHeader) */}
        <div className="p-4 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-white" />
              <h3 className="text-lg font-bold text-white">Add New Address</h3>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
        
        <div className="p-5 space-y-4">
          {/* Detect Location Button */}
          <button
            type="button"
            onClick={detectCurrentLocation}
            disabled={detectingLocation}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {detectingLocation ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Detecting Location...
              </>
            ) : (
              <>
                <MapPin className="w-5 h-5" />
                Detect My Current Location
              </>
            )}
          </button>

          <div className="relative">
            <div className="absolute inset-x-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-sm text-gray-500">or enter manually</span>
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
            <select
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            >
              <option value="Home">Home</option>
              <option value="Work">Work</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter your full name"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Address Line 1 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.addressLine1}
              onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
              placeholder="House/Flat No., Building Name, Street"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Address Line 2 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
            <input
              type="text"
              value={formData.addressLine2}
              onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
              placeholder="Area, Locality (Optional)"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* City and Pincode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g., Mumbai"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pincode <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                placeholder="e.g., 400001"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* State */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              placeholder="e.g., Maharashtra"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Landmark */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Landmark</label>
            <input
              type="text"
              value={formData.landmark}
              onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
              placeholder="Near..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Default Address Toggle */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <input
              type="checkbox"
              id="isDefault"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <label htmlFor="isDefault" className="text-sm font-medium text-gray-700">Set as default address</label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 border-2 border-gray-300 rounded-xl font-medium text-gray-700"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAddress}
              disabled={loading}
              className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl text-white font-medium disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Add Address'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
