'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Star, Clock, MapPin, Phone, Video, Home, Building2,
  Shield, Award, GraduationCap, Heart, Share2, Check, X, Calendar,
  ChevronRight, Plus, User, MessageCircle, Image as ImageIcon, Sparkles
} from 'lucide-react';
import { AmenitiesSection } from './AmenitiesSection';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import {
  buildDefaultSlotsWithPastGuard,
  normalizeAvailableSlotsResponse,
} from '@/lib/available-slots-response';
import { toast } from 'sonner';
import { AddAddressModal } from './AddAddressModal';
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import { INDICATIVE_PRICING_NOTE } from '@/lib/pricing-disclaimer';
import { formatLocalDateYYYYMMDD } from '@/lib/local-calendar-date';
import { ServiceDescriptionInline } from './ServiceDescriptionInline';
import { VendorRatingDisplay } from './VendorRatingDisplay';
import { resolveCustomerVendorAmenities, shouldShowVendorAmenities } from '@/lib/vendor-display-media';
import { shareVendorProfile, universalCategoryToSharePersona } from '@/lib/vendor-profile-share';

// ============================================================================
// TYPES
// ============================================================================

interface Service {
  id: string;
  serviceId: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  popular?: boolean;
  categoryName?: string;
  serviceStyle: string;
}

interface Review {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  date: string;
  petName?: string;
  serviceName?: string;
}

interface Provider {
  providerId: string;
  providerType: 'vendor' | 'staff' | 'individual';
  vendorId?: string;
  vendorName?: string;
  staffId?: string;
  name: string;
  photo?: string;
  photos?: string[];
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  role?: string;
  specialization?: string;
  qualifications?: string;
  degree?: string;
  bio?: string;
  experienceYears?: number;
  rating: number;
  reviewCount: number;
  distance?: number | null;
  isVerified?: boolean;
  isOnline?: boolean;
  nextAvailableSlot?: string;
  services: Service[];
  amenities?: string[];
  languages?: string[];
  consultationFee?: number;
}

interface TimeSlot {
  time: string;
  available: boolean;
  booked?: boolean;
}

interface Pet {
  id: string;
  name: string;
  type: string;
  breed: string;
  photo?: string;
}

interface Address {
  id: string;
  label: string;
  address: string;
  city?: string;
  pincode?: string;
  isDefault?: boolean;
}

interface UniversalProviderProfileProps {
  phone: string;
  provider: Provider;
  category: 'vet' | 'grooming' | 'training' | 'walking' | 'boarding' | 'nutritionist';
  serviceStyle: 'tele' | 'at_home' | 'at_center';
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  onProceedToPayment: (bookingData: any) => void;
  /** When user returns from address book after selecting an address */
  initialSelectedAddress?: any;
  onConsumeInitialAddress?: () => void;
  /** Restore booking form after returning from shell payment screen */
  initialShowBookingForm?: boolean;
  initialSelectedDate?: string;
  initialSelectedTime?: string;
  initialSelectedPetId?: string;
  initialSelectedServiceIds?: string[];
  initialSelectedAddressId?: string;
  /** Hardware / shell back: close booking form or address modal before parent step back */
  onInternalBackReady?: (handleBack: () => void) => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert 24-hour format time to 12-hour format
 * Example: "09:00" -> "9:00 AM", "14:30" -> "2:30 PM"
 */
function formatTime12Hour(time24: string): string {
  if (!time24) return '';
  
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours, 10);
  const min = minutes || '00';
  
