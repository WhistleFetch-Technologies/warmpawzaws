"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { UtensilsCrossed, Apple, Heart, Calendar, Clock, MapPin, User, CreditCard, CheckCircle2, ChevronRight, Package, Gift, Plus, X, Upload, Video, Home, Building2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { mergeCustomerVendorServicesPayload } from '@/lib/customer-vendor-services-merge';
import { runInlineAddressDetect, inlineAddressCoordsPayload } from '@/lib/run-inline-address-detect';
import { toast } from 'sonner';
import { EnhancedAddPetModal } from '../EnhancedAddPetModal';
import { ServiceDashboardHeader, StepInfo } from '../shared/ServiceDashboardHeader';
import { PrePaymentBookingReview } from '../booking/PrePaymentBookingReview';
import { UniversalPaymentPage } from '../payment/UniversalPaymentPage';
import { catalogPriceIncludesTax } from '@/lib/booking-display-utils';
import { NutritionistBookingRouterProps, Pet, TimeSlot } from './constants/interface';
import { defaultServiceTypeOptions } from './constants';
import { formatLocalDateYYYYMMDD } from '@/lib/local-calendar-date';
import { normalizeAvailableSlotsResponse, buildDefaultSlotsWithPastGuard } from '@/lib/available-slots-response';
import { SERVICE_DESC_VIEW_MORE_MIN_LEN } from '@/lib/service-description-preview';
import { cn } from '@/components/ui/utils';
import { useWapptAppointmentBooking } from '@/hooks/useWapptAppointmentBooking';
import { useWapptBookingSlots } from '@/hooks/useWapptBookingSlots';
import {
  WAPPT_APPOINTMENT_SERVICE_ID,
  WAPPT_BOOKING_MODE,
  WAPPT_DEFAULT_SLOT_DURATION_MIN,
  getWarmpawzAppointmentServiceLabel,
} from '@/lib/warmpawz-appointments-customer';
import { WapptBookingDetailsStep } from '../warmpawz-appointments/WapptBookingDetailsStep';
import { WapptBookingSummaryStep } from '../warmpawz-appointments/WapptBookingSummaryStep';
import { WapptBookingAddressStep } from '../warmpawz-appointments/WapptBookingAddressStep';
import {
  formatWapptAddressLine,
  getWapptBookingPreviousStep,
  getWapptBookingStepIndex,
  getWapptBookingSteps,
} from '@/lib/warmpawz-appointments/wappt-booking-flow-steps';

/** Real catalog service UUID (not role/category slugs like pet_nutritionist). */
function looksLikeCatalogServiceId(id: string | undefined | null): id is string {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
}

