'use client';

import React, { useState, useEffect, useMemo, type MouseEvent } from 'react';
import { ArrowLeft, Star, MapPin, Clock, Building2, Home, ChevronRight, Filter, Loader2, Shield, User, Heart, Share2, Navigation, Phone, Award, Scissors, Sparkles, Check, Search, X, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { resolveVendorProfileHeroGallery } from '@/lib/vendor-display-media';
import { VendorHeroPhotoCarousel } from '../shared/VendorHeroPhotoCarousel';
import { getWebGroomingTrainingEmbedVendorId } from '@/lib/customer-vendor-profile-navigation';
import { VendorProfileDashboardHeader } from '../shared/VendorProfileDashboardHeader';
import { ServiceDashboardHeader } from '../shared/ServiceDashboardHeader';
import { EMPTY_SERVICE_HEADER_STATS } from '@/lib/service-header-stats';
import { ServiceDescriptionInline } from '../shared/ServiceDescriptionInline';
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import {
  buildWalkerServiceDataForVendorPackagePurchase,
  isVendorServicePackageRow,
} from '@/lib/vendor-package-purchase-nav';
import { VendorRatingDisplay } from '@/components/customer/shared/VendorRatingDisplay';
import { pickCustomerVendorAccountId } from '@warmpawz/shared-types';
import { shareVendorProfile } from '@/lib/vendor-profile-share';
import { useDiscoveryCount } from '@/hooks/useDiscoveryCount';
import { formatDiscoveryCountStat } from '@/lib/format-floored-ten-plus';

interface GroomingServicesByStyleProps {
  phone: string;
  serviceStyle: string; // 'at_home', 'at_center'
  serviceTypeName?: string;
  category?: string;
  vendorId?: string; // Optional: filter to show only this vendor's services (vendor profile mode)
  specialization?: string;
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
  isVerified?: boolean;
  isIndividualProvider?: boolean;
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
}

export function GroomingServicesByStyle({ 
  phone, 
  serviceStyle, 
  serviceTypeName,
  category = 'grooming',
  vendorId,
  specialization,
  onBack, 
  onNavigate 
}: GroomingServicesByStyleProps) {
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
  
  // ✅ NEW: Promotions state
  const [promotions, setPromotions] = useState<any[]>([]);
  
  // ✅ NEW: Filter and sort state for provider listing
  const [providerSortBy, setProviderSortBy] = useState<'distance' | 'rating' | 'relevance' | 'reviews'>('relevance');
  const [providerFilter, setProviderFilter] = useState<{
    minRating?: number;
    maxDistance?: number;
    specialisation?: string;
    amenities?: string[];
  }>({});

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

  // Check if we're in profile view mode (vendorId provided and single provider)
  const isProfileView = vendorId && providers.length === 1;
  const profileProvider = isProfileView ? providers[0] : null;

  useEffect(() => {
    loadServicesByStyle();
    // If vendorId is provided, also load vendor and facility details for profile view
    if (vendorId) {
      loadVendorProfile();
    }
  }, [serviceStyle, vendorId, specialization]);

  // ✅ NEW: Load active promotions for discount display
  useEffect(() => {
    loadPromotions();
  }, []);

  const loadPromotions = async () => {
    try {
      const response = await apiClient.get('/promotions/active') as any;
      if (response.success && response.promotions) {
        setPromotions(response.promotions || []);
        console.log(`✅ [Grooming] Loaded ${response.promotions.length} active promotions`);
      }
    } catch (error) {
      console.error('Error loading promotions:', error);
      // Don't block UI if promotions fail to load
    }
  };

  const loadServicesByStyle = async () => {
    // Get customer location from localStorage for distance-based sorting
    let locationParams = '';
    try {
      const customerLat = localStorage.getItem('customer_latitude');
      const customerLng = localStorage.getItem('customer_longitude');
      if (customerLat && customerLng) {
        locationParams = `&latitude=${customerLat}&longitude=${customerLng}`;
      }
    } catch (e) {
      console.log('Could not get customer location');
    }

    try {
      setLoading(true);
      console.log(`🔵 [Grooming] Discovering providers: category=${category}, serviceStyle=${serviceStyle}`);

      // Use by-style endpoint (primary)
      const phoneParam = phone ? `&customerPhone=${encodeURIComponent(phone)}` : '';
      const specializationParam = specialization
        ? `&specialization=${encodeURIComponent(specialization)}`
        : '';
      const byStyleUrl = `/customer/services/by-style?style=${serviceStyle}&category=${category}${locationParams}${specializationParam}${phoneParam}`;
      console.log(`🔵 [Grooming] specialization prop="${specialization}" url=${byStyleUrl}`);
        const response = await apiClient.get(byStyleUrl) as any;
        console.log(`🔵 [Grooming] by-style response: specializationApplied=${(response as any).specializationApplied ?? 'n/a'} total=${(response as any).total}`);

      if (response.success) {
        let byStyleProviders = response.providers || response.vendors || [];
        // at_home / tele / at_center: backend + Admin role_config gate vendors; do not strip business here

        // ✅ FIX: Enhance provider data with specialisation and amenities
        byStyleProviders = byStyleProviders.map((p: any) => ({
          ...p,
          specialisation: p.specialisation || p.vendorSpecialisation || p.vendor?.specialisation || p.specialization,
          amenities: Array.isArray(p.amenities) ? p.amenities : 
                    (p.vendorAmenities ? (Array.isArray(p.vendorAmenities) ? p.vendorAmenities : [p.vendorAmenities]) : 
                    (p.vendor?.amenities ? (Array.isArray(p.vendor.amenities) ? p.vendor.amenities : [p.vendor.amenities]) : 
                    (p.facility?.amenities ? (Array.isArray(p.facility.amenities) ? p.facility.amenities : [p.facility.amenities]) : [])))
        }));
        
        // Filter to specific vendor if vendorId is provided (vendor profile mode)
        if (vendorId) {
          byStyleProviders = byStyleProviders.filter((p: any) => 
            (p.providerId || p.vendorId || p.id) === vendorId
          );
        }
        
        // ✅ NEW: Apply promotions to services in providerData
        const enrichedProviders = await Promise.all(
          byStyleProviders.map(async (p: any) => {
            if (p.services && Array.isArray(p.services)) {
              const enrichedServices = await Promise.all(
                p.services.map(async (s: any) => {
                  const basePrice = s.price || 0;
                  let finalPrice = basePrice;
                  let originalPrice = basePrice;
                  let discountPercentage: number | undefined;
                  let discountAmount: number | undefined;
                  let promotionId: string | undefined;

                  // Check for applicable promotions
                  if (promotions.length > 0) {
                    const applicablePromo = promotions.find((promo: any) => {
                      const appliesToService = !promo.applicable_services || 
                        promo.applicable_services.length === 0 ||
                        promo.applicable_services.includes(s.id || s.serviceId);
                      
                      const appliesToCategory = !promo.applicable_roles || 
                        promo.applicable_roles.length === 0 ||
                        promo.applicable_roles.includes(category);
                      
                      const now = new Date();
                      const startDate = new Date(promo.start_date);
                      const endDate = promo.end_date ? new Date(promo.end_date) : null;
                      const isActive = now >= startDate && (!endDate || now <= endDate);
                      
                      return appliesToService && appliesToCategory && isActive && promo.is_active;
                    });

                    if (applicablePromo) {
                      originalPrice = basePrice;
                      promotionId = applicablePromo.id;
                      
                      if (applicablePromo.discount_type === 'percentage') {
                        discountPercentage = parseFloat(applicablePromo.discount_value || '0');
                        discountAmount = (basePrice * discountPercentage) / 100;
                        if (applicablePromo.max_discount_amount) {
                          discountAmount = Math.min(discountAmount, parseFloat(applicablePromo.max_discount_amount));
                        }
                        finalPrice = Math.max(0, basePrice - discountAmount);
                      } else if (applicablePromo.discount_type === 'fixed') {
                        discountAmount = parseFloat(applicablePromo.discount_value || '0');
                        finalPrice = Math.max(0, basePrice - discountAmount);
                        discountPercentage = Math.round((discountAmount / basePrice) * 100);
                      }
                    }
                  }

                  return {
                    ...s,
                    price: finalPrice,
                    originalPrice: originalPrice !== finalPrice ? originalPrice : undefined,
                    discountPercentage,
                    discountAmount,
                    promotionId,
                  };
                })
              );
              return { ...p, services: enrichedServices };
            }
            return p;
          })
        );

        setProviders(enrichedProviders);
        console.log(`✅ [Grooming] Loaded ${enrichedProviders.length} provider${vendorId ? ' (filtered)' : 's'} with ${serviceStyle} services (by-style)`);
      } else {
        console.warn('⚠️ [Grooming] by-style API returned success=false');
        setProviders([]);
      }
    } catch (error) {
      console.error('❌ [Grooming] Error loading services by style:', error);
        setProviders([]);
    } finally {
      setLoading(false);
    }
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
  const filteredServices = profileProvider?.services || [];
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
      pickCustomerVendorAccountId(profileProvider ?? {}) ||
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

  if (loading) {
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
  if (isProfileView && profileProvider) {
    const salonName = vendor?.business_name || vendor?.name || profileProvider.name;
    const photos = resolveVendorProfileHeroGallery({ facility, vendor, profileProvider });
    const hasPhotos = photos.length > 0;
    const amenities = facility?.amenities || vendor?.amenities || [];
    const address = vendor?.address || facility?.address || profileProvider.address || '';
    const phoneNumber = vendor?.phone || facility?.phone || profileProvider.phone || '';
    const description = vendor?.description || facility?.description || `${salonName} is a professional pet grooming salon offering premium grooming services.`;

    const profileVendorId = String(
      vendorId ?? profileProvider.id ?? pickCustomerVendorAccountId(vendor as Record<string, unknown>) ?? ''
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
            {amenities.length > 0 && (
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
                {amenities.length > 0 && (
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
                                {service.category && (
                                  <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-gray-600">{service.category}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-2xl font-bold text-[#FF8C42] mb-1">{formatPriceWithSymbol(service.price)}</div>
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
          {selectedServices.size > 0 && (
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
              disabled={profileProvider.services.length === 0}
              className="w-full bg-[#FF8C42] hover:bg-[#E67A35] h-12 text-lg text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {selectedServices.size === 0 
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ✅ FIX: Restore Frame UI with ServiceDashboardHeader */}
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

      {/* Unified body panel — matches Pet Boarding pattern (one continuous white surface, no gray gaps) */}
      <div className="flex-1 -mt-4 rounded-t-[1.75rem] bg-white sm:rounded-t-[2rem]">
      {/* Info section */}
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

      {/* Content */}
      <div className="px-4 cw-scroll-pad-tabbar">
        {providers.length === 0 ? (
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
            {/* ✅ FIXED: Filter and Sort Bar with actual filter controls */}
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
              
              {/* ✅ NEW: Filter Controls */}
              <div className="pt-3 border-t border-gray-200 space-y-2">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Filters</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {/* Min Rating Filter */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Min Rating</label>
                    <select
                      value={providerFilter.minRating || ''}
                      onChange={(e) => setProviderFilter({ ...providerFilter, minRating: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                    >
                      <option value="">Any</option>
                      <option value="3">3+ Stars</option>
                      <option value="4">4+ Stars</option>
                      <option value="4.5">4.5+ Stars</option>
                    </select>
                  </div>
                  
                  {/* Max Distance Filter */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Max Distance</label>
                    <select
                      value={providerFilter.maxDistance || ''}
                      onChange={(e) => setProviderFilter({ ...providerFilter, maxDistance: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                    >
                      <option value="">Any</option>
                      <option value="5">Within 5 km</option>
                      <option value="10">Within 10 km</option>
                      <option value="20">Within 20 km</option>
                    </select>
                  </div>
                </div>
                
                {/* Clear Filters Button */}
                {(providerFilter.minRating || providerFilter.maxDistance || providerFilter.specialisation || (providerFilter.amenities && providerFilter.amenities.length > 0)) && (
                  <button
                    onClick={() => setProviderFilter({})}
                    className="w-full text-xs text-[#FF8C42] hover:text-[#E67A35] font-medium py-1"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </Card>
            
            {filteredAndSortedProviders.map((provider) => {
              const expanded = selectedProvider === provider.providerId;
              const headerInteractive = expanded;
              const providerAddress = getProviderAddress(provider);
              return (
              <Card key={provider.providerId} className="bg-white overflow-hidden">
                <div
                  role={headerInteractive ? 'button' : undefined}
                  tabIndex={headerInteractive ? 0 : undefined}
                  className={`p-4 border-b text-left w-full ${headerInteractive ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                  onClick={
                    headerInteractive
                      ? () =>
                          setSelectedProvider(
                            selectedProvider === provider.providerId ? null : provider.providerId
                          )
                      : undefined
                  }
                  onKeyDown={
                    headerInteractive
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedProvider(
                              selectedProvider === provider.providerId ? null : provider.providerId
                            );
                          }
                        }
                      : undefined
                  }
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* Provider Photo or Initial */}
                      {provider.photo ? (
                        <img 
                          src={provider.photo} 
                          alt={provider.name}
                          className="w-12 h-12 rounded-full object-cover border-2 border-[#FF8C42]"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-[#FF8C42] rounded-full flex items-center justify-center text-white font-bold text-lg">
                          {provider.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                          {provider.isVerified && (
                            <Shield className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                        <p className="text-gray-500 text-sm">{getProviderTypeLabel(provider)}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm font-medium">{provider.rating}</span>
                            <span className="text-gray-400 text-sm">({provider.reviewCount} reviews)</span>
                          </div>
                          {provider.city && (
                            <div className="flex items-center gap-1 text-gray-500 text-sm">
                              <MapPin className="w-3 h-3" />
                              {provider.city}
                            </div>
                          )}
                          {provider.distance != null && (
                            <span className="text-xs text-blue-600 font-medium">
                              {Number(provider.distance) < 1
                                ? `${Math.round(Number(provider.distance) * 1000)} m away`
                                : `${Math.round(Number(provider.distance))} km away`}
                            </span>
                          )}
                        </div>
                        {providerAddress && (
                          <div className="flex items-start gap-1 text-gray-500 text-xs mt-1 max-w-[240px]">
                            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-1">{providerAddress}</span>
                          </div>
                        )}
                        {/* ✅ NEW: Amenities display */}
                        {provider.amenities && provider.amenities.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {provider.amenities.slice(0, 3).map((amenity, idx) => (
                              <span key={idx} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                                {amenity}
                              </span>
                            ))}
                            {provider.amenities.length > 3 && (
                              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                                +{provider.amenities.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                        {/* Show experience for staff/individual */}
                        {provider.experienceYears && provider.providerType !== 'vendor' && (
                          <div className="text-xs text-gray-500 mt-1">
                            {provider.experienceYears} years experience
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={`View profile: ${provider.name}`}
                      className="-m-1.5 p-1.5 rounded-full text-gray-400 hover:text-[#FF8C42] hover:bg-orange-50 flex-shrink-0 transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#FF8C42] focus-visible:ring-offset-2"
                      onClick={(e) => openGroomingProviderProfile(e, provider)}
                    >
                      <ChevronRight
                        className={`w-5 h-5 transition-transform ${expanded ? 'rotate-90' : ''}`}
                        aria-hidden
                      />
                    </button>
                  </div>
                </div>

                {/* Services List - Expanded */}
                {expanded && (
                  <div className="bg-gray-50 p-4 space-y-3">
                    {/* Provider details for staff/individual */}
                    {provider.qualifications && (
                      <div className="bg-white rounded-lg p-3 mb-3 border border-orange-100">
                        <div className="text-xs text-gray-500 mb-1">Qualifications</div>
                        <div className="text-sm text-gray-700">{provider.qualifications}</div>
                      </div>
                    )}
                    
                    <h4 className="text-sm font-medium text-gray-600 mb-2">
                      Available Services ({provider.services.length})
                    </h4>
                    {provider.services.length > 0 ? (
                      provider.services.map((service) => {
                        const descTrim = service.description?.trim() ?? '';
                        return (
                          <div
                            key={service.id}
                            className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 space-y-2"
                          >
                            {/* Row 1: name + package badge (left) | price (right) */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                <h5 className="min-w-0 flex-1 truncate font-medium text-gray-900 leading-5">
                                  {service.name}
                                </h5>
                                {service.isPackage && (
                                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 border border-purple-200 shrink-0">
                                    Package
                                  </span>
                                )}
                              </div>
                              <div className="shrink-0 text-right">
                                {service.originalPrice && service.originalPrice > service.price ? (
                                  <>
                                    <div className="text-lg font-bold text-[#FF8C42] tabular-nums">
                                      {formatPriceWithSymbol(service.price)}
                                    </div>
                                    <div className="text-sm text-gray-400 line-through">
                                      {formatPriceWithSymbol(service.originalPrice)}
                                    </div>
                                    {service.discountPercentage && (
                                      <Badge className="bg-green-500 text-white text-xs mt-1">
                                        {service.discountPercentage}% OFF
                                      </Badge>
                                    )}
                                  </>
                                ) : (
                                  <div className="text-lg font-bold text-[#FF8C42] tabular-nums">
                                    {formatPriceWithSymbol(service.price)}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Row 2: description full width */}
                            {descTrim && (
                              <ServiceDescriptionInline
                                description={descTrim}
                                title={service.name}
                                className="m-0 text-sm leading-5 text-gray-500"
                              />
                            )}

                            {/* Row 3: badges (left) | Book Now (right) */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="text-xs shrink-0">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {service.duration} mins
                                </Badge>
                                {service.category && (
                                  <Badge variant="secondary" className="text-xs shrink-0 max-w-full">
                                    {service.category}
                                  </Badge>
                                )}
                              </div>
                              <Button
                                size="sm"
                                className="bg-[#FF8C42] hover:bg-[#E67A35] text-white shrink-0 min-w-[7rem]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectService(provider, service);
                                }}
                              >
                                Book Now
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="bg-white rounded-lg p-4 text-center text-gray-500 text-sm">
                        No services available from this provider
                      </div>
                    )}
                  </div>
                )}

                {!expanded && provider.services.length > 0 && (
                  <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      {provider.services.length} service{provider.services.length !== 1 ? 's' : ''} available
                      {provider.services[0] && (
                        <span className="text-gray-900 font-medium"> from {formatPriceWithSymbol(
                          Math.min(...provider.services.map(s => s.price))
                        )}</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[#FF8C42] border-[#FF8C42] hover:bg-[#FF8C42]/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProvider(provider.providerId);
                      }}
                    >
                      View Services
                    </Button>
                  </div>
                )}
              </Card>
            );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
