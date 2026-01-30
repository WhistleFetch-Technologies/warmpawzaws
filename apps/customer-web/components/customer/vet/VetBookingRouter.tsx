"use client";

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Video, Home, Building2, Calendar, Clock, MapPin, User, CreditCard, CheckCircle2, ChevronRight, Package, Gift, Plus, X, Upload, Stethoscope, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { ServiceDashboardHeader, StepInfo } from '../shared/ServiceDashboardHeader';
import { StandardizedFooter } from '../shared/StandardizedFooter';
import { UniversalPaymentPage } from '../payment/UniversalPaymentPage';
import { trackBookingStep, useBookingAnalytics } from '@/lib/analytics';

interface VetBookingRouterProps {
  phone: string;
  doctorId?: string;
  vendorId?: string; // ✅ FIX: Add vendorId to support clinic/vendor context
  clinicId?: string; // ✅ FIX: Add clinicId for clinic bookings
  doctor?: any;
  selectedService?: any; // Service object with id, name, price, etc.
  serviceType?: string;
  serviceId?: string; // ✅ FIX: Add serviceId to handle specific service selection
  serviceName?: string; // ✅ FIX: Add serviceName
  serviceStyle?: string; // ✅ FIX: Add serviceStyle to preserve context
  price?: number; // ✅ FIX: Add price
  duration?: number; // ✅ FIX: Add duration
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string) => void;
}

type BookingStep = 'service' | 'details' | 'payment' | 'confirmation';

interface TimeSlot {
  time: string;
  available: boolean;
}

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
  photo?: string;
}

