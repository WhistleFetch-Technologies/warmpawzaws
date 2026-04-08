"use client";

/**
 * HomeServiceRouter - Universal Home Service Booking Flow
 * 
 * Flow: Service Dashboard → Home Service → Discover Providers → 
 *       Provider Profile → Schedule → Address → Payment → Confirmation
 * 
 * Features:
 * - Hyperlocal service provider discovery (radius-based)
 * - Provider cards with ratings, availability, completed services count
 * - Last booked providers shown at top
 * - Package tracking integration
 * - Session start/end OTP for walker/sitter
 * - GPS tracking for home visits
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft, Search, Filter, MapPin, Star, Clock, Calendar, 
  User, CheckCircle2, ChevronRight, Package, Heart, 
  Navigation, Phone, X, Plus, RefreshCw, Briefcase, Home
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { PromotionBanner } from '../shared/PromotionBanner';
import { UniversalPaymentPage } from '../payment/UniversalPaymentPage';
import { BookingConfirmationPage } from '../payment/BookingConfirmationPage';
import { AddAddressModal } from '../shared/AddAddressModal';
import { trackBookingStep, trackPageView, useBookingAnalytics, ServiceCategory } from '@/lib/analytics';

// Service types that support home service
export type HomeServiceType = 'walking' | 'grooming' | 'training' | 'veterinary' | 'sitting' | 'nutrition' | 'behaviourist' | 'diagnostics';

// ✅ NEW: Problem definitions for each service type
interface Problem {
  id: string;
  name: string;
  icon: string;
}

const SERVICE_PROBLEMS: Record<string, Problem[]> = {
  veterinary: [
    { id: 'vomiting', name: 'Vomiting', icon: '🤮' },
    { id: 'diarrhea', name: 'Diarrhea', icon: '💩' },
    { id: 'not-eating', name: 'Not Eating', icon: '🍽️' },
    { id: 'skin-issues', name: 'Skin Issues', icon: '🔴' },
    { id: 'limping', name: 'Limping', icon: '🦵' },
    { id: 'fever', name: 'Fever', icon: '🤒' },
    { id: 'vaccination', name: 'Vaccination', icon: '💉' },
    { id: 'checkup', name: 'General Checkup', icon: '🩺' },
  ],
  grooming: [
    { id: 'full-grooming', name: 'Full Grooming', icon: '✨' },
    { id: 'bath', name: 'Bath Only', icon: '🛁' },
    { id: 'haircut', name: 'Hair Cut', icon: '✂️' },
    { id: 'nail-trim', name: 'Nail Trim', icon: '💅' },
    { id: 'ear-cleaning', name: 'Ear Cleaning', icon: '👂' },
    { id: 'de-shedding', name: 'De-shedding', icon: '🧹' },
  ],
  training: [
    { id: 'basic-obedience', name: 'Basic Obedience', icon: '🎓' },
    { id: 'potty-training', name: 'Potty Training', icon: '🚽' },
    { id: 'leash-training', name: 'Leash Training', icon: '🦮' },
    { id: 'aggression', name: 'Aggression', icon: '😠' },
    { id: 'anxiety', name: 'Anxiety', icon: '😰' },
    { id: 'socialization', name: 'Socialization', icon: '🐕‍🦺' },
  ],
  walking: [
    { id: '30-min', name: '30 Min Walk', icon: '🚶' },
    { id: '60-min', name: '60 Min Walk', icon: '🏃' },
    { id: 'group-walk', name: 'Group Walk', icon: '👥' },
    { id: 'park-visit', name: 'Park Visit', icon: '🌳' },
  ],
  behaviourist: [
    { id: 'aggression', name: 'Aggression', icon: '😠' },
    { id: 'anxiety', name: 'Anxiety/Fear', icon: '😰' },
    { id: 'separation', name: 'Separation Anxiety', icon: '💔' },
    { id: 'destructive', name: 'Destructive Behavior', icon: '🔨' },
    { id: 'barking', name: 'Excessive Barking', icon: '🔊' },
    { id: 'assessment', name: 'Behavior Assessment', icon: '📋' },
  ],
  sitting: [
    { id: 'day-sitting', name: 'Day Sitting', icon: '☀️' },
    { id: 'overnight', name: 'Overnight Stay', icon: '🌙' },
    { id: 'multi-day', name: 'Multi-day Care', icon: '📅' },
    { id: 'drop-in', name: 'Drop-in Visit', icon: '🚪' },
  ],
  diagnostics: [
    { id: 'blood-test', name: 'Blood Test', icon: '🩸' },
    { id: 'urine-test', name: 'Urine Test', icon: '🧪' },
    { id: 'stool-test', name: 'Stool Test', icon: '💩' },
    { id: 'xray', name: 'X-Ray (At Center)', icon: '☢️' },
    { id: 'general', name: 'General Screening', icon: '🔬' },
  ],
};

interface HomeServiceRouterProps {
  phone: string;
  serviceType: HomeServiceType;
  serviceName: string; // Display name e.g., "Pet Walking"
  serviceIcon: string; // Emoji icon e.g., "🚶"
  primaryColor: string; // e.g., "green" for walker, "purple" for grooming
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

type RouterStep = 
  | 'discovery' 
  | 'provider-profile' 
  | 'services' 
  | 'datetime' 
  | 'pet' 
  | 'address' 
  | 'payment' 
  | 'confirmation';

interface ServiceProvider {
  id: string;
  vendorId: string;
  name: string;
  businessName?: string;
  photo?: string;
  description?: string;
  rating: number;
  totalReviews: number;
  completedServices: number;
  distance: number; // in km
  nextAvailability: string | null; // ISO date or null
  nextAvailabilityTime?: string; // Time string
  isVerified: boolean;
  isFavorite?: boolean;
  priceRange: { min: number; max: number };
  services: ProviderService[];
  specializations?: string[];
  yearsExperience?: number;
  responseTime?: string; // e.g., "Usually responds in 10 mins"
}

interface ProviderService {
  id: string;
  serviceId: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  serviceStyle: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
  booked?: boolean;
}

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
  photo?: string;
}

interface ActivePackage {
  id: string;
  packageName: string;
  vendorId: string;
  vendorName: string;
  remainingSessions: number | 'unlimited';
  totalSessions: number | 'unlimited';
  expiresAt: string | null;
  servicesIncluded: string[];
  usageType: string;
}

function feeCategoryForHomeService(t: HomeServiceType): string {
  const map: Record<HomeServiceType, string> = {
    walking: 'walking',
    grooming: 'grooming',
    training: 'training',
    veterinary: 'veterinary',
    sitting: 'boarding',
    nutrition: 'nutritionist',
    behaviourist: 'training',
    diagnostics: 'veterinary',
  };
  return map[t] || '';
}

export function HomeServiceRouter({
  phone,
  serviceType,
  serviceName,
  serviceIcon,
  primaryColor,
  onBack,
  onNavigate
}: HomeServiceRouterProps) {
  // Core state
  const [step, setStep] = useState<RouterStep>('discovery');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Discovery state
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [lastBookedProviders, setLastBookedProviders] = useState<ServiceProvider[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState<string | null>(null); // ✅ NEW: Problem filter
  const [filters, setFilters] = useState({
    sortBy: 'distance' as 'distance' | 'rating' | 'price' | 'availability',
    maxDistance: 10,
    minRating: 0,
    priceRange: { min: 0, max: 10000 },
    availableNow: false
  });
  
  // ✅ NEW: Get problems for this service type
  const serviceProblems = SERVICE_PROBLEMS[serviceType] || [];
  const [customerLocation, setCustomerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  
  // Selection state
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null);
  const [selectedService, setSelectedService] = useState<ProviderService | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [notes, setNotes] = useState('');
  
  // Data state
  const [pets, setPets] = useState<Pet[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  // ✅ ANALYTICS: Track booking steps
  const analytics = useBookingAnalytics(serviceType as ServiceCategory, 'at_home');
  
  // ✅ ANALYTICS: Track step changes
  useEffect(() => {
    const stepToAnalyticsMap: Record<RouterStep, string> = {
      'discovery': 'provider_discovery',
      'provider-profile': 'provider_selection',
      'services': 'service_selection',
      'datetime': 'schedule_selection',
      'pet': 'pet_selection',
      'address': 'address_selection',
      'payment': 'payment_initiated',
      'confirmation': 'booking_confirmed',
    };
    
    const analyticsStep = stepToAnalyticsMap[step];
    if (analyticsStep) {
      trackBookingStep({
        step: analyticsStep as any,
        serviceCategory: serviceType as ServiceCategory,
        serviceStyle: 'at_home',
        vendorId: selectedProvider?.id,
        petId: selectedPet?.id,
        phone,
        metadata: {
          serviceName,
          selectedProblem,
        }
      });
    }
  }, [step, serviceType, selectedProvider?.id, selectedPet?.id]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  
  // Package state
  const [activePackages, setActivePackages] = useState<ActivePackage[]>([]);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<ActivePackage | null>(null);
  const [usePackageSession, setUsePackageSession] = useState(false);
  
  // Booking state
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState<string | null>(null);
  
  // Add modals
  const [showAddPetModal, setShowAddPetModal] = useState(false);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);

  // Color schemes based on service type
  const colorSchemes: Record<string, { gradient: string; primary: string; light: string; text: string }> = {
    green: {
      gradient: 'from-green-600 to-emerald-600',
      primary: 'bg-green-600',
      light: 'bg-green-50 border-green-200 text-green-700',
      text: 'text-green-600'
    },
    purple: {
      gradient: 'from-purple-600 to-indigo-600',
      primary: 'bg-purple-600',
      light: 'bg-purple-50 border-purple-200 text-purple-700',
      text: 'text-purple-600'
    },
    blue: {
      gradient: 'from-blue-600 to-cyan-600',
      primary: 'bg-blue-600',
      light: 'bg-blue-50 border-blue-200 text-blue-700',
      text: 'text-blue-600'
    },
    orange: {
      gradient: 'from-orange-500 to-amber-500',
      primary: 'bg-orange-500',
      light: 'bg-orange-50 border-orange-200 text-orange-700',
      text: 'text-orange-600'
    }
  };

  const colors = colorSchemes[primaryColor] || colorSchemes.green;

  // Generate dates for next 7 days
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

  const [dates] = useState(generateDates());

  // Load initial data
  useEffect(() => {
    detectCustomerLocation();
    loadCustomerData();
    loadActivePackages();
  }, [phone]);

  // Load providers when location is available
  useEffect(() => {
    if (customerLocation) {
      loadProviders();
      loadLastBookedProviders();
    }
  }, [customerLocation, searchQuery, filters, selectedProblem]);

  // Load time slots when date/provider selected
  useEffect(() => {
    if (selectedDate && selectedProvider) {
      loadTimeSlots(selectedDate);
    }
  }, [selectedDate, selectedProvider?.id]);

  // Detect customer location (silent fallback when permission denied)
  const detectCustomerLocation = useCallback(() => {
    const { getCurrentPositionSafe, DEFAULT_COORDS } = require('@/lib/geolocation-utils');
    setDetectingLocation(true);
    getCurrentPositionSafe(
      (coords: { lat: number; lng: number }) => {
        setCustomerLocation(coords);
        setDetectingLocation(false);
      },
      () => {
        setCustomerLocation(DEFAULT_COORDS);
        setDetectingLocation(false);
      }
    );
  }, []);

  // Load providers based on location and filters
  const loadProviders = async () => {
    if (!customerLocation) return;

    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        serviceType: serviceType,
        serviceStyle: 'at_home',
        latitude: customerLocation.lat.toString(),
        longitude: customerLocation.lng.toString(),
        radius: filters.maxDistance.toString(),
        sortBy: filters.sortBy,
        ...(searchQuery && { query: searchQuery }),
        ...(filters.minRating > 0 && { minRating: filters.minRating.toString() }),
        ...(filters.availableNow && { availableNow: 'true' }),
        // ✅ NEW: Add problem filter
        ...(selectedProblem && { problemId: selectedProblem })
      });

      const response = await apiClient.get<any>(`/customer/home-service-providers?${params}`);

      if (response.success && response.providers) {
        setProviders(response.providers);
      } else {
        // Fallback - try alternative endpoint
        const altResponse = await apiClient.get<any>(
          `/customer/vendors/search?roleId=${serviceType}&serviceStyle=at_home&latitude=${customerLocation.lat}&longitude=${customerLocation.lng}`
        );
        
        if (altResponse.vendors) {
          // Transform to provider format
          const transformedProviders = altResponse.vendors.map((v: any) => ({
            id: v.id,
            vendorId: v.id,
            name: v.fullName || v.ownerName || v.businessName,
            businessName: v.businessName,
            photo: v.photo || v.profilePhoto,
            description: v.description || v.bio,
            rating: v.rating || 4.5,
            totalReviews: v.totalReviews || 0,
            completedServices: v.completedServices || v.bookingsCompleted || 0,
            distance: v.distance || calculateDistance(customerLocation, v.latitude, v.longitude),
            nextAvailability: v.nextAvailability,
            nextAvailabilityTime: v.nextAvailabilityTime,
            isVerified: v.isVerified || false,
            priceRange: v.priceRange || { min: 299, max: 999 },
            services: v.services || [],
            specializations: v.specializations || [],
            yearsExperience: v.yearsExperience,
            responseTime: v.responseTime
          }));
          setProviders(transformedProviders);
        } else {
          setProviders([]);
        }
      }
    } catch (error) {
      console.error('Error loading providers:', error);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper to calculate distance
  const calculateDistance = (loc1: { lat: number; lng: number }, lat2?: number, lng2?: number) => {
    if (!lat2 || !lng2) return 999;
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - loc1.lat) * Math.PI / 180;
    const dLon = (lng2 - loc1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(loc1.lat * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 10) / 10;
  };

  // Load last booked providers
  const loadLastBookedProviders = async () => {
    try {
      const response = await apiClient.get<any>(
        `/customer/${phone}/last-booked-providers?serviceType=${serviceType}&limit=3`
      );

      if (response.success && response.providers) {
        setLastBookedProviders(response.providers);
      }
    } catch (error) {
      console.log('No previous bookings found');
      setLastBookedProviders([]);
    }
  };

  // Load customer data (pets, addresses)
  const loadCustomerData = async () => {
    try {
      // Load pets
      const petsResponse = await apiClient.get<any>(`/customer/pets/${phone}`);
      if (petsResponse.pets) {
        setPets(petsResponse.pets);
      }

      // Load addresses — normalize and pre-select default or first
      const addressResponse = await apiClient.get<any>(`/customer/addresses?phone=${encodeURIComponent(phone)}`);
      if (addressResponse?.addresses && Array.isArray(addressResponse.addresses)) {
        const list = addressResponse.addresses;
        setAddresses(list);
        const defaultAddr = list.find((a: any) => a.isDefault ?? a.is_default);
        setSelectedAddress(defaultAddr || list[0] || null);
      }

      // Get customer ID
      const profileResponse = await apiClient.get<any>(`/customer/profile?phone=${encodeURIComponent(phone)}`);
      if (profileResponse?.profile?.id || profileResponse?.id) {
        setCustomerId(profileResponse?.profile?.id || profileResponse?.id);
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
    }
  };

  // Load active packages
  const loadActivePackages = async () => {
    try {
      const response = await apiClient.get<any>(
        `/customer/${phone}/packages?serviceType=${serviceType}&status=active`
      );

      if (response.packages) {
        setActivePackages(response.packages);
      }
    } catch (error) {
      console.log('No active packages');
      setActivePackages([]);
    }
  };

  // Load time slots
  const loadTimeSlots = async (date: string) => {
    if (!selectedProvider) return;

    try {
      setLoadingSlots(true);
      const response = await apiClient.get<any>(
        `/customer/vendor/${selectedProvider.vendorId}/available-slots?date=${date}&serviceStyle=at_home`
      );

      if (response.success && response.slots) {
        setTimeSlots(response.slots);
      } else {
        // Default fallback slots
        const defaultSlots = [
          '08:00', '09:00', '10:00', '11:00',
          '14:00', '15:00', '16:00', '17:00', '18:00'
        ].map(time => ({ time, available: true }));
        setTimeSlots(defaultSlots);
      }
    } catch (error) {
      console.error('Error loading slots:', error);
      // Default fallback
      const defaultSlots = [
        '08:00', '09:00', '10:00', '11:00',
        '14:00', '15:00', '16:00', '17:00', '18:00'
      ].map(time => ({ time, available: true }));
      setTimeSlots(defaultSlots);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Handle provider selection
  const handleProviderSelect = async (provider: ServiceProvider) => {
    setSelectedProvider(provider);
    
    // Check if customer has active package with this provider
    const providerPackage = activePackages.find(p => p.vendorId === provider.vendorId);
    if (providerPackage) {
      setSelectedPackage(providerPackage);
      setShowPackageModal(true);
    } else {
      setStep('provider-profile');
    }
  };

  // Handle package usage decision
  const handleUsePackage = () => {
    setUsePackageSession(true);
    setShowPackageModal(false);
    setStep('provider-profile');
    toast.success('Using package session - No payment required!');
  };

  const handleBookNew = () => {
    setUsePackageSession(false);
    setShowPackageModal(false);
    setStep('provider-profile');
  };

  // Navigation handlers
  const handleNext = () => {
    if (step === 'provider-profile') {
      if (selectedProvider?.services?.length === 1) {
        // Auto-select single service and skip to datetime
        setSelectedService(selectedProvider.services[0]);
        setStep('datetime');
      } else {
        setStep('services');
      }
    } else if (step === 'services') {
      setStep('datetime');
    } else if (step === 'datetime') {
      setStep('pet');
    } else if (step === 'pet') {
      setStep('address');
    } else if (step === 'address') {
      handleCreateBooking();
    }
  };

  const handleBackStep = () => {
    if (step === 'discovery') {
      onBack();
    } else if (step === 'provider-profile') {
      setSelectedProvider(null);
      setStep('discovery');
    } else if (step === 'services') {
      setStep('provider-profile');
    } else if (step === 'datetime') {
      if (selectedProvider?.services?.length === 1) {
        setStep('provider-profile');
      } else {
        setStep('services');
      }
    } else if (step === 'pet') {
      setStep('datetime');
    } else if (step === 'address') {
      setStep('pet');
    } else if (step === 'payment') {
      setStep('address');
    }
  };

  // Create booking and proceed to payment
  const handleCreateBooking = async () => {
    if (!selectedPet || !selectedAddress || !selectedDate || !selectedTime || !customerId) {
      toast.error('Please complete all required fields');
      return;
    }

    setProcessing(true);

    try {
      const bookingData = {
        customerId,
        vendorId: selectedProvider?.vendorId,
        serviceId: selectedService?.serviceId,
        bookingDate: selectedDate,
        bookingTime: selectedTime,
        serviceType: 'at_home',
        petId: selectedPet.id,
        address: selectedAddress.addressLine1 || selectedAddress.address,
        city: selectedAddress.city,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
        latitude: selectedAddress.latitude,
        longitude: selectedAddress.longitude,
        notes,
        ...(usePackageSession && selectedPackage && { 
          packagePurchaseId: selectedPackage.id,
          amount: 0
        }),
        ...(!usePackageSession && { 
          amount: selectedService?.price || 0
        })
      };

      const response = await apiClient.post<any>('/bookings/create', bookingData);

      if (response.bookingId || response.booking?.id || response.id) {
        const newBookingId = response.bookingId || response.booking?.id || response.id;
        setBookingId(newBookingId);
        
        if (usePackageSession) {
          // Skip payment for package sessions
          if (response.otp) {
            setOtpCode(response.otp);
          }
          setStep('confirmation');
        } else {
          setStep('payment');
        }
      } else {
        throw new Error(response.error || 'Failed to create booking');
      }
    } catch (error: any) {
      console.error('Error creating booking:', error);
      toast.error(error.message || 'Failed to create booking');
    } finally {
      setProcessing(false);
    }
  };

  // Handle payment success
  const handlePaymentSuccess = (bookingIdResult: string, _orderId?: string, otpCodeResult?: string) => {
    setBookingId(bookingIdResult);
    if (otpCodeResult) {
      setOtpCode(otpCodeResult);
    }
    setStep('confirmation');
  };

  // Render step indicator
  const renderStepIndicator = () => {
    const steps = ['Provider', 'Service', 'Schedule', 'Pet', 'Address', 'Payment'];
    const stepMap: Record<RouterStep, number> = {
      'discovery': -1,
      'provider-profile': 0,
      'services': 1,
      'datetime': 2,
      'pet': 3,
      'address': 4,
      'payment': 5,
      'confirmation': 6
    };
    const currentIdx = stepMap[step];

    if (currentIdx < 0) return null;

    return (
      <div className="flex items-center justify-center gap-1 mb-4 px-4 overflow-x-auto">
        {steps.map((s, idx) => (
          <div key={s} className="flex items-center">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              idx <= currentIdx ? `${colors.primary} text-white` : 'bg-gray-200 text-gray-500'
            }`}>
              {idx < currentIdx ? '✓' : idx + 1}
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-4 h-0.5 ${idx < currentIdx ? colors.primary : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  // Render provider card
  const renderProviderCard = (provider: ServiceProvider, isLastBooked = false) => (
    <Card 
      key={provider.id}
      className={`p-4 cursor-pointer hover:shadow-lg transition-all ${
        isLastBooked ? 'border-2 border-orange-200 bg-orange-50/30' : ''
      }`}
      onClick={() => handleProviderSelect(provider)}
    >
      {isLastBooked && (
        <Badge className="mb-2 bg-orange-100 text-orange-700 border-orange-200">
          Previously Booked
        </Badge>
      )}
      
      <div className="flex gap-4">
        {/* Provider Photo */}
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden">
            {provider.photo ? (
              <img src={provider.photo} alt={provider.name} className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full flex items-center justify-center ${colors.light}`}>
                <User className="w-8 h-8" />
              </div>
            )}
          </div>
          {provider.isVerified && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        {/* Provider Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">
                {provider.name}
              </h3>
              {provider.businessName && provider.businessName !== provider.name && (
                <p className="text-xs text-gray-500 truncate">{provider.businessName}</p>
              )}
            </div>
            <div className="flex items-center gap-1 ml-2">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="font-semibold text-sm">{Number(provider.rating || 0).toFixed(1)}</span>
              <span className="text-xs text-gray-500">({provider.totalReviews || 0})</span>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {Number(provider.distance || 0).toFixed(1)} km
            </span>
            <span className="flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5" />
              {provider.completedServices}+ done
            </span>
            {provider.yearsExperience && (
              <span>{provider.yearsExperience}+ yrs exp</span>
            )}
          </div>

          {/* Description */}
          {provider.description && (
            <p className="text-sm text-gray-600 mt-2 line-clamp-2">{provider.description}</p>
          )}

          {/* Specializations */}
          {provider.specializations && provider.specializations.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {provider.specializations.slice(0, 3).map((spec, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {spec}
                </Badge>
              ))}
            </div>
          )}

          {/* Next Availability & Price */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <div className="flex items-center gap-1 text-sm">
              <Clock className={`w-4 h-4 ${colors.text}`} />
              <span className="text-gray-600">
                {provider.nextAvailability ? (
                  <>Next: <span className="font-medium">{
                    new Date(provider.nextAvailability).toLocaleDateString('en-IN', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    })
                  } {provider.nextAvailabilityTime || ''}</span></>
                ) : (
                  <span className="text-green-600 font-medium">Available Now</span>
                )}
              </span>
            </div>
            <div className="text-right">
              <span className="font-bold text-gray-900">
                ₹{provider.priceRange.min}
              </span>
              {provider.priceRange.min !== provider.priceRange.max && (
                <span className="text-gray-500 text-sm">-{provider.priceRange.max}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );

  // Get header title and subtitle based on step
  const getHeaderInfo = () => {
    if (step === 'discovery') {
      return { title: serviceName, subtitle: 'Find service providers near you' };
    }
    if (step === 'provider-profile') {
      return { title: selectedProvider?.name || serviceName, subtitle: 'Provider details' };
    }
    if (step === 'services') {
      return { title: serviceName, subtitle: 'Select service' };
    }
    if (step === 'datetime') {
      return { title: serviceName, subtitle: 'Pick date & time' };
    }
    if (step === 'pet') {
      return { title: serviceName, subtitle: 'Select your pet' };
    }
    if (step === 'address') {
      return { title: serviceName, subtitle: 'Confirm address' };
    }
    if (step === 'payment') {
      return { title: serviceName, subtitle: 'Complete payment' };
    }
    return { title: serviceName, subtitle: 'Booking confirmed' };
  };

  const headerInfo = getHeaderInfo();
  // Get icon component - use Home icon for home services
  const ServiceIconComponent = () => {
    // If serviceIcon is an emoji string, render it, otherwise use Home icon
    if (typeof serviceIcon === 'string' && serviceIcon.length <= 2) {
      return <span className="text-xl">{serviceIcon}</span>;
    }
    return <Home className="w-6 h-6 text-[#FF8C42]" />;
  };

  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto relative overflow-hidden">
      {/* Orange Header - Half size (17-18vh) with rounded bottom edge */}
      <div className="relative px-4 pt-8 pb-6" style={{ minHeight: '18vh' }}>
        {/* Back Button - White circular with black arrow */}
        <button
          onClick={handleBackStep}
          className="absolute top-8 left-4 w-10 h-10 bg-white rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm z-10"
        >
          <ArrowLeft className="w-5 h-5 text-black" />
        </button>

        {/* Service Icon - Centered horizontally, white circular */}
        <div className="flex flex-col items-center pt-4">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-2 shadow-sm">
            <ServiceIconComponent />
          </div>
          
          {/* Title and Subtitle - Centered */}
          <h1 className="text-xl font-bold text-white text-center mb-0.5">
            {headerInfo.title}
          </h1>
          <p className="text-white text-xs text-center opacity-90">
            {headerInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Rounded Bottom Edge on Header */}
      <div className="relative -mt-1">
        <div className="absolute top-0 left-0 right-0 h-6 bg-[#FF8C42] rounded-b-[32px]"></div>
      </div>

      {/* Main Content - White Card with Top Radius */}
      <div className="bg-white rounded-t-[32px] px-4 pt-6 min-h-[calc(82vh)] pb-24 relative z-10 -mt-1">
        {/* Search Bar - Only in discovery */}
        {step === 'discovery' && (
          <div className="mb-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100"
            >
              <Filter className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        )}

      {/* Step Indicator */}
      {step !== 'discovery' && step !== 'confirmation' && (
        <div className="bg-white py-3 border-b">
          {renderStepIndicator()}
        </div>
      )}

      {/* Content Area */}
      <div className="pb-24">
        {/* ============ DISCOVERY STEP ============ */}
        {step === 'discovery' && (
          <div className="p-4 space-y-6">
            {/* Location Status */}
            <Card className={`p-3 ${colors.light} border`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  <div>
                    <p className="text-sm font-medium">
                      {customerLocation ? 'Showing providers near you' : 'Getting your location...'}
                    </p>
                    <p className="text-xs opacity-80">
                      Within {filters.maxDistance} km radius
                    </p>
                  </div>
                </div>
                <button
                  onClick={detectCustomerLocation}
                  disabled={detectingLocation}
                  className="p-2 hover:bg-white/50 rounded-full"
                >
                  <RefreshCw className={`w-4 h-4 ${detectingLocation ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </Card>

            {/* ✅ NEW: Problem Filter Strip */}
            {serviceProblems.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">What's the concern?</p>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                  <button
                    onClick={() => setSelectedProblem(null)}
                    className={`flex-shrink-0 px-3 py-2 rounded-full text-sm font-medium transition-all ${
                      !selectedProblem
                        ? `${colors.primary} text-white shadow-md`
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All
                  </button>
                  {serviceProblems.map((problem) => (
                    <button
                      key={problem.id}
                      onClick={() => setSelectedProblem(problem.id === selectedProblem ? null : problem.id)}
                      className={`flex-shrink-0 px-3 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                        selectedProblem === problem.id
                          ? `${colors.primary} text-white shadow-md`
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span>{problem.icon}</span>
                      {problem.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Active Packages */}
            {activePackages.length > 0 && (
              <Card className="p-4 bg-purple-50 border-purple-200">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-purple-900">Your Active Packages</h3>
                </div>
                <div className="space-y-2">
                  {activePackages.slice(0, 2).map((pkg) => (
                    <div key={pkg.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-purple-100">
                      <div>
                        <p className="font-medium text-sm">{pkg.packageName}</p>
                        <p className="text-xs text-gray-500">
                          {pkg.remainingSessions === 'unlimited' ? 'Unlimited' : `${pkg.remainingSessions} sessions left`}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-purple-600 border-purple-200"
                        onClick={() => {
                          const provider = providers.find(p => p.vendorId === pkg.vendorId);
                          if (provider) {
                            setSelectedPackage(pkg);
                            handleProviderSelect(provider);
                          }
                        }}
                      >
                        Book Now
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Promotions */}
            <PromotionBanner service={serviceType} onNavigate={onNavigate} />

            {/* Last Booked Providers */}
            {lastBookedProviders.length > 0 && (
              <div>
                <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-400" />
                  Your Previous {serviceName} Providers
                </h2>
                <div className="space-y-3">
                  {lastBookedProviders.map(provider => renderProviderCard(provider, true))}
                </div>
              </div>
            )}

            {/* Filter Bar */}
            {showFilters && (
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Filters</h3>
                
                {/* Sort By */}
                <div className="mb-4">
                  <label className="text-sm text-gray-600 mb-2 block">Sort By</label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { id: 'distance', label: 'Nearest' },
                      { id: 'rating', label: 'Top Rated' },
                      { id: 'price', label: 'Price' },
                      { id: 'availability', label: 'Available Now' }
                    ].map(option => (
                      <button
                        key={option.id}
                        onClick={() => setFilters(prev => ({ ...prev, sortBy: option.id as any }))}
                        className={`px-3 py-1.5 rounded-full text-sm ${
                          filters.sortBy === option.id
                            ? `${colors.primary} text-white`
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Max Distance */}
                <div className="mb-4">
                  <label className="text-sm text-gray-600 mb-2 block">
                    Max Distance: {filters.maxDistance} km
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={25}
                    value={filters.maxDistance}
                    onChange={(e) => setFilters(prev => ({ ...prev, maxDistance: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                </div>

                {/* Min Rating */}
                <div className="mb-4">
                  <label className="text-sm text-gray-600 mb-2 block">Minimum Rating</label>
                  <div className="flex gap-2">
                    {[0, 3, 3.5, 4, 4.5].map(rating => (
                      <button
                        key={rating}
                        onClick={() => setFilters(prev => ({ ...prev, minRating: rating }))}
                        className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1 ${
                          filters.minRating === rating
                            ? `${colors.primary} text-white`
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {rating === 0 ? 'All' : <><Star className="w-3 h-3" /> {rating}+</>}
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* All Providers */}
            <div>
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center justify-between">
                <span>{serviceName} Providers Near You</span>
                <span className="text-sm font-normal text-gray-500">
                  {providers.length} found
                </span>
              </h2>
              
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <RefreshCw className={`w-8 h-8 ${colors.text} animate-spin mx-auto mb-2`} />
                    <p className="text-gray-600">Finding providers...</p>
                  </div>
                </div>
              ) : providers.length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="text-5xl mb-4">{serviceIcon}</div>
                  <h3 className="font-semibold text-gray-900 mb-2">No providers found</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Try increasing the search radius or check back later
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setFilters(prev => ({ ...prev, maxDistance: 25 }))}
                  >
                    Increase Search Radius
                  </Button>
                </Card>
              ) : (
                <div className="space-y-4">
                  {providers.map(provider => renderProviderCard(provider))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ PROVIDER PROFILE STEP ============ */}
        {step === 'provider-profile' && selectedProvider && (
          <div className="pb-4">
            {/* Provider Hero */}
            <div className="bg-white p-4 border-b">
              <div className="flex gap-4">
                <div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden">
                  {selectedProvider.photo ? (
                    <img src={selectedProvider.photo} alt={selectedProvider.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${colors.light}`}>
                      <User className="w-10 h-10" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900">{selectedProvider.name}</h2>
                    {selectedProvider.isVerified && (
                      <CheckCircle2 className="w-5 h-5 text-blue-500" />
                    )}
                  </div>
                  {selectedProvider.businessName && (
                    <p className="text-gray-500">{selectedProvider.businessName}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span className="font-semibold">{selectedProvider.rating}</span>
                      <span className="text-gray-500 text-sm">({selectedProvider.totalReviews} reviews)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{selectedProvider.completedServices}+</p>
                  <p className="text-xs text-gray-500">Services Done</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{selectedProvider.yearsExperience || 2}+</p>
                  <p className="text-xs text-gray-500">Years Exp.</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{selectedProvider.distance}</p>
                  <p className="text-xs text-gray-500">km Away</p>
                </div>
              </div>

              {/* Description */}
              {selectedProvider.description && (
                <div className="mt-4 pt-4 border-t">
                  <h3 className="font-semibold text-gray-900 mb-2">About</h3>
                  <p className="text-gray-600 text-sm">{selectedProvider.description}</p>
                </div>
              )}

              {/* Response Time */}
              {selectedProvider.responseTime && (
                <div className={`mt-4 p-3 rounded-lg ${colors.light}`}>
                  <p className="text-sm">
                    <Clock className="w-4 h-4 inline mr-1" />
                    {selectedProvider.responseTime}
                  </p>
                </div>
              )}
            </div>

            {/* Services List */}
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Services Offered</h3>
              <div className="space-y-3">
                {selectedProvider.services && selectedProvider.services.length > 0 ? (
                  selectedProvider.services.map(service => (
                    <Card
                      key={service.id}
                      className={`p-4 cursor-pointer transition-all ${
                        selectedService?.id === service.id
                          ? `border-2 ${colors.light.includes('border') ? colors.light.split(' ')[1] : 'border-green-500'} bg-green-50`
                          : 'hover:border-gray-300'
                      }`}
                      onClick={() => {
                        setSelectedService(service);
                        setStep('datetime');
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{service.name}</h4>
                          {service.description && (
                            <p className="text-sm text-gray-500 mt-1">{service.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {service.duration} mins
                            </span>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-xl font-bold text-gray-900">₹{service.price}</p>
                          <ChevronRight className={`w-5 h-5 ${colors.text} mt-1 ml-auto`} />
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <Card className="p-6 text-center">
                    <p className="text-gray-500">No services available</p>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============ DATE/TIME STEP ============ */}
        {step === 'datetime' && (
          <div className="p-4 space-y-6">
            {/* Selected Service Summary */}
            {selectedService && (
              <Card className={`p-3 ${colors.light} border`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{selectedService.name}</p>
                    <p className="text-sm">{selectedService.duration} mins</p>
                  </div>
                  <p className="text-xl font-bold">₹{selectedService.price}</p>
                </div>
              </Card>
            )}

            {/* Date Selection */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Select Date</h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {dates.map((d) => (
                  <button
                    key={d.date}
                    onClick={() => setSelectedDate(d.date)}
                    className={`flex-shrink-0 w-16 p-3 rounded-xl text-center transition-all ${
                      selectedDate === d.date 
                        ? `${colors.primary} text-white` 
                        : 'bg-white border border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="text-xs opacity-75">{d.day}</p>
                    <p className="text-xl font-bold">{d.dayNum}</p>
                    <p className="text-xs opacity-75">{d.month}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Time Selection */}
            {selectedDate && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Select Time</h3>
                {loadingSlots ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className={`w-6 h-6 ${colors.text} animate-spin`} />
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
                            ? `${colors.primary} text-white` 
                            : slot.available
                              ? 'bg-white border border-gray-200 hover:border-gray-300'
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
              disabled={!selectedDate || !selectedTime}
              className={`w-full ${colors.primary} hover:opacity-90`}
            >
              Continue
            </Button>
          </div>
        )}

        {/* ============ PET SELECTION STEP ============ */}
        {step === 'pet' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Select Your Pet</h2>
              <button
                onClick={() => setShowAddPetModal(true)}
                className={`flex items-center gap-1 px-3 py-1.5 ${colors.light} rounded-lg text-sm font-medium`}
              >
                <Plus className="w-4 h-4" />
                Add Pet
              </button>
            </div>

            <div className={`p-3 ${colors.light} rounded-lg`}>
              <p className="text-sm">
                🐾 A pet profile is required for {serviceName.toLowerCase()} services.
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
                        ? `${colors.light.includes('border') ? colors.light.split(' ')[1] : 'border-green-500'} ${colors.light.includes('bg') ? colors.light.split(' ')[0] : 'bg-green-50'}` 
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-full bg-orange-100 overflow-hidden flex items-center justify-center text-2xl">
                      {pet.photo ? (
                        <img src={pet.photo} alt={pet.name} className="w-full h-full object-cover" />
                      ) : (
                        pet.species?.toLowerCase().includes('dog') ? '🐕' : 
                        pet.species?.toLowerCase().includes('cat') ? '🐈' : '🐾'
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold text-gray-900">{pet.name}</h3>
                      <p className="text-sm text-gray-500 capitalize">{pet.breed}</p>
                    </div>
                    {selectedPet?.id === pet.id && (
                      <CheckCircle2 className={`w-6 h-6 ${colors.text}`} />
                    )}
                  </button>
                ))
              ) : (
                <Card className="p-8 text-center border-2 border-dashed">
                  <div className="text-5xl mb-3">🐾</div>
                  <p className="font-medium text-gray-900 mb-2">No pets added yet</p>
                  <p className="text-sm text-gray-500 mb-4">Add your pet to continue</p>
                  <Button
                    onClick={() => setShowAddPetModal(true)}
                    className={colors.primary}
                  >
                    + Add Your First Pet
                  </Button>
                </Card>
              )}
            </div>

            <Button
              onClick={handleNext}
              disabled={!selectedPet}
              className={`w-full ${colors.primary} hover:opacity-90`}
            >
              {selectedPet ? 'Continue' : 'Select a Pet to Continue'}
            </Button>
          </div>
        )}

        {/* ============ ADDRESS STEP ============ */}
        {step === 'address' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Service Location</h2>
              <button
                onClick={() => setShowAddAddressModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-600 rounded-lg text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Address
              </button>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                📍 Where should the service provider come?
              </p>
            </div>

            <div className="space-y-3">
              {addresses.length > 0 ? (
                addresses.map((addr) => (
                  <button
                    key={addr.id}
                    onClick={() => setSelectedAddress(addr)}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                      selectedAddress?.id === addr.id 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-200 bg-white hover:border-gray-300'
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
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{addr.addressLine1 || addr.address}</p>
                        <p className="text-sm text-gray-500">{addr.city} - {addr.pincode}</p>
                      </div>
                      {selectedAddress?.id === addr.id && (
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <Card className="p-8 text-center border-2 border-dashed">
                  <div className="text-5xl mb-3">📍</div>
                  <p className="font-medium text-gray-900 mb-2">No addresses saved</p>
                  <p className="text-sm text-gray-500 mb-4">Add an address for service delivery</p>
                  <Button
                    onClick={() => setShowAddAddressModal(true)}
                    className="bg-blue-500 hover:bg-blue-600"
                  >
                    + Add Your Address
                  </Button>
                </Card>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Special Instructions (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special instructions for the service provider..."
                className="w-full p-3 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                rows={3}
              />
            </div>

            <Button
              onClick={handleNext}
              disabled={!selectedAddress || processing}
              className={`w-full ${colors.primary} hover:opacity-90`}
            >
              {processing ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Creating Booking...</>
              ) : (
                `Proceed to ${usePackageSession ? 'Confirm' : 'Payment'}`
              )}
            </Button>
          </div>
        )}

        {/* ============ PAYMENT STEP ============ */}
        {/* ✅ FIX: Render payment page as full-screen overlay to escape router layout */}
        {step === 'payment' && bookingId && (
          <div className="fixed inset-0 z-50 bg-white">
            <UniversalPaymentPage
              type="booking"
              category={feeCategoryForHomeService(serviceType)}
              bookingId={bookingId}
              vendorId={selectedProvider?.vendorId || ''}
              vendorName={selectedProvider?.name || selectedProvider?.businessName || 'Provider'}
              serviceStyle="at_home"
              serviceName={selectedService?.name || serviceName}
              baseAmount={selectedService?.price || 0}
              customerPhone={phone}
              onSuccess={handlePaymentSuccess}
              onBack={() => setStep('address')}
            />
          </div>
        )}

        {/* ============ CONFIRMATION STEP ============ */}
        {step === 'confirmation' && bookingId && (
          <BookingConfirmationPage
            bookingId={bookingId}
            type="booking"
            otpCode={otpCode || undefined}
            serviceName={selectedService?.name || serviceName}
            serviceStyle="at_home"
            vendorName={selectedProvider?.name || 'Provider'}
            bookingDate={selectedDate}
            bookingTime={selectedTime}
            petName={selectedPet?.name}
            address={{
              addressLine1: selectedAddress?.addressLine1 || selectedAddress?.address,
              city: selectedAddress?.city,
              pincode: selectedAddress?.pincode
            }}
            totalAmount={usePackageSession ? 0 : (selectedService?.price || 0)}
            onViewDetails={() => onNavigate('booking-details', { bookingId })}
            onBackToHome={onBack}
          />
        )}
      </div>
      </div>

      {/* Package Selection Modal */}
      {showPackageModal && selectedPackage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Active Package Found!</h2>
                <p className="text-sm text-gray-500">You have sessions available</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <h3 className="font-semibold mb-2">{selectedPackage.packageName}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Sessions Remaining</span>
                  <span className="font-medium text-green-600">
                    {selectedPackage.remainingSessions === 'unlimited' 
                      ? 'Unlimited' 
                      : `${selectedPackage.remainingSessions} of ${selectedPackage.totalSessions}`}
                  </span>
                </div>
                {selectedPackage.expiresAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Expires</span>
                    <span className="font-medium">
                      {new Date(selectedPackage.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleUsePackage}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Use Package Session (Free)
              </Button>
              <Button
                onClick={handleBookNew}
                variant="outline"
                className="w-full"
              >
                Book New (Pay ₹{selectedService?.price || selectedProvider?.priceRange?.min || 299})
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Address Modal */}
      {showAddAddressModal && (
        <AddAddressModal
          phone={phone}
          isOpen={showAddAddressModal}
          onClose={() => setShowAddAddressModal(false)}
          onSuccess={async (newAddress) => {
            console.log('✅ [HomeServiceRouter] New address added:', newAddress);
            setShowAddAddressModal(false);
            // Select the new address immediately so the proceed button enables
            if (newAddress) {
              setSelectedAddress(newAddress);
            }
            // Refresh addresses list (may overwrite selectedAddress with default; re-apply selection after)
            try {
              await loadCustomerData();
              if (newAddress) {
                setSelectedAddress(newAddress);
              }
            } catch (_) {
              // List refresh failed; selection already set above, button stays enabled
            }
          }}
        />
      )}

      {/* TODO: Add Pet Modal component */}
      {/* Can be imported from existing AddPetModal or created similarly */}
    </div>
  );
}

export default HomeServiceRouter;
