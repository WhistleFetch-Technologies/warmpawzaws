/**
 * UniversalHomeServiceRouter - Unified Home Service Booking Flow
 * 
 * Supports: Walker, Groomer, Trainer, Behaviourist, Sitter, Diagnostics (Home Collection)
 * 
 * Flow: Landing → Provider Discovery → Provider Profile → Service Selection → 
 *       Pet Selection → Time Selection → Address Selection → Payment → Confirmation
 * 
 * Features:
 * - Consistent step-by-step booking across all home services
 * - Problem-based filtering
 * - Hyperlocal provider discovery
 * - Package session support
 * - GPS tracking integration
 * - Start/End OTP for service verification
 */

"use client";

import { useState, useEffect, useCallback } from 'react';
import { PetSelector } from '../grooming/PetSelector';
import { AddressSelector } from '../grooming/AddressSelector';
import { TimeSlotSelector } from '../grooming/TimeSlotSelector';
import { ServicePackageSelector } from '../grooming/ServicePackageSelector';
import { UniversalPaymentPage } from '../payment/UniversalPaymentPage';
import { catalogPriceIncludesTax } from '@/lib/booking-display-utils';
import { BookingConfirmationPage } from '../payment/BookingConfirmationPage';
import { HomeServiceProviderListView } from './HomeServiceProviderListView';
import { HomeServiceProviderProfile } from './HomeServiceProviderProfile';
import { HomeServiceLanding } from './HomeServiceLanding';
import { apiClient } from '@/lib/api-client';
import { resolveVendorProfilePhotoUrl } from '@/lib/vendor-display-media';
import { toast } from 'sonner';

// Service type definitions
export type HomeServiceType = 
  | 'walker' 
  | 'grooming' 
  | 'training' 
  | 'veterinary' 
  | 'behaviourist' 
  | 'sitter' 
  | 'diagnostics';

// Service configuration
interface ServiceConfig {
  roleId: string;
  displayName: string;
  icon: string;
  primaryColor: string;
  bgGradient: string;
  problems: Array<{ id: string; name: string; icon: string }>;
  priceUnit: string;
  defaultDuration: number;
  requiresOTP: boolean;
  requiresStartOTP: boolean;
  supportsPackages: boolean;
  showMedicalHistory: boolean;
}