  if (hour === 0) {
    return `12:${min} AM`;
  } else if (hour === 12) {
    return `12:${min} PM`;
  } else if (hour < 12) {
    return `${hour}:${min} AM`;
  } else {
    return `${hour - 12}:${min} PM`;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

/** Normalize address from address book (camelCase or snake_case from backend) to profile shape */
function normalizeAddress(raw: any): Address {
  if (!raw) return { id: '', label: 'Address', address: '' };
  const line1 = raw.addressLine1 ?? raw.address_line1;
  const line2 = raw.addressLine2 ?? raw.address_line2;
  const city = raw.city;
  const stateVal = raw.state;
  const pincode = raw.pincode;
  const addressLine = [line1, line2, city, stateVal, pincode].filter(Boolean).join(', ') || raw.address || '';
  return {
    id: raw.id || '',
    label: raw.label ?? raw.address_type ?? raw.name ?? 'Address',
    address: addressLine,
    city: city,
    pincode: pincode,
    isDefault: raw.isDefault ?? raw.is_default,
  };
}

/** Minutes for slot API — backend uses this as service length for grid spacing */
function serviceDurationMinutes(s: Service): number {
  const raw = (s as any).duration ?? (s as any).duration_minutes ?? (s as any).custom_duration;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function servicesMatchingSelection(services: Service[], selected: Set<string>): Service[] {
  if (!selected.size) return [];
  const want = new Set([...selected].map((id) => String(id)));
  return services.filter(
    (s) => want.has(String(s.id)) || (s.serviceId && want.has(String(s.serviceId)))
  );
}

export function UniversalProviderProfile({
  phone,
  provider,
  category,
  serviceStyle,
  onBack,
  onNavigate,
  onProceedToPayment,
  initialSelectedAddress,
  onConsumeInitialAddress,
  initialShowBookingForm,
  initialSelectedDate,
  initialSelectedTime,
  initialSelectedPetId,
  initialSelectedServiceIds,
  initialSelectedAddressId,
  onInternalBackReady,
}: UniversalProviderProfileProps) {
  const [activeTab, setActiveTab] = useState<'services' | 'about' | 'reviews'>('services');
  const [selectedServices, setSelectedServices] = useState<Set<string>>(
    () => new Set(initialSelectedServiceIds ?? []),
  );
  const [isFavorite, setIsFavorite] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  
  // Booking form state
  const [showBookingForm, setShowBookingForm] = useState(initialShowBookingForm ?? false);
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate ?? '');
  const [selectedTime, setSelectedTime] = useState(initialSelectedTime ?? '');
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [profileAmenities, setProfileAmenities] = useState<string[]>(provider.amenities || []);
  const [profileCustomAmenities, setProfileCustomAmenities] = useState<string[]>([]);

  const showFacilitiesAmenitiesOnAbout =
    shouldShowVendorAmenities(serviceStyle) &&
    !(category === 'vet' && serviceStyle === 'at_home');

  const handleInternalBack = useCallback(() => {
    if (showAddAddressModal) {
      setShowAddAddressModal(false);
      return;
    }
    if (showBookingForm) {
      setShowBookingForm(false);
      return;
    }
    onBack();
  }, [showAddAddressModal, showBookingForm, onBack]);

  useEffect(() => {
    onInternalBackReady?.(handleInternalBack);
  }, [handleInternalBack, onInternalBackReady]);

  // When returning from address book with a selected address, pre-select it
  useEffect(() => {
    if (initialSelectedAddress && initialSelectedAddress.id) {
      setSelectedAddress(normalizeAddress(initialSelectedAddress));
      onConsumeInitialAddress?.();
    }
  }, [initialSelectedAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate next 7 days
  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return {
      date: formatLocalDateYYYYMMDD(date),
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
    };
  });

  // Load customer data on mount
  useEffect(() => {
    loadCustomerData();
  }, [phone]);

  useEffect(() => {
    const vid = String(provider.vendorId || provider.providerId || '').trim();
    if (!vid || !shouldShowVendorAmenities(serviceStyle)) return;
    if (provider.amenities && provider.amenities.length > 0) {
      setProfileAmenities(provider.amenities);
    }
    let cancelled = false;
    (async () => {
      try {
        const res = (await apiClient.get(`/customer/facility/${encodeURIComponent(vid)}`)) as {
          success?: boolean;
          facility?: Record<string, unknown>;
          vendor?: Record<string, unknown>;
        };
        if (cancelled || res?.success === false) return;
        const resolved = resolveCustomerVendorAmenities({
          ...(res.facility && typeof res.facility === 'object' ? res.facility : {}),
          ...(res.vendor && typeof res.vendor === 'object' ? res.vendor : {}),
          ...(provider.amenities ? { amenities: provider.amenities } : {}),
        });
        if (!cancelled) {
          setProfileAmenities(resolved.amenities);
          setProfileCustomAmenities(resolved.customAmenities);
        }
      } catch {
        /* optional enrichment */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider.vendorId, provider.providerId, provider.amenities, serviceStyle]);

  const refreshAddresses = async () => {
    if (serviceStyle !== 'at_home') return;
    try {
      const addressResponse = await apiClient.get(`/customer/addresses?phone=${encodeURIComponent(phone)}`) as any;
      if (addressResponse?.addresses && Array.isArray(addressResponse.addresses)) {
        const normalized = addressResponse.addresses.map((a: any) => normalizeAddress(a));
        setAddresses(normalized);
        if (normalized.length > 0) {
          setSelectedAddress((prev) => {
            if (prev?.id) {
              const stillInList = normalized.find((a: Address) => a.id === prev!.id);
              return stillInList ?? normalizeAddress(addressResponse.addresses.find((a: any) => a.isDefault ?? a.is_default) || addressResponse.addresses[0]);
            }
            const defaultRaw = addressResponse.addresses.find((a: any) => a.isDefault ?? a.is_default);
            return normalizeAddress(defaultRaw || addressResponse.addresses[0]);
          });
        }
      }
    } catch (e) {
      console.log('Could not refresh addresses', e);
    }
  };

  const loadCustomerData = async () => {
    try {
      // Load pets
      const petsResponse = await apiClient.get(`/customer/pets/${phone}`) as any;
      if (petsResponse?.pets) {
        setPets(petsResponse.pets);
        if (petsResponse.pets.length > 0) {
          if (initialSelectedPetId) {
            const match = petsResponse.pets.find(
              (p: Pet) => String(p.id) === String(initialSelectedPetId),
            );
            setSelectedPet(match ?? petsResponse.pets[0]);
          } else {
            setSelectedPet(petsResponse.pets[0]);
          }
        }
      }

      // Load addresses (for at_home service style) — use ?phone= and normalize so list/selected have .address and .label
      if (serviceStyle === 'at_home') {
        try {
          const addressResponse = await apiClient.get(`/customer/addresses?phone=${encodeURIComponent(phone)}`) as any;
          if (addressResponse?.addresses && Array.isArray(addressResponse.addresses)) {
            const normalized = addressResponse.addresses.map((a: any) => normalizeAddress(a));
            setAddresses(normalized);
            const pickById = initialSelectedAddressId
              ? normalized.find((a: Address) => String(a.id) === String(initialSelectedAddressId))
              : undefined;
            const defaultRaw = addressResponse.addresses.find((a: any) => a.isDefault ?? a.is_default);
            const toSelect = pickById ?? (defaultRaw || addressResponse.addresses[0]);
            if (toSelect) setSelectedAddress(normalizeAddress(toSelect));
          }
        } catch (e) {
          console.log('No addresses found');
        }
      }

      // Get customer ID
      try {
        const profileResponse = await apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`) as any;
        if (profileResponse?.profile?.id || profileResponse?.id) {
          setCustomerId(profileResponse?.profile?.id || profileResponse?.id);
        }
      } catch (e) {
        console.log('Could not get customer ID');
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
    }
  };

  const loadTimeSlots = async (date: string) => {
    const vendorId = provider.vendorId || provider.providerId;
    if (!vendorId) return;

    try {
      setLoadingSlots(true);
      const selectedList = servicesMatchingSelection(provider.services, selectedServices);
      const sumMinutes = selectedList.reduce((sum, s) => sum + serviceDurationMinutes(s), 0);
      const totalDuration = Math.max(15, sumMinutes > 0 ? sumMinutes : 30);
      const serviceIds = selectedList
        .map((s) => s.serviceId || s.id)
        .filter(Boolean)
        .join(',');
      const params = new URLSearchParams({
        date,
        serviceStyle,
        totalDuration: String(totalDuration),
      });
      if (serviceIds) params.set('serviceIds', serviceIds);
      const raw = await apiClient.get(
        `/customer/vendor/${vendorId}/available-slots?${params.toString()}`
      );

      const { success, slots } = normalizeAvailableSlotsResponse(raw, date);

      if (success && slots.length > 0) {
        setTimeSlots(slots);
      } else if (!success) {
        setTimeSlots(buildDefaultSlotsWithPastGuard(date));
      } else {
        setTimeSlots([]);
      }
    } catch (error) {
      console.error('Error loading time slots:', error);
      setTimeSlots(buildDefaultSlotsWithPastGuard(date));
    } finally {
      setLoadingSlots(false);
    }
  };

  // Refetch slots when date / form / selection change (loadTimeSlots reads latest `provider` from closure)
  useEffect(() => {
    if (selectedDate && showBookingForm) {
      void loadTimeSlots(selectedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid re-running on every `provider.services` array identity from parent
  }, [selectedDate, showBookingForm, selectedServices, serviceStyle]);

  const loadReviews = async () => {
    const vendorId = provider.vendorId || provider.providerId;
    if (!vendorId) return;

    try {
      setLoadingReviews(true);
      const response = await apiClient.get(`/vendor/${vendorId}/reviews`) as any;
      if (response?.reviews) {
        setReviews(response.reviews);
      }
    } catch (error) {
      console.log('Could not load reviews');
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reviews' && reviews.length === 0) {
      loadReviews();
    }
  }, [activeTab]);

  // Toggle service selection
  const toggleService = (serviceId: string) => {
    const newSelected = new Set(selectedServices);
    if (newSelected.has(serviceId)) {
      newSelected.delete(serviceId);
    } else {
      newSelected.add(serviceId);
    }
    setSelectedServices(newSelected);
  };

  // Calculate total for selected services
  const selectedServicesList = servicesMatchingSelection(provider.services, selectedServices);
  const totalAmount = selectedServicesList.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServicesList.reduce((sum, s) => sum + s.duration, 0);

  // Proceed to booking
  const handleProceedToBooking = () => {
    if (selectedServices.size === 0) {
      toast.error('Please select at least one service');
      return;
    }
    setShowBookingForm(true);
    // Set default date to today
    setSelectedDate(dates[0].date);
  };

  // Proceed to payment
  const handleProceedToPayment = () => {
    // Validate
    if (selectedServices.size === 0) {
      toast.error('Please select at least one service');
      return;
    }
    if (!selectedPet) {
      toast.error('Please select a pet');
      return;
    }
    if (!selectedDate || !selectedTime) {
      toast.error('Please select date and time');
      return;
    }
    if (serviceStyle === 'at_home' && !selectedAddress) {
      toast.error('Please select a delivery address');
      return;
    }
    if (!customerId) {
      toast.error('Customer ID not found. Please try again.');
      return;
    }

    const vendorId = provider.vendorId || provider.providerId;
    const firstService = selectedServicesList[0];

    const bookingData = {
      customerId,
      vendorId,
      staffId: provider.staffId,
      serviceId: firstService.serviceId || (firstService as any).service_id || firstService.id,
      services: selectedServicesList.map((s: any) => ({
        ...s,
        serviceId: s.serviceId || (s as any).service_id || s.id,
        name: s.name || s.serviceName,
        price: Number(s.price) || 0,
        duration: Number(s.duration) || 0,
      })),
      bookingDate: selectedDate,
      bookingTime: selectedTime,
      serviceType: serviceStyle,
      petId: selectedPet.id,
      petName: selectedPet.name,
      petBreed: selectedPet.breed,
      address: selectedAddress,
      notes,
      totalAmount,
      totalDuration,
      provider: {
        id: provider.providerId,
        name: provider.name,
        photo: provider.photo,
        rating: provider.rating,
      },
    };

    onProceedToPayment(bookingData);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Provider Photo */}
      <div className="relative">
        {/* Photo Banner */}
        <div className="h-48 bg-gradient-to-br from-orange-400 to-amber-500 relative">
          {provider.photo && (
            <img 
              src={provider.photo} 
              alt={provider.name} 
              className="w-full h-full object-cover opacity-30"
            />
          )}
          
          {/* Toolbar: safe-area so back/actions clear status bar (iOS / WebView) */}
          <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 cw-header-safe-top cw-header-safe-x pointer-events-none">
            <button
              type="button"
              onClick={handleInternalBack}
              className="pointer-events-auto flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur transition-colors hover:bg-white/30"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>

            <div className="flex shrink-0 gap-2 pointer-events-auto">
              <button
                type="button"
                onClick={() => setIsFavorite(!isFavorite)}
                className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white shadow-lg"
                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart className={`h-5 w-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
              </button>
              <button
                type="button"
                onClick={() => {
                  const shareVendorId = String(provider.vendorId || provider.providerId || '').trim();
                  if (!shareVendorId) return;
                  void shareVendorProfile({
                    title: provider.name,
                    text: `Check out ${provider.name} on Warmpawz`,
                    vendorId: shareVendorId,
                    persona: universalCategoryToSharePersona(category),
                    vendorName: provider.name,
                    serviceStyle,
                  });
                }}
                className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white shadow-lg"
                aria-label="Share"
              >
                <Share2 className="h-5 w-5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Provider Card */}
        <div className="px-4 -mt-16 relative z-10">
          <Card className="p-4 bg-white shadow-lg">
            <div className="flex gap-4">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100 flex-shrink-0 border-4 border-white shadow-lg -mt-8">
                {provider.photo ? (
                  <img src={provider.photo} alt={provider.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-orange-500">
                    {provider.name.charAt(0)}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="font-bold text-lg text-gray-900 truncate">{provider.name}</h1>
                  {provider.isVerified && (
                    <Shield className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  )}
                </div>
                
                {provider.qualifications && (
                  <p className="text-sm text-gray-500 truncate">{provider.qualifications}</p>
                )}

                <VendorRatingDisplay
                  row={{
                    vendorId: provider.vendorId ?? provider.id,
                    vendorRating: provider.rating,
                    vendorReviewCount: provider.reviewCount,
                  }}
                  vendorId={String(provider.vendorId ?? provider.id ?? '')}
                  className="mt-2"
                  starsClassName="w-4 h-4"
                  textClassName="text-xs text-gray-500"
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Booking Form (Slide-in from bottom) */}
      {showBookingForm ? (
        <div className="px-4 pt-4 cw-scroll-pad-tabbar-sticky-cta">
          <h2 className="text-lg font-bold mb-4">Complete Your Booking</h2>

          {/* Selected Services Summary */}
          <Card className="p-4 mb-4 bg-orange-50 border-orange-200">
            <h3 className="font-medium text-sm mb-2">Selected Services</h3>
            {selectedServicesList.map(service => (
              <div key={service.id} className="mb-3 last:mb-0">
                <div className="flex justify-between text-sm items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="flex items-center gap-2 font-medium">
                      {service.name}
                      {(service as any).isPackage && (
                        <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-700">Package</span>
                      )}
                    </span>
                    {service.description?.trim() && (
                      <div onClick={(e) => e.stopPropagation()} className="mt-1">
                        <ServiceDescriptionInline
                          description={service.description}
                          title={service.name}
                          className="m-0 text-xs leading-snug text-gray-600"
                          linkClassName="inline cursor-pointer align-baseline text-[10px] font-semibold text-[#FF8C42] hover:underline"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      {service.duration > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {service.duration} mins
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-medium whitespace-nowrap">{formatPriceWithSymbol(service.price)}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-between mt-2 pt-2 border-t border-orange-200 font-bold">
              <span>Total</span>
              <span className="text-orange-600">{formatPriceWithSymbol(totalAmount)}</span>
            </div>
          </Card>

          {/* Date Selection */}
          <div className="mb-4">
            <h3 className="font-medium text-sm mb-2">Select Date</h3>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {dates.map((d) => (
                <button
                  key={d.date}
                  onClick={() => setSelectedDate(d.date)}
                  className={`flex-shrink-0 w-16 p-3 rounded-xl text-center transition-all ${
                    selectedDate === d.date 
                      ? 'bg-orange-500 text-white' 
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

          {/* Time Selection */}
          {selectedDate && (
            <div className="mb-4">
              <h3 className="font-medium text-sm mb-1">Select Time</h3>
              <p className="text-xs text-gray-500 mb-2">Select next closest time</p>
              {loadingSlots ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500 mx-auto" />
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() => slot.available && setSelectedTime(slot.time)}
                      disabled={!slot.available}
                      className={`p-2 rounded-lg text-sm text-center transition-all ${
                        selectedTime === slot.time 
                          ? 'bg-orange-500 text-white' 
                          : slot.available
                            ? 'bg-white border border-gray-200 hover:border-orange-300'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {formatTime12Hour(slot.time)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pet Selection */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm">Select Pet</h3>
              <button 
                onClick={() => onNavigate('add-pet')}
                className="text-orange-500 text-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Pet
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {pets.map((pet) => (
                <button
                  key={pet.id}
                  onClick={() => setSelectedPet(pet)}
                  className={`flex-shrink-0 p-3 rounded-xl flex items-center gap-2 transition-all ${
                    selectedPet?.id === pet.id 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-white border border-gray-200 hover:border-orange-300'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                    {pet.photo ? (
                      <img src={pet.photo} alt={pet.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg">{pet.type === 'Dog' ? '🐕' : '🐈'}</span>
                    )}
                  </div>
                  <span className="font-medium">{pet.name}</span>
                  {selectedPet?.id === pet.id && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>

          {/* Address Selection (for at_home) - modal in-context, no navigation */}
          {serviceStyle === 'at_home' && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">Delivery Address</h3>
                <button 
                  onClick={() => setShowAddAddressModal(true)}
                  className="text-orange-500 text-sm flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Address
                </button>
              </div>
              <div className="space-y-2">
                {addresses.length === 0 ? (
                  <div className="text-center py-4 border-2 border-dashed border-gray-200 rounded-xl">
                    <p className="text-sm text-gray-500 mb-2">No addresses saved</p>
                    <button
                      onClick={() => setShowAddAddressModal(true)}
                      className="text-orange-500 text-sm font-medium"
                    >
                      + Add your address
                    </button>
                  </div>
                ) : (
                addresses.map((addr) => (
                  <button
                    key={addr.id}
                    onClick={() => setSelectedAddress(addr)}
                    className={`w-full p-3 rounded-xl text-left transition-all overflow-hidden max-w-full ${
                      selectedAddress?.id === addr.id 
                        ? 'bg-orange-500 text-white' 
                        : 'bg-white border border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0 max-w-full">
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="font-medium truncate">{addr.label}</p>
                        <p className="text-sm opacity-80 line-clamp-2 break-words overflow-hidden">{addr.address}</p>
                      </div>
                      {selectedAddress?.id === addr.id && <Check className="w-5 h-5 flex-shrink-0" />}
                    </div>
                  </button>
                ))
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="mb-4">
            <h3 className="font-medium text-sm mb-2">Additional Notes (Optional)</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions or concerns..."
              className="w-full p-3 border border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none resize-none"
              rows={3}
            />
          </div>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="px-4 mt-4">
            <div className="flex bg-gray-100 rounded-xl p-1">
              {(['services', 'about', 'reviews'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                    activeTab === tab
                      ? 'bg-white text-orange-600 shadow'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content — scroll padding matches globals (--customer-sticky-cta-scroll-padding) */}
          <div className="px-4 pt-4 cw-scroll-pad-tabbar-sticky-cta">
            {activeTab === 'services' && (
              <div className="space-y-3">
                <h3 className="font-medium text-gray-700">Available Services</h3>
                {provider.services.length === 0 ? (
                  <Card className="p-6 text-center">
                    <p className="text-gray-500">No services available</p>
                  </Card>
                ) : (
                  provider.services.map((service) => {
                    const isSelected = selectedServices.has(service.id);
                    return (
                      <Card 
                        key={service.id}
                        className={`p-4 cursor-pointer transition-all ${
                          isSelected ? 'border-orange-500 bg-orange-50' : 'hover:border-orange-200'
                        }`}
                        onClick={() => toggleService(service.id)}
                      >
                        <div className="flex w-full min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <h4 className="min-w-0 flex-1 truncate font-medium text-gray-900 leading-5">
                                {service.name}
                              </h4>
                              {service.popular && (
                                <Badge className="bg-amber-100 text-amber-700 text-xs shrink-0">Popular</Badge>
                              )}
                            </div>
                            {service.description?.trim() && (
                              <div className="mt-1">
                                <ServiceDescriptionInline
                                  description={service.description}
                                  title={service.name}
                                  className="m-0 text-sm leading-5 text-gray-500"
                                />
                              </div>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                              <span className="flex min-w-0 items-center gap-1">
                                <Clock className="h-3 w-3 shrink-0" />
                                {service.duration} mins
                              </span>
                              {service.categoryName && (
                                <span className="min-w-0 break-words">{service.categoryName}</span>
                              )}
                            </div>
                          </div>
                          <div className="ml-2 flex shrink-0 flex-col items-end gap-2">
                            <p className="font-bold tabular-nums text-[#FF8C42] whitespace-nowrap">
                              {formatPriceWithSymbol(service.price)}
                            </p>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                              isSelected 
                                ? 'bg-orange-500 border-orange-500' 
                                : 'border-gray-300'
                            }`}>
                              {isSelected && <Check className="w-4 h-4 text-white" />}
                            </div>
                          </div>
                        </div>
                        <p className="mt-2 text-right text-[11px] leading-4 text-gray-500 break-words">{INDICATIVE_PRICING_NOTE}</p>
                      </Card>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'about' && (
              <div className="space-y-4">
                {provider.bio && (
                  <Card className="p-4">
                    <h3 className="font-medium mb-2">About</h3>
                    <p className="text-sm text-gray-600">{provider.bio}</p>
                  </Card>
                )}

                {provider.qualifications && (
                  <Card className="p-4">
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-purple-500" />
                      Qualifications
                    </h3>
                    <p className="text-sm text-gray-600">{provider.qualifications}</p>
                  </Card>
                )}

                {provider.languages && provider.languages.length > 0 && (
                  <Card className="p-4">
                    <h3 className="font-medium mb-2">Languages</h3>
                    <div className="flex flex-wrap gap-2">
                      {provider.languages.map((lang) => (
                        <Badge key={lang} variant="secondary">{lang}</Badge>
                      ))}
                    </div>
                  </Card>
                )}

                {provider.address && (
                  <Card className="p-4">
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      Location
                    </h3>
                    <p className="text-sm text-gray-600">{provider.address}</p>
                    {provider.city && <p className="text-sm text-gray-500">{provider.city}</p>}
                  </Card>
                )}

                {showFacilitiesAmenitiesOnAbout && (
                  <Card className="p-4">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-orange-500" />
                      Facilities & Amenities
                    </h3>
                    <AmenitiesSection
                      amenities={profileAmenities}
                      customAmenities={profileCustomAmenities}
                      compact={true}
                    />
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-4">
                {loadingReviews ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto" />
                  </div>
                ) : reviews.length === 0 ? (
                  <Card className="p-6 text-center">
                    <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">No reviews yet</p>
                  </Card>
                ) : (
                  reviews.map((review) => (
                    <Card key={review.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{review.customerName}</p>
                            <div className="flex items-center gap-1 text-amber-500">
                              <Star className="w-4 h-4 fill-current" />
                              <span className="text-sm font-medium">{review.rating}</span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{review.comment}</p>
                          <p className="text-xs text-gray-400 mt-2">{review.date}</p>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Sticky Footer — bottom/z-index/width aligned with BottomNavigation + globals.css tokens */}
      <div className="fixed left-0 right-0 z-40 mx-auto w-full max-w-customer border-t border-gray-200 bg-white shadow-lg cw-fixed-above-customer-tabbar">
        {showBookingForm ? (
          <div className="p-4">
            <Button
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-md"
              onClick={handleProceedToPayment}
              disabled={
                selectedServices.size === 0 ||
                !selectedPet ||
                !selectedDate ||
                !selectedTime ||
                (serviceStyle === 'at_home' && !selectedAddress)
              }
            >
              Proceed to Payment • {formatPriceWithSymbol(totalAmount)}
            </Button>
          </div>
        ) : (
          <div className="p-4">
            {selectedServices.size > 0 ? (
              <Button
                className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2"
                onClick={handleProceedToBooking}
              >
                Continue with {selectedServices.size} service{selectedServices.size !== 1 ? 's' : ''} • {formatPriceWithSymbol(totalAmount)}
                <ChevronRight className="w-5 h-5" />
              </Button>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Select a service to continue</p>
                  <p className="font-bold text-lg text-gray-400">{formatPriceWithSymbol(0)}</p>
                </div>
                <Button
                  className="h-12 px-8 bg-gray-300 text-gray-500 font-bold rounded-xl cursor-not-allowed"
                  disabled
                >
                  Continue
                  <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Address Modal - in-context so user stays on provider profile (no navigate to address_book) */}
      <AddAddressModal
        phone={phone}
        isOpen={showAddAddressModal}
        onClose={() => setShowAddAddressModal(false)}
        onSuccess={(savedAddress) => {
          setShowAddAddressModal(false);
          if (savedAddress) {
            const normalized = normalizeAddress(savedAddress);
            setSelectedAddress(normalized);
            setAddresses((prev) => {
              const exists = prev.some((a) => a.id && a.id === normalized.id);
              if (exists) return prev.map((a) => (a.id === normalized.id ? normalized : a));
              return [...prev, normalized];
            });
          }
          refreshAddresses();
        }}
        customerName={provider?.name ? '' : undefined}
      />
    </div>
  );
}

export default UniversalProviderProfile;
