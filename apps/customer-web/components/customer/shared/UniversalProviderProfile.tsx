'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft, Star, Clock, MapPin, Phone, Video, Home, Building2,
  Shield, Award, GraduationCap, Heart, Share2, Check, X, Calendar,
  ChevronRight, Plus, User, MessageCircle, Image as ImageIcon, Sparkles, Loader2,
  Navigation, Stethoscope, Search, Filter,
} from 'lucide-react';
import { AmenitiesSection } from './AmenitiesSection';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import {
  normalizeAvailableSlotsResponse,
} from '@/lib/available-slots-response';
import { toast } from 'sonner';
import { AddAddressModal } from './AddAddressModal';
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import { INDICATIVE_PRICING_NOTE } from '@/lib/pricing-disclaimer';
import { formatLocalDateYYYYMMDD } from '@/lib/local-calendar-date';
import { ServiceDescriptionInline } from './ServiceDescriptionInline';
import { VendorRatingDisplay } from './VendorRatingDisplay';
import { resolveCustomerVendorAmenities, shouldShowVendorAmenities, resolveVendorProfileHeroGallery } from '@/lib/vendor-display-media';
import { shareVendorProfile, universalCategoryToSharePersona } from '@/lib/vendor-profile-share';
import { useProviderServicesLazyLoad } from '@/hooks/useProviderServicesLazyLoad';
import { mapVendorServicesForVetHub } from '@/lib/map-vendor-services-for-vet';
import {
  mapFacilityRecentReviews,
  mergeProviderAboutFromFacility,
  type UniversalProviderProfileAbout,
} from '@/lib/universal-provider-profile-enrichment';
import { DiscoveryVendorFeedSentinel } from './DiscoveryVendorFeedSentinel';
import { BookingPetSelection, type BookingPet } from './BookingPetSelection';
import { mapBookingPetFromApi } from '@/lib/pet-display-photo';
import { discoveryServiceSections } from '@/lib/vendor-services-package-sections';
import {
  buildWalkerServiceDataForVendorPackagePurchase,
  isVendorServicePackageRow,
  MIXED_PACKAGE_SERVICE_BOOK_ERROR,
  partitionVendorServiceRowsByPackage,
  toggleExclusivePackageOrServiceSelection,
} from '@/lib/vendor-package-purchase-nav';
import { VendorProfileDashboardHeader } from './VendorProfileDashboardHeader';
import { VendorHeroPhotoCarousel } from './VendorHeroPhotoCarousel';
import { ServicePricingDisplay } from '@/components/customer/ServicePricingDisplay';
import { resolveServiceCategoryDisplayLabel } from '@/lib/filter-hub-services';

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
  isPackage?: boolean;
  packageDetails?: unknown;
  metadata?: unknown;
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