// Service configurations for all home service types
export const SERVICE_CONFIGS: Record<HomeServiceType, ServiceConfig> = {
  walker: {
    roleId: 'dog_walker',
    displayName: 'Dog Walking',
    icon: '🚶',
    primaryColor: '#FF8C42',
    bgGradient: 'from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]',
    problems: [
      { id: '30-min', name: '30 Min Walk', icon: '🚶' },
      { id: '60-min', name: '60 Min Walk', icon: '🏃' },
      { id: 'group-walk', name: 'Group Walk', icon: '👥' },
      { id: 'park-visit', name: 'Park Visit', icon: '🌳' },
      { id: 'puppy-walk', name: 'Puppy Walk', icon: '🐕' },
    ],
    priceUnit: 'per walk',
    defaultDuration: 30,
    requiresOTP: true,
    requiresStartOTP: true,
    supportsPackages: true,
    showMedicalHistory: false,
  },
  grooming: {
    roleId: 'pet_groomer',
    displayName: 'Pet Grooming',
    icon: '✂️',
    primaryColor: '#A855F7',
    bgGradient: 'from-purple-500 to-violet-600',
    problems: [
      { id: 'full-grooming', name: 'Full Grooming', icon: '✨' },
      { id: 'bath', name: 'Bath Only', icon: '🛁' },
      { id: 'haircut', name: 'Hair Cut', icon: '✂️' },
      { id: 'nail-trim', name: 'Nail Trim', icon: '💅' },
      { id: 'ear-cleaning', name: 'Ear Cleaning', icon: '👂' },
      { id: 'de-shedding', name: 'De-shedding', icon: '🧹' },
      { id: 'flea-treatment', name: 'Flea Treatment', icon: '🔬' },
    ],
    priceUnit: 'per session',
    defaultDuration: 60,
    requiresOTP: true,
    requiresStartOTP: false,
    supportsPackages: true,
    showMedicalHistory: false,
  },
  training: {
    roleId: 'pet_trainer',
    displayName: 'Pet Training',
    icon: '🎓',
    primaryColor: '#3B82F6',
    bgGradient: 'from-blue-500 to-indigo-600',
    problems: [
      { id: 'basic-obedience', name: 'Basic Obedience', icon: '🎓' },
      { id: 'potty-training', name: 'Potty Training', icon: '🚽' },
      { id: 'leash-training', name: 'Leash Training', icon: '🦮' },
      { id: 'aggression', name: 'Aggression', icon: '😠' },
      { id: 'anxiety', name: 'Anxiety', icon: '😰' },
      { id: 'socialization', name: 'Socialization', icon: '🐕‍🦺' },
      { id: 'puppy-training', name: 'Puppy Training', icon: '🐶' },
    ],
    priceUnit: 'per session',
    defaultDuration: 60,
    requiresOTP: true,
    requiresStartOTP: true,
    supportsPackages: true,
    showMedicalHistory: false,
  },
  veterinary: {
    roleId: 'veterinarian',
    displayName: 'Home Vet Visit',
    icon: '🏥',
    primaryColor: '#EF4444',
    bgGradient: 'from-red-500 to-rose-600',
    problems: [
      { id: 'vomiting', name: 'Vomiting', icon: '🤮' },
      { id: 'diarrhea', name: 'Diarrhea', icon: '💩' },
      { id: 'not-eating', name: 'Not Eating', icon: '🍽️' },
      { id: 'skin-issues', name: 'Skin Issues', icon: '🔴' },
      { id: 'limping', name: 'Limping', icon: '🦵' },
      { id: 'fever', name: 'Fever', icon: '🤒' },
      { id: 'vaccination', name: 'Vaccination', icon: '💉' },
      { id: 'checkup', name: 'General Checkup', icon: '🩺' },
    ],
    priceUnit: 'per visit',
    defaultDuration: 45,
    requiresOTP: true,
    requiresStartOTP: false,
    supportsPackages: false,
    showMedicalHistory: true,
  },
  behaviourist: {
    roleId: 'pet_behaviourist',
    displayName: 'Pet Behaviourist',
    icon: '🧠',
    primaryColor: '#F59E0B',
    bgGradient: 'from-amber-500 to-orange-600',
    problems: [
      { id: 'aggression', name: 'Aggression', icon: '😠' },
      { id: 'anxiety', name: 'Anxiety/Fear', icon: '😰' },
      { id: 'separation', name: 'Separation Anxiety', icon: '💔' },
      { id: 'destructive', name: 'Destructive Behavior', icon: '🔨' },
      { id: 'barking', name: 'Excessive Barking', icon: '🔊' },
      { id: 'biting', name: 'Biting/Nipping', icon: '🦷' },
      { id: 'assessment', name: 'Behavior Assessment', icon: '📋' },
      { id: 'resource-guarding', name: 'Resource Guarding', icon: '🍖' },
    ],
    priceUnit: 'per session',
    defaultDuration: 90,
    requiresOTP: true,
    requiresStartOTP: false,
    supportsPackages: true,
    showMedicalHistory: false,
  },
  sitter: {
    roleId: 'pet_sitter',
    displayName: 'Pet Sitting',
    icon: '🏠',
    primaryColor: '#EC4899',
    bgGradient: 'from-pink-500 to-rose-600',
    problems: [
      { id: 'day-sitting', name: 'Day Sitting', icon: '☀️' },
      { id: 'overnight', name: 'Overnight Stay', icon: '🌙' },
      { id: 'drop-in', name: 'Drop-in Visit', icon: '🚪' },
      { id: 'multi-day', name: 'Multi-day Care', icon: '📅' },
      { id: 'medication', name: 'With Medication', icon: '💊' },
      { id: 'special-needs', name: 'Special Needs Pet', icon: '♿' },
    ],
    priceUnit: 'per day',
    defaultDuration: 480,
    requiresOTP: true,
    requiresStartOTP: true,
    supportsPackages: true,
    showMedicalHistory: false,
  },
  diagnostics: {
    roleId: 'diagnostics_technician',
    displayName: 'Home Sample Collection',
    icon: '🧪',
    primaryColor: '#06B6D4',
    bgGradient: 'from-cyan-500 to-teal-600',
    problems: [
      { id: 'blood-test', name: 'Blood Test', icon: '🩸' },
      { id: 'urine-test', name: 'Urine Test', icon: '🧪' },
      { id: 'stool-test', name: 'Stool Test', icon: '💩' },
      { id: 'skin-scraping', name: 'Skin Scraping', icon: '🔬' },
      { id: 'general-screening', name: 'General Screening', icon: '📋' },
      { id: 'pre-surgery', name: 'Pre-Surgery Panel', icon: '🏥' },
    ],
    priceUnit: 'per test',
    defaultDuration: 30,
    requiresOTP: true,
    requiresStartOTP: false,
    supportsPackages: false,
    showMedicalHistory: true,
  },
};

