'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Star, MapPin, Clock, Building2, Home, ChevronRight, Filter, Loader2, Shield, User, Heart, Share2, Navigation, Phone, Award, Scissors, Sparkles, Check, Search, X, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { resolveVendorProfileHeroGallery, shouldShowVendorAmenities } from '@/lib/vendor-display-media';
import { VendorHeroPhotoCarousel } from '../shared/VendorHeroPhotoCarousel';
import { getWebGroomingTrainingEmbedVendorId } from '@/lib/customer-vendor-profile-navigation';
import { VendorProfileDashboardHeader } from '../shared/VendorProfileDashboardHeader';
import { ServiceDashboardHeader } from '../shared/ServiceDashboardHeader';
import { EMPTY_SERVICE_HEADER_STATS } from '@/lib/service-header-stats';
import { ServiceDescriptionInline } from '../shared/ServiceDescriptionInline';
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import { ServicePricingDisplay } from '@/components/customer/ServicePricingDisplay';
import {
  buildWalkerServiceDataForVendorPackagePurchase,
  isVendorServicePackageRow,
} from '@/lib/vendor-package-purchase-nav';
import { VendorRatingDisplay } from '@/components/customer/shared/VendorRatingDisplay';
import { pickCustomerVendorAccountId } from '@warmpawz/shared-types';
import { shareVendorProfile } from '@/lib/vendor-profile-share';
import { VendorServicePromotions } from '../services/VendorServicePromotions';
import { useDiscoveryCount } from '@/hooks/useDiscoveryCount';
import { formatDiscoveryCountStat } from '@/lib/format-floored-ten-plus';
import { filterServicesByQuery } from '@/lib/filter-services-by-query';
import { resolveServiceCategoryDisplayLabel } from '@/lib/filter-hub-services';
import { resolveNextAvailableLabel } from '@/lib/available-slots-response';
import { isDiscoveryAutoApplyPromotion } from '@/lib/promotion-banner-filter';
import { useServiceStyleLaunchGate } from '@/hooks/useServiceStyleLaunchGate';
import { ServiceStyleLaunchBlocked } from '../shared/ServiceStyleLaunchBlocked';
import { useByStyleDiscoveryFeed } from '@/hooks/useByStyleDiscoveryFeed';
import { useDiscoveryProfileVendorResolve } from '@/hooks/useDiscoveryProfileVendorResolve';
import { mapDiscoveryRowBaseFields } from '@/lib/map-discovery-list-row';
import { DiscoveryVendorFeedSentinel } from '../shared/DiscoveryVendorFeedSentinel';
import { DiscoveryProviderAvatar } from '../shared/DiscoveryProviderAvatar';
import { applyGroomingPromotionsToServices } from '@/lib/apply-grooming-promotions-to-services';
import {
  buildVendorServicesPageUrl,
  vendorServicesNextCursor,
  vendorServicesRowsFromResponse,
} from '@/lib/vendor-services-page';
import { mergeDiscoveryProvidersPreservingServices } from '@/lib/merge-discovery-provider-feed';
import { useWarmpawzAppointmentsByCategoryFeed } from '@/hooks/useWarmpawzAppointmentsByCategoryFeed';
import { filterGroomingHubProviderRows } from '@/lib/filter-hub-services';
import type { WapptStyleFilter } from '@/hooks/useWarmpawzAppointmentsByCategoryFeed';
import {
  buildWarmpawzAppointmentsBookingNav,
  buildWarmpawzAppointmentsProfileNav,
  resolveWarmpawzBookingScreen,
  WAPPT_VENDOR_PROFILE_SCREEN,
} from '@/lib/warmpawz-appointments-customer';
import { WarmpawzPayVendorCard } from '@/components/warmpawz-pay/vendor-card/WarmpawzPayVendorCard';
import { buildWapptDiscoveryVendorCardProps } from '@/lib/wappt-discovery-vendor-card';
import { WarmpawzAppointmentsVendorProfile } from '../warmpawz-appointments/WarmpawzAppointmentsVendorProfile';

interface GroomingServicesByStyleProps {
  phone: string;
  serviceStyle: string; // 'at_home', 'at_center'
  serviceTypeName?: string;
  category?: string;
  vendorId?: string; // Optional: filter to show only this vendor's services (vendor profile mode)
  specialization?: string;
  appointmentsMode?: boolean;
  wapptStyleFilter?: WapptStyleFilter;
  hideDashboardHeader?: boolean;
  profileBackScreen?: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