export function VetBookingRouter({ 
  phone, 
  doctorId, 
  vendorId,
  clinicId,
  doctor, 
  selectedService, 
  serviceType,
  serviceId,
  serviceName,
  serviceStyle,
  price,
  duration,
  onBack, 
  onNavigate, 
  onViewBooking 
}: VetBookingRouterProps) {
  // ✅ FIX: If serviceType/serviceStyle is provided, skip service selection and go to details
  // This preserves the service-style context when coming from service listing
  const hasServiceContext = (serviceType || serviceStyle) && (serviceId || selectedService);
  const initialStep: BookingStep = hasServiceContext ? 'details' : 'service';
  const [step, setStep] = useState<BookingStep>(initialStep);
  
  // ✅ FIX: Prevent step from resetting to 'service' if we have service context
  // Use a ref to track if we've already initialized to avoid loops
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current && hasServiceContext && step === 'service') {
      // If we have service context but step is 'service', move to details
      setStep('details');
      initializedRef.current = true;
    }
  }, [serviceId, serviceType, serviceStyle, step]);
  const [loading, setLoading] = useState(false);
  // ✅ FIX: Map 'clinic' to 'at_center', use serviceStyle if provided, otherwise fall back to serviceType
  const normalizedServiceType = (serviceStyle || serviceType) === 'clinic' ? 'at_center' : (serviceStyle || serviceType || 'tele');
  const [selectedServiceType, setSelectedServiceType] = useState(normalizedServiceType);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [showPaymentPage, setShowPaymentPage] = useState(false);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [vendorServices, setVendorServices] = useState<any[]>([]);
  // ✅ FIX: Initialize selectedVendorService with passed service data if available
  const [selectedVendorService, setSelectedVendorService] = useState<any>(
    selectedService || (serviceId ? {
      id: serviceId,
      serviceId: serviceId,
      name: serviceName,
      price: price,
      duration: duration,
      serviceStyle: serviceStyle || serviceType
    } : null)
  );
  
  // Package awareness state
  const [activePackage, setActivePackage] = useState<any>(null);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [usePackageSession, setUsePackageSession] = useState(false);
  const [showPackageOffer, setShowPackageOffer] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  
  // ✅ ANALYTICS: Track booking steps
  const analytics = useBookingAnalytics('vet', selectedServiceType as any);
  
  useEffect(() => {
    const stepToAnalyticsMap: Record<BookingStep, string> = {
      'service': 'service_selection',
      'details': 'schedule_selection',
      'payment': 'payment_initiated',
      'confirmation': 'booking_confirmed',
    };
    
    const analyticsStep = stepToAnalyticsMap[step];
    if (analyticsStep) {
      trackBookingStep({
        step: analyticsStep as any,
        serviceCategory: 'vet',
        serviceStyle: selectedServiceType as any,
        vendorId: vendorId || doctorId,
        petId: selectedPet?.id,
        phone,
        metadata: {
          serviceName: selectedVendorService?.name || serviceName,
          price: selectedVendorService?.price || price,
        }
      });
    }
  }, [step, selectedServiceType, vendorId, doctorId, selectedPet?.id]);
  
  // Add Pet/Address modal states
  const [showAddPetModal, setShowAddPetModal] = useState(false);
  
  // User profile data for header
  const [userName, setUserName] = useState('User');
  const [userProfilePhoto, setUserProfilePhoto] = useState<string | undefined>(undefined);
  const [customerName, setCustomerName] = useState<string>('');

  // Default service type options (used when no specific services loaded)
  const defaultServiceTypeOptions = [
    { id: 'tele', name: 'Tele Consultation', icon: Video, price: 299, duration: 15, desc: 'Video call with vet', color: 'blue' },
    { id: 'at_home', name: 'Home Visit', icon: Home, price: 599, duration: 30, desc: 'Vet comes to you', color: 'green' },
    { id: 'at_center', name: 'Clinic Visit', icon: Building2, price: 399, duration: 20, desc: 'Visit the clinic', color: 'purple' },
  ];

  // Get actual services for current style, or fall back to defaults
  const getServicesForStyle = (style: string) => {
    const styleServices = vendorServices.filter(s => s.serviceStyle === style || s.service_style === style);
    if (styleServices.length > 0) {
      return styleServices.map(s => ({
        id: s.serviceId || s.service_id, // ✅ CRITICAL: Use service_id (UUID) as id, not numeric vendor_services.id
        serviceId: s.serviceId || s.service_id, // ✅ CRITICAL: This is the UUID from services table
        vendorServiceId: s.id, // ✅ Store numeric vendor_services.id separately if needed
        name: s.serviceName || s.service_name || s.name,
        price: s.price || 0,
        duration: s.duration || 30,
        desc: s.description || '',
        serviceStyle: style,
        icon: style === 'tele' ? Video : style === 'at_home' ? Home : Building2,
        color: style === 'tele' ? 'blue' : style === 'at_home' ? 'green' : 'purple',
      }));
    }
    return [];
  };

  // Use actual services or fallback to service type selection
  const serviceOptions = vendorServices.length > 0 
    ? getServicesForStyle(selectedServiceType) 
    : defaultServiceTypeOptions;

  // ✅ FIX: Create a computed service option that includes passed service data
  // This ensures the booking summary shows correct info even when service doesn't match options
  const getSelectedServiceOption = () => {
    // First try to find in service options
    const fromOptions = serviceOptions.find(s => s.id === selectedServiceType);
    if (fromOptions) return fromOptions;
    
    // If we have passed service data, use that
    if (selectedService || selectedVendorService) {
      const svc = selectedVendorService || selectedService;
      return {
        id: svc.id || svc.serviceId || selectedServiceType,
        name: svc.name || svc.serviceName || serviceName || 'Clinic Visit',
        price: svc.price || price || 399,
        duration: svc.duration || duration || 20,
        desc: svc.description || 'Visit the clinic',
        icon: Building2,
        color: 'orange',
      };
    }
    
    // Fallback to default based on type
    return defaultServiceTypeOptions.find(s => s.id === selectedServiceType) || defaultServiceTypeOptions[2];
  };

  const generateDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push({
        date: date.toISOString().split('T')[0],
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
    if (selectedDate && doctorId) {
      loadTimeSlots(selectedDate);
    } else {
      // Reset slots when date is cleared
      setTimeSlots([]);
    }
  }, [selectedDate, doctorId, selectedServiceType]);

  const loadTimeSlots = async (date: string) => {
    if (!doctorId) return;
    
    try {
      setLoadingSlots(true);
      const response = await apiClient.get(
        `/customer/vendor/${doctorId}/available-slots?date=${date}&serviceStyle=${selectedServiceType}`
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
    loadUserProfile();
    if (doctorId || vendorId) {
      loadVendorServices();
    }
  }, [phone, doctorId, vendorId]);

  // ✅ CRITICAL: Resolve serviceId prop to UUID when vendorServices are loaded
  useEffect(() => {
    if (serviceId && vendorServices.length > 0 && !selectedVendorService?.service_id) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      // If serviceId is already a UUID, find it in vendorServices
      if (uuidRegex.test(serviceId)) {
        const foundService = vendorServices.find((s: any) => 
          (s.serviceId || s.service_id) === serviceId
        );
        if (foundService) {
          setSelectedVendorService({
            id: foundService.id,
            serviceId: foundService.serviceId || foundService.service_id,
            service_id: foundService.serviceId || foundService.service_id,
            name: foundService.serviceName || foundService.name || serviceName,
            price: foundService.price || price || 0,
            duration: foundService.duration || duration || 30,
            serviceStyle: foundService.serviceStyle || foundService.service_style || serviceStyle || serviceType,
          });
          console.log('✅ Resolved serviceId prop to UUID:', foundService.serviceId || foundService.service_id);
          return;
        }
      }
      
      // If serviceId is numeric, find it in vendorServices by numeric id
      const foundService = vendorServices.find((s: any) => 
        String(s.id) === String(serviceId) || 
        s.id === serviceId ||
        parseInt(String(s.id), 10) === parseInt(String(serviceId), 10)
      );
      
      if (foundService && (foundService.serviceId || foundService.service_id)) {
        const uuid = foundService.serviceId || foundService.service_id;
        setSelectedVendorService({
          id: foundService.id,
          serviceId: uuid,
          service_id: uuid,
          name: foundService.serviceName || foundService.name || serviceName,
          price: foundService.price || price || 0,
          duration: foundService.duration || duration || 30,
          serviceStyle: foundService.serviceStyle || foundService.service_style || serviceStyle || serviceType,
        });
        console.log('✅ Resolved numeric serviceId to UUID:', uuid);
      } else {
        console.warn('⚠️ Could not resolve serviceId to UUID:', serviceId);
      }
    }
  }, [serviceId, vendorServices, selectedVendorService?.service_id, serviceName, price, duration, serviceStyle, serviceType]);
  
  const loadUserProfile = async () => {
    try {
      const profileResponse = await apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`) as any;
      if (profileResponse?.profile || profileResponse) {
        const profile = profileResponse.profile || profileResponse;
        const name = profile.name || profile.fullName || 'User';
        setUserName(name);
        setCustomerName(name);
        setUserProfilePhoto(profile.profilePhoto || profile.profile_image_url || profile.photo);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadVendorServices = async () => {
    if (!doctorId && !vendorId) return;
    
    try {
      setLoading(true);
      // ✅ CRITICAL: Use the correct endpoint that returns service_id (UUID)
      // Try multiple endpoints to ensure we get the real data
      let servicesResponse: any = null;
      const endpoints = [
        `/vendor/${vendorId || doctorId}/services`,
        `/vendor/services/${vendorId || doctorId}`,
        `/customer/clinic/${doctorId}/services`
      ];
      
      for (const endpoint of endpoints) {
        try {
          servicesResponse = await apiClient.get(endpoint) as any;
          // Check if response has services in expected format
          if (servicesResponse?.services || servicesResponse?.allServices || (Array.isArray(servicesResponse) && servicesResponse.length > 0)) {
            break;
          }
        } catch (e) {
          continue; // Try next endpoint
        }
      }
      
      if (servicesResponse) {
        // Extract services from different response formats
        let services: any[] = [];
        if (servicesResponse.services) {
          // Handle servicesByStyle format
          if (servicesResponse.services.at_home || servicesResponse.services.at_center || servicesResponse.services.tele) {
            services = [
              ...(servicesResponse.services.at_home?.services || []),
              ...(servicesResponse.services.at_center?.services || []),
              ...(servicesResponse.services.tele?.services || [])
            ];
          } else if (Array.isArray(servicesResponse.services)) {
            services = servicesResponse.services;
          }
        } else if (servicesResponse.allServices) {
          services = servicesResponse.allServices;
        } else if (Array.isArray(servicesResponse)) {
          services = servicesResponse;
        }
        
        setVendorServices(services);
        console.log('✅ Loaded vendor services from API:', services.length, services);
      }
    } catch (error) {
      console.error('Error loading vendor services:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIX: Helper function for API calls with retry logic
  const fetchWithRetry = async (url: string, maxRetries: number = 3, delay: number = 1000) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await apiClient.get(url);
      } catch (error: any) {
        const isServerError = error?.status >= 500 || error?.message?.includes('5');
        if (isServerError && attempt < maxRetries - 1) {
          console.log(`🔄 Retrying ${url} (attempt ${attempt + 2}/${maxRetries}) after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1))); // Exponential backoff
          continue;
        }
        throw error;
      }
    }
    throw new Error('Max retries exceeded');
  };

  const loadCustomerData = async () => {
    try {
      // Load pets from API with retry logic for intermittent 500/503 errors
      const petsResponse = await fetchWithRetry(`/customer/pets/${phone}`, 3, 1000) as any;
      if (petsResponse.pets && petsResponse.pets.length > 0) {
        setPets(petsResponse.pets.map((p: any) => ({
          id: p.id,
          name: p.name,
          species: p.species || p.type,
          breed: p.breed,
          photo: p.photo || p.profilePhoto || p.image,
        })));
      }
      
      // Address is part of vendor profile - not needed here
      // Get customer ID for package checking
      try {
        const profileResponse = await fetchWithRetry(`/customer/profile?phone=${encodeURIComponent(phone)}`, 2, 500) as any;
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
          photo: p.photo || p.profilePhoto || p.image,
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
  
  // Address refresh removed - address is part of vendor profile

  // Check for active packages when customer and vendor are known
  const checkForActivePackages = async () => {
    if (!customerId || !doctorId) return;
    
    try {
      const response = await apiClient.get<any>(
        `/packages/check-for-booking?customerId=${customerId}&vendorId=${doctorId}${selectedServiceType ? `&serviceType=${selectedServiceType}` : ''}`
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
    if (customerId && doctorId && (step === 'service' || step === 'details')) {
      checkForActivePackages();
    }
  }, [customerId, doctorId, step]);

  // Handle using a package session
  const handleUsePackageSession = async () => {
    if (!activePackage) return;
    
    setUsePackageSession(true);
    setShowPackageModal(false);
    toast.success('Using package session - No payment required!');
    // Proceed to details selection
    setStep('details');
  };

  // Handle booking new (skip package)
  const handleBookNew = () => {
    setShowPackageModal(false);
    setUsePackageSession(false);
    // Proceed with normal booking
  };

  const handleNext = () => {
    const steps: BookingStep[] = ['service', 'details', 'payment', 'confirmation'];
    const currentIdx = steps.indexOf(step);
    
    if (currentIdx < steps.length - 1) {
      const nextStep = steps[currentIdx + 1];
      
      // When advancing to payment, ensure selectedVendorService is set
      if (nextStep === 'payment' && !selectedVendorService) {
        const serviceOption = getSelectedServiceOption();
        if (serviceOption) {
          // ✅ CRITICAL: Find the actual vendor service from API to get real service_id (UUID)
          const actualVendorService = vendorServices.find(s => {
            const serviceOptionId = (serviceOption as any).serviceId || serviceOption.id;
            return (s.serviceId || s.service_id) === serviceOptionId || (s.serviceId || s.service_id) === serviceOption.id;
          });
          
          const optionServiceId = (serviceOption as any).serviceId || serviceOption.id;
          setSelectedVendorService({
            id: actualVendorService?.id, // Numeric vendor_services.id (for reference)
            serviceId: actualVendorService?.serviceId || actualVendorService?.service_id || optionServiceId, // ✅ UUID from services table
            service_id: actualVendorService?.serviceId || actualVendorService?.service_id || optionServiceId, // ✅ Explicit UUID field
            name: serviceOption.name,
            price: serviceOption.price,
            duration: serviceOption.duration,
            serviceStyle: selectedServiceType,
          });
        }
      }
      
      setStep(nextStep);
    }
  };

  const handleBack = () => {
    const steps: BookingStep[] = ['service', 'details', 'payment', 'confirmation'];
    const currentIdx = steps.indexOf(step);
    
    if (currentIdx > 0) {
      setStep(steps[currentIdx - 1]);
    } else {
      onBack();
    }
  };

  const handleConfirmBooking = async () => {
    setProcessing(true);
    try {
      const selectedServiceOption = getSelectedServiceOption();
      
      // If using package session, create session instead of booking
      if (usePackageSession && activePackage) {
        try {
          const sessionData = {
            packagePurchaseId: activePackage.id,
            scheduledStartTime: `${selectedDate}T${selectedTime}:00`,
            petId: selectedPet?.id,
            staffId: doctorId,
            location: doctor?.clinic_address || doctor?.address || '',
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
        // Regular booking: use CreateBookingRequestSchema (customerId, vendorId, serviceId UUID, bookingDate, bookingTime, serviceType enum)
        if (!customerId) {
          toast.error('Please wait for your profile to load, then try again.');
          setProcessing(false);
          return;
        }
        const vendorIdValue = doctorId || vendorId;
        const serviceIdValue = (selectedServiceOption as any)?.serviceId || (selectedServiceOption as any)?.service_id || serviceId;
        if (!vendorIdValue || !serviceIdValue) {
          toast.error('Missing vendor or service. Please go back and select a service.');
          setProcessing(false);
          return;
        }
        const bookingData = {
          customerId,
          vendorId: vendorIdValue,
          serviceId: serviceIdValue,
          bookingDate: selectedDate,
          bookingTime: selectedTime,
          serviceType: selectedServiceType === 'clinic' ? 'at_center' : selectedServiceType,
          petId: selectedPet?.id || undefined,
          petName: selectedPet?.name,
          amount: usePackageSession ? 0 : selectedServiceOption?.price,
          notes: notes || undefined,
          serviceName: selectedServiceOption?.name,
          customerPhone: phone,
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

  const selectedServiceOption = getSelectedServiceOption();

  // ✅ FIX: Prepare stats for ServiceDashboardHeader
  const getServiceTitle = () => {
    if (selectedServiceType === 'at_center') return 'Clinic Visit Booking';
    if (selectedServiceType === 'at_home') return 'Home Visit Booking';
    if (selectedServiceType === 'tele') return 'Tele Consultation Booking';
    return 'Veterinary Booking';
  };
  
  const getServiceSubtitle = () => {
    if (selectedServiceType === 'at_center') return 'Book a clinic appointment';
    if (selectedServiceType === 'at_home') return 'Book a home visit';
    if (selectedServiceType === 'tele') return 'Book a video consultation';
    return 'Book your veterinary service';
  };
  
  const dashboardStats = [
    { value: '50+', label: 'Vets', icon: <Stethoscope className="w-4 h-4" /> },
    { value: '1K+', label: 'Bookings' },
    { value: '4.8', label: 'Rating', icon: <Star className="w-4 h-4 fill-white" /> }
  ];

  // ✅ FIX: Prepare step indicators for header
  const getStepIndicators = (): StepInfo[] | undefined => {
    if (step === 'payment' || step === 'confirmation') return undefined;
    
    const stepLabels = ['Service', 'Details', 'Payment'];
    const currentStepMap: Record<BookingStep, number> = {
      service: 0,
      details: 1,
      payment: 2,
      confirmation: 3
    };
    const currentIdx = currentStepMap[step];
    
    return stepLabels.map((label, idx) => ({
      label,
      isCompleted: idx < currentIdx,
      isCurrent: idx === currentIdx
    }));
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* ✅ FIX: Restore Frame UI with ServiceDashboardHeader - Hide when on payment step */}
      {step !== 'payment' && (
        <ServiceDashboardHeader
          serviceName={getServiceTitle()}
          serviceSubtitle={getServiceSubtitle()}
          serviceIcon={Stethoscope}
          iconColor="text-white"
          stats={dashboardStats}
          steps={getStepIndicators()}
          onBack={handleBack}
          showBackButton={true}
          headerColor="bg-[#FF8C42]"
        />
      )}

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-md mx-auto px-4 sm:px-6 py-4 sm:py-6">
          {/* Pet Selector - Show when not on payment step */}
          {step !== 'payment' && pets.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-700">Select Pet:</span>
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {pets.map((pet) => (
                  <button
                    key={pet.id}
                    onClick={() => setSelectedPet(pet)}
                    className={`flex-shrink-0 px-3 py-2 rounded-lg border-2 transition-all ${
                      selectedPet?.id === pet.id
                        ? 'border-[#FF8C42] bg-orange-50'
                        : 'border-gray-200 bg-white hover:border-orange-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {pet.photo ? (
                        <img src={pet.photo} alt={pet.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                          <span className="text-xs font-bold text-orange-600">{pet.name.charAt(0)}</span>
                        </div>
                      )}
                      <span className={`text-sm font-medium ${selectedPet?.id === pet.id ? 'text-[#FF8C42]' : 'text-gray-700'}`}>
                        {pet.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

        {/* Service Selection - Skip if service context exists */}
        {step === 'service' && !hasServiceContext && (
          <div className="space-y-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Select Consultation Type</h2>
            <div className="space-y-3">
              {serviceOptions.map((service) => {
                const Icon = service.icon;
                const isSelected = selectedServiceType === service.id;
                return (
                  <button
                    key={service.id}
                    onClick={() => {
                      setSelectedServiceType(service.id);
                      
                      // ✅ CRITICAL: Immediately find and set selectedVendorService with UUID
                      const serviceOption = service as any;
                      const actualService = vendorServices.find((s: any) => {
                        const serviceOptionId = serviceOption.serviceId || service.id;
                        return (s.serviceId || s.service_id) === service.id ||
                               (s.serviceId || s.service_id) === serviceOptionId;
                      });
                      
                      if (actualService) {
                        setSelectedVendorService({
                          id: actualService.id, // Numeric vendor_services.id
                          serviceId: actualService.serviceId || actualService.service_id, // ✅ UUID
                          service_id: actualService.serviceId || actualService.service_id, // ✅ UUID
                          name: serviceOption.name,
                          price: serviceOption.price,
                          duration: serviceOption.duration,
                          serviceStyle: serviceOption.serviceStyle || service.id,
                        });
                        console.log('✅ Service selected with UUID:', actualService.serviceId || actualService.service_id);
                      } else {
                        // Fallback: use service from serviceOptions (already has UUID from getServicesForStyle)
                        setSelectedVendorService({
                          id: serviceOption.vendorServiceId,
                          serviceId: serviceOption.serviceId, // ✅ Already UUID from getServicesForStyle
                          service_id: serviceOption.serviceId, // ✅ Already UUID
                          name: serviceOption.name,
                          price: serviceOption.price,
                          duration: serviceOption.duration,
                          serviceStyle: serviceOption.serviceStyle || service.id,
                        });
                        console.log('✅ Service selected (fallback):', serviceOption.serviceId);
                      }
                      
                      // Auto-advance to details after selection
                      setTimeout(() => setStep('details'), 100);
                    }}
                    className={`w-full p-3 sm:p-4 rounded-xl border-2 transition-all ${
                      isSelected 
                        ? 'border-orange-500 bg-orange-50' 
                        : 'border-gray-200 bg-white hover:border-orange-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-100 text-orange-600`}>
                        <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{service.name}</h3>
                        <p className="text-xs sm:text-sm text-gray-500">{service.desc}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400" />
                          <span className="text-xs sm:text-sm text-gray-500">{service.duration} mins</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-base sm:text-lg text-gray-900">₹{service.price}</p>
                        {isSelected && (
                          <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500 mt-1 ml-auto" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <Button 
              onClick={handleNext} 
              className="w-full bg-orange-500 hover:bg-orange-600 mt-4 text-sm sm:text-base py-2.5 sm:py-3"
              disabled={!selectedServiceType}
            >
              Continue
            </Button>
          </div>
        )}

        {/* Combined Details Selection: Schedule, Pet, and Address */}
        {step === 'details' && (
          <div className="space-y-6 pb-24">
            {/* Date & Time Selection */}
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">Select Date & Time</h2>
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Date</h3>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                {dates.map((d) => (
                  <button
                    key={d.date}
                    onClick={() => setSelectedDate(d.date)}
                      className={`flex-shrink-0 w-14 sm:w-16 p-2 sm:p-3 rounded-xl text-center transition-all ${
                      selectedDate === d.date 
                        ? 'bg-orange-500 text-white' 
                        : 'bg-white border border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <p className="text-xs opacity-75">{d.day}</p>
                      <p className="text-lg sm:text-xl font-bold">{d.dayNum}</p>
                    <p className="text-xs opacity-75">{d.month}</p>
                  </button>
                ))}
              </div>
            </div>

            {selectedDate && (
              <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Time</h3>
                {loadingSlots ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
                      <p className="text-sm text-gray-500">Loading available slots...</p>
                    </div>
                  </div>
                ) : timeSlots.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">No slots available for this date</p>
                      <p className="text-xs mt-2">Please select another date</p>
                  </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.time}
                        onClick={() => slot.available && setSelectedTime(slot.time)}
                        disabled={!slot.available}
                          className={`p-2.5 sm:p-3 rounded-xl text-center transition-all text-sm ${
                          selectedTime === slot.time 
                            ? 'bg-orange-500 text-white' 
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
          </div>

        {/* Pet Selection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Select Your Pet</h2>
              <button
                onClick={() => setShowAddPetModal(true)}
                  className="flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-orange-100 text-orange-600 rounded-lg text-xs sm:text-sm font-medium hover:bg-orange-200 transition"
              >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Add Pet</span>
                  <span className="sm:hidden">Add</span>
              </button>
            </div>
            
            <div className="space-y-3">
              {pets.length > 0 ? (
                pets.map((pet) => (
                  <button
                    key={pet.id}
                    onClick={() => setSelectedPet(pet)}
                      className={`w-full p-3 sm:p-4 rounded-xl border-2 transition-all flex items-center gap-3 sm:gap-4 ${
                      selectedPet?.id === pet.id 
                        ? 'border-orange-500 bg-orange-50' 
                        : 'border-gray-200 bg-white hover:border-orange-200'
                    }`}
                  >
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-orange-100 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0">
                      {pet.species === 'dog' || (pet.species || '').toLowerCase().includes('dog') ? '🐕' : 
                       pet.species === 'cat' || (pet.species || '').toLowerCase().includes('cat') ? '🐈' : '🐾'}
                    </div>
                      <div className="flex-1 text-left min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{pet.name}</h3>
                        <p className="text-xs sm:text-sm text-gray-500 capitalize">{pet.breed}</p>
                    </div>
                    {selectedPet?.id === pet.id && (
                        <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500 flex-shrink-0" />
                    )}
                  </button>
                ))
              ) : (
                  <div className="text-center py-8 sm:py-12 border-2 border-dashed border-gray-200 rounded-xl">
                    <div className="text-4xl sm:text-5xl mb-3">🐾</div>
                    <p className="text-gray-600 font-medium mb-2 text-sm sm:text-base">No pets added yet</p>
                    <p className="text-xs sm:text-sm text-gray-500 mb-4">Add your pet to continue with the booking</p>
                  <button
                    onClick={() => setShowAddPetModal(true)}
                      className="px-4 sm:px-6 py-2 sm:py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition text-sm sm:text-base"
                  >
                    + Add Your First Pet
                  </button>
                </div>
              )}
            </div>
          </div>

            {/* Address is already part of vendor profile - removed per user request */}

              </div>
            )}
            
        {/* Fixed Continue Button - Above Footer */}
        {step === 'details' && (
          <div className="fixed bottom-16 left-0 right-0 bg-white border-t p-4 z-30">
            <div className="max-w-[430px] mx-auto">
            <Button 
              onClick={() => {
                handleNext();
              }} 
                className="w-full bg-orange-500 hover:bg-orange-600 text-base py-3"
                disabled={!selectedDate || !selectedTime || !selectedPet}
              >
                {!selectedDate || !selectedTime 
                  ? 'Select Date & Time' 
                  : !selectedPet 
                    ? 'Select a Pet' 
                    : 'Continue to Payment'}
            </Button>
            </div>
          </div>
        )}

        {/* Payment Summary - Using UniversalPaymentPage */}
        {step === 'payment' && !showPaymentPage && (
          <div className="space-y-4 pb-24">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Booking Summary</h2>
            
            <div className="bg-white rounded-xl p-3 sm:p-4 space-y-3 sm:space-y-4 shadow-sm">
              {/* Service */}
              <div className="flex items-center gap-2 sm:gap-3 pb-3 sm:pb-4 border-b">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-100 text-orange-600`}>
                  {selectedServiceType === 'tele' ? <Video className="w-5 h-5 sm:w-6 sm:h-6" /> :
                   selectedServiceType === 'at_home' ? <Home className="w-5 h-5 sm:w-6 sm:h-6" /> :
                   <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base">{selectedServiceOption?.name}</h3>
                  <p className="text-xs sm:text-sm text-gray-500">{selectedServiceOption?.duration} mins</p>
                </div>
                <p className="font-bold text-sm sm:text-base flex-shrink-0">₹{selectedServiceOption?.price}</p>
              </div>

              {/* Date & Time */}
              <div className="flex items-center gap-2 sm:gap-3 pb-3 sm:pb-4 border-b">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Date & Time</p>
                  <p className="font-medium text-sm sm:text-base">
                    {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })} at {selectedTime}
                  </p>
                </div>
              </div>

              {/* Pet */}
              <div className="flex items-center gap-2 sm:gap-3 pb-3 sm:pb-4 border-b">
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Pet</p>
                  <p className="font-medium text-sm sm:text-base">{selectedPet?.name} ({selectedPet?.breed})</p>
                </div>
              </div>

              {/* Address is part of vendor profile - not shown here */}

              {/* Notes */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any symptoms or concerns..."
                  className="w-full p-2 sm:p-3 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm sm:text-base"
                  rows={3}
                />
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm">
              <div className="flex justify-between items-center text-base sm:text-lg">
                <span className="font-bold">Total</span>
                <span className="font-bold text-orange-600">₹{selectedServiceOption?.price}</span>
              </div>
            </div>
          </div>
        )}

        {/* Fixed Continue Button for Payment Summary - Above Footer */}
        {step === 'payment' && !showPaymentPage && (
          <div className="fixed bottom-16 left-0 right-0 bg-white border-t p-4 z-30 shadow-lg">
            <div className="max-w-[430px] mx-auto">
              <Button 
                onClick={() => {
                  // Ensure we have selectedVendorService before showing payment
                  if (!selectedVendorService && selectedServiceOption) {
                    // ✅ CRITICAL: Find the actual vendor service from API to get real service_id (UUID)
                    const actualVendorService = vendorServices.find(s => {
                      const optionServiceId = (selectedServiceOption as any).serviceId || selectedServiceOption.id;
                      return (s.serviceId || s.service_id) === optionServiceId || (s.serviceId || s.service_id) === selectedServiceOption.id;
                    });
                    
                    const optionServiceId = (selectedServiceOption as any).serviceId || selectedServiceOption.id;
                    setSelectedVendorService({
                      id: actualVendorService?.id, // Numeric vendor_services.id (for reference)
                      serviceId: actualVendorService?.serviceId || actualVendorService?.service_id || optionServiceId, // ✅ UUID from services table
                      service_id: actualVendorService?.serviceId || actualVendorService?.service_id || optionServiceId, // ✅ Explicit UUID field
                      name: selectedServiceOption.name,
                      price: selectedServiceOption.price,
                      duration: selectedServiceOption.duration,
                      serviceStyle: selectedServiceType,
                    });
                  }
                  setShowPaymentPage(true);
                }} 
                className="w-full bg-orange-500 hover:bg-orange-600 text-base py-3"
                disabled={processing}
              >
                Continue to Payment
              </Button>
            </div>
          </div>
        )}
        
        {/* Universal Payment Page */}
        {step === 'payment' && showPaymentPage && selectedVendorService && selectedPet && selectedDate && selectedTime && (() => {
          // ✅ CRITICAL: Ensure we only use UUID, not numeric ID
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          let finalServiceId = selectedVendorService.service_id || selectedVendorService.serviceId;
          
          // If not a UUID, try to find it from vendorServices
          if (!finalServiceId || !uuidRegex.test(finalServiceId)) {
            console.warn('⚠️ serviceId is not a UUID, attempting to resolve:', finalServiceId);
            const foundService = vendorServices.find((s: any) => 
              String(s.id) === String(selectedVendorService.id) ||
              s.id === selectedVendorService.id ||
              (s.serviceId || s.service_id) === finalServiceId
            );
            if (foundService && (foundService.serviceId || foundService.service_id)) {
              finalServiceId = foundService.serviceId || foundService.service_id;
              console.log('✅ Resolved to UUID:', finalServiceId);
            } else {
              console.error('❌ Could not resolve serviceId to UUID:', selectedVendorService);
            }
          }
          
          // Only render if we have a valid UUID
          if (finalServiceId && uuidRegex.test(finalServiceId)) {
            return (
              <UniversalPaymentPage
                type="booking"
                vendorId={(vendorId || doctorId || clinicId || '') as string}
                vendorName={doctor?.name || doctor?.clinic_name || 'Veterinary Clinic'}
                serviceId={finalServiceId}
                serviceName={selectedVendorService.name || selectedServiceOption?.name || 'Vet Consultation'}
                serviceDescription={`${selectedServiceOption?.name} for ${selectedPet.name}`}
                serviceStyle={selectedServiceType === 'tele' ? 'tele' : selectedServiceType === 'at_home' ? 'at_home' : 'at_center'}
                bookingDate={selectedDate}
                bookingTime={selectedTime}
                petId={selectedPet.id}
                petName={selectedPet.name}
                petBreed={selectedPet.breed}
                baseAmount={selectedVendorService.price || selectedServiceOption?.price || 0}
                duration={selectedVendorService.duration || selectedServiceOption?.duration || 15}
                customerPhone={phone}
                customerId={customerId || undefined}
                onBack={() => setShowPaymentPage(false)}
                onSuccess={(bookingId) => {
                  setBookingId(bookingId);
                  setShowPaymentPage(false);
                  setStep('confirmation');
                }}
              />
            );
          }
          
          // Fallback: show error message
          return (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-600 font-medium">Error: Invalid service ID</p>
              <p className="text-red-500 text-sm mt-1">Please go back and select the service again.</p>
              <Button onClick={() => setShowPaymentPage(false)} className="mt-3">Go Back</Button>
            </div>
          );
        })()}

        {/* Confirmation */}
        {step === 'confirmation' && (
          <div className="text-center py-4 sm:py-8">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-green-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
            <p className="text-sm sm:text-base text-gray-500 mb-4 sm:mb-6">Your appointment has been scheduled successfully</p>
            
            <div className="bg-white rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 text-left">
              <div className="text-center mb-3 sm:mb-4">
                <p className="text-xs sm:text-sm text-gray-500">Booking ID</p>
                <p className="font-mono font-bold text-base sm:text-lg break-all">{bookingId}</p>
              </div>
              <div className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-500">Service</span>
                  <span className="font-medium text-xs sm:text-sm text-right ml-2">{selectedServiceOption?.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-500">Date</span>
                  <span className="font-medium text-xs sm:text-sm">{new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-500">Time</span>
                  <span className="font-medium text-xs sm:text-sm">{selectedTime}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-500">Pet</span>
                  <span className="font-medium text-xs sm:text-sm">{selectedPet?.name}</span>
                </div>
              </div>
            </div>

            {/* Package upsell offer - show if this was a single booking (not using package) */}
            {!usePackageSession && !showPackageOffer && (
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 border border-purple-100">
                <div className="flex items-center gap-2 sm:gap-3 mb-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Gift className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-orange-900 text-sm sm:text-base">Save with a Package!</h3>
                    <p className="text-xs sm:text-sm text-orange-600">Get up to 30% off with health packages</p>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  className="w-full border-orange-200 text-orange-700 hover:bg-orange-50 text-sm sm:text-base py-2 sm:py-2.5"
                  onClick={() => setShowPackageOffer(true)}
                >
                  <Package className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  View Packages
                </Button>
              </div>
            )}

            {showPackageOffer && (
              <div className="bg-white rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 border border-gray-200">
                <div className="flex justify-between items-center mb-3 sm:mb-4">
                  <h3 className="font-semibold text-sm sm:text-base">Available Packages</h3>
                  <button onClick={() => setShowPackageOffer(false)} className="text-gray-400 hover:text-gray-600 text-lg sm:text-xl">
                    ✕
                  </button>
                </div>
                
                <div className="space-y-2 sm:space-y-3">
                  {/* Package options */}
                  <div className="border rounded-lg p-2 sm:p-3 hover:border-orange-300 cursor-pointer transition-colors" onClick={() => onNavigate('purchase-package', { vendorId: doctorId, packageType: 'health-checkup-5' })}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-sm sm:text-base">5 Checkup Pack</h4>
                        <p className="text-xs sm:text-sm text-gray-500">5 visits • Valid 6 months</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <span className="text-base sm:text-lg font-bold text-orange-600">₹1,799</span>
                        <p className="text-xs text-gray-400 line-through">₹2,495</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Save 28%</span>
                    </div>
                  </div>
                  
                  <div className="border rounded-lg p-2 sm:p-3 hover:border-orange-300 cursor-pointer transition-colors" onClick={() => onNavigate('purchase-package', { vendorId: doctorId, packageType: 'health-checkup-10' })}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-sm sm:text-base">10 Checkup Pack</h4>
                        <p className="text-xs sm:text-sm text-gray-500">10 visits • Valid 12 months</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <span className="text-base sm:text-lg font-bold text-orange-600">₹2,999</span>
                        <p className="text-xs text-gray-400 line-through">₹4,990</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Save 40%</span>
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">Best Value</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 sm:space-y-3">
              <Button 
                onClick={() => onViewBooking?.(bookingId || '')}
                className="w-full bg-orange-500 hover:bg-orange-600 text-sm sm:text-base py-2.5 sm:py-3"
              >
                View Booking Details
              </Button>
              <Button 
                onClick={onBack}
                variant="outline"
                className="w-full text-sm sm:text-base py-2.5 sm:py-3"
              >
                Back to Home
              </Button>
            </div>
          </div>
        )}

        {/* Package Selection Modal */}
        {showPackageModal && activePackage && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold">Active Package Found!</h2>
                  <p className="text-xs sm:text-sm text-gray-500">You have sessions available</p>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
                <h3 className="font-semibold mb-2 text-sm sm:text-base">{activePackage.packageName}</h3>
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sessions Remaining</span>
                    <span className="font-medium text-green-600">
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
              
              <div className="space-y-2 sm:space-y-3">
                <Button 
                  onClick={handleUsePackageSession}
                  className="w-full bg-green-600 hover:bg-green-700 text-sm sm:text-base py-2.5 sm:py-3"
                >
                  Use Package Session (Free)
                </Button>
                <Button 
                  onClick={handleBookNew}
                  variant="outline"
                  className="w-full text-sm sm:text-base py-2.5 sm:py-3"
                >
                  Book New (Pay ₹{selectedServiceOption?.price || 499})
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Add Pet Modal */}
        {showAddPetModal && (
          <AddPetModalInline 
            phone={phone}
            onClose={() => setShowAddPetModal(false)}
            onSuccess={() => {
              refreshPets();
              setShowAddPetModal(false);
            }}
          />
        )}
        
        {/* Add Address Modal */}
        </div>
      </div>
      
      {/* Standardized Footer */}
      <StandardizedFooter
        currentTab="bookings"
        onTabChange={(tab) => {
          if (tab === 'home') onBack();
          else if (tab === 'bookings') onNavigate('my-bookings');
          else if (tab === 'cart') onNavigate('cart');
          else if (tab === 'profile') onNavigate('profile');
        }}
        maxWidth="max-w-[430px]"
      />
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
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-3 sm:p-4 rounded-t-3xl sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-bold text-white">Add New Pet 🐾</h3>
            <button onClick={onClose} className="w-7 h-7 sm:w-8 sm:h-8 bg-white/20 rounded-full flex items-center justify-center">
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>
          </div>
        </div>
        
        <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
          {/* Photo Upload */}
          <div className="flex flex-col items-center">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-16 h-16 sm:w-20 sm:h-20 bg-orange-100 rounded-full overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-80 border-4 border-white shadow-lg"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Pet" className="w-full h-full object-cover" />
              ) : (
                <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            <p className="text-xs text-gray-500 mt-1">Upload photo (Optional)</p>
          </div>

          {/* Pet Name */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Pet Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={petData.name}
              onChange={(e) => setPetData({ ...petData, name: e.target.value })}
              placeholder="e.g., Oreo, Max, Bella"
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none text-sm sm:text-base"
            />
          </div>

          {/* Pet Type */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Pet Type <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {['Dog', 'Cat', 'Other'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPetData({ ...petData, type })}
                  className={`py-2 sm:py-2.5 px-2 sm:px-3 border-2 rounded-xl transition font-medium text-xs sm:text-sm ${
                    petData.type === type ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-700'
                  }`}
                >
                  {type === 'Dog' ? '🐕' : type === 'Cat' ? '🐈' : '🐾'} {type}
                </button>
              ))}
            </div>
          </div>

          {/* Breed */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Breed <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={petData.breed}
              onChange={(e) => setPetData({ ...petData, breed: e.target.value })}
              placeholder="e.g., Golden Retriever, Persian"
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none text-sm sm:text-base"
            />
          </div>

          {/* Age and Gender */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Age (years) <span className="text-red-500">*</span></label>
              <input
                type="number"
                value={petData.age}
                onChange={(e) => setPetData({ ...petData, age: e.target.value })}
                placeholder="e.g., 3"
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none text-sm sm:text-base"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                value={petData.gender}
                onChange={(e) => setPetData({ ...petData, gender: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none text-sm sm:text-base"
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>

          {/* Weight and Color */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                value={petData.weight}
                onChange={(e) => setPetData({ ...petData, weight: e.target.value })}
                placeholder="e.g., 12.5"
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none text-sm sm:text-base"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Color</label>
              <input
                type="text"
                value={petData.color}
                onChange={(e) => setPetData({ ...petData, color: e.target.value })}
                placeholder="e.g., Golden"
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none text-sm sm:text-base"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 sm:gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 sm:py-3 border-2 border-gray-300 rounded-xl font-medium text-gray-700 text-sm sm:text-base"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleSavePet}
              disabled={loading}
              className="flex-1 py-2.5 sm:py-3 bg-orange-500 hover:bg-orange-600 rounded-xl text-white font-medium disabled:opacity-50 text-sm sm:text-base"
            >
              {loading ? 'Saving...' : 'Add Pet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Address modal removed - address is part of vendor profile
// REMOVED: AddAddressModalInline function - address is part of vendor profile