// Router step types
type RouterStep = 
  | 'landing'
  | 'provider_list'
  | 'provider_profile'
  | 'select_service'
  | 'select_pet'
  | 'select_time'
  | 'select_address'
  | 'payment'
  | 'confirmation';

// Booking flow state interface
interface BookingFlowState {
  serviceType: HomeServiceType;
  vendorId: string | null;
  vendorName: string | null;
  vendorAddress: string | null;
  vendorPhone: string | null;
  vendorPhoto: string | null;
  staffId: string | null;
  staffName: string | null;
  services: any[];
  addOns: any[];
  pet: any | null;
  date: string | null;
  time: string | null;
  slotData: any | null;
  address: any | null;
  payment: any | null;
  booking: any | null;
  packageId: string | null;
  usePackageSession: boolean;
  selectedProblem: string | null;
  notes: string;
}

interface UniversalHomeServiceRouterProps {
  phone: string;
  serviceType: HomeServiceType;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string, petId?: string) => void;
  onViewAppointment?: (appointmentId: string) => void;
  initialProblem?: string;
  preSelectedVendorId?: string;
}

export function UniversalHomeServiceRouter({
  phone,
  serviceType,
  onBack,
  onNavigate,
  onViewBooking,
  onViewAppointment,
  initialProblem,
  preSelectedVendorId
}: UniversalHomeServiceRouterProps) {
  const config = SERVICE_CONFIGS[serviceType];

  // Router state
  const [currentStep, setCurrentStep] = useState<RouterStep>(preSelectedVendorId ? 'provider_profile' : 'landing');
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState<string>('');
  const [customerData, setCustomerData] = useState<any>(null);

  // Booking flow state
  const [bookingFlow, setBookingFlow] = useState<BookingFlowState>({
    serviceType,
    vendorId: preSelectedVendorId || null,
    vendorName: null,
    vendorAddress: null,
    vendorPhone: null,
    vendorPhoto: null,
    staffId: null,
    staffName: null,
    services: [],
    addOns: [],
    pet: null,
    date: null,
    time: null,
    slotData: null,
    address: null,
    payment: null,
    booking: null,
    packageId: null,
    usePackageSession: false,
    selectedProblem: initialProblem || null,
    notes: '',
  });

  // Load customer data on mount
  useEffect(() => {
    loadCustomerData();
  }, [phone]);

  // Load vendor if pre-selected
  useEffect(() => {
    if (preSelectedVendorId && currentStep === 'provider_profile') {
      loadVendorDetails(preSelectedVendorId);
    }
  }, [preSelectedVendorId]);

  const loadCustomerData = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<{ customerId: string; customer: any }>(`/customer-by-phone/${phone}`);
      setCustomerId(data.customerId);
      setCustomerData(data.customer);
    } catch (error) {
      console.error('Error loading customer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVendorDetails = async (vendorId: string) => {
    try {
      const data = await apiClient.get<{ vendor?: any }>(`/vendor/${vendorId}`);
      const vendor = data.vendor || data;
      const raw = vendor as Record<string, unknown>;
      setBookingFlow(prev => ({
        ...prev,
        vendorId: vendor.id,
        vendorName: vendor.business_name || vendor.businessName || vendor.fullName,
        vendorAddress: vendor.address,
        vendorPhone: vendor.phone,
        vendorPhoto: resolveVendorProfilePhotoUrl(raw) || (vendor.photo as string) || (vendor.logo as string) || null,
      }));
    } catch (error) {
      console.error('Error loading vendor details:', error);
    }
  };

  // Reset booking flow
  const resetBookingFlow = () => {
    setBookingFlow({
      serviceType,
      vendorId: null,
      vendorName: null,
      vendorAddress: null,
      vendorPhone: null,
      vendorPhoto: null,
      staffId: null,
      staffName: null,
      services: [],
      addOns: [],
      pet: null,
      date: null,
      time: null,
      slotData: null,
      address: null,
      payment: null,
      booking: null,
      packageId: null,
      usePackageSession: false,
      selectedProblem: null,
      notes: '',
    });
  };

  // Navigation handlers
  const handleNavigateToStep = (step: RouterStep) => {
    setCurrentStep(step);
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'landing':
        onBack();
        break;
      case 'provider_list':
        setCurrentStep('landing');
        break;
      case 'provider_profile':
        setCurrentStep('provider_list');
        break;
      case 'select_service':
        setCurrentStep('provider_profile');
        break;
      case 'select_pet':
        setCurrentStep('select_service');
        break;
      case 'select_time':
        setCurrentStep('select_pet');
        break;
      case 'select_address':
        setCurrentStep('select_time');
        break;
      case 'payment':
        setCurrentStep('select_address');
        break;
      case 'confirmation':
        // Don't go back from confirmation
        break;
      default:
        onBack();
    }
  };

  // Event handlers for each step
  const handleLandingNavigate = (action: string, data?: any) => {
    if (action === 'browse_providers') {
      setCurrentStep('provider_list');
    } else if (action === 'problem_selected') {
      setBookingFlow(prev => ({ ...prev, selectedProblem: data?.problemId }));
      setCurrentStep('provider_list');
    } else if (action === 'quick_book') {
      // Quick book with last provider
      if (data?.vendorId) {
        setBookingFlow(prev => ({
          ...prev,
          vendorId: data.vendorId,
          vendorName: data.vendorName,
        }));
        setCurrentStep('provider_profile');
      }
    }
  };

  const handleProviderSelect = (provider: any) => {
    console.log('✅ [HOME-SERVICE-ROUTER] Provider selected:', provider);
    const raw = provider as Record<string, unknown>;
    setBookingFlow(prev => ({
      ...prev,
      vendorId: provider.id || provider.vendorId,
      vendorName: provider.businessName || provider.name || provider.fullName,
      vendorAddress: provider.address,
      vendorPhone: provider.phone,
      vendorPhoto: resolveVendorProfilePhotoUrl(raw) || provider.photo || provider.logo || null,
    }));
    setCurrentStep('provider_profile');
  };

  const handleServiceSelected = (services: any[], addOns: any[] = []) => {
    console.log('✅ [HOME-SERVICE-ROUTER] Services selected:', services);
    setBookingFlow(prev => ({ ...prev, services, addOns }));
    setCurrentStep('select_pet');
  };

  const handlePetSelected = (pet: any) => {
    console.log('✅ [HOME-SERVICE-ROUTER] Pet selected:', pet);
    try { sessionStorage.setItem(`warmpawz_last_pet_${phone}`, String(pet?.id)); } catch { /* ignore */ }
    setBookingFlow(prev => ({ ...prev, pet }));
    setCurrentStep('select_time');
  };

  const handleTimeSelected = (date: string, time: string, slotData?: any) => {
    console.log('✅ [HOME-SERVICE-ROUTER] Time selected:', date, time);
    setBookingFlow(prev => ({ ...prev, date, time, slotData }));
    setCurrentStep('select_address');
  };

  const handleAddressSelected = (address: any) => {
    console.log('✅ [HOME-SERVICE-ROUTER] Address selected:', address);
    setBookingFlow(prev => ({ ...prev, address }));
    setCurrentStep('payment');
  };

  const handlePaymentSuccess = (bookingId: string, _orderId?: string, otpCode?: string) => {
    // UniversalPaymentPage already creates the booking and passes bookingId via onSuccess. Do NOT POST again.
    console.log('✅ [HOME-SERVICE-ROUTER] Payment successful, bookingId:', bookingId);

    setBookingFlow(prev => ({
      ...prev,
      payment: { amount: prev.services.reduce((s, svc) => s + (svc.customPrice || svc.price || 0), 0), method: 'upi' },
      booking: {
        bookingId,
        otp: otpCode,
        startOTP: otpCode,
      }
    }));
    setCurrentStep('confirmation');
  };

  const handleViewBooking = () => {
    if (onViewBooking && bookingFlow.booking) {
      onViewBooking(bookingFlow.booking.bookingId, bookingFlow.pet?.id);
    }
  };

  const handleBackToDashboard = () => {
    resetBookingFlow();
    setCurrentStep('landing');
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <div 
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
            style={{ borderColor: config.primaryColor }}
          />
          <p className="text-gray-600">Loading {config.displayName}...</p>
        </div>
      </div>
    );
  }

  // Render based on current step
  // STEP: Landing
  if (currentStep === 'landing') {
    return (
      <HomeServiceLanding
        phone={phone}
        serviceType={serviceType}
        config={config}
        customerId={customerId}
        onBack={onBack}
        onNavigate={handleLandingNavigate}
      />
    );
  }

  // STEP: Provider List
  if (currentStep === 'provider_list') {
    return (
      <HomeServiceProviderListView
        phone={phone}
        serviceType={serviceType}
        config={config}
        selectedProblem={bookingFlow.selectedProblem}
        onBack={handleBack}
        onSelectProvider={handleProviderSelect}
        onNavigate={onNavigate}
      />
    );
  }

  // STEP: Provider Profile
  if (currentStep === 'provider_profile' && bookingFlow.vendorId) {
    return (
      <HomeServiceProviderProfile
        phone={phone}
        vendorId={bookingFlow.vendorId}
        serviceType={serviceType}
        config={config}
        onBack={handleBack}
        onSelectService={() => setCurrentStep('select_service')}
        onNavigate={onNavigate}
      />
    );
  }

  // STEP: Service Selection
  if (currentStep === 'select_service' && bookingFlow.vendorId) {
    return (
      <ServicePackageSelector
        vendorId={bookingFlow.vendorId}
        vendorName={bookingFlow.vendorName || config.displayName}
        serviceType="home"
        onBack={handleBack}
        onSelect={handleServiceSelected}
      />
    );
  }

  // STEP: Pet Selection (Phase 1: pre-select last-used pet from sessionStorage)
  if (currentStep === 'select_pet' && bookingFlow.services.length > 0) {
    let preSelectedPetId: string | undefined;
    try { preSelectedPetId = sessionStorage.getItem(`warmpawz_last_pet_${phone}`) || undefined; } catch { /* ignore */ }
    return (
      <PetSelector
        phone={phone}
        onBack={handleBack}
        onSelect={handlePetSelected}
        onNavigate={onNavigate}
        preSelectedPetId={preSelectedPetId}
      />
    );
  }

  // STEP: Time Selection
  if (currentStep === 'select_time' && bookingFlow.vendorId && bookingFlow.services.length > 0 && bookingFlow.pet) {
    return (
      <TimeSlotSelector
        vendorId={bookingFlow.vendorId}
        serviceDuration={bookingFlow.services[0]?.duration || config.defaultDuration}
        serviceStyle="at_home"
        onBack={handleBack}
        onSelect={handleTimeSelected}
      />
    );
  }

  // STEP: Address Selection
  if (currentStep === 'select_address' && bookingFlow.date && bookingFlow.time) {
    return (
      <AddressSelector
        phone={phone}
        onBack={handleBack}
        onSelect={handleAddressSelected}
      />
    );
  }

  // STEP: Payment
  if (currentStep === 'payment' && bookingFlow.services.length > 0 && bookingFlow.pet && bookingFlow.date && bookingFlow.time && bookingFlow.address) {
    const primaryService = bookingFlow.services[0];
    const totalAmount = bookingFlow.services.reduce((sum, s) => sum + (s.customPrice || s.price || 0), 0) +
                       bookingFlow.addOns.reduce((sum, a) => sum + (a.price || 0), 0);
    
    return (
      <UniversalPaymentPage
        type="booking"
        serviceId={primaryService?.id || primaryService?.serviceId}
        serviceName={primaryService?.serviceName || primaryService?.name || config.displayName}
        serviceDescription={`${config.displayName} service at your location`}
        serviceStyle="at_home"
        category={config.roleId}
        vendorId={bookingFlow.vendorId || ''}
        vendorName={bookingFlow.vendorName || config.displayName}
        bookingDate={bookingFlow.date}
        bookingTime={bookingFlow.time}
        petId={bookingFlow.pet.id}
        petName={bookingFlow.pet.name}
        petBreed={bookingFlow.pet.breed}
        addressId={bookingFlow.address?.id}
        address={bookingFlow.address}
        baseAmount={totalAmount}
        priceIncludesTax={catalogPriceIncludesTax(primaryService)}
        duration={primaryService?.duration || 60}
        customerPhone={phone}
        customerId={customerId}
        onBack={handleBack}
        onSuccess={handlePaymentSuccess}
      />
    );
  }

  // STEP: Confirmation
  if (currentStep === 'confirmation' && bookingFlow.booking) {
    return (
      <BookingConfirmationPage
        bookingId={bookingFlow.booking.bookingId}
        type="booking"
        otpCode={bookingFlow.booking.otp}
        serviceName={bookingFlow.services[0]?.serviceName || bookingFlow.services[0]?.name || config.displayName}
        vendorName={bookingFlow.vendorName || config.displayName}
        bookingDate={bookingFlow.date || ''}
        bookingTime={bookingFlow.time || ''}
        petName={bookingFlow.pet?.name || 'Pet'}
        address={bookingFlow.address}
        serviceStyle="at_home"
        totalAmount={bookingFlow.payment?.amount || 0}
        paymentMethod={bookingFlow.payment?.method || 'upi'}
        transactionId={bookingFlow.payment?.transactionId}
        onViewDetails={handleViewBooking}
        onBackToHome={handleBackToDashboard}
        onNavigate={onNavigate}
      />
    );
  }

  // Fallback
  return (
    <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
      <div className="text-center p-6">
        <p className="text-gray-600 mb-4">Something went wrong. Please try again.</p>
        <button
          onClick={handleBackToDashboard}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

export default UniversalHomeServiceRouter;
