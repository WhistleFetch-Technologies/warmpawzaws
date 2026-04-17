"use client";

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Video, Home, Building2, Calendar, Clock, MapPin, User, CreditCard, CheckCircle2, ChevronRight, Package, Gift, Plus, X, Upload, Stethoscope, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { ServiceDashboardHeader, StepInfo } from '../shared/ServiceDashboardHeader';
import { StandardizedFooter } from '../shared/StandardizedFooter';
import { UniversalPaymentPage } from '../payment/UniversalPaymentPage';
import { AddAddressModal } from '../shared/AddAddressModal';
import { trackBookingStep, useBookingAnalytics } from '@/lib/analytics';
import { formatPriceWithSymbol, catalogPriceIncludesTax } from '@/lib/booking-display-utils';

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
  selectedServices?: any[]; // ✅ NEW: Multiple selected services (from VetServicesByStyle, etc.)
  vendorName?: string; // ✅ NEW: Clinic/center/vendor name for display
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string) => void;
}

type BookingStep = 'service' | 'details' | 'address' | 'summary' | 'payment' | 'confirmation';

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
  selectedServices,
  vendorName: vendorNameProp,
  onBack, 
  onNavigate, 
  onViewBooking 
}: VetBookingRouterProps) {
  const formatTime12Hour = (time24: string) => {
    if (!time24) return '';
    const [hRaw, mRaw = '00'] = String(time24).split(':');
    const hour = Number(hRaw);
    const minute = String(mRaw).slice(0, 2);
    if (Number.isNaN(hour)) return time24;
    if (hour === 0) return `12:${minute} AM`;
    if (hour === 12) return `12:${minute} PM`;
    if (hour < 12) return `${hour}:${minute} AM`;
    return `${hour - 12}:${minute} PM`;
  };

  // ✅ FIX: If serviceType/serviceStyle is provided, skip service selection and go to details
  // ✅ NEW: Also consider selectedServices (multi-service from VetServicesByStyle)
  const hasServiceContext = (serviceType || serviceStyle) && (serviceId || selectedService || (selectedServices && selectedServices.length > 0));
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
  
  // ✅ Sync allSelectedServices when selectedServices prop changes
  useEffect(() => {
    if (selectedServices && selectedServices.length > 0) {
      setAllSelectedServices(selectedServices.map((s: any) => ({
        id: s.id || s.serviceId,
        serviceId: s.serviceId || s.id,
        name: s.name || s.serviceName,
        serviceName: s.serviceName || s.name,
        price: s.price ?? 0,
        duration: s.duration ?? 0,
        serviceStyle: s.serviceStyle || serviceStyle || serviceType,
      })));
    }
  }, [selectedServices, serviceStyle, serviceType]);
  
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
  const [selectedPackageForSwitch, setSelectedPackageForSwitch] = useState<any | null>(null); // Phase 1: Package switch
  const [vendorServices, setVendorServices] = useState<any[]>([]);
  // ✅ NEW: Store all selected services for multi-service booking
  const [allSelectedServices, setAllSelectedServices] = useState<any[]>(() => {
    if (selectedServices && selectedServices.length > 0) {
      return selectedServices.map((s: any) => ({
        id: s.id || s.serviceId,
        serviceId: s.serviceId || s.id,
        name: s.name || s.serviceName,
        serviceName: s.serviceName || s.name,
        price: s.price ?? 0,
        duration: s.duration ?? 0,
        serviceStyle: s.serviceStyle || serviceStyle || serviceType,
      }));
    }
    return [];
  });
  // ✅ FIX: Initialize selectedVendorService with passed service data if available
  const [selectedVendorService, setSelectedVendorService] = useState<any>(
    selectedService || (selectedServices && selectedServices.length > 0 ? selectedServices[0] : null) || (serviceId ? {
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
      'address': 'address_selection',
      'summary': 'booking_summary',
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
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any | null>(null);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  
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
    const effectiveVendorId = vendorId || doctorId;
    if (selectedDate && effectiveVendorId) {
      loadTimeSlots(selectedDate);
    } else {
      setTimeSlots([]);
    }
  }, [selectedDate, vendorId, doctorId, selectedServiceType]);

  const loadTimeSlots = async (date: string) => {
    const effectiveVendorId = vendorId || doctorId;
    if (!effectiveVendorId) return;

    try {
      setLoadingSlots(true);
      const response = await apiClient.get(
        `/customer/vendor/${effectiveVendorId}/available-slots?date=${date}&serviceStyle=${selectedServiceType}`
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
      const vid = vendorId || doctorId;
      // Prefer customer endpoint so only published services with vendor price show (CRUD reflects immediately)
      // ✅ FIX: Include serviceStyle parameter to filter services correctly
      const serviceStyleParam = serviceStyle ? `?serviceStyle=${encodeURIComponent(serviceStyle)}` : '';
      let servicesResponse: any = null;
      const endpoints = [
        `/customer/vendor/${vid}/services${serviceStyleParam}`,
        `/customer/clinic/${vid}/services${serviceStyleParam}`,
        `/vendor/${vid}/services`,
        `/vendor/services/${vid}`,
      ];
      
      for (const endpoint of endpoints) {
        try {
          servicesResponse = await apiClient.get(endpoint) as any;
          if (servicesResponse?.services?.length || servicesResponse?.allServices?.length || (Array.isArray(servicesResponse?.services) && servicesResponse.services.length > 0)) {
            break;
          }
          if (servicesResponse?.services && (servicesResponse.services.at_home || servicesResponse.services.at_center || servicesResponse.services.tele)) {
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (servicesResponse) {
        let services: any[] = [];
        if (servicesResponse.services) {
          if (servicesResponse.services.at_home || servicesResponse.services.at_center || servicesResponse.services.tele) {
            services = [
              ...(servicesResponse.services.at_home?.services || []),
              ...(servicesResponse.services.at_center?.services || []),
              ...(servicesResponse.services.tele?.services || []),
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
        const mappedPets = petsResponse.pets.map((p: any) => ({
          id: p.id,
          name: p.name,
          species: p.species || p.type,
          breed: p.breed,
          photo: p.photo || p.profilePhoto || p.image,
        }));
        setPets(mappedPets);
        // Phase 1: Pre-select last-used pet from sessionStorage
        try {
          const lastPetId = sessionStorage.getItem(`warmpawz_last_pet_${phone}`);
          if (lastPetId) {
            const found = mappedPets.find((p: Pet) => p.id === lastPetId || String(p.id) === lastPetId);
            if (found) setSelectedPet(found);
            else if (mappedPets.length > 0) setSelectedPet(mappedPets[0]);
          } else if (mappedPets.length === 1) setSelectedPet(mappedPets[0]);
        } catch { /* ignore */ }
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
  
  // Load addresses when at_home (for address step)
  const refreshAddresses = async () => {
    if (selectedServiceType !== 'at_home') return;
    try {
      const addressResponse = await apiClient.get(`/customer/addresses?phone=${encodeURIComponent(phone)}`) as any;
      if (addressResponse?.addresses && Array.isArray(addressResponse.addresses)) {
        setAddresses(addressResponse.addresses);
        const defaultAddr = addressResponse.addresses.find((a: any) => a.isDefault);
        if (defaultAddr && !selectedAddress) setSelectedAddress(defaultAddr);
        else if (addressResponse.addresses.length > 0 && !selectedAddress) setSelectedAddress(addressResponse.addresses[0]);
      } else {
        setAddresses([]);
      }
    } catch (e) {
      setAddresses([]);
    }
  };

  useEffect(() => {
    if (selectedServiceType === 'at_home') refreshAddresses();
  }, [selectedServiceType]);

  // ✅ FIX: Auto-advance to UniversalPaymentPage for at_home services (like tele consultation)
  // Skip the intermediate review page and go directly to full payment UI
  useEffect(() => {
    if (step === 'payment' && selectedServiceType === 'at_home' && !showPaymentPage) {
      // Ensure we have selectedVendorService before showing payment
      const serviceOption = getSelectedServiceOption();
      if (!selectedVendorService && serviceOption) {
        // ✅ CRITICAL: Find the actual vendor service from API to get real service_id (UUID)
        const actualVendorService = vendorServices.find(s => {
          const optionServiceId = (serviceOption as any).serviceId || serviceOption.id;
          return (s.serviceId || s.service_id) === optionServiceId || (s.serviceId || s.service_id) === serviceOption.id;
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
      // Auto-advance to UniversalPaymentPage for at_home services
      if (selectedVendorService && selectedPet && selectedDate && selectedTime) {
        setShowPaymentPage(true);
      }
    }
  }, [step, selectedServiceType, showPaymentPage, selectedVendorService, selectedPet, selectedDate, selectedTime, vendorServices]);

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

  // Phase 1: Summary step with package advice
  const [recommendedPackages, setRecommendedPackages] = useState<any[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  useEffect(() => {
    if (step === 'summary' && (doctorId || vendorId)) {
      const load = async () => {
        setLoadingPackages(true);
        try {
          const res = await apiClient.get(`/vendor/${doctorId || vendorId}/packages`) as any;
          setRecommendedPackages(res?.packages || []);
        } catch { setRecommendedPackages([]); }
        finally { setLoadingPackages(false); }
      };
      load();
    } else { setRecommendedPackages([]); }
  }, [step, doctorId, vendorId]);

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
    const steps: BookingStep[] = selectedServiceType === 'at_home'
      ? ['service', 'details', 'address', 'summary', 'payment', 'confirmation']
      : ['service', 'details', 'summary', 'payment', 'confirmation'];
    const currentIdx = steps.indexOf(step);
    
    if (currentIdx < steps.length - 1) {
      const nextStep = steps[currentIdx + 1];
      
      // When advancing to payment or summary, ensure selectedVendorService is set
      if ((nextStep === 'payment' || nextStep === 'summary') && !selectedVendorService) {
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
    const steps: BookingStep[] = selectedServiceType === 'at_home'
      ? ['service', 'details', 'address', 'summary', 'payment', 'confirmation']
      : ['service', 'details', 'summary', 'payment', 'confirmation'];
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
        // For at_home: pass address so backend stores it and can compute commute (expects string; JSON with latitude/longitude for ETA)
        let addressPayload: string | undefined;
        if (selectedServiceType === 'at_home' && selectedAddress) {
          const coords = (selectedAddress as any).coordinates;
          if (coords && (coords.latitude != null || coords.lat != null) && (coords.longitude != null || coords.lng != null)) {
            addressPayload = JSON.stringify({
              addressLine1: selectedAddress.addressLine1 || (selectedAddress as any).address,
              city: (selectedAddress as any).city,
              pincode: (selectedAddress as any).pincode,
              state: (selectedAddress as any).state,
              latitude: coords.latitude ?? coords.lat,
              longitude: coords.longitude ?? coords.lng,
            });
          } else {
            const parts = [
              selectedAddress.addressLine1 || (selectedAddress as any).address,
              (selectedAddress as any).city,
              (selectedAddress as any).pincode,
              (selectedAddress as any).state,
            ].filter(Boolean);
            addressPayload = parts.join(', ');
          }
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
          ...(addressPayload && { address: addressPayload }),
        };

        try {
          const response = await apiClient.post('/bookings/create', bookingData) as any;
          const res = response?.data ?? response;
          const newBookingId = res?.bookingId || res?.booking?.id || res?.id || 'BK-' + Date.now();
          setBookingId(newBookingId);
          // Generate OTP for at_home/at_center so customer can share with vendor (skip if they will go through payment step)
          if (selectedServiceType !== 'tele' && newBookingId) {
            apiClient.post('/bookings/generate-otp', {
              bookingId: newBookingId,
              serviceStyle: selectedServiceType,
              customerId: customerId || undefined,
            }).catch(() => {});
          }
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

  // Phase 1: Step indicators include Summary
  const getStepIndicators = (): StepInfo[] | undefined => {
    if (step === 'payment' || step === 'confirmation') return undefined;
    
    const stepLabels = selectedServiceType === 'at_home'
      ? ['Service', 'Details', 'Address', 'Summary', 'Payment']
      : ['Service', 'Details', 'Summary', 'Payment'];
    const currentStepMap: Record<BookingStep, number> = selectedServiceType === 'at_home'
      ? { service: 0, details: 1, address: 2, summary: 3, payment: 4, confirmation: 5 }
      : { service: 0, details: 1, address: 1, summary: 2, payment: 3, confirmation: 4 };
    const currentIdx = currentStepMap[step] ?? 0;
    
    return stepLabels.map((label, idx) => ({
      label,
      isCompleted: idx < currentIdx,
      isCurrent: idx === currentIdx
    }));
  };

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-gray-50">
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

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-gray-50">
        <div className="mx-auto max-w-md px-4 py-4 sm:px-6 sm:py-6">
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
                        <p className="font-bold text-base sm:text-lg text-gray-900">{formatPriceWithSymbol(service.price)}</p>
                        {isSelected && (
                          <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500 mt-1 ml-auto" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mx-auto mt-4 w-full max-w-xs sm:max-w-sm">
            <Button 
              onClick={handleNext} 
              className="w-full whitespace-normal text-center rounded-full bg-orange-500 hover:bg-orange-600 text-sm sm:text-base min-h-12 px-4 py-2.5 shadow-md sm:h-12 sm:py-0"
              disabled={!selectedServiceType}
            >
              Continue
            </Button>
            </div>
          </div>
        )}

        {/* Combined Details Selection: Schedule, Pet, and Address */}
        {step === 'details' && (
          <div className="space-y-4 cw-scroll-pad-tabbar">
            <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              {/* Date & Time Selection */}
              <div>
                <h2 className="mb-3 text-lg font-bold text-gray-900 sm:text-xl">Select Date & Time</h2>
                <div className="mb-4">
                  <h3 className="mb-2 text-sm font-medium text-gray-700">Date</h3>
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 scrollbar-hide">
                    {dates.map((d) => (
                      <button
                        key={d.date}
                        onClick={() => setSelectedDate(d.date)}
                        className={`flex-shrink-0 rounded-xl p-2 text-center transition-all sm:w-16 sm:p-3 ${
                          selectedDate === d.date
                            ? 'bg-orange-500 text-white'
                            : 'border border-gray-200 bg-gray-50 hover:border-orange-300'
                        } w-14`}
                      >
                        <p className="text-xs opacity-75">{d.day}</p>
                        <p className="text-lg font-bold sm:text-xl">{d.dayNum}</p>
                        <p className="text-xs opacity-75">{d.month}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedDate && (
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-gray-700">Time</h3>
                    {loadingSlots ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="text-center">
                          <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-orange-500"></div>
                          <p className="text-sm text-gray-500">Loading available slots...</p>
                        </div>
                      </div>
                    ) : timeSlots.length === 0 ? (
                      <div className="py-8 text-center text-gray-500">
                        <p className="text-sm">No slots available for this date</p>
                        <p className="mt-2 text-xs">Please select another date</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {timeSlots.map((slot) => (
                          <button
                            key={slot.time}
                            onClick={() => slot.available && setSelectedTime(slot.time)}
                            disabled={!slot.available}
                            className={`rounded-xl p-2.5 text-center text-sm transition-all sm:p-3 ${
                              selectedTime === slot.time
                                ? 'bg-orange-500 text-white'
                                : slot.available
                                  ? 'border border-gray-200 bg-gray-50 hover:border-orange-300'
                                  : 'cursor-not-allowed bg-gray-100 text-gray-400'
                            }`}
                          >
                            {formatTime12Hour(slot.time)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pet Selection */}
              <div className="border-t border-gray-100 pt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 sm:text-xl">Select Your Pet</h2>
                  <button
                    onClick={() => setShowAddPetModal(true)}
                    className="flex items-center gap-1 rounded-lg bg-orange-100 px-2 py-1.5 text-xs font-medium text-orange-600 transition hover:bg-orange-200 sm:px-3 sm:text-sm"
                  >
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Add Pet</span>
                    <span className="sm:hidden">Add</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {pets.length > 0 ? (
                    pets.map((pet) => (
                      <button
                        key={pet.id}
                        onClick={() => {
                          setSelectedPet(pet);
                          try {
                            sessionStorage.setItem(`warmpawz_last_pet_${phone}`, String(pet.id));
                          } catch {
                            /* ignore */
                          }
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 transition-all sm:gap-4 sm:p-4 ${
                          selectedPet?.id === pet.id
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 bg-gray-50 hover:border-orange-200'
                        }`}
                      >
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-xl sm:h-14 sm:w-14 sm:text-2xl">
                          {pet.species === 'dog' || (pet.species || '').toLowerCase().includes('dog')
                            ? '🐕'
                            : pet.species === 'cat' || (pet.species || '').toLowerCase().includes('cat')
                              ? '🐈'
                              : '🐾'}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <h3 className="text-sm font-semibold text-gray-900 sm:text-base">{pet.name}</h3>
                          <p className="text-xs capitalize text-gray-500 sm:text-sm">{pet.breed}</p>
                        </div>
                        {selectedPet?.id === pet.id && (
                          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-orange-500 sm:h-6 sm:w-6" />
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center sm:py-12">
                      <div className="mb-3 text-4xl sm:text-5xl">🐾</div>
                      <p className="mb-2 text-sm font-medium text-gray-600 sm:text-base">No pets added yet</p>
                      <p className="mb-4 text-xs text-gray-500 sm:text-sm">Add your pet to continue with the booking</p>
                      <button
                        onClick={() => setShowAddPetModal(true)}
                        className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 sm:px-6 sm:py-3 sm:text-base"
                      >
                        + Add Your First Pet
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mx-auto w-full max-w-xs sm:max-w-sm">
              <Button
                onClick={() => {
                  handleNext();
                }}
                className="min-h-12 w-full rounded-full bg-orange-500 px-4 py-2.5 text-center text-sm shadow-md hover:bg-orange-600 sm:h-12 sm:text-base sm:py-0"
                disabled={!selectedDate || !selectedTime || !selectedPet}
              >
                {!selectedDate || !selectedTime
                  ? 'Select Date & Time'
                  : !selectedPet
                    ? 'Select a Pet'
                    : selectedServiceType === 'at_home'
                      ? 'Continue to Address'
                      : 'Continue'}
              </Button>
            </div>
          </div>
        )}

        {/* Address Step - only for at_home */}
        {step === 'address' && selectedServiceType === 'at_home' && (
          <div className="space-y-4 cw-scroll-pad-tabbar">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Select Your Address</h2>
              <button
                onClick={() => setShowAddAddressModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-200 transition"
              >
                <Plus className="w-4 h-4" />
                Add Address
              </button>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <p className="text-sm text-blue-800">An address is required for home visit.</p>
            </div>
            <div className="space-y-3">
              {addresses.length > 0 ? (
                addresses.map((addr) => (
                  <button
                    key={addr.id}
                    onClick={() => setSelectedAddress(addr)}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                      selectedAddress?.id === addr.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{addr.label || 'Address'}</h3>
                          {addr.isDefault && (
                            <span className="px-2 py-0.5 bg-orange-100 text-[#FF7A35] text-xs rounded-full">Default</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{addr.addressLine1 || addr.address}</p>
                        <p className="text-sm text-gray-500">{addr.city} - {addr.pincode}</p>
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
              )}
            </div>
            {selectedAddress && addresses.length > 0 && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-[#FF6B35] font-medium">
                  ✓ Home visit at: {selectedAddress?.label || 'Selected Address'}
                </p>
              </div>
            )}
            <div className="mx-auto w-full max-w-xs sm:max-w-sm">
            <Button
              onClick={handleNext}
              className="w-full whitespace-normal text-center rounded-full bg-[#FF8C42] hover:bg-[#FF7A35] min-h-12 px-3 py-2.5 text-xs shadow-md sm:h-12 sm:px-4 sm:text-sm sm:py-0"
              disabled={!selectedAddress}
            >
              {selectedAddress ? 'Continue' : 'Select an Address to Continue'}
            </Button>
            </div>
          </div>
        )}

        {/* Phase 1: Summary step with package advice */}
        {step === 'summary' && (
          <div className="space-y-4 cw-scroll-pad-tabbar">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Booking Summary</h2>
            <div className="bg-white rounded-xl p-4 space-y-3 shadow-sm border border-gray-200">
              {allSelectedServices && allSelectedServices.length > 0 ? (
                <div className="space-y-2 pb-3 border-b">
                  {allSelectedServices.map((svc: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-100 text-orange-600">
                        {selectedServiceType === 'tele' ? <Video className="w-5 h-5" /> : selectedServiceType === 'at_home' ? <Home className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                      </div>
                      <div className="flex-1"><p className="font-semibold">{svc.name || svc.serviceName}</p><p className="text-xs text-gray-500">{svc.duration} mins</p></div>
                      <p className="font-bold text-orange-600">{formatPriceWithSymbol(svc.price ?? 0)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3 pb-3 border-b">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-100 text-orange-600">
                    {selectedServiceType === 'tele' ? <Video className="w-5 h-5" /> : selectedServiceType === 'at_home' ? <Home className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                  </div>
                  <div className="flex-1"><p className="font-semibold">{selectedServiceOption?.name || 'Vet Consultation'}</p><p className="text-xs text-gray-500">{selectedServiceOption?.duration ?? 0} mins</p></div>
                  <p className="font-bold text-orange-600">{formatPriceWithSymbol(selectedServiceOption?.price ?? 0)}</p>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm"><Calendar className="w-4 h-4 text-gray-400" /><span>{selectedDate && new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} at {formatTime12Hour(selectedTime)}</span></div>
              <div className="flex items-center gap-2 text-sm"><User className="w-4 h-4 text-gray-400" /><span>{selectedPet?.name} ({selectedPet?.breed})</span></div>
              {selectedServiceType === 'at_home' && selectedAddress && <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-gray-400" /><span>{selectedAddress.street || selectedAddress.address || 'Address'}</span></div>}
              <div className="pt-2 flex justify-between font-semibold"><span>Total</span><span className="text-orange-600">{formatPriceWithSymbol(selectedPackageForSwitch ? (selectedPackageForSwitch.package_price ?? selectedPackageForSwitch.price ?? 0) : (allSelectedServices?.length ? allSelectedServices.reduce((s: number, x: any) => s + (Number(x.price) || 0), 0) : (selectedServiceOption?.price ?? 0)))}</span></div>
              {selectedPackageForSwitch && (
                <div className="mt-2 p-2 bg-green-50 rounded-lg text-sm text-green-700 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  <span>Package: {selectedPackageForSwitch.package_name ?? selectedPackageForSwitch.name} • {(selectedPackageForSwitch.total_sessions ?? selectedPackageForSwitch.session_count ?? 1)} sessions</span>
                </div>
              )}
            </div>
            {loadingPackages ? <div className="py-4 text-center text-sm text-gray-500">Loading packages...</div> : recommendedPackages.length > 0 ? (
              <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                <p className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><Package className="w-4 h-4 text-orange-500" />Get a package instead</p>
                {recommendedPackages.slice(0, 2).map((pkg: any) => {
                  const singlePrice = selectedServiceOption?.price ?? 0;
                  const pkgPrice = pkg.package_price ?? pkg.price ?? 0;
                  const sessions = pkg.total_sessions ?? pkg.session_count ?? 1;
                  const perSession = sessions > 0 ? pkgPrice / sessions : pkgPrice;
                  const savings = singlePrice > 0 && perSession < singlePrice ? Math.round((singlePrice - perSession) * sessions) : 0;
                  return (
                    <div key={pkg.id} className="mb-3 last:mb-0 p-3 bg-white rounded-lg border border-orange-100">
                      <p className="font-medium">{pkg.package_name ?? pkg.name}</p>
                      <p className="text-sm text-gray-600 mt-1">{formatPriceWithSymbol(pkgPrice)} • {sessions} sessions</p>
                      {savings > 0 && <p className="text-xs text-green-600 mt-1">Save {formatPriceWithSymbol(savings)} vs single bookings</p>}
                      <Button variant="outline" size="sm" className="mt-2 border-orange-300 text-orange-600 hover:bg-orange-50" onClick={() => {
                        setSelectedPackageForSwitch(pkg);
                        toast.success(`Switched to ${pkg.package_name ?? pkg.name}. Proceed to payment.`);
                      }}>Switch to Package</Button>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <div className="mx-auto w-full max-w-xs sm:max-w-sm">
            <Button onClick={handleNext} className="w-full whitespace-normal text-center rounded-full bg-orange-500 hover:bg-orange-600 min-h-12 px-4 py-2.5 text-sm shadow-md sm:h-12 sm:py-0">Continue to Payment</Button>
            </div>
          </div>
        )}

        {/* Payment Summary - Using UniversalPaymentPage (only for at_center services, at_home goes directly to UniversalPaymentPage) */}
        {step === 'payment' && !showPaymentPage && selectedServiceType !== 'at_home' && (
          <div className="space-y-4 cw-scroll-pad-tabbar -mx-4 cw-header-safe-x cw-header-safe-top sm:-mx-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-gray-900 hover:bg-gray-200 active:bg-gray-300 transition-colors"
                aria-label="Go back"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Booking Summary</h2>
            </div>
            
            <div className="bg-white rounded-xl p-3 sm:p-4 space-y-3 sm:space-y-4 shadow-sm">
              {/* Service(s) - multi-service or single with fallbacks */}
              {allSelectedServices && allSelectedServices.length > 0 ? (
                <div className="space-y-3 pb-3 sm:pb-4 border-b">
                  {allSelectedServices.map((svc: any, idx: number) => (
                    <div key={svc.id || svc.serviceId || idx} className="flex items-center gap-2 sm:gap-3">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-100 text-orange-600`}>
                        {selectedServiceType === 'tele' ? <Video className="w-5 h-5 sm:w-6 sm:h-6" /> :
                         selectedServiceType === 'at_home' ? <Home className="w-5 h-5 sm:w-6 sm:h-6" /> :
                         <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm sm:text-base">{svc.name || svc.serviceName || 'Service'}</h3>
                        {(svc.duration ?? 0) > 0 && (
                          <p className="text-xs sm:text-sm text-gray-500">{svc.duration} mins</p>
                        )}
                      </div>
                      <p className="font-bold text-sm sm:text-base flex-shrink-0">{formatPriceWithSymbol(svc.price ?? 0)}</p>
                    </div>
                  ))}
                  {allSelectedServices.length > 1 && (
                    <div className="flex justify-between items-center pt-2 font-bold text-sm sm:text-base">
                      <span>Subtotal</span>
                      <span className="text-orange-600">{formatPriceWithSymbol(allSelectedServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0))}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 sm:gap-3 pb-3 sm:pb-4 border-b">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-100 text-orange-600`}>
                    {selectedServiceType === 'tele' ? <Video className="w-5 h-5 sm:w-6 sm:h-6" /> :
                     selectedServiceType === 'at_home' ? <Home className="w-5 h-5 sm:w-6 sm:h-6" /> :
                     <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base">
                      {selectedServiceOption?.name || selectedVendorService?.name || serviceName || 'Vet Consultation'}
                    </h3>
                    {(selectedServiceOption?.duration ?? selectedVendorService?.duration ?? duration) > 0 && (
                      <p className="text-xs sm:text-sm text-gray-500">
                        {selectedServiceOption?.duration ?? selectedVendorService?.duration ?? duration} mins
                      </p>
                    )}
                  </div>
                  <p className="font-bold text-sm sm:text-base flex-shrink-0">
                    {formatPriceWithSymbol(selectedServiceOption?.price ?? selectedVendorService?.price ?? price ?? 0)}
                  </p>
                </div>
              )}

              {/* Date & Time */}
              <div className="flex items-center gap-2 sm:gap-3 pb-3 sm:pb-4 border-b">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Date & Time</p>
                  <p className="font-medium text-sm sm:text-base">
                    {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })} at {formatTime12Hour(selectedTime)}
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
                <span className="font-bold text-orange-600">
                  {formatPriceWithSymbol(allSelectedServices && allSelectedServices.length > 0
                    ? allSelectedServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0)
                    : (selectedServiceOption?.price ?? selectedVendorService?.price ?? price ?? 0))}
                </span>
              </div>
            </div>

            <div className="mx-auto w-full max-w-xs sm:max-w-sm">
              <Button
                onClick={() => {
                  if (!selectedVendorService && selectedServiceOption) {
                    const actualVendorService = vendorServices.find((s) => {
                      const optionServiceId = (selectedServiceOption as any).serviceId || selectedServiceOption.id;
                      return (
                        (s.serviceId || s.service_id) === optionServiceId ||
                        (s.serviceId || s.service_id) === selectedServiceOption.id
                      );
                    });

                    const optionServiceId = (selectedServiceOption as any).serviceId || selectedServiceOption.id;
                    setSelectedVendorService({
                      id: actualVendorService?.id,
                      serviceId: actualVendorService?.serviceId || actualVendorService?.service_id || optionServiceId,
                      service_id: actualVendorService?.serviceId || actualVendorService?.service_id || optionServiceId,
                      name: selectedServiceOption.name,
                      price: selectedServiceOption.price,
                      duration: selectedServiceOption.duration,
                      serviceStyle: selectedServiceType,
                    });
                  }
                  setShowPaymentPage(true);
                }}
                className="min-h-12 w-full rounded-full bg-orange-500 px-4 py-2.5 text-center text-sm shadow-md hover:bg-orange-600 sm:h-12 sm:text-base sm:py-0"
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
            const totalBaseAmount = selectedPackageForSwitch
              ? (selectedPackageForSwitch.package_price ?? selectedPackageForSwitch.price ?? 0)
              : (allSelectedServices && allSelectedServices.length > 0
                ? allSelectedServices.reduce((sum, s) => sum + (s.price ?? 0), 0)
                : (selectedVendorService?.price ?? selectedServiceOption?.price ?? 0));
            const totalDuration = allSelectedServices && allSelectedServices.length > 0
              ? allSelectedServices.reduce((sum, s) => sum + (s.duration ?? 0), 0)
              : (selectedVendorService?.duration ?? selectedServiceOption?.duration ?? 15);
            const displayVendorName = vendorNameProp || doctor?.name || doctor?.clinic_name || doctor?.clinicName || 'Veterinary Clinic';
            return (
              <UniversalPaymentPage
                type="booking"
                layoutVariant="appShell"
                category="veterinary"
                vendorId={(vendorId || doctorId || clinicId || '') as string}
                vendorName={displayVendorName}
                serviceId={finalServiceId}
                serviceName={allSelectedServices?.length > 1 ? `${allSelectedServices.length} Services` : (selectedVendorService.name || selectedServiceOption?.name || 'Vet Consultation')}
                serviceDescription={allSelectedServices?.length > 1 ? allSelectedServices.map((s: any) => s.name || s.serviceName).join(', ') : `${selectedServiceOption?.name || selectedVendorService?.name} for ${selectedPet.name}`}
                serviceStyle={selectedServiceType === 'tele' ? 'tele' : selectedServiceType === 'at_home' ? 'at_home' : 'at_center'}
                bookingDate={selectedDate}
                bookingTime={selectedTime}
                petId={selectedPet.id}
                petName={selectedPet.name}
                petBreed={selectedPet.breed}
                addressId={selectedServiceType === 'at_home' ? selectedAddress?.id : undefined}
                address={selectedServiceType === 'at_home' && selectedAddress ? {
                  id: selectedAddress.id,
                  label: selectedAddress.label,
                  addressLine1: selectedAddress.addressLine1 || selectedAddress.address,
                  city: selectedAddress.city,
                  pincode: selectedAddress.pincode,
                  state: selectedAddress.state,
                } : undefined}
                baseAmount={totalBaseAmount}
                priceIncludesTax={
                  catalogPriceIncludesTax(selectedVendorService) ||
                  catalogPriceIncludesTax(selectedServiceOption) ||
                  (!!(allSelectedServices?.length) && catalogPriceIncludesTax(allSelectedServices![0]))
                }
                duration={totalDuration}
                selectedServices={allSelectedServices && allSelectedServices.length > 0 ? allSelectedServices : undefined}
                customerPhone={phone}
                customerId={customerId || undefined}
                flowType={selectedServiceType === 'tele' ? 'tele-scheduled' : undefined}
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
                  <span className="text-xs sm:text-sm text-gray-500">Service{allSelectedServices?.length > 1 ? 's' : ''}</span>
                  <span className="font-medium text-xs sm:text-sm text-right ml-2">
                    {allSelectedServices && allSelectedServices.length > 1
                      ? allSelectedServices.map((s: any) => s.name || s.serviceName).join(', ')
                      : (selectedServiceOption?.name || selectedVendorService?.name)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-500">Date</span>
                  <span className="font-medium text-xs sm:text-sm">{new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-500">Time</span>
                  <span className="font-medium text-xs sm:text-sm">{formatTime12Hour(selectedTime)}</span>
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

            <div className="mx-auto w-full max-w-xs sm:max-w-sm space-y-2 sm:space-y-3">
              <Button 
                onClick={() => onViewBooking?.(bookingId || '')}
                className="w-full whitespace-normal text-center rounded-full bg-orange-500 hover:bg-orange-600 text-sm min-h-12 px-4 py-2.5 shadow-md sm:h-12 sm:text-base sm:py-0"
              >
                View Booking Details
              </Button>
              <Button 
                onClick={onBack}
                variant="outline"
                className="w-full whitespace-normal text-center rounded-full text-sm min-h-12 px-4 py-2.5 sm:h-12 sm:text-base sm:py-0"
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
                  Book New (Pay {formatPriceWithSymbol(selectedServiceOption?.price || 499)})
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

        {/* Add Address Modal - in-context for at_home booking step */}
        <AddAddressModal
          phone={phone}
          isOpen={showAddAddressModal}
          onClose={() => setShowAddAddressModal(false)}
          onSuccess={() => {
            refreshAddresses();
            setShowAddAddressModal(false);
          }}
        />
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
        maxWidth="max-w-customer"
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