  // Provider can be vendor (for at_center) or staff/individual (for at_home)
interface Provider {
  providerId: string;
  providerType: 'vendor' | 'staff' | 'individual';
  vendorId?: string;
  vendorName?: string;
  staffId?: string;
  name: string;
  phone?: string;
  photo?: string;
  address?: string;
  city?: string;
  role?: string;
  specialisation?: string; // ✅ NEW: Specialisation
  amenities?: string[]; // ✅ NEW: Amenities
  experienceYears?: number;
  qualifications?: string;
  rating: string;
  reviewCount: number;
  distance?: number | null;
  distanceText?: string | null;
  isVerified?: boolean;
  isIndividualProvider?: boolean;
  nextAvailableSlot?: string;
  services: {
    id: string;
    serviceId: string;
    name: string;
    price: number;
    originalPrice?: number; // ✅ NEW: Original price before discount
    discountPercentage?: number; // ✅ NEW: Discount percentage
    discountAmount?: number; // ✅ NEW: Discount amount
    promotionId?: string; // ✅ NEW: Active promotion ID
    duration: number;
    description?: string;
    category?: string;
    isPackage?: boolean;
  }[];
  servicesHydrated?: boolean;
  servicesNextCursor?: string | null;
  servicesLoadingMore?: boolean;
  priceMin?: number;
}

export function GroomingServicesByStyle({ 
  phone, 
  serviceStyle, 
  serviceTypeName,
  category = 'grooming',
  vendorId,
  specialization,
  appointmentsMode = false,
  wapptStyleFilter = 'all',
  hideDashboardHeader = false,
  profileBackScreen,
  onBack, 
  onNavigate 
}: GroomingServicesByStyleProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  
  // Profile view state (when vendorId is provided)
  const [vendor, setVendor] = useState<any>(null);
  const [facility, setFacility] = useState<any>(null);
  const [rating, setRating] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'reviews'>('services');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'price' | 'name' | 'popular'>('popular');
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [fetchingServicesFor, setFetchingServicesFor] = useState<string | null>(null);
  const providersRef = useRef(providers);
  providersRef.current = providers;
  const [promotions, setPromotions] = useState<any[]>([]);
  const launchGate = useServiceStyleLaunchGate(phone, category, serviceStyle);

  const feedEnabled = appointmentsMode || (launchGate.ready && !launchGate.blocked);

  const wapptFeed = useWarmpawzAppointmentsByCategoryFeed({
    category,
    serviceStyle: wapptStyleFilter,
    enabled: appointmentsMode && feedEnabled,
  });

  const normalFeed = useByStyleDiscoveryFeed({
    phone,
    serviceStyle,
    category,
    specialization,
    enabled: !appointmentsMode && feedEnabled,
  });

  const feedRows = appointmentsMode ? wapptFeed.vendors : normalFeed.rows;
  const feedLoading = appointmentsMode ? wapptFeed.loading : normalFeed.loading;
  const loadingMore = appointmentsMode ? wapptFeed.loadingMore : normalFeed.loadingMore;
  const hasMore = appointmentsMode ? wapptFeed.hasMore : normalFeed.hasMore;
  const loadMore = appointmentsMode ? wapptFeed.loadMore : normalFeed.loadMore;

  const mapRowToGroomingProvider = useCallback((row: Record<string, unknown>): Provider => {
    const base = mapDiscoveryRowBaseFields(row);
    const label = base.nextAvailableSlot;
    return {
      providerId: base.providerId,
      providerType: 'vendor',
      vendorId: base.vendorId,
      name: base.name,
      phone: base.phone,
      photo: base.photo,
      address: base.address,
      city: base.city,
      role: base.role,
      specialisation:
        (row.specialisation as string) ||
        (row.specialization as string) ||
        base.specialization,
      amenities: Array.isArray(row.amenities) ? (row.amenities as string[]) : [],
      experienceYears: base.experienceYears,
      qualifications: base.qualifications,
      rating: String(base.rating),
      reviewCount: base.reviewCount,
      distance: base.distance != null ? Number(base.distance) : null,
      distanceText: base.distanceText,
      isVerified: base.isVerified,
      isIndividualProvider: base.isIndividualProvider,
      nextAvailableSlot:
        label && label !== 'Tap to view availability' ? label : undefined,
      priceMin: appointmentsMode ? undefined : base.priceMin,
      services: [],
    };
  }, [appointmentsMode]);

  useEffect(() => {
    if (!feedEnabled) {
      if (!appointmentsMode && launchGate.ready && launchGate.blocked) setLoading(false);
      return;
    }
    let mapped = feedRows.map(mapRowToGroomingProvider);
    if (appointmentsMode) {
      mapped = filterGroomingHubProviderRows(mapped);
    }
    if (vendorId) {
      const want = String(vendorId);
      mapped = mapped.filter(
        (p) => p.providerId === want || p.vendorId === want
      );
    }
    setProviders((prev) => mergeDiscoveryProvidersPreservingServices(prev, mapped));
    setLoading(feedLoading);
  }, [feedEnabled, feedRows, feedLoading, vendorId, mapRowToGroomingProvider, launchGate.ready, launchGate.blocked]);

  const { showProfileLoading, profileResolveFailed } = useDiscoveryProfileVendorResolve({
    vendorId,
    feedEnabled,
    feedLoading,
    providers,
    mapRow: mapRowToGroomingProvider,
    setProviders,
  });

  useEffect(() => {
    if (!feedEnabled || !vendorId) return;
    loadVendorProfile();
  }, [feedEnabled, vendorId, serviceStyle]);

  const fetchProviderServices = useCallback(
    async (providerId: string, append = false) => {
      const p = providersRef.current.find((x) => x.providerId === providerId);
      if (!p) return;
      if (append) {
        if (!p.servicesNextCursor || p.servicesLoadingMore) return;
      } else if (p.servicesHydrated) {
        return;
      }
      const vid = p.vendorId || p.providerId;
      if (append) {
        setProviders((prev) =>
          prev.map((v) =>
            v.providerId === providerId ? { ...v, servicesLoadingMore: true } : v
          )
        );
      } else {
        setFetchingServicesFor(providerId);
      }
      try {
        const url = buildVendorServicesPageUrl({
          vendorId: vid,
          serviceStyle,
          category,
          customerPhone: phone || undefined,
          cursor: append ? p.servicesNextCursor : undefined,
        });
        const res = await apiClient.get(url);
        const rows = vendorServicesRowsFromResponse(
          res as { services?: unknown[]; packages?: unknown[] }
        );
        const withPromos = applyGroomingPromotionsToServices(
          rows as Record<string, unknown>[],
          promotions,
          category
        );
        const services = withPromos.map((s) => ({
          id: String(s.id ?? s.serviceId ?? ''),
          serviceId: String(s.serviceId ?? s.id ?? ''),
          name: String(s.name ?? 'Service'),
          price: Number(s.price ?? 0),
          originalPrice: s.originalPrice != null ? Number(s.originalPrice) : undefined,
          discountPercentage:
            s.discountPercentage != null ? Number(s.discountPercentage) : undefined,
          discountAmount: s.discountAmount != null ? Number(s.discountAmount) : undefined,
          promotionId: s.promotionId as string | undefined,
          duration: Number(s.duration ?? 30),
          description: s.description as string | undefined,
          category: s.category as string | undefined,
          isPackage: Boolean(s.isPackage),
        }));
        const nextCursor = vendorServicesNextCursor(res);
        setProviders((prev) =>
          prev.map((v) => {
            if (v.providerId !== providerId) return v;
            const seen = new Set(
              append ? v.services.map((s) => s.id || s.serviceId) : []
            );
            const merged = append ? [...v.services] : [];
            for (const s of services) {
              const key = s.id || s.serviceId;
              if (key && seen.has(key)) continue;
              if (key) seen.add(key);
              merged.push(s);
            }
            return {
              ...v,
              services: merged,
              servicesHydrated: true,
              servicesNextCursor: nextCursor,
              servicesLoadingMore: false,
            };
          })
        );
      } catch (e) {
        console.warn('[GroomingServicesByStyle] vendor services fetch failed', e);
        setProviders((prev) =>
          prev.map((v) =>
            v.providerId === providerId
              ? { ...v, servicesHydrated: true, servicesLoadingMore: false }
              : v
          )
        );
      } finally {
        setFetchingServicesFor(null);
      }
    },
    [phone, serviceStyle, category, promotions]
  );

  const loadMoreProviderServices = useCallback(
    (providerId: string) => {
      void fetchProviderServices(providerId, true);
    },
    [fetchProviderServices]
  );

  useEffect(() => {
    if (!selectedProvider) return;
    const p = providers.find((x) => x.providerId === selectedProvider);
    if (!p || p.servicesHydrated) return;
    if (fetchingServicesFor === selectedProvider) return;
    void fetchProviderServices(selectedProvider);
  }, [selectedProvider, providers, fetchingServicesFor, fetchProviderServices]);

  useEffect(() => {
    if (!vendorId || providers.length !== 1) return;
    const p = providers[0];
    if (p.servicesHydrated) return;
    if (fetchingServicesFor === p.providerId) return;
    void fetchProviderServices(p.providerId);
  }, [vendorId, providers, fetchingServicesFor, fetchProviderServices]);

  // Check if we're in profile view mode (vendorId provided and single provider)
  const isProfileView = vendorId && providers.length === 1;
  const profileProvider = isProfileView ? providers[0] : null;

  const [providerSortBy, setProviderSortBy] = useState<
    'distance' | 'rating' | 'relevance' | 'reviews'
  >('relevance');
  const [providerFilter, setProviderFilter] = useState<{
    minRating?: number;
    maxDistance?: number;
    specialisation?: string;
    amenities?: string[];
  }>({});

  const loadPromotions = async () => {
    try {
      const response = (await apiClient.get('/promotions/active')) as any;
      if (response.success && response.promotions) {
        const discoveryPromos = (response.promotions || []).filter(
          isDiscoveryAutoApplyPromotion
        );
        setPromotions(discoveryPromos);
      }
    } catch (error) {
      console.error('Error loading promotions:', error);
    }
  };

  useEffect(() => {
    void loadPromotions();
  }, []);

  const salonCenterDiscovery = useDiscoveryCount({
    phone,
    serviceStyle: 'at_center',
    category: 'grooming',
    specialization: specialization,
    enabled: serviceStyle === 'at_center',
  });
  const salonHomeDiscovery = useDiscoveryCount({
    phone,
    serviceStyle: 'at_home',
    category: 'grooming',
    specialization: specialization,
    enabled: serviceStyle === 'at_home',
  });

  const groomingSalonStatValue = useMemo(() => {
    const q = serviceStyle === 'at_center' ? salonCenterDiscovery : salonHomeDiscovery;
    const st =
      q.isLoading || q.isFetching ? 'loading' : q.isError ? 'error' : 'success';
    return formatDiscoveryCountStat(q.data, st);
  }, [
    serviceStyle,
    salonCenterDiscovery.data,
    salonCenterDiscovery.isLoading,
    salonCenterDiscovery.isFetching,
    salonCenterDiscovery.isError,
    salonHomeDiscovery.data,
    salonHomeDiscovery.isLoading,
    salonHomeDiscovery.isFetching,
    salonHomeDiscovery.isError,
  ]);

  const groomingSalonStatLabel = serviceStyle === 'at_center' ? 'Salons' : 'Pros';

  const dashboardStats = EMPTY_SERVICE_HEADER_STATS;

  const getServiceTitle = () => {
    if (serviceStyle === 'at_center') return 'Grooming Center';
    if (serviceStyle === 'at_home') return 'At Home Grooming';
    return 'Grooming Services';
  };

  const getServiceSubtitle = () => {
    if (serviceStyle === 'at_center') return 'Visit our premium grooming salons';
    if (serviceStyle === 'at_home') return 'Professional groomer comes to you';
    return 'Premium pet grooming services';
  };

  // Load vendor and facility details for profile view
  const loadVendorProfile = async () => {
    if (!vendorId) return;
    
    try {
      const [vendorRes, facilityRes] = await Promise.all([
        apiClient.get<any>(`/customer/vendor/${vendorId}`).catch(() => null),
        apiClient.get<any>(`/customer/facility/${vendorId}`).catch(() => null)
      ]);

      if (vendorRes?.success || vendorRes) {
        const vendorData = vendorRes?.vendor || vendorRes;
        setVendor(vendorData);
        
        // ✅ ENHANCED: Update provider with vendor data including specialisation and amenities
        setProviders(prevProviders => {
          if (prevProviders.length === 0) return prevProviders;
          return prevProviders.map(p => {
            if ((p.providerId || p.vendorId) === vendorId) {
              return {
                ...p,
                specialisation: p.specialisation || vendorData.specialisation || vendorData.specialization || vendorData.category,
                amenities: (p.amenities && p.amenities.length > 0) ? p.amenities : 
                          (Array.isArray(vendorData.amenities) ? vendorData.amenities :
                          (vendorData.amenities ? [vendorData.amenities] : p.amenities || []))
              };
            }
            return p;
          });
        });
      }

      if (facilityRes?.success) {
        const facilityData = facilityRes.facility;
        setFacility(facilityData);
        setRating(facilityRes.rating);
        setReviews(facilityRes.recentReviews || []);
        
        // ✅ ENHANCED: Update provider with facility amenities if not already set
        setProviders(prevProviders => {
          if (prevProviders.length === 0 || !facilityData?.amenities) return prevProviders;
          return prevProviders.map(p => {
            if ((p.providerId || p.vendorId) === vendorId && (!p.amenities || p.amenities.length === 0)) {
              return {
                ...p,
                amenities: Array.isArray(facilityData.amenities) ? facilityData.amenities : [facilityData.amenities]
              };
            }
            return p;
          });
        });
      }
    } catch (error) {
      console.error('Error loading vendor profile:', error);
    }
  };

  const getStyleIcon = () => {
    switch (serviceStyle) {
      case 'at_home': return <Home className="w-5 h-5" />;
      case 'at_center': return <Building2 className="w-5 h-5" />;
      default: return <Building2 className="w-5 h-5" />;
    }
  };

  const getStyleColor = () => {
    switch (serviceStyle) {
      case 'at_home': return 'from-green-500 to-green-600';
      case 'at_center': return 'from-orange-500 to-orange-600';
      default: return 'from-orange-500 to-orange-600';
    }
  };

  const getProviderTypeLabel = (provider: Provider) => {
    if (appointmentsMode) {
      const roleLabel = String(
        (provider as Provider & { roleDisplayName?: string }).roleDisplayName ??
          provider.role ??
          ''
      ).trim();
      if (roleLabel) return roleLabel;
    }
    if (provider.providerType === 'individual') {
      return 'Independent Groomer';
    }
    if (provider.providerType === 'staff') {
      return provider.vendorName ? `From ${provider.vendorName}` : 'Salon Staff';
    }
    return provider.role || 'Grooming Salon';
  };

  const getProviderAddress = (provider: Provider) => {
    const rawAddress = [
      provider.address,
      (provider as any)?.location?.address,
      (provider as any)?.vendorLocation?.address,
      (provider as any)?.vendor?.address,
      (provider as any)?.facility?.address,
    ].find((value) => typeof value === 'string' && value.trim().length > 0) as string | undefined;

    return rawAddress?.trim() || '';
  };

  const openGroomingProviderProfile = (e: MouseEvent, provider: Provider) => {
    e.stopPropagation();
    if (appointmentsMode) {
      const vid = String(provider.vendorId || provider.providerId || '');
      const style =
        wapptStyleFilter === 'all' ? serviceStyle : wapptStyleFilter;
      onNavigate(WAPPT_VENDOR_PROFILE_SCREEN, {
        ...buildWarmpawzAppointmentsProfileNav({
          vendorId: vid,
          vendorName: provider.name,
          serviceStyle: style,
          category,
          profileBackScreen: profileBackScreen || 'wappt-discovery',
        }),
      });
      return;
    }
    const vid = getWebGroomingTrainingEmbedVendorId(provider as unknown as Record<string, unknown>);
    onNavigate('grooming_embed_vendor_profile', { vendorId: vid, serviceStyle });
  };

  const handleSelectService = (provider: Provider, service: any) => {
    // For staff/individual providers, include staffId in booking data
    const bookingData: any = {
      serviceId: service.id,
      serviceName: service.name,
      serviceStyle,
      price: service.price,
      duration: service.duration,
      providerName: provider.name,
    };

    const vendorIdForPkg =
      provider.providerType === 'vendor'
        ? String(provider.providerId || provider.vendorId || '')
        : String(provider.vendorId || provider.providerId || '');
    if (isVendorServicePackageRow(service as any) && vendorIdForPkg) {
      const pkgNav = buildWalkerServiceDataForVendorPackagePurchase({
        vendorId: vendorIdForPkg,
        vendorName: provider.vendorName || provider.name,
        serviceRow: service as Record<string, unknown>,
        serviceTypeCategory: 'grooming',
        serviceStyle,
      });
      if (pkgNav) {
        onNavigate('purchase-package', pkgNav);
        return;
      }
    }

    if (provider.providerType === 'vendor') {
      bookingData.vendorId = provider.providerId;
      bookingData.vendorName = provider.name;
    } else {
      // Staff or individual provider
      bookingData.staffId = provider.providerId;
      bookingData.staffName = provider.name;
      bookingData.vendorId = provider.vendorId; // May be null for individual providers
      bookingData.vendorName = provider.vendorName;
      bookingData.isIndividualProvider = provider.isIndividualProvider;
    }

    onNavigate('create-booking', bookingData);
  };

  // ✅ NEW: Filter and sort providers for listing view
  const filteredAndSortedProviders = useMemo(() => {
    let filtered = [...providers];
    
    // Apply filters
    if (providerFilter.minRating) {
      filtered = filtered.filter(p => Number(p.rating) >= providerFilter.minRating!);
    }
    if (providerFilter.maxDistance !== undefined) {
      filtered = filtered.filter(p => 
        p.distance !== null && p.distance !== undefined && p.distance <= providerFilter.maxDistance!
      );
    }
    if (providerFilter.specialisation) {
      filtered = filtered.filter(p => 
        p.specialisation?.toLowerCase().includes(providerFilter.specialisation!.toLowerCase())
      );
    }
    if (providerFilter.amenities && providerFilter.amenities.length > 0) {
      filtered = filtered.filter(p => 
        providerFilter.amenities!.every(amenity => 
          p.amenities?.some(a => a.toLowerCase().includes(amenity.toLowerCase()))
        )
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (providerSortBy) {
        case 'distance':
          const distA = a.distance ?? Infinity;
          const distB = b.distance ?? Infinity;
          return distA - distB;
        case 'rating':
          return Number(b.rating) - Number(a.rating);
        case 'reviews':
          return (b.reviewCount || 0) - (a.reviewCount || 0);
        case 'relevance':
        default:
          // Relevance: combination of rating, reviews, and distance
          const ratingScore = (Number(b.rating) * 40) + ((b.reviewCount || 0) * 0.1);
          const distanceScore = (a.distance ?? 0) * 10;
          return ratingScore - distanceScore;
      }
    });
    
    return filtered;
  }, [providers, providerSortBy, providerFilter]);

  // Filter and sort services for profile view
  const filteredServices = useMemo(
    () => filterServicesByQuery(profileProvider?.services || [], searchQuery),
    [profileProvider?.services, searchQuery]
  );
  const sortedServices = [...filteredServices].sort((a, b) => {
    if (sortBy === 'popular') return 0; // No popularity data yet
    if (sortBy === 'price') return a.price - b.price;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0;
  });

  const toggleServiceSelection = (serviceId: string) => {
    const newSelection = new Set(selectedServices);
    if (newSelection.has(serviceId)) {
      newSelection.delete(serviceId);
    } else {
      newSelection.add(serviceId);
    }
    setSelectedServices(newSelection);
  };

  // ✅ FIX: Pass all selected services to booking, not just the first one
  // This matches the vet flow where multiple services can be selected
  const handleBookServices = () => {
    if (appointmentsMode && profileProvider) {
      const vid = String(profileProvider.vendorId || profileProvider.providerId || '');
      const style =
        wapptStyleFilter === 'all' ? serviceStyle : wapptStyleFilter;
      onNavigate(resolveWarmpawzBookingScreen(category), {
        ...buildWarmpawzAppointmentsBookingNav({
          vendorId: vid,
          vendorName: profileProvider.name,
          serviceStyle: style,
          category,
        }),
        appointmentsMode: true,
      });
      return;
    }
    if (selectedServices.size === 0) {
      // If no services selected, navigate with first service or all services
      if (profileProvider?.services && profileProvider.services.length > 0) {
        handleSelectService(profileProvider, profileProvider.services[0]);
      }
      return;
    }

    const selectedServicesData = Array.from(selectedServices).map(id => 
      profileProvider?.services.find(s => s.id === id || s.serviceId === id)
    ).filter(Boolean);

    if (selectedServicesData.length > 0) {
      const pkgRow = selectedServicesData.find((s) => isVendorServicePackageRow(s as any));
      if (pkgRow && profileProvider) {
        const vid =
          profileProvider.providerType === 'vendor'
            ? String(profileProvider.providerId || profileProvider.vendorId || '')
            : String(profileProvider.vendorId || profileProvider.providerId || '');
        if (vid) {
          const pkgNav = buildWalkerServiceDataForVendorPackagePurchase({
            vendorId: vid,
            vendorName: profileProvider.vendorName || profileProvider.name,
            serviceRow: pkgRow as Record<string, unknown>,
            serviceTypeCategory: 'grooming',
            serviceStyle,
          });
          if (pkgNav) {
            onNavigate('purchase-package', pkgNav);
            return;
          }
        }
      }

      // ✅ FIX: Pass all selected services, not just the first one
      // Build booking data similar to VetCenterProfileView
      const firstService = selectedServicesData[0];
      const bookingData: any = {
        vendorId: profileProvider!.providerId || profileProvider!.vendorId,
        vendorName: profileProvider!.name,
        serviceStyle,
        selectedServices: selectedServicesData, // ✅ Pass array of selected services
        // Also include first service for backward compatibility
        serviceId: firstService?.id || firstService?.serviceId,
        serviceName: firstService?.name,
        price: totalPrice, // Total price of all selected services
        duration: selectedServicesData.reduce((sum, s) => sum + (s?.duration || 0), 0),
      };

      if (profileProvider!.providerType === 'vendor') {
        bookingData.vendorId = profileProvider!.providerId;
        bookingData.vendorName = profileProvider!.name;
      } else {
        // Staff or individual provider
        bookingData.staffId = profileProvider!.providerId;
        bookingData.staffName = profileProvider!.name;
        bookingData.vendorId = profileProvider!.vendorId;
        bookingData.vendorName = profileProvider!.vendorName;
        bookingData.isIndividualProvider = profileProvider!.isIndividualProvider;
      }

      onNavigate('create-booking', bookingData);
    }
  };

  const totalPrice = Array.from(selectedServices).reduce((sum, id) => {
    const service = profileProvider?.services.find(s => s.id === id || s.serviceId === id);
    return sum + (service?.price || 0);
  }, 0);

  const handleShare = async () => {
    const shareVendorId =
      vendorId ||
      pickCustomerVendorAccountId((profileProvider ?? {}) as unknown as Record<string, unknown>) ||
      profileProvider?.vendorId ||
      profileProvider?.providerId;
    if (!shareVendorId) return;
    await shareVendorProfile({
      title: profileProvider?.name || 'Grooming Salon',
      text: `Check out ${profileProvider?.name || 'this grooming salon'} on Warmpawz`,
      vendorId: String(shareVendorId),
      persona: 'grooming',
      vendorName: profileProvider?.name,
      serviceStyle,
    });
  };

  if (!appointmentsMode && launchGate.ready && launchGate.blocked) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ServiceStyleLaunchBlocked message={launchGate.blockMessage} onBack={onBack} />
      </div>
    );
  }

  if (loading || showProfileLoading) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-customer items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#FF8C42] mx-auto mb-3" />
          <p className="text-gray-600">Loading {vendorId ? 'salon profile' : 'available services'}...</p>
        </div>
      </div>
    );
  }

  // Profile View Mode - Zomato-style for grooming salon
  if (isProfileView && profileProvider && appointmentsMode && vendorId) {
    return (
      <WarmpawzAppointmentsVendorProfile
        phone={phone}
        vendorId={String(vendorId)}
        vendorName={profileProvider.name}
        category={category || 'grooming'}
        serviceStyle={serviceStyle}
        profileBackScreen={profileBackScreen || 'wappt-discovery'}
        onBack={onBack}
        onNavigate={onNavigate}
      />
    );
  }

  if (isProfileView && profileProvider) {
    const salonName = vendor?.business_name || vendor?.name || profileProvider.name;
    const photos = resolveVendorProfileHeroGallery({ facility, vendor, profileProvider });
    const hasPhotos = photos.length > 0;
    const amenities = facility?.amenities || vendor?.amenities || [];
    const address = vendor?.address || facility?.address || profileProvider.address || '';
    const phoneNumber = vendor?.phone || facility?.phone || profileProvider.phone || '';
    const description = vendor?.description || facility?.description || `${salonName} is a professional pet grooming salon offering premium grooming services.`;

    const profileVendorId = String(
      vendorId ?? profileProvider.providerId ?? pickCustomerVendorAccountId(vendor as Record<string, unknown>) ?? ''
    ).trim();
    
    const getServiceTitle = () => {
      if (serviceStyle === 'at_center') return 'Grooming Center';
      if (serviceStyle === 'at_home') return 'At Home Grooming';
      return 'Grooming Services';
    };
    
    const getServiceSubtitle = () => {
      if (serviceStyle === 'at_center') return 'Visit our premium grooming salons';
      if (serviceStyle === 'at_home') return 'Professional groomer comes to you';
      return 'Premium pet grooming services';
    };

    return (
      <div className="min-h-screen bg-gray-50 relative overflow-hidden">
        {/* ✅ FIX: Restore Frame UI with ServiceDashboardHeader */}
        <VendorProfileDashboardHeader
          fullWidth
          className="!z-0 isolation-auto"
          serviceName={getServiceTitle()}
          serviceSubtitle={getServiceSubtitle()}
          serviceIcon={Scissors}
          iconColor="text-white"
          onBack={onBack}
          showBackButton={true}
          bottomEdge="flat"
        />
        <div className="relative z-0 mx-auto w-full max-w-customer">
        {hasPhotos ? (
          <div className="relative w-full -mt-3 sm:-mt-3">
            <div className="overflow-hidden rounded-t-[24px] bg-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] sm:rounded-t-[28px]">
              <VendorHeroPhotoCarousel
                photos={photos}
                name={salonName}
                frameClassName="relative h-[280px] overflow-hidden sm:h-[320px]"
              />
            </div>
          </div>
        ) : (
          <div className="relative w-full -mt-3 sm:-mt-3">
            <div className="overflow-hidden rounded-t-[24px] sm:rounded-t-[28px]">
          <div className="relative flex h-[280px] w-full items-center justify-center bg-gradient-to-br from-[#FF8C42] to-[#FF7029]">
            <div className="text-center text-white">
              <Scissors className="w-20 h-20 mx-auto mb-3 opacity-50" />
              <p className="text-sm opacity-75">No photos available</p>
            </div>
          </div>
            </div>
          </div>
        )}

        <div className="mx-auto w-full max-w-customer px-4 cw-scroll-pad-tabbar-sticky-cta">
          <VendorServicePromotions vendorId={profileVendorId} vendorName={salonName} className="mb-4" />
          {/* Salon Header Info - Grooming-Focused */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4 -mt-6 relative z-10">
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{salonName}</h1>
              
              {/* Rating and Reviews */}
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <VendorRatingDisplay
                  row={{
                    vendorId: profileVendorId,
                    vendorRating: rating?.averageRating ?? profileProvider.rating,
                    vendorReviewCount: rating?.totalReviews ?? profileProvider.reviewCount,
                  }}
                  vendorId={profileVendorId}
                  starsClassName="h-5 w-5"
                  textClassName="text-sm text-gray-700"
                />
                
                {facility?.isPremium && (
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" />
                    Premium
                  </span>
                )}
                {profileProvider.isVerified && (
                  <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" />
                    Verified
                  </span>
                )}
              </div>

              {/* Service Type Badge */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg">
                  <Scissors className="w-4 h-4 text-[#FF8C42]" />
                  <span className="text-sm font-medium text-gray-700">
                    {serviceStyle === 'at_center' ? 'Grooming Salon' : 'At-Home Grooming'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-3 gap-2 mb-4 border-t border-gray-100 pt-4">
              <button 
                onClick={() => phoneNumber && window.open(`tel:${phoneNumber}`, '_self')}
                className="flex flex-col items-center justify-center gap-1.5 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
              >
                <Phone className="w-5 h-5 text-[#FF8C42] group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-gray-700">Call</span>
              </button>
              <button 
                onClick={() => {
                  if (address) {
                    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
                  }
                }}
                className="flex flex-col items-center justify-center gap-1.5 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
              >
                <Navigation className="w-5 h-5 text-[#FF8C42] group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-gray-700">Directions</span>
              </button>
              <button 
                onClick={handleShare}
                className="flex flex-col items-center justify-center gap-1.5 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
              >
                <Share2 className="w-5 h-5 text-[#FF8C42] group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-gray-700">Share</span>
              </button>
            </div>

            {/* Quick Info */}
            <div className="space-y-2.5 border-t border-gray-100 pt-4">
              {address && (
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 leading-relaxed">{address}</span>
                </div>
              )}
            </div>

            {/* Amenities - Grooming-Specific */}
            {shouldShowVendorAmenities(serviceStyle) && amenities.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Salon Features</h3>
                <div className="flex flex-wrap gap-2">
                  {amenities.slice(0, 6).map((amenity: string, idx: number) => (
                    <span key={idx} className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-xs font-medium border border-orange-100">
                      {amenity}
                    </span>
                  ))}
                  {amenities.length > 6 && (
                    <span className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                      +{amenities.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b-2 border-gray-200 bg-white rounded-t-2xl overflow-hidden sticky top-[56px] z-40 shadow-sm">
            {['overview', 'services', 'reviews'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 py-4 text-sm font-semibold capitalize transition-all relative ${
                  activeTab === tab
                    ? 'text-[#FF8C42]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'services' ? `Services (${profileProvider.services.length})` : tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF8C42]" />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-b-2xl p-5 mb-4 min-h-[400px]">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Scissors className="w-5 h-5 text-[#FF8C42]" />
                    About
                  </h3>
                  <p className="text-sm text-gray-700 leading-relaxed">{description}</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-xl p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{profileProvider.services.length}</div>
                    <div className="text-xs text-gray-500 mt-1">Services</div>
                  </div>
                  <div className="text-center border-x border-gray-200">
                    <div className="text-2xl font-bold text-gray-900">
                      {profileProvider.experienceYears || '5+'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Years Experience</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {rating?.totalReviews || profileProvider.reviewCount || '10+'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Reviews</div>
                  </div>
                </div>

                {/* Grooming Specialties */}
                {profileProvider.qualifications && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Specialties</h3>
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-purple-500 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-700 font-medium mb-1">Expertise</p>
                          <p className="text-sm text-gray-600">{profileProvider.qualifications}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Full Amenities List */}
                {shouldShowVendorAmenities(serviceStyle) && amenities.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">All Features</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {amenities.map((amenity: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span className="text-sm text-gray-700">{amenity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Get Directions CTA */}
                {address && (
                  <button 
                    onClick={() => {
                      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
                    }}
                    className="w-full px-4 py-3.5 bg-[#FF8C42] text-white rounded-xl font-semibold hover:bg-[#E67A35] transition-colors flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                  >
                    <Navigation className="w-5 h-5" />
                    Get Directions on Maps
                  </button>
                )}
              </div>
            )}

            {activeTab === 'services' && (
              <div className="space-y-4">
                {/* Search and Filter */}
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search grooming services..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                    >
                      <option value="popular">Popular First</option>
                      <option value="price">Price: Low to High</option>
                      <option value="name">Name: A to Z</option>
                    </select>
                  </div>
                </div>

                {/* Services List - Enhanced Cards */}
                {sortedServices.length > 0 ? (
                  <div className="space-y-3">
                    {sortedServices.map((service) => {
                      const isSelected = selectedServices.has(service.id) || selectedServices.has(service.serviceId);
                      return (
                        <div
                          key={service.id}
                          onClick={() => toggleServiceSelection(service.id)}
                          className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${
                            isSelected
                              ? 'border-[#FF8C42] bg-gradient-to-br from-orange-50 to-orange-100 shadow-md'
                              : 'border-gray-200 hover:border-[#FF8C42]/50 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h4 className="font-bold text-gray-900 text-base">{service.name}</h4>
                                {service.isPackage && (
                                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 border border-purple-200">Package</span>
                                )}
                                {isSelected && (
                                  <span className="px-2.5 py-0.5 bg-green-500 text-white rounded-full text-xs font-semibold flex items-center gap-1 flex-shrink-0">
                                    <Check className="w-3 h-3" />
                                    Selected
                                  </span>
                                )}
                              </div>
                              {service.description?.trim() && (
                                <ServiceDescriptionInline
                                  description={service.description}
                                  title={service.name}
                                  className="m-0 text-sm leading-5 text-gray-600 mb-3"
                                />
                              )}
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-lg">
                                  <Clock className="w-3.5 h-3.5 text-gray-600" />
                                  {service.duration} mins
                                </span>
                                {resolveServiceCategoryDisplayLabel(service) && (
                                  <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-gray-600">{resolveServiceCategoryDisplayLabel(service)}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <ServicePricingDisplay
                                basePrice={service.originalPrice ?? service.price}
                                usePromoQuote
                                vendorId={vendorId || profileProvider?.providerId}
                                serviceId={String(service.id || service.serviceId || '')}
                                customerId={phone}
                                serviceStyle={serviceStyle}
                                serviceCategory={category}
                                className="mb-1 items-end"
                              />
                              {isSelected && (
                                <div className="mt-1 flex justify-end">
                                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                    <Check className="w-4 h-4 text-white" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : fetchingServicesFor === profileProvider.providerId ||
                  !profileProvider.servicesHydrated ? (
                  <div className="text-center py-16">
                    <Loader2 className="w-10 h-10 animate-spin text-[#FF8C42] mx-auto mb-3" />
                    <p className="text-gray-600">Loading services…</p>
                  </div>
                ) : (
                  <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <Scissors className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium mb-1">No services available</p>
                    <p className="text-sm text-gray-500">Services will be added soon</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-4">
                {/* Reviews Summary */}
                {reviews.length > 0 && rating && (
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-200 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
                          <span className="text-3xl font-bold text-gray-900">
                            {Number(rating?.averageRating || profileProvider.rating || 0).toFixed(1)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          Based on {rating.totalReviews || profileProvider.reviewCount || 0} reviews
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="w-10 h-10 mx-auto mb-1 bg-yellow-100 rounded-full flex items-center justify-center">
                          <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                        </div>
                        <p className="text-xs text-gray-500">Overall</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reviews List */}
                {reviews.length > 0 ? (
                  reviews.map((review) => (
                    <div key={review.id} className="bg-gray-50 rounded-xl p-5 border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-4 mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-[#FF8C42] to-[#FF7029] rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-md">
                          {review.customerName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-bold text-gray-900">{review.customerName || 'Anonymous'}</h4>
                            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                              {new Date(review.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mb-3">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                className={`w-4 h-4 ${i < review.rating ? 'fill-amber-500 text-amber-500' : 'text-gray-300'}`} 
                              />
                            ))}
                            <span className="ml-2 text-sm font-medium text-gray-700">{review.rating}/5</span>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium mb-1">No reviews yet</p>
                    <p className="text-sm text-gray-500">Be the first to review this salon!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Fixed bottom CTA — above app tab bar (globals --customer-footer-offset); do not use bottom-0 or it hides behind BottomNavigation z-50 */}
        <div className="cw-fixed-above-customer-tabbar fixed left-0 right-0 z-40 mx-auto w-full max-w-customer border-t border-gray-200 bg-white shadow-lg">
          {selectedServices.size > 0 && !appointmentsMode && (
            <div className="px-4 py-3 bg-orange-50 border-b border-orange-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {selectedServices.size} service{selectedServices.size > 1 ? 's' : ''} selected
                  </p>
                  <p className="text-lg font-bold text-orange-600">{formatPriceWithSymbol(totalPrice)}</p>
                </div>
                <button
                  onClick={() => setSelectedServices(new Set())}
                  className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          <div className="p-4">
            <Button 
              onClick={handleBookServices}
              disabled={!appointmentsMode && profileProvider.services.length === 0}
              className="w-full bg-[#FF8C42] hover:bg-[#E67A35] h-12 text-lg text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {appointmentsMode
                ? 'Select Slot for Appointment'
                : selectedServices.size === 0 
                ? (profileProvider.services.length === 0 ? 'No Services Available' : 'Select Services to Book')
                : `Book ${selectedServices.size} Service${selectedServices.size > 1 ? 's' : ''} (${formatPriceWithSymbol(totalPrice)})`
              }
            </Button>
          </div>
        </div>
        </div>
      </div>
  );
  }

  // Listing View Mode (when vendorId not provided or multiple providers)
  return (
    <div
      className={`mx-auto flex w-full max-w-customer flex-col bg-gray-50 ${
        hideDashboardHeader ? 'h-full min-h-0' : 'min-h-screen'
      }`}
    >
      {!hideDashboardHeader ? (
      <ServiceDashboardHeader
        fullWidth
        serviceName={getServiceTitle()}
        serviceSubtitle={getServiceSubtitle()}
        serviceIcon={Scissors}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
        sheetToneClass="bg-white"
      />
      ) : null}

      {/* Unified body panel — matches Pet Boarding pattern (one continuous white surface, no gray gaps) */}
      <div
        className={`flex-1 min-h-0 overflow-y-auto cw-scroll-pad-tabbar bg-white ${
          hideDashboardHeader ? '' : '-mt-4 rounded-t-[1.75rem] sm:rounded-t-[2rem]'
        }`}
      >
      {!hideDashboardHeader ? (
      <div className="px-6 pt-6 pb-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 bg-orange-100 rounded-2xl flex items-center justify-center">
            {getStyleIcon()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{serviceTypeName || 'Grooming Services'}</h1>
            <p className="text-gray-600 text-sm">
              {providers.length} provider{providers.length !== 1 ? 's' : ''} available
            </p>
          </div>
        </div>
        
        {/* Info badge for home visits */}
        {serviceStyle === 'at_home' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm mb-4">
            <div className="flex items-center gap-2 text-blue-900">
              <Shield className="w-4 h-4" />
              <span>All groomers are verified and background-checked</span>
            </div>
          </div>
        )}
      </div>
      ) : null}

      {/* Content */}
      <div className={`px-4 cw-scroll-pad-tabbar ${hideDashboardHeader ? 'pt-4' : ''}`}>
        {vendorId && providers.length !== 1 ? (
          profileResolveFailed ? (
            <Card className="p-8 text-center bg-white">
              <h3 className="font-semibold text-gray-900 mb-2">Provider not found</h3>
              <p className="text-gray-500 text-sm mb-4">This provider may no longer be available.</p>
              <Button onClick={onBack} variant="outline">Go back</Button>
            </Card>
          ) : null
        ) : providers.length === 0 ? (
          <Card className="p-8 text-center bg-white">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {getStyleIcon()}
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">No Providers Available</h3>
            <p className="text-gray-500 text-sm mb-4">
              No {serviceStyle === 'at_home' ? 'home visit' : 'salon'} groomers are currently available in your area.
            </p>
            <Button 
              onClick={onBack}
              variant="outline"
            >
              Try Other Services
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Sort only — provider filters hidden until distance/rating filters work reliably */}
            <Card className="bg-white p-4 space-y-3">
              {/* Sort Dropdown */}
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-gray-600" />
                <select
                  value={providerSortBy}
                  onChange={(e) => setProviderSortBy(e.target.value as any)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                >
                  <option value="relevance">Sort: Relevance</option>
                  <option value="distance">Sort: Distance</option>
                  <option value="rating">Sort: Rating</option>
                  <option value="reviews">Sort: Most Reviews</option>
                </select>
              </div>
            </Card>
            
            {filteredAndSortedProviders.map((provider) => {
              const providerAddress = getProviderAddress(provider);
              return (
                <WarmpawzPayVendorCard
                  key={provider.providerId}
                  {...buildWapptDiscoveryVendorCardProps({
                    provider: {
                      name: provider.name,
                      photo: provider.photo,
                      isVerified: provider.isVerified,
                      rating: provider.rating,
                      reviewCount: provider.reviewCount,
                      distance: provider.distance,
                      distanceText: provider.distanceText,
                      nextAvailableSlot: provider.nextAvailableSlot,
                      experienceYears: provider.experienceYears,
                      providerType: provider.providerType,
                      city: provider.city,
                      providerId: provider.providerId,
                      vendorId: provider.vendorId,
                    },
                    subtitle: getProviderTypeLabel(provider),
                    address: providerAddress,
                    category: category || 'grooming',
                    serviceKey: 'grooming',
                    onPrimary: (e) => openGroomingProviderProfile(e, provider),
                    onProfileClick: (e) => openGroomingProviderProfile(e, provider),
                    router,
                  })}
                />
              );
            })}
            <DiscoveryVendorFeedSentinel
              hasMore={hasMore && !vendorId}
              loading={loading}
              loadingMore={loadingMore}
              onLoadMore={() => void loadMore()}
            />
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