interface Pet extends BookingPet {
  type?: string;
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

function initialSelectedServiceSet(
  ids: string[] | undefined,
  style: UniversalProviderProfileProps['serviceStyle'],
): Set<string> {
  const list = ids ?? [];
  if (style === 'tele') {
    const first = list[0];
    return first ? new Set([first]) : new Set();
  }
  return new Set(list);
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
    () => initialSelectedServiceSet(initialSelectedServiceIds, serviceStyle),
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
  const [profileAbout, setProfileAbout] = useState<UniversalProviderProfileAbout>(() =>
    mergeProviderAboutFromFacility(provider, null)
  );
  const [loadingProfileEnrichment, setLoadingProfileEnrichment] = useState(false);
  const [displayName, setDisplayName] = useState(provider.name);
  const isVetProfile = category === 'vet';
  const [vetActiveTab, setVetActiveTab] = useState<'overview' | 'services' | 'reviews'>('services');
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [serviceSortBy, setServiceSortBy] = useState<'popular' | 'price' | 'name'>('popular');
  const [profileFacility, setProfileFacility] = useState<Record<string, unknown> | null>(null);
  const [profileVendorRaw, setProfileVendorRaw] = useState<Record<string, unknown> | null>(null);

  const vendorAccountId = String(provider.vendorId || provider.providerId || '').trim();

  const mapServiceRows = useCallback(
    (rows: unknown[]): Service[] => {
      if (category === 'vet') {
        return mapVendorServicesForVetHub(rows).map((s) => ({
          id: s.id,
          serviceId: s.serviceId,
          name: s.name,
          description: s.description,
          price: s.price,
          duration: s.duration,
          serviceStyle,
          categoryName: s.category,
          isPackage: s.isPackage,
          packageDetails: s.packageDetails,
          metadata: s.metadata,
        }));
      }
      return (rows || []).map((raw) => {
        const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
        const meta =
          s.metadata && typeof s.metadata === 'object' && !Array.isArray(s.metadata)
            ? (s.metadata as Record<string, unknown>)
            : undefined;
        const packageDetails = s.packageDetails ?? meta?.packageDetails;
        const isPackage = Boolean(
          s.isPackage ?? s.is_package ?? meta?.isPackage ?? packageDetails
        );
        return {
          id: String(s.id ?? s.serviceId ?? ''),
          serviceId: String(s.serviceId ?? s.id ?? ''),
          name: String(s.name ?? s.serviceName ?? 'Service'),
          description:
            String(s.shortDescription ?? s.description ?? '').trim() || undefined,
          price: Number(s.price ?? 0),
          duration: Number(s.duration ?? 30),
          serviceStyle: String(s.serviceStyle ?? s.service_style ?? serviceStyle),
          categoryName:
            String(s.categoryLabel ?? s.category ?? s.categoryName ?? '').trim() ||
            undefined,
          isPackage,
          packageDetails,
          metadata: meta ?? s.metadata,
        };
      });
    },
    [category, serviceStyle]
  );

  const {
    services,
    loading: servicesLoading,
    loadingMore: servicesLoadingMore,
    loadMore: loadMoreServices,
    hasMore: hasMoreServices,
  } = useProviderServicesLazyLoad<Service>({
    vendorId: vendorAccountId,
    serviceStyle,
    category,
    phone,
    mapRows: mapServiceRows,
    enabled: Boolean(vendorAccountId),
  });

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
    setDisplayName(provider.name);
  }, [provider.name, provider.providerId]);

  useEffect(() => {
    const vid = vendorAccountId;
    if (!vid) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = (await apiClient.get(`/customer/vendor/${encodeURIComponent(vid)}`)) as {
          vendor?: Record<string, unknown>;
        };
        const vendor = res?.vendor;
        if (cancelled || !vendor) return;
        const bn = String(
          vendor.businessName ?? vendor.business_name ?? vendor.name ?? ''
        ).trim();
        if (bn) setDisplayName(bn);
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorAccountId]);

  useEffect(() => {
    setProfileAbout(mergeProviderAboutFromFacility(provider, null));
    setReviews([]);
  }, [provider.providerId, provider.vendorId, provider.bio, provider.qualifications]);

  useEffect(() => {
    const vid = vendorAccountId;
    if (!vid) return;
    let cancelled = false;
    void (async () => {
      setLoadingProfileEnrichment(true);
      try {
        const res = (await apiClient.get(
          `/customer/facility/${encodeURIComponent(vid)}`
        )) as {
          success?: boolean;
          facility?: Record<string, unknown>;
          vendor?: Record<string, unknown>;
          recentReviews?: unknown[];
        };
        if (cancelled || res?.success === false) return;

        setProfileAbout(mergeProviderAboutFromFacility(provider, res));
        if (res.facility && typeof res.facility === 'object') {
          setProfileFacility(res.facility as Record<string, unknown>);
        }
        if (res.vendor && typeof res.vendor === 'object') {
          setProfileVendorRaw(res.vendor as Record<string, unknown>);
        }
        const facilityReviews = mapFacilityRecentReviews(res.recentReviews);
        if (facilityReviews.length > 0) {
          setReviews(facilityReviews);
        }

        if (shouldShowVendorAmenities(serviceStyle)) {
          const resolved = resolveCustomerVendorAmenities({
            ...(res.facility && typeof res.facility === 'object' ? res.facility : {}),
            ...(res.vendor && typeof res.vendor === 'object' ? res.vendor : {}),
            ...(provider.amenities ? { amenities: provider.amenities } : {}),
          });
          setProfileAmenities(resolved.amenities);
          setProfileCustomAmenities(resolved.customAmenities);
        }
      } catch {
        /* optional enrichment */
      } finally {
        if (!cancelled) setLoadingProfileEnrichment(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorAccountId, serviceStyle, provider.providerId, provider.amenities]);

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
        const mappedPets = petsResponse.pets.map((p: any) => mapBookingPetFromApi(p));
        setPets(mappedPets);
        if (mappedPets.length > 0) {
          if (initialSelectedPetId) {
            const match = mappedPets.find(
              (p: Pet) => String(p.id) === String(initialSelectedPetId),
            );
            setSelectedPet(match ?? mappedPets[0]);
          } else {
            setSelectedPet(mappedPets[0]);
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
      const selectedList = servicesMatchingSelection(services, selectedServices);
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
        setTimeSlots([]);
      } else {
        setTimeSlots([]);
      }
    } catch (error) {
      console.error('Error loading time slots:', error);
      setTimeSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Refetch slots when date / form / selection change (loadTimeSlots reads latest `provider` from closure)
  useEffect(() => {
    if (selectedDate && showBookingForm) {
      void loadTimeSlots(selectedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- services identity from lazy-load hook
  }, [selectedDate, showBookingForm, selectedServices, serviceStyle, services]);

  const loadReviews = async () => {
    const vendorId = provider.vendorId || provider.providerId;
    if (!vendorId || reviews.length > 0) return;

    try {
      setLoadingReviews(true);
      try {
        const facilityRes = (await apiClient.get(
          `/customer/facility/${encodeURIComponent(vendorId)}`
        )) as { success?: boolean; recentReviews?: unknown[] };
        if (facilityRes?.success !== false) {
          const mapped = mapFacilityRecentReviews(facilityRes.recentReviews);
          if (mapped.length > 0) {
            setReviews(mapped);
            return;
          }
        }
      } catch {
        /* try vendor reviews fallback */
      }

      const response = (await apiClient.get(`/vendor/${vendorId}/reviews`)) as {
        reviews?: Review[];
      };
      if (response?.reviews?.length) {
        setReviews(response.reviews);
      }
    } catch {
      console.log('Could not load reviews');
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reviews' && reviews.length === 0 && !loadingProfileEnrichment) {
      void loadReviews();
    }
  }, [activeTab, loadingProfileEnrichment, reviews.length]);

  // Toggle service selection (single-select for tele; multi-select for other styles)
  const toggleService = (serviceId: string) => {
    if (serviceStyle === 'tele') {
      setSelectedServices((prev) => {
        if (prev.has(serviceId)) return new Set();
        return new Set([serviceId]);
      });
      return;
    }
    setSelectedServices((prev) =>
      toggleExclusivePackageOrServiceSelection(
        prev,
        serviceId,
        services as unknown as Record<string, unknown>[]
      )
    );
  };

  // Calculate total for selected services
  const selectedServicesList = servicesMatchingSelection(services, selectedServices);
  const totalAmount = selectedServicesList.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServicesList.reduce((sum, s) => sum + s.duration, 0);

  const vetServiceStyleLabel =
    serviceStyle === 'tele'
      ? 'Tele Consultation'
      : serviceStyle === 'at_home'
        ? 'Home Visit'
        : 'Clinic Visit';

  const vetProfileHeaderTitle =
    serviceStyle === 'at_center'
      ? 'Vet Clinic'
      : serviceStyle === 'at_home'
        ? 'Home Visit'
        : serviceStyle === 'tele'
          ? 'Tele Consultation'
          : 'Veterinary Services';

  const vetProfileHeaderSubtitle =
    serviceStyle === 'at_center'
      ? 'Visit our veterinary clinics'
      : serviceStyle === 'at_home'
        ? 'Vet comes to you'
        : serviceStyle === 'tele'
          ? 'Video consultation with vet'
          : 'Professional pet healthcare';

  const vetHeroPhotos = useMemo(
    () =>
      resolveVendorProfileHeroGallery({
        facility: profileFacility,
        vendor: profileVendorRaw,
        profileProvider: provider,
      }),
    [profileFacility, profileVendorRaw, provider]
  );

  const sortedVetServices = useMemo(() => {
    let list = [...services];
    if (serviceSearchQuery.trim()) {
      const q = serviceSearchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description?.toLowerCase().includes(q) ?? false)
      );
    }
    list.sort((a, b) => {
      if (serviceSortBy === 'price') return a.price - b.price;
      if (serviceSortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });
    return list;
  }, [services, serviceSearchQuery, serviceSortBy]);

  // Proceed to booking
  const handleProceedToBooking = () => {
    if (selectedServices.size === 0) {
      toast.error('Please select at least one service');
      return;
    }
    const { packages: pkgOnly, services: oneOffRows } = partitionVendorServiceRowsByPackage(
      selectedServicesList as unknown as Record<string, unknown>[]
    );
    if (pkgOnly.length === 1 && oneOffRows.length === 0) {
      const pkg = pkgOnly[0]!;
      const vendorIdForPkg = String(provider.vendorId || provider.providerId || '').trim();
      const nav = buildWalkerServiceDataForVendorPackagePurchase({
        vendorId: vendorIdForPkg,
        vendorName: displayName || provider.name,
        serviceRow: pkg as unknown as Record<string, unknown>,
        serviceTypeCategory: category,
        serviceStyle,
      });
      if (nav) {
        onNavigate('purchase-package', nav);
        return;
      }
      toast.error('Could not start package booking. Please try again.');
      return;
    }
    if (pkgOnly.length > 0 && (oneOffRows.length > 0 || pkgOnly.length > 1)) {
      toast.error(MIXED_PACKAGE_SERVICE_BOOK_ERROR);
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
        name: displayName || provider.name,
        photo: provider.photo,
        rating: provider.rating,
      },
    };

    onProceedToPayment(bookingData);
  };

  const handleShareProfile = () => {
    const shareVendorId = String(provider.vendorId || provider.providerId || '').trim();
    if (!shareVendorId) return;
    void shareVendorProfile({
      title: displayName || provider.name,
      text: `Check out ${displayName || provider.name} on Warmpawz`,
      vendorId: shareVendorId,
      persona: universalCategoryToSharePersona(category),
      vendorName: displayName || provider.name,
      serviceStyle,
    });
  };

  const profilePhone = String(provider.phone || '').trim();
  const profileAddress = String(
    profileAbout.address || provider.address || provider.city || ''
  ).trim();

  if (isVetProfile) {
    return (
      <div className="mx-auto flex min-h-[100dvh] min-h-screen w-full max-w-customer flex-col overflow-x-hidden bg-gray-50">
        <VendorProfileDashboardHeader
          fullWidth
          className="!z-0 isolation-auto"
          serviceName={vetProfileHeaderTitle}
          serviceSubtitle={vetProfileHeaderSubtitle}
          serviceIcon={Stethoscope}
          iconColor="text-white"
          onBack={handleInternalBack}
          showBackButton
          bottomEdge="flat"
        />

        {showBookingForm ? (
          <div className="relative z-0 flex-1 px-4 pt-4 pb-36 cw-scroll-pad-tabbar-sticky-cta">
            <h2 className="mb-4 text-lg font-bold">Complete Your Booking</h2>
            <Card className="mb-4 border-orange-200 bg-orange-50 p-4">
              <h3 className="mb-2 text-sm font-medium">Selected Services</h3>
              {selectedServicesList.map((service) => (
                <div key={service.id} className="mb-3 last:mb-0">
                  <div className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-medium">{service.name}</span>
                      {service.duration > 0 && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {service.duration} mins
                        </div>
                      )}
                    </div>
                    <span className="whitespace-nowrap font-medium">
                      {formatPriceWithSymbol(service.price)}
                    </span>
                  </div>
                </div>
              ))}
              <div className="mt-2 flex justify-between border-t border-orange-200 pt-2 font-bold">
                <span>Total</span>
                <span className="text-orange-600">{formatPriceWithSymbol(totalAmount)}</span>
              </div>
            </Card>
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-medium">Select Date</h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {dates.map((d) => (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setSelectedDate(d.date)}
                    className={`w-16 flex-shrink-0 rounded-xl p-3 text-center transition-all ${
                      selectedDate === d.date
                        ? 'bg-orange-500 text-white'
                        : 'border border-gray-200 bg-white hover:border-orange-300'
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
              <div className="mb-4">
                <h3 className="mb-1 text-sm font-medium">Select Time</h3>
                {loadingSlots ? (
                  <div className="py-4 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-b-2 border-orange-500" />
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        onClick={() => slot.available && setSelectedTime(slot.time)}
                        disabled={!slot.available}
                        className={`rounded-lg p-2 text-center text-sm transition-all ${
                          selectedTime === slot.time
                            ? 'bg-orange-500 text-white'
                            : slot.available
                              ? 'border border-gray-200 bg-white hover:border-orange-300'
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
            <BookingPetSelection
              variant="embedded"
              pets={pets}
              selectedPet={selectedPet}
              onSelectPet={setSelectedPet}
              onAddPet={() => onNavigate('add-pet')}
            />
            {serviceStyle === 'at_home' && (
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium">Delivery Address</h3>
                  <button
                    type="button"
                    onClick={() => setShowAddAddressModal(true)}
                    className="flex items-center gap-1 text-sm text-orange-500"
                  >
                    <Plus className="h-4 w-4" />
                    Add Address
                  </button>
                </div>
                <div className="space-y-2">
                  {addresses.map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => setSelectedAddress(addr)}
                      className={`w-full max-w-full overflow-hidden rounded-xl p-3 text-left transition-all ${
                        selectedAddress?.id === addr.id
                          ? 'bg-orange-500 text-white'
                          : 'border border-gray-200 bg-white hover:border-orange-300'
                      }`}
                    >
                      <p className="truncate font-medium">{addr.label}</p>
                      <p className="line-clamp-2 break-words text-sm opacity-80">{addr.address}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-medium">Additional Notes (Optional)</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special instructions or concerns..."
                className="w-full resize-none rounded-xl border border-gray-200 p-3 focus:border-orange-400 focus:outline-none"
                rows={3}
              />
            </div>
          </div>
        ) : (
          <div className="relative z-0 w-full flex-1">
            {vetHeroPhotos.length > 0 ? (
              <div className="relative w-full -mt-3">
                <div className="overflow-hidden rounded-t-[24px] bg-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
                  <VendorHeroPhotoCarousel
                    photos={vetHeroPhotos}
                    name={displayName || provider.name}
                    frameClassName="relative aspect-[5/4] w-full max-h-[420px] overflow-hidden sm:aspect-auto sm:h-[280px] sm:max-h-none"
                  />
                </div>
              </div>
            ) : (
              <div className="relative w-full -mt-3">
                <div className="overflow-hidden rounded-t-[24px]">
                  <div className="relative flex aspect-[5/4] w-full max-h-[420px] items-center justify-center bg-gradient-to-br from-[#FF8C42] to-[#FF7029] sm:aspect-auto sm:h-[280px] sm:max-h-none">
                    <div className="text-center text-white">
                      {serviceStyle === 'tele' ? (
                        <Video className="mx-auto mb-3 h-20 w-20 opacity-50" />
                      ) : serviceStyle === 'at_home' ? (
                        <Home className="mx-auto mb-3 h-20 w-20 opacity-50" />
                      ) : (
                        <Building2 className="mx-auto mb-3 h-20 w-20 opacity-50" />
                      )}
                      <p className="text-sm opacity-75">No photos available</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="px-4 pb-32">
              <div className="relative z-10 -mt-6 mb-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h1 className="mb-2 text-2xl font-bold text-gray-900">{displayName || provider.name}</h1>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <VendorRatingDisplay
                    row={{
                      vendorId: provider.vendorId ?? provider.providerId,
                      vendorRating: provider.rating,
                      vendorReviewCount: provider.reviewCount,
                    }}
                    vendorId={String(provider.vendorId ?? provider.providerId ?? '')}
                    starsClassName="h-5 w-5"
                    textClassName="text-sm text-gray-700"
                  />
                  {provider.isVerified && (
                    <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                      <Shield className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  )}
                </div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5">
                    {serviceStyle === 'tele' ? (
                      <Video className="h-4 w-4 text-[#FF8C42]" />
                    ) : serviceStyle === 'at_home' ? (
                      <Home className="h-4 w-4 text-[#FF8C42]" />
                    ) : (
                      <Building2 className="h-4 w-4 text-[#FF8C42]" />
                    )}
                    <span className="text-sm font-medium text-gray-700">{vetServiceStyleLabel}</span>
                  </div>
                </div>
                <div className="mb-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={() => profilePhone && window.open(`tel:${profilePhone}`, '_self')}
                    className="group flex flex-col items-center justify-center gap-1.5 rounded-xl bg-gray-50 p-3 transition-colors hover:bg-gray-100"
                  >
                    <Phone className="h-5 w-5 text-[#FF8C42] transition-transform group-hover:scale-110" />
                    <span className="text-xs font-medium text-gray-700">Call</span>
                  </button>
                  {profileAddress && serviceStyle !== 'tele' && (
                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profileAddress)}`,
                          '_blank'
                        )
                      }
                      className="group flex flex-col items-center justify-center gap-1.5 rounded-xl bg-gray-50 p-3 transition-colors hover:bg-gray-100"
                    >
                      <Navigation className="h-5 w-5 text-[#FF8C42] transition-transform group-hover:scale-110" />
                      <span className="text-xs font-medium text-gray-700">Directions</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleShareProfile}
                    className="group flex flex-col items-center justify-center gap-1.5 rounded-xl bg-gray-50 p-3 transition-colors hover:bg-gray-100"
                  >
                    <Share2 className="h-5 w-5 text-[#FF8C42] transition-transform group-hover:scale-110" />
                    <span className="text-xs font-medium text-gray-700">Share</span>
                  </button>
                </div>
                <div className="space-y-2.5 border-t border-gray-100 pt-4">
                  {profileAddress && serviceStyle !== 'tele' && (
                    <div className="flex items-start gap-3 text-sm">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                      <span className="leading-relaxed text-gray-700">{profileAddress}</span>
                    </div>
                  )}
                  {serviceStyle === 'tele' && (
                    <div className="flex items-center gap-3 text-sm">
                      <Video className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="text-gray-700">Video Consultation Available</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="sticky top-0 z-40 flex overflow-hidden rounded-t-2xl border-b-2 border-gray-200 bg-white shadow-sm">
                {(['overview', 'services', 'reviews'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setVetActiveTab(tab);
                      if (tab === 'reviews' && reviews.length === 0) void loadReviews();
                    }}
                    className={`relative flex-1 py-4 text-sm font-semibold capitalize transition-all ${
                      vetActiveTab === tab ? 'text-[#FF8C42]' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab === 'services'
                      ? `Services (${services.length}${hasMoreServices ? '+' : ''})`
                      : tab}
                    {vetActiveTab === tab && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF8C42]" />
                    )}
                  </button>
                ))}
              </div>

              <div className="mb-4 min-h-[400px] rounded-b-2xl bg-white p-5">
                {vetActiveTab === 'overview' && (
                  <div className="space-y-6">
                    {profileAbout.bio && (
                      <div>
                        <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
                          <Stethoscope className="h-5 w-5 text-[#FF8C42]" />
                          About
                        </h3>
                        <p className="text-sm leading-relaxed text-gray-700">{profileAbout.bio}</p>
                      </div>
                    )}
                    {profileAbout.qualifications && (
                      <div>
                        <h3 className="mb-3 text-lg font-bold text-gray-900">Qualifications</h3>
                        <p className="text-sm text-gray-600">{profileAbout.qualifications}</p>
                      </div>
                    )}
                    {showFacilitiesAmenitiesOnAbout &&
                      (profileAmenities.length > 0 || profileCustomAmenities.length > 0) && (
                        <AmenitiesSection
                          amenities={profileAmenities}
                          customAmenities={profileCustomAmenities}
                          compact
                        />
                      )}
                  </div>
                )}

                {vetActiveTab === 'services' && (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search vet services..."
                          value={serviceSearchQuery}
                          onChange={(e) => setServiceSearchQuery(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                        />
                        {serviceSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setServiceSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-gray-400" />
                        <select
                          value={serviceSortBy}
                          onChange={(e) =>
                            setServiceSortBy(e.target.value as 'popular' | 'price' | 'name')
                          }
                          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                        >
                          <option value="popular">Popular First</option>
                          <option value="price">Price: Low to High</option>
                          <option value="name">Name: A to Z</option>
                        </select>
                      </div>
                    </div>

                    <h3 className="font-bold text-gray-900">
                      Available Services ({sortedVetServices.length}
                      {hasMoreServices ? '+' : ''})
                    </h3>

                    {servicesLoading ? (
                      <div className="py-16 text-center">
                        <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-[#FF8C42]" />
                        <p className="text-gray-600">Loading services…</p>
                      </div>
                    ) : sortedVetServices.length === 0 ? (
                      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-16 text-center">
                        <Stethoscope className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                        <p className="font-medium text-gray-600">No services available</p>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {discoveryServiceSections(
                          sortedVetServices as unknown as Record<string, unknown>[]
                        ).map((sec) => (
                          <div key={sec.title} className="space-y-3">
                            <h4 className="text-sm font-semibold text-gray-700">
                              {sec.title} ({sec.list.length})
                            </h4>
                            {(sec.list as unknown as Service[]).map((service) => {
                              const isSelected =
                                selectedServices.has(service.id) ||
                                (service.serviceId
                                  ? selectedServices.has(service.serviceId)
                                  : false);
                              return (
                                <div
                                  key={service.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => toggleService(service.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      toggleService(service.id);
                                    }
                                  }}
                                  className={`cursor-pointer rounded-xl border-2 p-4 transition-all hover:shadow-md ${
                                    isSelected
                                      ? 'border-[#FF8C42] bg-gradient-to-br from-orange-50 to-orange-100 shadow-md'
                                      : 'border-gray-200 bg-white hover:border-[#FF8C42]/50'
                                  }`}
                                >
                                  <div className="flex w-full min-w-0 items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="mb-2 flex flex-wrap items-center gap-2">
                                        <h4 className="break-words text-base font-bold text-gray-900">
                                          {service.name}
                                        </h4>
                                        {service.isPackage && (
                                          <span className="rounded-full border border-purple-200 bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                                            Package
                                          </span>
                                        )}
                                      </div>
                                      {service.description?.trim() && (
                                        <ServiceDescriptionInline
                                          description={service.description}
                                          title={service.name}
                                          className="m-0 mb-3 text-sm leading-5 text-gray-600"
                                        />
                                      )}
                                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                        <span className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1">
                                          <Clock className="h-3.5 w-3.5 text-gray-600" />
                                          {service.duration} mins
                                        </span>
                                        {resolveServiceCategoryDisplayLabel(service) && (
                                          <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-gray-600">
                                            {resolveServiceCategoryDisplayLabel(service)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="ml-2 flex w-[7.25rem] shrink-0 flex-col items-end text-right">
                                      <ServicePricingDisplay
                                        basePrice={service.price}
                                        usePromoQuote
                                        vendorId={vendorAccountId || undefined}
                                        serviceId={String(service.id || service.serviceId || '')}
                                        customerId={phone}
                                        serviceStyle={serviceStyle}
                                        serviceCategory="vet"
                                        className="mb-1"
                                      />
                                      <p className="mt-0.5 w-full break-words text-[11px] leading-4 text-gray-500">
                                        {INDICATIVE_PRICING_NOTE}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                        <DiscoveryVendorFeedSentinel
                          hasMore={hasMoreServices}
                          loading={servicesLoading}
                          loadingMore={servicesLoadingMore}
                          onLoadMore={loadMoreServices}
                        />
                      </div>
                    )}
                  </div>
                )}

                {vetActiveTab === 'reviews' && (
                  <div className="space-y-4">
                    {loadingReviews ? (
                      <div className="py-8 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#FF8C42]" />
                      </div>
                    ) : reviews.length === 0 ? (
                      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-16 text-center">
                        <Star className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                        <p className="font-medium text-gray-600">No reviews yet</p>
                      </div>
                    ) : (
                      reviews.map((review) => (
                        <div
                          key={review.id}
                          className="rounded-xl border border-gray-200 bg-gray-50 p-5"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <h4 className="font-bold text-gray-900">{review.customerName}</h4>
                            <span className="text-xs text-gray-500">{review.date}</span>
                          </div>
                          <div className="mb-3 flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < review.rating
                                    ? 'fill-amber-500 text-amber-500'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <p className="text-sm leading-relaxed text-gray-700">{review.comment}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Vet sticky footer — cw-fixed-above-customer-tabbar keeps CTA above BottomNavigation */}
        <div className="pointer-events-none fixed inset-x-0 z-50 flex justify-center cw-fixed-above-customer-tabbar">
          <div className="pointer-events-auto w-full max-w-customer border-t border-gray-200 bg-white shadow-lg pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
            {selectedServices.size > 0 && !showBookingForm && (
              <div className="border-b border-orange-100 bg-orange-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {serviceStyle === 'tele'
                        ? 'Selected service'
                        : `${selectedServices.size} service${selectedServices.size > 1 ? 's' : ''} selected`}
                    </p>
                    <p className="text-lg font-bold text-orange-600">
                      {formatPriceWithSymbol(totalAmount)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedServices(new Set())}
                    className="text-sm font-medium text-orange-600 hover:text-orange-700"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
            <div className="p-4">
              {showBookingForm ? (
                <Button
                  className="h-12 w-full rounded-xl bg-[#FF8C42] text-base font-semibold text-white hover:bg-[#E67A35] disabled:cursor-not-allowed disabled:bg-gray-300"
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
              ) : (
                <Button
                  onClick={handleProceedToBooking}
                  disabled={services.length === 0}
                  className="h-12 w-full bg-[#FF8C42] text-base text-white hover:bg-[#E67A35] disabled:cursor-not-allowed disabled:bg-gray-300 sm:text-lg"
                >
                  {selectedServices.size === 0
                    ? services.length === 0
                      ? 'No Services Available'
                      : 'Select Services to Book'
                    : serviceStyle === 'tele'
                      ? `Continue • ${formatPriceWithSymbol(totalAmount)}`
                      : `Book ${selectedServices.size} Service${selectedServices.size > 1 ? 's' : ''} (${formatPriceWithSymbol(totalAmount)})`}
                </Button>
              )}
            </div>
          </div>
        </div>

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
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Provider Photo */}
      <div className="relative">
        {/* Photo Banner */}
        <div className="h-48 bg-gradient-to-br from-orange-400 to-amber-500 relative">
          {provider.photo && (
            <img 
              src={provider.photo} 
              alt={displayName || provider.name} 
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
                onClick={handleShareProfile}
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
                  <img src={provider.photo} alt={displayName || provider.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-orange-500">
                    {(displayName || provider.name).charAt(0)}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="font-bold text-lg text-gray-900 truncate">{displayName || provider.name}</h1>
                  {provider.isVerified && (
                    <Shield className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  )}
                </div>
                
                {provider.qualifications && (
                  <p className="text-sm text-gray-500 truncate">{provider.qualifications}</p>
                )}

                <VendorRatingDisplay
                  row={{
                    vendorId: provider.vendorId ?? provider.providerId,
                    vendorRating: provider.rating,
                    vendorReviewCount: provider.reviewCount,
                  }}
                  vendorId={String(provider.vendorId ?? provider.providerId ?? '')}
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
                      <div className="mt-1">
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

          <BookingPetSelection
            variant="embedded"
            pets={pets}
            selectedPet={selectedPet}
            onSelectPet={setSelectedPet}
            onAddPet={() => onNavigate('add-pet')}
          />

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
                {servicesLoading ? (
                  <Card className="p-6 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-2" />
                    <p className="text-gray-500">Loading services…</p>
                  </Card>
                ) : services.length === 0 ? (
                  <Card className="p-6 text-center">
                    <p className="text-gray-500">No services available</p>
                  </Card>
                ) : (
                  <>
                    {discoveryServiceSections(
                      services as unknown as Record<string, unknown>[]
                    ).map((sec) => (
                      <div key={sec.title} className="space-y-3">
                        <h3 className="font-medium text-gray-700">
                          {sec.title} ({sec.list.length})
                        </h3>
                        {(sec.list as unknown as Service[]).map((service) => {
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
                              {service.isPackage && (
                                <Badge className="bg-purple-100 text-purple-700 text-xs shrink-0 border border-purple-200">
                                  Package
                                </Badge>
                              )}
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
                  })}
                      </div>
                    ))}
                    <DiscoveryVendorFeedSentinel
                      hasMore={hasMoreServices}
                      loading={servicesLoading}
                      loadingMore={servicesLoadingMore}
                      onLoadMore={loadMoreServices}
                    />
                  </>
                )}
              </div>
            )}

            {activeTab === 'about' && (
              <div className="space-y-4">
                {loadingProfileEnrichment ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto" />
                  </div>
                ) : null}

                {profileAbout.bio ? (
                  <Card className="p-4">
                    <h3 className="font-medium mb-2">About</h3>
                    <p className="text-sm text-gray-600">{profileAbout.bio}</p>
                  </Card>
                ) : null}

                {profileAbout.qualifications ? (
                  <Card className="p-4">
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-purple-500" />
                      Qualifications
                    </h3>
                    <p className="text-sm text-gray-600">{profileAbout.qualifications}</p>
                  </Card>
                ) : null}

                {profileAbout.languages.length > 0 ? (
                  <Card className="p-4">
                    <h3 className="font-medium mb-2">Languages</h3>
                    <div className="flex flex-wrap gap-2">
                      {profileAbout.languages.map((lang) => (
                        <Badge key={lang} variant="secondary">{lang}</Badge>
                      ))}
                    </div>
                  </Card>
                ) : null}

                {profileAbout.address ? (
                  <Card className="p-4">
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      Location
                    </h3>
                    <p className="text-sm text-gray-600">{profileAbout.address}</p>
                    {profileAbout.city ? (
                      <p className="text-sm text-gray-500">{profileAbout.city}</p>
                    ) : null}
                  </Card>
                ) : null}

                {!loadingProfileEnrichment &&
                !profileAbout.bio &&
                !profileAbout.qualifications &&
                profileAbout.languages.length === 0 &&
                !profileAbout.address &&
                (!showFacilitiesAmenitiesOnAbout ||
                  (profileAmenities.length === 0 && profileCustomAmenities.length === 0)) ? (
                  <Card className="p-6 text-center">
                    <p className="text-gray-500">No additional information available</p>
                  </Card>
                ) : null}

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
                {serviceStyle === 'tele'
                  ? `Continue • ${formatPriceWithSymbol(totalAmount)}`
                  : `Continue with ${selectedServices.size} service${selectedServices.size !== 1 ? 's' : ''} • ${formatPriceWithSymbol(totalAmount)}`}
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
