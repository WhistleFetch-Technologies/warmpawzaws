/**
 * HomeServiceProviderProfile — home-service vendor profile (walker, sitter, grooming, etc.)
 *
 * Vet-style layout: ServiceDashboardHeader, hero carousel, overlapping identity card,
 * Services tab: tap-to-select list + “Continue to book”; other tabs show “Select Services to Book” to jump to Services.
 * Fixed at bottom with no full-width bar — only the pill button. Set fixedFooterAboveBottomNav when this
 * view is inside CustomerScreenWrapper so the CTA clears BottomNavigation (globals token).
 */

"use client";

import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ServiceDescriptionInline } from '../shared/ServiceDescriptionInline';
import { AmenitiesSection } from '../shared/AmenitiesSection';
import { VendorProfileDashboardHeader } from '../shared/VendorProfileDashboardHeader';
import { VendorHeroPhotoCarousel } from '../shared/VendorHeroPhotoCarousel';
import { StarRating } from '../shared/StarRating';
import { resolveVendorRating } from '@/lib/resolve-vendor-rating';
import {
  Star,
  MapPin,
  Phone,
  Heart,
  Share2,
  MessageCircle,
  Navigation,
  Image as ImageIcon,
  X,
  Award,
  Footprints,
  Scissors,
  GraduationCap,
  Stethoscope,
  Brain,
  Home,
  FlaskConical,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import {
  mapHomeServiceProfileServices,
  type HomeServiceProfileService,
} from '@/lib/customer-vendor-services-merge';
import { discoveryServiceSections } from '@/lib/vendor-services-package-sections';
import { homeServiceProfileVendorServicesQuery, filterHomeServiceProfileVendorRows } from '@/lib/home-service-profile-vendor-services';
import { useProviderServicesLazyLoad } from '@/hooks/useProviderServicesLazyLoad';
import { DiscoveryVendorFeedSentinel } from '../shared/DiscoveryVendorFeedSentinel';
import {
  mergeCustomerFacilityPayload,
  mergeVendorPhotoFieldsForHero,
  ratingFromFacilityRoot,
  resolveCustomerVendorAmenities,
  resolveVendorCoverImageUrl,
  resolveVendorProfileHeroGallery,
  resolveVendorProfilePhotoUrl,
} from '@/lib/vendor-display-media';
import { HomeServiceType } from './UniversalHomeServiceRouter';
import { homeServiceTypeToPersona, shareVendorProfile } from '@/lib/vendor-profile-share';
import { requestGuestAuthForProfileContinue } from '@/lib/guest-auth-gate';
import { mergeProviderAboutFromFacility } from '@/lib/universal-provider-profile-enrichment';
import { resolveHomeServiceProfileOverviewFields } from '@/lib/home-service-profile-overview';
import { formatOperatingHours } from '@/lib/format-utils';
import {
  WalkerWalkServicePicker,
  type WalkerWalkPickerSelection,
} from '../walker/WalkerWalkServicePicker';
import {
  isWalkerVendorServicePackageRow,
  type WalkerServiceOption,
} from '@/lib/walker-vendor-offerings';

/** Second identity-chip line derived only from vertical (not vendor-specific catalog copy). */
const HOME_SERVICE_CONTEXT_LABEL: Record<HomeServiceType, string> = {
  walker: 'At your home',
  grooming: 'At your home',
  training: 'At your home',
  veterinary: 'Home visit',
  behaviourist: 'At your home',
  sitter: 'In your home',
  diagnostics: 'At-home collection',
};

/** Hub-style header subtitle — vendor name lives in the identity card below. */
const HOME_SERVICE_HEADER_SUBTITLE: Record<HomeServiceType, string> = {
  walker: 'Professional pet walking services',
  grooming: 'At-home grooming services',
  training: 'Professional pet training services',
  veterinary: 'Veterinary care at your home',
  behaviourist: 'Pet behaviour consultation',
  sitter: 'Trusted in-home pet sitting',
  diagnostics: 'At-home sample collection',
};

function profileHeroPlaceholderIcon(serviceType: HomeServiceType): LucideIcon {
  switch (serviceType) {
    case 'walker':
      return Footprints;
    case 'grooming':
      return Scissors;
    case 'training':
      return GraduationCap;
    case 'veterinary':
      return Stethoscope;
    case 'behaviourist':
      return Brain;
    case 'sitter':
      return Home;
    case 'diagnostics':
      return FlaskConical;
    default:
      return Home;
  }
}

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

interface ProviderDetails {
  id: string;
  vendorId: string;
  businessName: string;
  fullName: string;
  photo: string;
  logo: string;
  coverImage: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  bio: string;
  description: string;
  rating: number;
  reviewCount: number;
  specializations: string[];
  amenities: string[];
  customAmenities: string[];
  qualifications: string;
  certifications: string[];
  experience: number;
  serviceCount: number;
  isVerified: boolean;
  operatingHours: { [key: string]: { open: string; close: string } };
  coordinates: { lat: number; lng: number };
  gallery: string[];
  reviews: Review[];
}

interface Review {
  id: string;
  customerName: string;
  customerPhoto: string;
  rating: number;
  comment: string;
  date: string;
  petName: string;
}

type TabType = 'overview' | 'services' | 'photos' | 'reviews';

interface HomeServiceProviderProfileProps {
  phone: string;
  vendorId: string;
  serviceType: HomeServiceType;
  config: ServiceConfig;
  onBack: () => void;
  onSelectService: (service: HomeServiceProfileService, rawRow?: Record<string, unknown>) => void;
  /** @deprecated Walker profile embeds WalkerWalkServicePicker; prop kept for backward compat. */
  onOpenWalkServicesAndBundles?: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  /**
   * When true, fixed CTA container uses `cw-fixed-above-customer-tabbar` so it sits above BottomNavigation.
   * When false (default), `bottom-0` + safe-area — for full-screen routes without CustomerScreenWrapper.
   */
  fixedFooterAboveBottomNav?: boolean;
}

export function HomeServiceProviderProfile({
  phone,
  vendorId,
  serviceType,
  config,
  onBack,
  onSelectService,
  onNavigate,
  fixedFooterAboveBottomNav = false,
}: HomeServiceProviderProfileProps) {

  const [provider, setProvider] = useState<ProviderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isFavorite, setIsFavorite] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const tabsSectionRef = useRef<HTMLDivElement>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const rawServiceRowsRef = useRef<Map<string, Record<string, unknown>>>(new Map());
  const walkerSelectedOptionRef = useRef<WalkerServiceOption | null>(null);
  const [walkerOfferingsLoading, setWalkerOfferingsLoading] = useState(false);
  const [walkerOfferingsCount, setWalkerOfferingsCount] = useState(0);
  const vendorServicesQuery = homeServiceProfileVendorServicesQuery(serviceType);

  const mapServiceRows = useCallback(
    (rows: unknown[]): HomeServiceProfileService[] => {
      const filtered = filterHomeServiceProfileVendorRows(serviceType, rows);
      for (const row of filtered) {
        if (!row || typeof row !== 'object') continue;
        const s = row as Record<string, unknown>;
        const id = String(s.id ?? s.vendorServiceId ?? s.serviceId ?? s.service_id ?? '').trim();
        if (id) rawServiceRowsRef.current.set(id, s);
      }
      return mapHomeServiceProfileServices(filtered);
    },
    [serviceType]
  );

  const {
    services: profileServices,
    loading: servicesLoading,
    loadingMore: servicesLoadingMore,
    loadMore: loadMoreServices,
    hasMore: hasMoreServices,
  } = useProviderServicesLazyLoad<HomeServiceProfileService>({
    vendorId,
    serviceStyle: vendorServicesQuery.serviceStyle,
    category: vendorServicesQuery.category,
    phone,
    mapRows: mapServiceRows,
    enabled: Boolean(vendorId) && serviceType !== 'walker',
  });

  useEffect(() => {
    loadProviderDetails();
  }, [vendorId]);

  useEffect(() => {
    setSelectedServiceId(null);
    rawServiceRowsRef.current = new Map();
    walkerSelectedOptionRef.current = null;
    setWalkerOfferingsCount(0);
    setWalkerOfferingsLoading(false);
  }, [vendorId]);

  useEffect(() => {
    if (serviceType !== 'walker' && profileServices.length === 1) {
      setSelectedServiceId(profileServices[0]!.id);
    }
  }, [profileServices, serviceType]);

  const handleWalkerPickerSelect = useCallback((selection: WalkerWalkPickerSelection) => {
    const { option, rawRow } = selection;
    setSelectedServiceId(option.id);
    walkerSelectedOptionRef.current = option;
    if (rawRow) {
      rawServiceRowsRef.current.set(option.id, rawRow);
    }
  }, []);

  const handleTabSelect = useCallback((tabId: TabType) => {
    setActiveTab(tabId);
  }, []);

  const loadProviderDetails = async () => {
    try {
      setLoading(true);
      console.log(`📍 [HOME-SERVICE-PROFILE] Loading vendor details for: ${vendorId}`);

      const [facilityResponse, customerVendorResponse] = await Promise.all([
        apiClient.get(`/customer/facility/${vendorId}`).catch(() => null),
        apiClient.get(`/customer/vendor/${vendorId}`).catch(() => null),
      ]);

      let facilityRoot: Record<string, unknown> | null = null;
      if (facilityResponse && typeof facilityResponse === 'object') {
        const fr = facilityResponse as Record<string, unknown>;
        if (fr.success !== false && (fr.vendor || fr.facility)) {
          facilityRoot = fr;
        }
      }

      let customerVendorRow: Record<string, unknown> | null = null;
      if (customerVendorResponse && typeof customerVendorResponse === 'object') {
        const cv = customerVendorResponse as { vendor?: unknown };
        const v = cv.vendor ?? customerVendorResponse;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          customerVendorRow = v as Record<string, unknown>;
        }
      }

      let merged: Record<string, unknown>;
      let ratingMeta: { average?: number; count?: number } = {};

      if (facilityRoot) {
        merged = mergeCustomerFacilityPayload(facilityRoot);
        ratingMeta = ratingFromFacilityRoot(facilityRoot);
        console.log('📦 [HOME-SERVICE-PROFILE] Facility merged vendor row:', merged);
      } else {
        try {
          const data = await apiClient.get<{ vendor?: any }>(`/vendor/${vendorId}`);
          merged = (data.vendor || data) as Record<string, unknown>;
          console.log('📦 [HOME-SERVICE-PROFILE] Vendor fallback response:', merged);
        } catch (e2) {
          console.error('❌ [HOME-SERVICE-PROFILE] Could not load vendor');
          setLoading(false);
          return;
        }
      }

      merged = mergeVendorPhotoFieldsForHero(merged, customerVendorRow);

      const aboutMerged = mergeProviderAboutFromFacility(
        {
          bio: String(merged.bio ?? merged.description ?? ''),
          address: String(merged.address ?? ''),
          city: String(merged.city ?? ''),
        },
        facilityRoot
      );
      const customerVendorBio = String(
        customerVendorRow?.description ?? customerVendorRow?.bio ?? ''
      ).trim();
      const bioText = (aboutMerged.bio || customerVendorBio || '').trim();
      const descriptionText =
        bioText ||
        String(merged.description ?? merged.bio ?? customerVendorRow?.description ?? '').trim();

      const profilePhotoUrl = resolveVendorProfilePhotoUrl(merged);
      const coverUrl = resolveVendorCoverImageUrl(merged);

      const facilityForHero: Record<string, unknown> | null =
        facilityRoot &&
        typeof facilityRoot.facility === 'object' &&
        facilityRoot.facility !== null
          ? (facilityRoot.facility as Record<string, unknown>)
          : null;
      const gallery = resolveVendorProfileHeroGallery({
        facility: facilityForHero,
        vendor: merged,
        profileProvider: {
          photo: profilePhotoUrl,
          photoUrl: profilePhotoUrl,
        },
      });

      const latRaw = merged.latitude ?? merged.lat;
      const lngRaw = merged.longitude ?? merged.lng;
      const lat = latRaw != null && latRaw !== '' ? Number(latRaw) : NaN;
      const lng = lngRaw != null && lngRaw !== '' ? Number(lngRaw) : NaN;

      // Load reviews
      let reviews: any[] = [];
      try {
        const reviewsData = await apiClient.get<{ reviews: any[] }>(`/vendor/${vendorId}/reviews`);
        reviews = reviewsData.reviews || [];
        console.log(`📦 [HOME-SERVICE-PROFILE] Found ${reviews.length} reviews`);
      } catch (e) {
        console.log('No reviews found');
      }

      const businessName =
        (merged.businessName as string) ||
        (merged.business_name as string) ||
        (merged.name as string) ||
        (merged.fullName as string) ||
        'Provider';
      const fullName = (merged.fullName as string) || (merged.owner_name as string) || (merged.ownerName as string) || '';

      const rcMerge = merged.reviewCount;
      const parsedRc =
        typeof rcMerge === 'number' && !Number.isNaN(rcMerge)
          ? rcMerge
          : rcMerge != null && String(rcMerge).trim() !== ''
            ? parseInt(String(rcMerge), 10)
            : NaN;
      const reviewCount =
        ratingMeta.count != null && Number.isFinite(ratingMeta.count)
          ? ratingMeta.count
          : Number.isFinite(parsedRc)
            ? parsedRc
            : reviews.length;

      const rawAvg =
        ratingMeta.average ??
        (typeof merged.rating === 'number'
          ? merged.rating
          : merged.rating != null || merged.avgRating != null
            ? parseFloat(String(merged.rating ?? merged.avgRating ?? ''))
            : NaN);
      const ratingAvg =
        reviewCount > 0 && Number.isFinite(rawAvg) && rawAvg > 0 ? rawAvg : undefined;

      const specs = merged.specializations;
      const specFallback = merged.services;
      const overviewFields = resolveHomeServiceProfileOverviewFields({ merged, customerVendorRow });
      const specializations: string[] =
        overviewFields.specializations.length > 0
          ? overviewFields.specializations
          : Array.isArray(specs)
            ? (specs as string[])
            : Array.isArray(specFallback)
              ? (specFallback as string[])
              : [];

      const { amenities, customAmenities } = resolveCustomerVendorAmenities(merged);
      const qualifications = overviewFields.qualifications;
      const experienceYears = overviewFields.experienceYears;

      setProvider({
        id: (merged.id as string) || vendorId,
        vendorId: (merged.vendorId as string) || vendorId,
        businessName,
        fullName,
        photo: profilePhotoUrl || '',
        logo: (merged.logo as string) || (merged.logo_url as string) || profilePhotoUrl || '',
        coverImage: coverUrl || '',
        address:
          (merged.address as string) ||
          [merged.city, merged.state].filter(Boolean).join(', ') ||
          'Address not specified',
        phone: (merged.phone as string) || '',
        email: (merged.email as string) || '',
        website: (merged.website as string) || '',
        bio: bioText,
        description: descriptionText,
        rating:
          ratingAvg != null && Number.isFinite(Number(ratingAvg)) ? Number(ratingAvg) : 0,
        reviewCount,
        specializations,
        amenities,
        customAmenities,
        qualifications,
        certifications: (Array.isArray(merged.certifications) ? merged.certifications : []) as string[],
        experience: experienceYears,
        serviceCount: Number(merged.serviceCount ?? merged.completedServices ?? merged.completed_bookings ?? 0),
        isVerified: Boolean(merged.isVerified ?? merged.verified ?? merged.is_verified),
        operatingHours: (merged.operatingHours || merged.operating_hours || merged.hours || {}) as ProviderDetails['operatingHours'],
        coordinates: !Number.isNaN(lat) && !Number.isNaN(lng) ? { lat, lng } : { lat: 0, lng: 0 },
        gallery,
        reviews: reviews
      });
    } catch (error) {
      console.error('❌ [HOME-SERVICE-PROFILE] Exception:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCall = () => {
    if (provider?.phone) {
      window.location.href = `tel:${provider.phone}`;
    }
  };

  const handleDirections = () => {
    if (!provider) return;
    const { lat, lng } = provider.coordinates;
    if (lat && lng && lat !== 0 && lng !== 0) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        '_blank'
      );
      return;
    }
    if (provider.address?.trim()) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(provider.address)}`,
        '_blank'
      );
    }
  };

  const handleShare = async () => {
    await shareVendorProfile({
      title: provider?.businessName || config.displayName,
      text: `Check out ${provider?.businessName} for ${config.displayName}`,
      vendorId,
      persona: homeServiceTypeToPersona(serviceType),
      vendorName: provider?.businessName,
    });
  };

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
    // TODO: Save to favorites API
  };

  const revealServicesAndScroll = useCallback(() => {
    if (!provider) return;
    setActiveTab('services');
    if (serviceType !== 'walker' && profileServices.length === 1) {
      setSelectedServiceId(profileServices[0]!.id);
    }
    requestAnimationFrame(() => {
      tabsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [provider, profileServices, serviceType]);

  const walkerContinueToBook = useCallback(() => {
    if (!selectedServiceId || !provider) return;
    if (
      requestGuestAuthForProfileContinue({
        persona: homeServiceTypeToPersona(serviceType),
        category: serviceType,
        vendorId: String(provider.vendorId || vendorId || ''),
        resumeScreen: 'home-service-booking',
        wapptMode: false,
      })
    ) {
      return;
    }
    const option = walkerSelectedOptionRef.current;
    const fromMap = rawServiceRowsRef.current.get(selectedServiceId);
    const service: HomeServiceProfileService = option
      ? {
          id: option.id,
          name: option.name,
          price: option.price,
          duration: option.duration,
          description: option.desc ?? '',
          category: 'walking',
        }
      : {
          id: selectedServiceId,
          name: String((fromMap as { name?: string } | undefined)?.name ?? ''),
          price: Number((fromMap as { price?: number } | undefined)?.price ?? 0) || 0,
          duration: Number((fromMap as { duration?: number } | undefined)?.duration ?? 0) || 0,
          description: '',
          category: 'walking',
        };
    // Treat picker packages OR name/metadata heuristics as packages (never fall through to one-off booking).
    const mergedProbe = {
      ...(fromMap || {}),
      id: (fromMap?.id as string | undefined) ?? option?.id ?? selectedServiceId,
      name: option?.name ?? service.name,
      isPackage: option?.isPackage || (fromMap as { isPackage?: boolean } | undefined)?.isPackage,
      totalSessions: option?.totalSessions,
      packageDetails: {
        ...((fromMap?.packageDetails as Record<string, unknown> | undefined) || {}),
        ...(option?.totalSessions != null ? { totalSessions: option.totalSessions } : {}),
        ...(option?.sessionsPerDay != null ? { sessionsPerDay: option.sessionsPerDay } : {}),
        ...(option?.sessionIntervalDays != null
          ? { sessionIntervalDays: option.sessionIntervalDays }
          : {}),
        ...(option?.price != null ? { price: option.price } : {}),
      },
    } as Record<string, unknown>;
    const asPackage =
      Boolean(option?.isPackage) || isWalkerVendorServicePackageRow(mergedProbe);

    const rawRow: Record<string, unknown> | undefined = asPackage
      ? ({
          ...mergedProbe,
          isPackage: true,
          name: option?.name ?? service.name,
          price: option?.price ?? service.price,
          duration: option?.duration ?? service.duration,
        } as Record<string, unknown>)
      : fromMap;
    onSelectService(service, rawRow);
  }, [onSelectService, provider, selectedServiceId]);

  const continueBookingDisabled = useMemo(() => {
    if (!provider || activeTab !== 'services') return false;
    if (serviceType === 'walker') {
      if (walkerOfferingsLoading) return true;
      if (walkerOfferingsCount === 0) return true;
      return !selectedServiceId;
    }
    if (servicesLoading) return true;
    const n = profileServices.length;
    if (n === 0) return true;
    if (n <= 1) return false;
    return !selectedServiceId;
  }, [
    provider,
    profileServices,
    servicesLoading,
    activeTab,
    selectedServiceId,
    serviceType,
    walkerOfferingsLoading,
    walkerOfferingsCount,
  ]);

  const heroPhotos = useMemo(
    () => (provider?.gallery ?? []).filter((u) => typeof u === 'string' && u.trim().length > 0),
    [provider?.gallery]
  );
  const operatingHoursLabel = useMemo(
    () => formatOperatingHours(provider?.operatingHours),
    [provider?.operatingHours]
  );
  const hasOverviewContent = useMemo(() => {
    if (!provider) return false;
    return Boolean(
      provider.bio ||
        provider.description ||
        provider.specializations.length > 0 ||
        provider.qualifications ||
        provider.certifications.length > 0 ||
        provider.experience > 0 ||
        provider.amenities.length > 0 ||
        provider.customAmenities.length > 0 ||
        operatingHoursLabel
    );
  }, [provider, operatingHoursLabel]);
  const hasPhotos = heroPhotos.length > 0;
  const PlaceholderIcon = profileHeroPlaceholderIcon(serviceType);
  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'services', label: 'Services' },
    { id: 'photos', label: 'Photos' },
    { id: 'reviews', label: 'Reviews' }
  ];

  if (loading) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-customer items-center justify-center bg-white">
        <div className="text-center">
          <div 
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
            style={{ borderColor: config.primaryColor }}
          />
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-customer items-center justify-center bg-white">
        <div className="text-center p-6">
          <p className="text-gray-600 mb-4">Provider not found</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const accentSoft: CSSProperties = {
    backgroundColor: `color-mix(in srgb, ${config.primaryColor} 14%, white)`,
  };
  const accentFg: CSSProperties = { color: config.primaryColor };

  return (
    <div className="mx-auto flex min-h-[100dvh] min-h-screen w-full max-w-customer flex-col overflow-x-hidden border-black/[0.04] bg-gray-50 shadow-[0_0_0_1px_rgba(0,0,0,0.04)] sm:border-x sm:shadow-[0_0_48px_rgba(0,0,0,0.06)]">
      <VendorProfileDashboardHeader
        className="!z-0 isolation-auto"
        serviceName={config.displayName}
        serviceSubtitle={HOME_SERVICE_HEADER_SUBTITLE[serviceType]}
        serviceIcon={<span className="text-2xl leading-none">{config.icon}</span>}
        iconColor="text-white"
        onBack={onBack}
        showBackButton
        bottomEdge="flat"
      />

      <div className="relative z-0 w-full flex-1">
        {hasPhotos ? (
          <div className="relative w-full -mt-3 sm:-mt-3">
            <div className="overflow-hidden rounded-t-[24px] bg-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] sm:rounded-t-[28px]">
              <VendorHeroPhotoCarousel
                photos={heroPhotos}
                name={provider.businessName}
                frameClassName="relative aspect-[5/4] w-full max-h-[420px] overflow-hidden sm:aspect-auto sm:h-[280px] sm:max-h-none"
              />
            </div>
          </div>
        ) : (
          <div className="relative w-full -mt-3 sm:-mt-3">
            <div className="overflow-hidden rounded-t-[24px] sm:rounded-t-[28px]">
              <div
                className={`relative flex aspect-[5/4] w-full max-h-[420px] items-center justify-center bg-gradient-to-br ${config.bgGradient} sm:aspect-auto sm:h-[280px] sm:max-h-none`}
              >
                <div className="text-center text-white">
                  <PlaceholderIcon className="mx-auto mb-3 h-20 w-20 opacity-50" aria-hidden />
                  <p className="text-sm opacity-80">No photos yet</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="px-4 pb-36 sm:px-5">
          <div className="relative z-10 -mt-6 mb-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold text-gray-900">{provider.businessName}</h1>
                {provider.fullName && provider.fullName !== provider.businessName ? (
                  <p className="mt-0.5 text-sm text-gray-500">{provider.fullName}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={toggleFavorite}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-600 hover:bg-gray-100"
                  aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Heart className={`h-5 w-5 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => void handleShare()}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-600 hover:bg-gray-100"
                  aria-label="Share"
                >
                  <Share2 className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              {resolveVendorRating(
                {
                  vendorId: provider.vendorId,
                  vendorRating: provider.rating,
                  vendorReviewCount: provider.reviewCount,
                },
                { expectedVendorId: String(provider.vendorId ?? vendorId) }
              ).shouldShowRating ? (
                <div className="rounded-lg bg-orange-50 px-3 py-1.5">
                  <StarRating
                    rating={provider.rating}
                    reviewCount={provider.reviewCount}
                    starsClassName="h-5 w-5"
                    textClassName="text-sm text-gray-600"
                  />
                </div>
              ) : null}
              {provider.isVerified ? (
                <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                  <Shield className="h-3.5 w-3.5" aria-hidden />
                  Verified
                </span>
              ) : null}
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5">
                <span className="text-lg leading-none" aria-hidden>
                  {config.icon}
                </span>
                <span className="text-sm font-medium text-gray-700">{config.displayName}</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-1.5">
                <MapPin className="h-4 w-4 shrink-0 text-[#FF8C42]" aria-hidden />
                <span className="text-sm font-medium text-gray-700">{HOME_SERVICE_CONTEXT_LABEL[serviceType]}</span>
              </div>
            </div>

            <div
              className={`mb-4 grid gap-2 border-t border-gray-100 pt-4 ${provider.address?.trim() ? 'grid-cols-3' : 'grid-cols-2'}`}
            >
              <button
                type="button"
                onClick={handleCall}
                disabled={!provider.phone}
                className="group flex flex-col items-center justify-center gap-1.5 rounded-xl bg-gray-50 p-3 transition-colors hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-40"
              >
                <Phone className="h-5 w-5 text-[#FF8C42] transition-transform group-hover:scale-110" />
                <span className="text-xs font-medium text-gray-700">Call</span>
              </button>
              {provider.address?.trim() ? (
                <button
                  type="button"
                  onClick={handleDirections}
                  className="group flex flex-col items-center justify-center gap-1.5 rounded-xl bg-gray-50 p-3 transition-colors hover:bg-gray-100"
                >
                  <Navigation className="h-5 w-5 text-[#FF8C42] transition-transform group-hover:scale-110" />
                  <span className="text-xs font-medium text-gray-700">Directions</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  onNavigate?.('chat', {
                    vendorId: provider.vendorId || provider.id,
                    vendorName: provider.businessName,
                  })
                }
                className="group flex flex-col items-center justify-center gap-1.5 rounded-xl bg-gray-50 p-3 transition-colors hover:bg-gray-100"
              >
                <MessageCircle className="h-5 w-5 text-[#FF8C42] transition-transform group-hover:scale-110" />
                <span className="text-xs font-medium text-gray-700">Chat</span>
              </button>
            </div>

            {provider.address?.trim() ? (
              <div className="flex items-start gap-3 border-t border-gray-100 pt-4 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <span className="leading-relaxed text-gray-700">{provider.address}</span>
              </div>
            ) : null}
          </div>

          <div ref={tabsSectionRef} className="sticky top-0 z-10 scroll-mt-28 border-b border-gray-200 bg-white">
            <div className="flex">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabSelect(tab.id)}
                  className={`flex-1 border-b-2 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'border-[#FF8C42] text-[#FF8C42]'
                      : 'border-transparent text-gray-500'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="py-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Bio */}
            {(provider.bio || provider.description) && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">About</h3>
                <ServiceDescriptionInline
                  description={provider.bio || provider.description}
                  title={provider.businessName}
                  className="m-0 text-sm leading-relaxed text-gray-600"
                  dialogHint="Full description (vendor-provided)"
                />
              </div>
            )}

            {/* Specializations — primary for solo walkers / home providers */}
            {provider.specializations.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Specializations</h3>
                <div className="flex flex-wrap gap-2">
                  {provider.specializations.map((spec) => (
                    <span
                      key={spec}
                      className="rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-800"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {provider.experience > 0 && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Experience</h3>
                <p className="text-sm text-gray-600">
                  {provider.experience} {provider.experience === 1 ? 'year' : 'years'} of experience
                </p>
              </div>
            )}

            {/* Qualifications (solo providers) */}
            {provider.qualifications && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Qualifications</h3>
                <p className="text-sm leading-relaxed text-gray-600">{provider.qualifications}</p>
              </div>
            )}

            {/* Amenities */}
            {(provider.amenities.length > 0 || provider.customAmenities.length > 0) && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Amenities</h3>
                <AmenitiesSection
                  amenities={provider.amenities}
                  customAmenities={provider.customAmenities}
                  compact
                />
              </div>
            )}

            {/* Certifications */}
            {provider.certifications.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Certifications</h3>
                <div className="space-y-2">
                  {provider.certifications.map((cert, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <Award className="w-4 h-4 text-yellow-500" />
                      {cert}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Operating Hours */}
            {operatingHoursLabel ? (
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Operating Hours</h3>
                <p className="text-sm text-gray-600">{operatingHoursLabel}</p>
              </div>
            ) : null}

            {!hasOverviewContent ? (
              <p className="text-sm text-gray-500">No overview details available yet.</p>
            ) : null}
          </div>
        )}

        {/* Services Tab — walker: walk/bundle picker; other home services: catalog list */}
        {activeTab === 'services' && serviceType === 'walker' && (
          <WalkerWalkServicePicker
            vendorId={vendorId}
            phone={phone}
            bookingServiceStyle="at_home"
            requireStyleMatch={false}
            selectedId={selectedServiceId ?? ''}
            onSelect={handleWalkerPickerSelect}
            onOfferingsCountChange={setWalkerOfferingsCount}
            onLoadingChange={setWalkerOfferingsLoading}
          />
        )}

        {activeTab === 'services' && serviceType !== 'walker' && (
          <div className="space-y-3">
            {profileServices.length > 1 ? (
              <p className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-900">
                Tap a service to select it, then use{' '}
                <span className="font-medium text-gray-900">Continue to book</span> below.
              </p>
            ) : null}
            {servicesLoading ? (
              <div className="flex justify-center py-8">
                <div
                  className="h-8 w-8 animate-spin rounded-full border-b-2"
                  style={{ borderColor: config.primaryColor }}
                />
              </div>
            ) : profileServices.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No services listed</p>
              </div>
            ) : (
              <>
                {discoveryServiceSections(
                  profileServices as unknown as Record<string, unknown>[]
                ).map((sec) => (
                  <div key={sec.title} className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">
                      {sec.title} ({sec.list.length})
                    </h3>
                    {(sec.list as unknown as HomeServiceProfileService[]).map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    aria-pressed={selectedServiceId === service.id}
                    onClick={() => setSelectedServiceId(service.id)}
                    className={`w-full rounded-xl border-2 bg-white p-4 text-left shadow-sm transition-colors hover:border-orange-300 ${
                      selectedServiceId === service.id
                        ? 'border-orange-600 bg-orange-50/50 ring-2 ring-orange-100'
                        : 'border-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4
                            className={`font-medium ${
                              selectedServiceId === service.id ? 'text-orange-900' : 'text-gray-800'
                            }`}
                          >
                            {service.name}
                          </h4>
                          {service.isPackage ? (
                            <span className="rounded-full border border-purple-200 bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                              Package
                            </span>
                          ) : null}
                        </div>
                        {service.description ? (
                          <div onClick={(e) => e.stopPropagation()}>
                            <ServiceDescriptionInline
                              description={service.description}
                              title={service.name}
                              className="m-0 mt-1 text-sm leading-5 text-gray-500"
                              dialogHint="Full description (vendor-provided)"
                            />
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className={`text-lg font-bold tabular-nums ${
                            selectedServiceId === service.id ? 'text-orange-700' : ''
                          }`}
                          style={
                            selectedServiceId === service.id ? undefined : { color: config.primaryColor }
                          }
                        >
                          ₹{service.price}
                        </span>
                        {service.duration > 0 ? (
                          <p className="text-xs text-gray-500">{service.duration} min</p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                    ))}
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

        {/* Photos Tab */}
        {activeTab === 'photos' && (
          <div>
            {provider.gallery.length === 0 ? (
              <div className="text-center py-8">
                <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No photos available</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {provider.gallery.map((image, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setSelectedImage(image);
                      setShowGallery(true);
                    }}
                    className="aspect-square rounded-xl overflow-hidden cursor-pointer"
                  >
                    <img
                      src={image}
                      alt={`Gallery ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {/* Rating Summary */}
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-gray-800">{provider.rating.toFixed(1)}</div>
                  <div className="flex items-center justify-center gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= Math.round(provider.rating)
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{provider.reviewCount} reviews</p>
                </div>
              </div>
            </div>

            {/* Reviews List */}
            {provider.reviews.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No reviews yet</p>
              </div>
            ) : (
              provider.reviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-white rounded-xl p-4 border border-gray-100"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden">
                      {review.customerPhoto ? (
                        <img
                          src={review.customerPhoto}
                          alt={review.customerName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-orange-100 flex items-center justify-center text-orange-600 font-medium">
                          {review.customerName?.[0] || '?'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-800">{review.customerName}</h4>
                        <span className="text-xs text-gray-400">{review.date}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3 h-3 ${
                              star <= review.rating
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      {review.petName && (
                        <p className="text-xs text-gray-500 mt-1">For: {review.petName}</p>
                      )}
                      <p className="text-sm text-gray-600 mt-2">{review.comment}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
          </div>
        </div>
      </div>

      <div
        className={`pointer-events-none fixed left-0 right-0 z-40 mx-auto flex w-full max-w-customer justify-center px-5 sm:px-6 ${
          fixedFooterAboveBottomNav
            ? 'cw-fixed-above-customer-tabbar py-3'
            : 'bottom-0 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]'
        }`}
      >
        <div className="pointer-events-auto mx-auto w-full max-w-xs sm:max-w-sm">
          {!provider ? (
            <Button
              type="button"
              disabled
              className="h-12 min-h-12 w-full cursor-not-allowed rounded-full bg-gray-300 px-4 text-center text-base font-semibold text-white shadow-md"
            >
              Loading…
            </Button>
          ) : serviceType === 'walker' ? (
            walkerOfferingsLoading ? (
              <Button
                type="button"
                disabled
                className="h-12 min-h-12 w-full cursor-not-allowed rounded-full bg-gray-300 px-4 text-center text-base font-semibold text-white shadow-md"
              >
                Loading walks…
              </Button>
            ) : walkerOfferingsCount === 0 ? (
              <Button
                type="button"
                disabled
                className="h-12 min-h-12 w-full cursor-not-allowed rounded-full bg-gray-300 px-4 text-center text-base font-semibold text-white shadow-md"
              >
                No walks available
              </Button>
            ) : activeTab !== 'services' || !selectedServiceId ? (
              <Button
                type="button"
                onClick={revealServicesAndScroll}
                className="h-12 min-h-12 w-full rounded-full bg-orange-500 px-4 text-center text-base font-semibold text-white shadow-lg hover:bg-orange-600"
              >
                Choose a walk or bundle
              </Button>
            ) : (
              <Button
                type="button"
                onClick={walkerContinueToBook}
                className="h-12 min-h-12 w-full rounded-full bg-orange-500 px-4 text-center text-base font-semibold text-white shadow-lg hover:bg-orange-600"
              >
                Continue to book
              </Button>
            )
          ) : servicesLoading ? (
            <Button
              type="button"
              disabled
              className="h-12 min-h-12 w-full cursor-not-allowed rounded-full bg-gray-300 px-4 text-center text-base font-semibold text-white shadow-md"
            >
              Loading services…
            </Button>
          ) : profileServices.length === 0 ? (
            <Button
              type="button"
              disabled
              className="h-12 min-h-12 w-full cursor-not-allowed rounded-full bg-gray-300 px-4 text-center text-base font-semibold text-white shadow-md"
            >
              No services listed
            </Button>
          ) : activeTab !== 'services' ? (
            <Button
              type="button"
              onClick={revealServicesAndScroll}
              className="h-12 min-h-12 w-full rounded-full bg-orange-500 px-4 text-center text-base font-semibold text-white shadow-lg hover:bg-orange-600"
            >
              Select Services to Book
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => {
                if (!selectedServiceId || !provider) return;
                const service = profileServices.find((s) => s.id === selectedServiceId);
                if (!service) return;
                onSelectService(service, rawServiceRowsRef.current.get(service.id));
              }}
              disabled={continueBookingDisabled}
              className="h-12 min-h-12 w-full rounded-full bg-orange-500 px-4 text-center text-base font-semibold text-white shadow-lg hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-md"
            >
              {continueBookingDisabled ? 'Choose a service above' : 'Continue to book'}
            </Button>
          )}
        </div>
      </div>

      {/* Gallery Lightbox */}
      <AnimatePresence>
        {showGallery && selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-50 flex items-center justify-center"
          >
            <div className="absolute right-0 top-0 z-10 flex justify-end cw-header-safe-top cw-header-safe-x">
              <button
                type="button"
                onClick={() => setShowGallery(false)}
                className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/20"
                aria-label="Close gallery"
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <img
              src={selectedImage}
              alt="Gallery"
              className="max-w-full max-h-full object-contain"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default HomeServiceProviderProfile;