function normalizeSlug(s: string): string {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

/** Maps props to API booking styles only; returns null for role/category strings. */
function normalizeToBookingStyle(style: string | undefined | null): 'tele' | 'at_home' | 'at_center' | null {
  if (!style) return null;
  const k = normalizeSlug(style);
  const map: Record<string, 'tele' | 'at_home' | 'at_center'> = {
    tele: 'tele',
    online: 'tele',
    video_consultation: 'tele',
    at_home: 'at_home',
    home_visit: 'at_home',
    at_center: 'at_center',
    at_clinic: 'at_center',
    at_vendor: 'at_center',
  };
  return map[k] ?? null;
}

function deriveInitialBookingStyle(
  serviceStyle: string | undefined,
  serviceType: string | undefined
): 'tele' | 'at_home' | 'at_center' {
  return normalizeToBookingStyle(serviceStyle) ?? normalizeToBookingStyle(serviceType) ?? 'tele';
}

type BookingStep = 'service' | 'datetime' | 'address' | 'summary' | 'pet' | 'payment' | 'confirmation';



export function NutritionistBookingRouter({
  phone,
  vendorId,
  nutritionist,
  selectedService,
  serviceType,
  serviceId,
  serviceName,
  serviceStyle,
  price,
  duration,
  appointmentsMode: _appointmentsMode = false,
  onBack,
  onNavigate,
  onViewBooking,
  onInternalBackReady,
}: NutritionistBookingRouterProps) {
  // Nutrition booking stays marketplace-only (no WAPPT wizard), even from WAPPT discovery profile.
  void _appointmentsMode;
  const appointmentsMode = false;

  console.log('NutritionistBookingRouter--------------------->', phone, vendorId, nutritionist, selectedService, serviceType, serviceId, serviceName, serviceStyle, price, duration, onBack, onNavigate, onViewBooking);

  const catalogServiceId = [serviceId, selectedService].find(looksLikeCatalogServiceId);
  const hasServiceContext = appointmentsMode && vendorId ? true : Boolean(catalogServiceId);
  const initialBookingStyle = deriveInitialBookingStyle(serviceStyle, serviceType);

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
  }, [catalogServiceId, hasServiceContext, step]);
  const [loading, setLoading] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState<'tele' | 'at_home' | 'at_center'>(initialBookingStyle);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [vendorServices, setVendorServices] = useState<any[]>([]);
  const [showPaymentPage, setShowPaymentPage] = useState(false);
  const [selectedVendorService, setSelectedVendorService] = useState<any>(
    catalogServiceId
      ? {
          id: catalogServiceId,
          serviceId: catalogServiceId,
          name: serviceName,
          price: price,
          duration: duration,
          serviceStyle: initialBookingStyle,
        }
      : null
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
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});

  const toggleExpanded = (id: string) => {
    setExpandedServices((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Map vendor services to display format (API already filters by style via query param)
  const mapVendorServices = () => {
    // Services are already filtered by serviceStyle on the backend
    return vendorServices.map(s => {
      const style = s.serviceStyle || s.service_style || selectedServiceType;
      return {
        id: s.id || s.serviceId,
        serviceId: s.serviceId || s.service_id,
        name: s.serviceName || s.service_name || s.name,
        price: s.price || 0,
        duration: s.duration || s.durationMinutes || 30,
        desc: s.description || s.shortDescription || '',
        serviceStyle: style,
        icon: style === 'tele' ? Video : style === 'at_home' ? Home : Building2,
        color: style === 'tele' ? 'blue' : style === 'at_home' ? 'green' : 'purple',
      };
    });
  };

  // Use actual vendor services or fallback to defaults (only when API hasn't loaded yet)
  const serviceOptions =
    vendorServices.length > 0 ? mapVendorServices() : defaultServiceTypeOptions;

  const generateDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push({
        date: formatLocalDateYYYYMMDD(date),
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
  const slotFetchSeq = useRef(0);

  // Use vendorId for nutrition services
  const effectiveVendorId = vendorId;

  const slotDurationMinutes = Math.max(
    15,
    Number(
      selectedVendorService?.duration ??
        selectedVendorService?.duration_minutes ??
        duration ??
        60
    ) || 60
  );

  const loadTimeSlots = async (date: string) => {
    if (!effectiveVendorId) return;
    const seq = ++slotFetchSeq.current;

    try {
      setLoadingSlots(true);
      const sid = String(
        selectedVendorService?.serviceId ?? selectedVendorService?.id ?? serviceId ?? ''
      ).trim();
      const params = new URLSearchParams();
      params.set('date', date);
      params.set('serviceStyle', selectedServiceType);
      params.set('totalDuration', String(slotDurationMinutes));
      if (sid && looksLikeCatalogServiceId(sid)) params.set('serviceId', sid);

      const raw = await apiClient.get(
        `/customer/vendor/${effectiveVendorId}/available-slots?${params.toString()}`
      );

      if (seq !== slotFetchSeq.current) return;

      const { success, slots: normalized, message } = normalizeAvailableSlotsResponse(raw, date);

      if (success && normalized.length > 0) {
        setTimeSlots(normalized);
        return;
      }

      if (!success) {
        setTimeSlots(buildDefaultSlotsWithPastGuard(date));
        return;
      }

      setTimeSlots([]);
      if (message && process.env.NODE_ENV === 'development') {
        console.warn('[NutritionistBooking] available-slots:', message);
      }
    } catch (error) {
      if (seq !== slotFetchSeq.current) return;
      console.error('Error loading time slots:', error);
      setTimeSlots(buildDefaultSlotsWithPastGuard(date));
    } finally {
      if (seq === slotFetchSeq.current) {
        setLoadingSlots(false);
      }
    }
  };

  // Load slots when date is selected and vendor is known
  useEffect(() => {
    if (selectedDate && effectiveVendorId) {
      loadTimeSlots(selectedDate);
    } else {
      setTimeSlots([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadTimeSlots uses latest slot duration / catalog service
  }, [selectedDate, effectiveVendorId, selectedServiceType, slotDurationMinutes, selectedVendorService?.id, serviceId]);

  const [dates] = useState(generateDates());

  const wapptBooking = useWapptAppointmentBooking({
    appointmentsMode,
    vendorId: effectiveVendorId,
    category: 'nutrition',
    serviceStyle: serviceStyle || serviceType || 'at_center',
    initialPrice: price,
  });

  useEffect(() => {
    if (!appointmentsMode || !wapptBooking.selectedVendorService) return;
    setSelectedVendorService(wapptBooking.selectedVendorService);
  }, [appointmentsMode, wapptBooking.selectedVendorService]);

  const wapptFlowSteps = useMemo(
    () =>
      appointmentsMode
        ? getWapptBookingSteps(selectedServiceType === 'at_home' ? 'at_home' : 'at_center')
        : [],
    [appointmentsMode, selectedServiceType],
  );

  const wapptSlots = useWapptBookingSlots({
    vendorId: effectiveVendorId,
    serviceStyle: selectedServiceType === 'at_home' ? 'at_home' : selectedServiceType === 'tele' ? 'tele' : 'at_center',
    totalDurationMinutes: WAPPT_DEFAULT_SLOT_DURATION_MIN,
    selectedDate,
    enabled: appointmentsMode && !!effectiveVendorId,
  });

  const wapptReviewTotal =
    wapptBooking.appointmentFee ?? selectedVendorService?.price ?? price ?? 0;

  useEffect(() => {
    loadCustomerData();
    if (effectiveVendorId && !appointmentsMode) {
      loadVendorServices();
    }
  }, [phone, effectiveVendorId, selectedServiceType, appointmentsMode]);

  const loadVendorServices = async () => {
    if (!effectiveVendorId) return;

    try {
      setLoading(true);
      // Fetch vendor services filtered by serviceStyle only (no category filter — vendor was
      // already resolved from the nutritionist listing, so all their tele services are relevant)
      const serviceStyleParam = selectedServiceType ? `?serviceStyle=${selectedServiceType}` : '';
      const servicesResponse = await apiClient.get(`/customer/vendor/${effectiveVendorId}/services${serviceStyleParam}`) as any;
      console.log('servicesResponse--------------------->', servicesResponse);
      if (servicesResponse.success && servicesResponse.services) {
        setVendorServices(mergeCustomerVendorServicesPayload(servicesResponse));
        console.log('✅ Loaded vendor services:', servicesResponse.services.length);
      } else {
        console.warn('⚠️ No services found or invalid response');
      }
    } catch (error) {
      console.error('❌ Error loading vendor services:', error);
      // Don't set vendorServices to empty - keep existing or fall back to defaults
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
    if (!customerId || !effectiveVendorId) return;

    try {
      const response = await apiClient.get<any>(
        `/packages/check-for-booking?customerId=${customerId}&vendorId=${effectiveVendorId}${selectedServiceType ? `&serviceType=${selectedServiceType}` : ''}`
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
    if (!appointmentsMode && customerId && effectiveVendorId) {
      void checkForActivePackages();
    }
  }, [customerId, effectiveVendorId, appointmentsMode, selectedServiceType]);

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

  const handleContinueFromBookingDetails = () => {
    if (!selectedDate || !selectedTime) {
      toast.error('Please select date and time');
      return;
    }
    const selectedSlot = wapptSlots.timeSlots.find((s) => s.time === selectedTime);
    if (selectedSlot && !selectedSlot.available) {
      toast.error('This time slot is already booked. Please select a different time.');
      return;
    }
    if (!selectedPet) {
      toast.error('Please select a pet');
      return;
    }
    if (selectedServiceType === 'at_home') {
      setStep('address');
    } else {
      setSelectedAddress({ id: 'clinic' });
      setStep('summary');
    }
  };

  const handleContinueFromAddress = () => {
    if (!selectedAddress) {
      toast.error('Please select a delivery address');
      return;
    }
    setStep('summary');
  };

  const handleNext = () => {
    const steps: BookingStep[] = ['service', 'datetime', 'pet', 'address', 'payment', 'confirmation'];
    const currentIdx = steps.indexOf(step);

    // ✅ FIX: Skip address for tele and at_center (customer goes to clinic)
    if (step === 'pet' && (selectedServiceType === 'tele' || selectedServiceType === 'at_center')) {
      setStep('payment');
      return;
    }

    if (currentIdx < steps.length - 1) {
      setStep(steps[currentIdx + 1]);
    }
  };

  const handleBack = useCallback(() => {
    if (showPaymentPage) {
      setShowPaymentPage(false);
      if (appointmentsMode) {
        setStep('summary');
        return;
      }
      return;
    }
    if (appointmentsMode && wapptFlowSteps.length > 0) {
      const prev = getWapptBookingPreviousStep(
        wapptFlowSteps,
        step as 'datetime' | 'address' | 'summary' | 'payment',
      );
      if (prev) {
        setStep(prev);
        return;
      }
      if (step === 'datetime' && hasServiceContext) {
        onBack();
        return;
      }
    }
    const steps: BookingStep[] = ['service', 'datetime', 'pet', 'address', 'payment', 'confirmation'];
    const currentIdx = steps.indexOf(step);

    if (step === 'payment' && (selectedServiceType === 'tele' || selectedServiceType === 'at_center')) {
      setStep('pet');
      return;
    }

    if (step === 'datetime' && hasServiceContext) {
      onBack();
      return;
    }

    if (currentIdx > 0) {
      const prevStep = steps[currentIdx - 1];
      if (prevStep === 'service' && hasServiceContext) {
        onBack();
        return;
      }
      setStep(prevStep);
    } else {
      onBack();
    }
  }, [showPaymentPage, step, selectedServiceType, onBack, hasServiceContext, appointmentsMode, wapptFlowSteps]);

  useEffect(() => {
    if (onInternalBackReady) {
      onInternalBackReady(handleBack);
    }
  }, [handleBack, onInternalBackReady]);

  const handleConfirmBooking = async () => {
    setProcessing(true);
    try {
      // Use selectedVendorService (user's selection) or fall back
      const bookedService =
        selectedVendorService ||
        serviceOptions.find(
          (s: any) => normalizeToBookingStyle(s.serviceStyle ?? s.service_style) === selectedServiceType
        ) ||
        serviceOptions[0];

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
        } catch (err: any) {
          console.error('Error creating package session:', err);
          const errorMessage = err?.response?.data?.error || err?.message || 'Failed to create package session';
          toast.error(errorMessage);
          setProcessing(false);
          return; // Don't proceed to confirmation on error
        }
      } else {
        // Regular booking: CreateBookingRequestSchema expects camelCase (customerId, vendorId, serviceId UUID, bookingDate, bookingTime, serviceType)
        const vendorIdValue = effectiveVendorId || '';
        const opt = bookedService as { serviceId?: string; service_id?: string } | undefined;
        const serviceIdValue = opt?.service_id ?? opt?.serviceId ?? serviceId ?? bookedService?.id ?? '';
        if (!vendorIdValue || !serviceIdValue) {
          toast.error('Missing vendor or service. Please go back and select a service.');
          setProcessing(false);
          return;
        }
        const customerIdValue = customerId;
        if (!customerIdValue) {
          toast.error('Could not load your profile. Please try again.');
          setProcessing(false);
          return;
        }
        const serviceTypeEnum = selectedServiceType === 'at_center' ? 'at_center' : selectedServiceType === 'at_home' ? 'at_home' : 'tele';
        const bookingData = {
          customerId: customerIdValue,
          vendorId: vendorIdValue,
          serviceId: serviceIdValue,
          bookingDate: selectedDate,
          bookingTime: selectedTime,
          serviceType: serviceTypeEnum,
          amount: usePackageSession ? 0 : (bookedService?.price ?? 0),
          petId: selectedPet?.id || undefined,
          petName: selectedPet?.name,
          notes: notes || undefined,
          serviceName: bookedService?.name,
          customerPhone: phone,
          ...(selectedServiceType === 'at_home' && selectedAddress && {
            address: [selectedAddress.addressLine1, selectedAddress.city, selectedAddress.state, selectedAddress.pincode].filter(Boolean).join(', '),
            city: selectedAddress.city,
            state: selectedAddress.state,
            pincode: selectedAddress.pincode,
          }),
        };

        try {
          const response = await apiClient.post('/bookings/create', bookingData) as any;
          const res = response?.data ?? response;
          setBookingId(res?.bookingId || res?.booking?.id || res?.id || 'BK-' + Date.now());
        } catch (err: any) {
          console.error('Error creating booking:', err);
          const errorMessage = err?.response?.data?.error || err?.message || 'Failed to create booking';
          toast.error(errorMessage);
          setProcessing(false);
          return; // Don't proceed to confirmation on error
        }
      }

      setStep('confirmation');
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error('Failed to create booking. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Use selectedVendorService if available (real vendor service), otherwise try matching by style
  const selectedServiceOption =
    selectedVendorService ||
    serviceOptions.find(
      (s: any) => normalizeToBookingStyle(s.serviceStyle ?? s.service_style) === selectedServiceType
    );

  const dashboardStats: Array<{ value: string; label: string }> = [];

  const getServiceTitle = () => {
    if (nutritionist?.name) return `Book with ${nutritionist.name}`;
    return 'Pet Nutrition';
  };

  const getServiceSubtitle = () => {
    if (selectedServiceType === 'tele') return 'Video consultation';
    if (selectedServiceType === 'at_home') return 'Nutritionist comes to you';
    return 'Expert nutrition consultation';
  };

  // ✅ FIX: Prepare step indicators for header
  const getStepIndicators = (): StepInfo[] | undefined => {
    if (step === 'payment' || step === 'confirmation') return undefined;

    if (appointmentsMode && wapptFlowSteps.length > 0) {
      const flowStep = step === 'address' || step === 'datetime' || step === 'summary' ? step : 'datetime';
      const currentIdx = getWapptBookingStepIndex(wapptFlowSteps, flowStep);
      if (currentIdx >= 0) {
        return wapptFlowSteps.map((s, idx) => ({
          label: s.label,
          isCompleted: idx < currentIdx,
          isCurrent: idx === currentIdx,
        }));
      }
    }

    const stepLabels = selectedServiceType === 'tele'
      ? ['Service', 'Date/Time', 'Pet', 'Payment']
      : ['Service', 'Date/Time', 'Pet', 'Address', 'Payment'];
    const currentStepMap: Record<BookingStep, number> = {
      service: 0, datetime: 1, pet: 2, address: 3, summary: selectedServiceType === 'tele' ? 3 : 4, payment: selectedServiceType === 'tele' ? 3 : 4, confirmation: 5
    };
    const currentIdx = currentStepMap[step];

    return stepLabels.map((label, idx) => ({
      label,
      isCompleted: idx < currentIdx,
      isCurrent: idx === currentIdx
    }));
  };

  const proceedToPaymentOrPackage = () => {
    if (usePackageSession && activePackage) {
      handleConfirmBooking();
      return;
    }
    if (!selectedVendorService && selectedServiceOption) {
      setSelectedVendorService(selectedServiceOption);
    }
    setStep('payment');
    setShowPaymentPage(true);
  };

  const nutritionistPaymentScreen =
    step === 'payment' &&
    showPaymentPage &&
    selectedVendorService &&
    selectedPet &&
    selectedDate &&
    selectedTime
      ? (() => {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          let finalServiceId = selectedVendorService.service_id || selectedVendorService.serviceId;

          if (!finalServiceId || !uuidRegex.test(finalServiceId)) {
            const foundService = vendorServices.find(
              (s: any) =>
                String(s.id) === String(selectedVendorService.id) ||
                s.id === selectedVendorService.id ||
                (s.serviceId || s.service_id) === finalServiceId
            );
            if (foundService && (foundService.serviceId || foundService.service_id)) {
              finalServiceId = foundService.serviceId || foundService.service_id;
            }
          }

          if ((finalServiceId && uuidRegex.test(finalServiceId)) || appointmentsMode) {
            const displayVendorName = nutritionist?.businessName || nutritionist?.name || 'Nutritionist';
            return (
              <UniversalPaymentPage
                type="booking"
                layoutVariant="appShell"
                vendorId={vendorId || ''}
                vendorName={displayVendorName}
                serviceId={appointmentsMode ? WAPPT_APPOINTMENT_SERVICE_ID : finalServiceId}
                serviceName={
                  appointmentsMode
                    ? getWarmpawzAppointmentServiceLabel({
                        category: 'nutrition',
                        serviceStyle: selectedServiceType === 'at_home' ? 'at_home' : 'at_center',
                      })
                    : selectedVendorService.name || selectedServiceOption?.name || 'Diet Consultation'
                }
                serviceDescription={`${selectedVendorService.name || 'Diet Consultation'} for ${selectedPet.name}`}
                serviceStyle={
                  selectedServiceType === 'tele' ? 'tele' : selectedServiceType === 'at_home' ? 'at_home' : 'at_center'
                }
                bookingDate={selectedDate}
                bookingTime={selectedTime}
                petId={selectedPet.id}
                petName={selectedPet.name}
                petBreed={selectedPet.breed}
                addressId={selectedServiceType === 'at_home' ? selectedAddress?.id : undefined}
                address={
                  selectedServiceType === 'at_home' && selectedAddress
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
                baseAmount={
                  appointmentsMode
                    ? wapptBooking.appointmentFee ?? selectedVendorService.price ?? price ?? 0
                    : selectedVendorService.price || selectedServiceOption?.price || 0
                }
                priceIncludesTax={
                  catalogPriceIncludesTax(selectedVendorService) || catalogPriceIncludesTax(selectedServiceOption)
                }
                duration={
                  appointmentsMode
                    ? WAPPT_DEFAULT_SLOT_DURATION_MIN
                    : selectedVendorService.duration || selectedServiceOption?.duration || 30
                }
                customerPhone={phone}
                customerId={customerId || undefined}
                flowType={selectedServiceType === 'tele' ? 'tele-scheduled' : undefined}
                bookingMode={appointmentsMode ? WAPPT_BOOKING_MODE : undefined}
                onBack={() => {
                  setShowPaymentPage(false);
                  if (appointmentsMode) {
                    setStep('summary');
                  }
                }}
                onSuccess={(bookingId) => {
                  setBookingId(bookingId);
                  setShowPaymentPage(false);
                  setStep('confirmation');
                }}
              />
            );
          }

          return (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl max-w-md mx-auto">
              <p className="text-red-600 font-medium">Error: Invalid service ID</p>
              <p className="text-red-500 text-sm mt-1">Please go back and select the service again.</p>
              <Button onClick={() => setShowPaymentPage(false)} className="mt-3">
                Go Back
              </Button>
            </div>
          );
        })()
      : null;

  if (nutritionistPaymentScreen) {
    return nutritionistPaymentScreen;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {(step !== 'payment' || (appointmentsMode && !showPaymentPage)) && (
        <ServiceDashboardHeader
          serviceName={getServiceTitle()}
          serviceSubtitle={getServiceSubtitle()}
          serviceIcon={Apple}
          iconColor="text-white"
          stats={dashboardStats}
          steps={getStepIndicators()}
          onBack={handleBack}
          showBackButton={true}
          headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"
        />
      )}

      {step === 'payment' && !showPaymentPage && appointmentsMode && (
        <div className="max-w-md mx-auto px-4 py-6">
          <WapptBookingSummaryStep
            category="nutrition"
            serviceStyle={selectedServiceType === 'at_home' ? 'at_home' : 'at_center'}
            amount={wapptReviewTotal}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            petName={selectedPet?.name}
            petBreed={selectedPet?.breed}
            addressLine={
              selectedServiceType === 'at_home' ? formatWapptAddressLine(selectedAddress) : undefined
            }
            onBack={() => setStep(selectedServiceType === 'at_home' ? 'address' : 'datetime')}
            onContinue={proceedToPaymentOrPackage}
          />
        </div>
      )}

      {step === 'payment' && !showPaymentPage && !appointmentsMode && (
        <PrePaymentBookingReview
          title="Booking Summary"
          subtitle="Review before payment"
          headerIcon={Apple}
          stats={dashboardStats}
          onBack={handleBack}
          headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"
          lead={{
            icon:
              selectedServiceType === 'tele' ? Video : selectedServiceType === 'at_home' ? Home : Building2,
            iconContainerClassName:
              selectedServiceType === 'tele'
                ? 'bg-blue-100 text-blue-600'
                : selectedServiceType === 'at_home'
                  ? 'bg-orange-100 text-[#FF8C42]'
                  : 'bg-purple-100 text-purple-600',
            title: String(selectedServiceOption?.name ?? ''),
            subtitle: selectedServiceOption?.duration
              ? `${selectedServiceOption.duration} mins`
              : undefined,
            trailing: <span>₹{selectedServiceOption?.price}</span>,
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
            onChange: (v) => setNotes(v),
            placeholder: 'Any symptoms or concerns...',
            showNotes: true,
          }}
          total={{ label: 'Total', amountFormatted: `₹${selectedServiceOption?.price}` }}
          totalTextClassName="text-orange-600"
          primaryButton={{
            label: usePackageSession ? 'Confirm Booking' : 'Continue to Payment',
            onClick: proceedToPaymentOrPackage,
            disabled: processing,
            loading: processing,
          }}
        />
      )}

      {/* Content */}
      {(step !== 'payment' || showPaymentPage) && (
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Step indicator moved to header */}

        {/* Service Selection */}
        {step === 'service' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Select Service</h2>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42] mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">Loading vendor services...</p>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {serviceOptions.map((service) => {
                    const Icon = service.icon;
                    const isSelected = selectedVendorService?.id === service.id || ('serviceId' in service && selectedVendorService?.serviceId === service.serviceId);
                    const serviceKey = String(service.id ?? ('serviceId' in service ? service.serviceId : '') ?? '');
                    const expanded = !!expandedServices[serviceKey];
                    const descTrim = (service.desc ?? '').trim();
                    const showToggle = descTrim.length > SERVICE_DESC_VIEW_MORE_MIN_LEN;
                    return (
                      <button
                        key={service.id}
                        onClick={() => {
                          setSelectedVendorService(service);
                          const fromRow = normalizeToBookingStyle((service as any).serviceStyle);
                          setSelectedServiceType(fromRow ?? selectedServiceType);
                        }}
                        className={`w-full p-4 rounded-xl border-2 transition-all ${isSelected
                          ? 'border-[#FF8C42] bg-orange-50'
                          : 'border-gray-200 bg-white hover:border-[#FF8C42]/50'
                          }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${service.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                            service.color === 'green' ? 'bg-orange-100 text-[#FF8C42]' :
                              'bg-purple-100 text-purple-600'
                            }`}>
                            <Icon className="w-7 h-7" />
                          </div>
                          <div className="flex-1 text-left">
                            <h3 className="font-semibold text-gray-900">{service.name}</h3>
                            {descTrim ? (
                              <div>
                                <p
                                  className={cn(
                                    'text-sm leading-5 text-gray-500 break-words whitespace-pre-line',
                                    !expanded && 'line-clamp-2'
                                  )}
                                >
                                  {descTrim}
                                </p>
                                {showToggle ? (
                                  <button
                                    type="button"
                                    className="mt-1 text-[11px] font-semibold text-[#FF8C42] hover:underline"
                                    aria-expanded={expanded}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleExpanded(serviceKey);
                                    }}
                                  >
                                    {expanded ? 'View Less' : 'View More'}
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                            <div className="flex items-center gap-2 mt-1">
                              <Clock className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-sm text-gray-500">{service.duration} mins</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-gray-900">₹{service.price}</p>
                            {isSelected && (
                              <CheckCircle2 className="w-6 h-6 text-[#FF8C42] mt-1 ml-auto" />
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Button
                  onClick={handleNext}
                  className="w-full bg-[#FF8C42] hover:bg-[#FF7A35] mt-4"
                  disabled={!selectedVendorService}
                >
                  Continue
                </Button>
              </>
            )}
          </div>
        )}

        {/* Date & Time Selection */}
        {step === 'datetime' && appointmentsMode ? (
          <WapptBookingDetailsStep
            dates={wapptSlots.dates}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            timeSlots={wapptSlots.timeSlots}
            loadingSlots={wapptSlots.loadingSlots}
            pets={pets}
            selectedPet={selectedPet}
            onDateSelect={setSelectedDate}
            onTimeSelect={setSelectedTime}
            onPetSelect={(pet) =>
              setSelectedPet({
                id: pet.id,
                name: pet.name,
                species: pet.species ?? '',
                breed: pet.breed ?? '',
              })
            }
            onAddPet={() => setShowAddPetModal(true)}
            onContinue={handleContinueFromBookingDetails}
          />
        ) : null}

        {step === 'address' && appointmentsMode && selectedServiceType === 'at_home' ? (
          <WapptBookingAddressStep
            addresses={addresses}
            selectedAddress={selectedAddress}
            onSelect={setSelectedAddress}
            onAddAddress={() => setShowAddAddressModal(true)}
            onContinue={handleContinueFromAddress}
            hint="An address is required for home nutrition visit."
          />
        ) : null}

        {step === 'summary' && appointmentsMode ? (
          <WapptBookingSummaryStep
            category="nutrition"
            serviceStyle={selectedServiceType === 'at_home' ? 'at_home' : 'at_center'}
            amount={wapptReviewTotal}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            petName={selectedPet?.name}
            petBreed={selectedPet?.breed}
            addressLine={
              selectedServiceType === 'at_home' ? formatWapptAddressLine(selectedAddress) : undefined
            }
            onBack={() => setStep(selectedServiceType === 'at_home' ? 'address' : 'datetime')}
            onContinue={proceedToPaymentOrPackage}
          />
        ) : null}

        {step === 'datetime' && !appointmentsMode ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-3">Select Date</h2>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {dates.map((d) => (
                  <button
                    key={d.date}
                    onClick={() => setSelectedDate(d.date)}
                    className={`flex-shrink-0 w-16 p-3 rounded-xl text-center transition-all ${selectedDate === d.date
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
                <h2 className="text-lg font-bold text-gray-900 mb-1">Select Time</h2>
                <p className="text-xs text-gray-500 mb-2">Select next closest time</p>
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
                        className={`p-3 rounded-xl text-center transition-all ${selectedTime === slot.time
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
        ) : null}

        {/* Pet Selection */}
        {step === 'pet' && !appointmentsMode && (
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
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                🐾 A pet profile is required for this service to provide the best care.
              </p>
            </div>

            <div className="space-y-3">
              {pets.length > 0 ? (
                pets.map((pet) => (
                  <button
                    key={pet.id}
                    onClick={() => setSelectedPet(pet)}
                    className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${selectedPet?.id === pet.id
                      ? 'border-[#FF8C42] bg-orange-50'
                      : 'border-gray-200 bg-white hover:border-[#FF8C42]/50'
                      }`}
                  >
                    <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center text-2xl">
                      {pet.species === 'dog' || (pet.species || '').toLowerCase().includes('dog') ? '🐕' :
                        pet.species === 'cat' || (pet.species || '').toLowerCase().includes('cat') ? '🐈' : '🐾'}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold text-gray-900">{pet.name}</h3>
                      <p className="text-sm text-gray-500 capitalize">{pet.breed}</p>
                    </div>
                    {selectedPet?.id === pet.id && (
                      <CheckCircle2 className="w-6 h-6 text-orange-500" />
                    )}
                  </button>
                ))
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                  <div className="text-5xl mb-3">🐾</div>
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
        {step === 'address' && !appointmentsMode && selectedServiceType !== 'tele' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {selectedServiceType === 'at_home' ? 'Select Your Address' : 'Confirm Clinic Address'}
              </h2>
              {(selectedServiceType === 'at_home') && (
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
            {(selectedServiceType === 'at_home') && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  📍 An address is required for home service delivery.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {(selectedServiceType === 'at_home') ? (
                addresses.length > 0 ? (
                  addresses.map((addr) => (
                    <button
                      key={addr.id}
                      onClick={() => setSelectedAddress(addr)}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left ${selectedAddress?.id === addr.id
                        ? 'border-[#FF8C42] bg-orange-50'
                        : 'border-gray-200 bg-white hover:border-[#FF8C42]/50'
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-lg">
                          {(addr.label || '').toLowerCase() === 'home' ? '🏠' :
                            (addr.label || '').toLowerCase() === 'work' ? '🏢' : '📍'}
                        </span>
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
                          <CheckCircle2 className="w-6 h-6 text-orange-500" />
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                    <div className="text-5xl mb-3">📍</div>
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
                    <Home className="w-5 h-5 text-[#FF8C42] mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-gray-900">{nutritionist?.businessName || nutritionist?.name || 'Photo Studio'}</h3>
                      <p className="text-sm text-gray-600">{nutritionist?.address || 'Address will be shared after confirmation'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm selected address */}
            {selectedServiceType === 'at_home' && selectedAddress && addresses.length > 0 && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-[#FF6B35] font-medium">
                  ✓ Service will be delivered to: {selectedAddress?.label || 'Selected Address'}
                </p>
              </div>
            )}

            <Button
              onClick={() => {
                if (selectedServiceType === 'at_center') setSelectedAddress({ id: 'clinic' });
                handleNext();
              }}
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A35]"
              disabled={selectedServiceType === 'at_home' && !selectedAddress}
            >
              {selectedServiceType === 'at_home' && !selectedAddress ? 'Select an Address to Continue' : 'Continue'}
            </Button>
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
                    <p className="text-sm text-purple-600">Get up to 30% off with health packages</p>
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
                  <div className="border rounded-lg p-3 hover:border-orange-300 cursor-pointer transition-colors" onClick={() => onNavigate('purchase-package', { vendorId: vendorId, packageType: 'nutrition-5' })}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">5 Consultation Pack</h4>
                        <p className="text-sm text-gray-500">5 sessions • Valid 6 months</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-orange-600">₹4,499</span>
                        <p className="text-xs text-gray-400 cw-price-strike">₹4,995</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-orange-100 text-[#FF7A35] text-xs rounded-full">Save 10%</span>
                    </div>
                  </div>

                  <div className="border rounded-lg p-3 hover:border-orange-300 cursor-pointer transition-colors" onClick={() => onNavigate('purchase-package', { vendorId: vendorId, packageType: 'nutrition-10' })}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">10 Consultation Pack</h4>
                        <p className="text-sm text-gray-500">10 sessions • Valid 12 months</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-orange-600">₹9,999</span>
                        <p className="text-xs text-gray-400 cw-price-strike">₹12,990</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-orange-100 text-[#FF7A35] text-xs rounded-full">Save 23%</span>
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">Best Value</span>
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
        {showPackageModal && activePackage && !appointmentsMode && (
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

      toast.success(`${petData.name} added successfully! 🐾`);
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
            <h3 className="text-lg font-bold text-white">Add New Pet 🐾</h3>
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
                <Upload className="w-8 h-8 text-orange-500" />
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
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
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
                  className={`py-2.5 px-3 border-2 rounded-xl transition font-medium text-sm ${petData.type === type ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]' : 'border-gray-200 text-gray-700'
                    }`}
                >
                  {type === 'Dog' ? '🐕' : type === 'Cat' ? '🐈' : '🐾'} {type}
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
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
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
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                value={petData.gender}
                onChange={(e) => setPetData({ ...petData, gender: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
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
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input
                type="text"
                value={petData.color}
                onChange={(e) => setPetData({ ...petData, color: e.target.value })}
                placeholder="e.g., Golden"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
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

  const detectCurrentLocation = async () => {
    setDetectingLocation(true);
    try {
      await runInlineAddressDetect(setFormData);
    } finally {
      setDetectingLocation(false);
    }
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
        ...inlineAddressCoordsPayload(formData),
        isDefault: formData.isDefault || (existingAddresses.length === 0),
        label: formData.label || 'home'
      });

      toast.success('Address added successfully! 📍');
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
        <div className="bg-gradient-to-br from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] p-4 rounded-t-3xl sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Add New Address 📍</h3>
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
              <option value="Home">🏠 Home</option>
              <option value="Work">🏢 Work</option>
              <option value="Other">📍 Other</option>
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
