'use client';

import React, { useState, useEffect, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Star, MapPin, Clock, Video, Home, Building2, ChevronRight, Filter, Loader2, Shield, User, Heart, Share2, Navigation, Phone, Award, Stethoscope, Check, Search, X, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { ServicePricingDisplay } from '../ServicePricingDisplay'; // ✅ FIX GAP-7.1: Vendor discount display
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import { INDICATIVE_PRICING_NOTE } from '@/lib/pricing-disclaimer';
import { VendorProfileDashboardHeader } from '../shared/VendorProfileDashboardHeader';
import { ServiceDashboardHeader } from '../shared/ServiceDashboardHeader';
import { ServiceDescriptionInline } from '../shared/ServiceDescriptionInline';
import { buildTeleInstantAutoPayBookingUrl } from '@/lib/tele-direct-booking';
import { resolveVendorProfileHeroGallery } from '@/lib/vendor-display-media';
import { VendorHeroPhotoCarousel } from '../shared/VendorHeroPhotoCarousel';
import { getWebVetDiscoveryChevronNavTarget } from '@/lib/customer-vendor-profile-navigation';
import {
  buildWalkerServiceDataForVendorPackagePurchase,
  isVendorServicePackageRow,
} from '@/lib/vendor-package-purchase-nav';
import { VendorRatingDisplay } from '@/components/customer/shared/VendorRatingDisplay';
import { EMPTY_SERVICE_HEADER_STATS } from '@/lib/service-header-stats';
import { pickCustomerVendorAccountId } from '@warmpawz/shared-types';
import { shareVendorProfile } from '@/lib/vendor-profile-share';

interface VetServicesByStyleProps {
  phone: string;
  serviceStyle: string; // 'tele', 'at_home', 'at_center'
  serviceTypeName?: string;
  category?: string;
  vendorId?: string; // Optional: filter to show only this vendor's services (vendor profile mode)
  /** Passed as `specialization` on GET /customer/services/by-style (problem grid / hub filters). */
  specialization?: string;
  /**
   * When embedded (e.g. problem grid), chevron/profile targets use this for doctor + clinic + style-browser return.
   */
  discoveryProfileBackScreen?: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

// Provider can be vendor (for at_center) or staff/individual (for at_home/tele)
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
    originalPrice?: number; // ✅ FIX GAP-7.1: Original price for discount calculation
    vendorDiscount?: number; // ✅ FIX GAP-7.1: Vendor discount percentage
    duration: number;
    description?: string;
    category?: string;
    isPackage?: boolean;
  }[];
}

export function VetServicesByStyle({ 
  phone, 
  serviceStyle, 
  serviceTypeName,
  category = 'vet',
  vendorId,
  specialization,
  discoveryProfileBackScreen,
  onBack, 
  onNavigate 
}: VetServicesByStyleProps) {
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
      
      const phoneParam = phone ? `&customerPhone=${encodeURIComponent(phone)}` : '';
      const specializationParam = specialization
        ? `&specialization=${encodeURIComponent(specialization)}`
        : '';
      const response = await apiClient.get(
        `/customer/services/by-style?style=${serviceStyle}&category=${category}${locationParams}${specializationParam}${phoneParam}`
      ) as any;

      if (response.success) {
        // New API returns 'providers' array, fallback to 'vendors' for backward compatibility
        let providerData = response.providers || response.vendors || [];
        
        // Filter to specific vendor if vendorId is provided (vendor profile mode)
        if (vendorId) {
          providerData = providerData.filter((p: any) => 
            (p.providerId || p.vendorId || p.id) === vendorId
          );
        }
        
        // Set providers from primary endpoint
          setProviders(providerData);
          console.log(`✅ [Vet] Loaded ${providerData.length} provider${vendorId ? ' (filtered)' : 's'} with ${serviceStyle} services`);
      } else {
        console.warn(`⚠️ [Vet] Primary endpoint returned success=false or no providers`);
        setProviders([]);
      }
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
      }

      if (facilityRes?.success) {
        setFacility(facilityRes.facility);
        setRating(facilityRes.rating);
        setReviews(facilityRes.recentReviews || []);
      }
    } catch (error) {
      console.error('Error loading vendor profile:', error);
    }
  };

  const getStyleIcon = () => {
    switch (serviceStyle) {
      case 'tele': return <Video className="w-5 h-5" />;
      case 'at_home': return <Home className="w-5 h-5" />;
      case 'at_center': return <Building2 className="w-5 h-5" />;
      default: return <Video className="w-5 h-5" />;
    }
  };

  const getStyleColor = () => {
    switch (serviceStyle) {
      case 'tele': return 'from-blue-500 to-blue-600';
      case 'at_home': return 'from-orange-500 to-orange-600';
      case 'at_center': return 'from-green-500 to-green-600';
      default: return 'from-blue-500 to-blue-600';
    }
  };

  const getProviderTypeLabel = (provider: Provider) => {
    if (provider.providerType === 'individual') {
      return 'Independent Provider';
    }
    if (provider.providerType === 'staff') {
      return provider.vendorName ? `From ${provider.vendorName}` : 'Clinic Staff';
    }
    return provider.role || 'Provider';
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

  const openVetProviderProfile = (e: MouseEvent, provider: Provider) => {
    e.stopPropagation();
    const { screen, data } = getWebVetDiscoveryChevronNavTarget({
      serviceStyle: String(serviceStyle),
      serviceTypeName,
      category,
      provider: provider as unknown as Record<string, unknown>,
      profileBackScreen: discoveryProfileBackScreen,
    });
    onNavigate(screen, data);
  };

  const handleSelectService = (provider: Provider, service: any) => {
    if (serviceStyle === 'tele') {
      const sid = String(service.id || service.serviceId || '');
      const vid =
        provider.providerType === 'vendor'
          ? provider.providerId
          : provider.vendorId || provider.providerId;
      if (sid) {
        const url = buildTeleInstantAutoPayBookingUrl({
          serviceId: sid,
          vendorId: vid ? String(vid) : undefined,
        });
        if (url) {
          console.log('[VetServicesByStyle] tele Book Now →', url);
          router.push(url);
          return;
        }
      }
    }

    // For staff/individual providers, include staffId in booking data
    const bookingData: any = {
      serviceId: service.id || service.serviceId,
      serviceName: service.name,
      serviceStyle,
      price: service.price,
      duration: service.duration,
      providerName: provider.name,
      /** Full vendor_services row — VetBookingRouter package redirect + booking need metadata / packageDetails */
      service,
      vendorName: provider.vendorName || provider.name,
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
        serviceTypeCategory: 'vet',
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

    onNavigate('vet-booking', bookingData);
  };

  // Filter and sort services for profile view
  const filteredServices = profileProvider?.services || [];
  const sortedServices = [...filteredServices].sort((a, b) => {
    if (sortBy === 'popular') return 0;
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
  // This matches the grooming flow where multiple services can be selected
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
      if (serviceStyle === 'tele' && profileProvider) {
        const only = selectedServicesData[0];
        handleSelectService(profileProvider, only);
        return;
      }

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
            serviceTypeCategory: 'vet',
            serviceStyle,
          });
          if (pkgNav) {
            onNavigate('purchase-package', pkgNav);
            return;
          }
        }
      }

      // ✅ FIX: Pass all selected services, not just the first one
      // Build booking data similar to GroomingServicesByStyle
      const firstService = selectedServicesData[0];
      const bookingData: any = {
        vendorId: profileProvider!.providerId || profileProvider!.vendorId,
        vendorName: profileProvider!.vendorName || profileProvider!.name,
        serviceStyle,
        selectedServices: selectedServicesData, // ✅ Pass array of selected services
        // Also include first service for backward compatibility
        serviceId: firstService?.id || firstService?.serviceId,
        serviceName: firstService?.name,
        price: totalPrice, // Total price of all selected services
        duration: selectedServicesData.reduce((sum, s) => sum + (s?.duration || 0), 0),
        service: firstService,
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

      onNavigate('vet-booking', bookingData);
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
      title: profileProvider?.name || 'Vet Provider',
      text: `Check out ${profileProvider?.name || 'this vet provider'} on Warmpawz`,
      vendorId: String(shareVendorId),
      persona: 'vet',
      vendorName: profileProvider?.name,
      serviceStyle,
    });
  };

  if (loading) {
    return (
      <div
        className={`flex min-h-[100dvh] min-h-screen w-full items-center justify-center bg-white ${vendorId ? 'max-w-customer mx-auto' : 'max-w-md mx-auto'}`}
      >
        <div className="text-center px-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#FF8C42] mx-auto mb-3" />
          <p className="text-gray-600">Loading {vendorId ? 'provider profile' : 'available services'}...</p>
        </div>
      </div>
    );
  }

  // Profile View Mode - Zomato-style for vet provider (tele/at_home/at_center)
  if (isProfileView && profileProvider) {
    const providerName = vendor?.business_name || vendor?.name || profileProvider.name;
    const photos = resolveVendorProfileHeroGallery({ facility, vendor, profileProvider });
    const hasPhotos = photos.length > 0;
    const amenities = facility?.amenities || vendor?.amenities || [];
    const address = vendor?.address || facility?.address || profileProvider.address || '';
    const phoneNumber = vendor?.phone || facility?.phone || profileProvider.phone || '';
    const description = vendor?.description || facility?.description || `${providerName} provides professional veterinary services.`;
    const profileServiceSubtitle =
      serviceStyle === 'tele'
        ? 'Tele Consultation'
        : serviceStyle === 'at_home'
          ? 'Home Visit'
          : 'Clinic Visit';

    const profileHeaderTitle =
      serviceStyle === 'at_center'
        ? 'Vet Clinic'
        : serviceStyle === 'at_home'
          ? 'Home Visit'
          : serviceStyle === 'tele'
            ? 'Tele Consultation'
            : serviceTypeName || 'Veterinary Services';
    const profileHeaderSubtitle =
      serviceStyle === 'at_center'
        ? 'Visit our veterinary clinics'
        : serviceStyle === 'at_home'
          ? 'Vet comes to you'
          : serviceStyle === 'tele'
            ? 'Video consultation with vet'
            : 'Professional pet healthcare';
    const profileVendorId = String(
      vendorId ?? profileProvider.id ?? pickCustomerVendorAccountId(vendor as Record<string, unknown>) ?? ''
    ).trim();

    return (
      <div className="mx-auto flex min-h-[100dvh] min-h-screen w-full max-w-customer flex-col overflow-x-hidden bg-gray-50">
        {/*
          Same as CustomerHomeComplete: `rounded-t-[24px] -mt-3` on the block below a flat
          orange header so the “bow” is the rounded top of the next surface (image here, white on home).
        */}
        <VendorProfileDashboardHeader
          fullWidth
          className="!z-0 isolation-auto"
          serviceName={profileHeaderTitle}
          serviceSubtitle={profileHeaderSubtitle}
          serviceIcon={Stethoscope}
          iconColor="text-white"
          onBack={onBack}
          showBackButton={true}
          bottomEdge="flat"
        />
        <div className="relative z-0 w-full flex-1">
        {hasPhotos ? (
          <div className="relative w-full -mt-3 sm:-mt-3">
            <div className="overflow-hidden rounded-t-[24px] bg-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] sm:rounded-t-[28px]">
              <VendorHeroPhotoCarousel
                photos={photos}
                name={providerName}
                frameClassName="relative aspect-[5/4] w-full max-h-[420px] overflow-hidden sm:aspect-auto sm:h-[280px] sm:max-h-none"
              />
            </div>
          </div>
        ) : (
          <div className="relative w-full -mt-3 sm:-mt-3">
            <div className="overflow-hidden rounded-t-[24px] sm:rounded-t-[28px]">
          <div className="relative flex aspect-[5/4] w-full max-h-[420px] items-center justify-center bg-gradient-to-br from-[#FF8C42] to-[#FF7029] sm:aspect-auto sm:h-[280px] sm:max-h-none">
            <div className="text-center text-white">
              {serviceStyle === 'tele' ? (
                <Video className="w-20 h-20 mx-auto mb-3 opacity-50" />
              ) : serviceStyle === 'at_home' ? (
                <Home className="w-20 h-20 mx-auto mb-3 opacity-50" />
              ) : (
                <Building2 className="w-20 h-20 mx-auto mb-3 opacity-50" />
              )}
              <p className="text-sm opacity-75">No photos available</p>
            </div>
          </div>
            </div>
          </div>
        )}

        <div className="px-4 pb-32">
          {/* Provider Header Info - Vet-Focused */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4 -mt-6 relative z-10">
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{providerName}</h1>
              
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
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
                  {serviceStyle === 'tele' ? (
                    <Video className="w-4 h-4 text-[#FF8C42]" />
                  ) : serviceStyle === 'at_home' ? (
                    <Home className="w-4 h-4 text-[#FF8C42]" />
                  ) : (
                    <Building2 className="w-4 h-4 text-[#FF8C42]" />
                  )}
                  <span className="text-sm font-medium text-gray-700">
                    {serviceStyle === 'tele' ? 'Tele Consultation' : serviceStyle === 'at_home' ? 'Home Visit' : 'Clinic Visit'}
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
              {address && serviceStyle !== 'tele' && (
                <button 
                  onClick={() => {
                    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
                  }}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
                >
                  <Navigation className="w-5 h-5 text-[#FF8C42] group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-medium text-gray-700">Directions</span>
                </button>
              )}
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
              {address && serviceStyle !== 'tele' && (
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 leading-relaxed">{address}</span>
                </div>
              )}
              {serviceStyle === 'tele' && (
                <div className="flex items-center gap-3 text-sm">
                  <Video className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700">Video Consultation Available</span>
                </div>
              )}
            </div>

            {/* Amenities/Features */}
            {amenities.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Features</h3>
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
          <div className="sticky top-0 z-40 flex overflow-hidden rounded-t-2xl border-b-2 border-gray-200 bg-white shadow-sm">
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
                    <Stethoscope className="w-5 h-5 text-[#FF8C42]" />
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

                {/* Qualifications */}
                {profileProvider.qualifications && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Qualifications</h3>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                      <div className="flex items-start gap-3">
                        <Award className="w-5 h-5 text-blue-500 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-700 font-medium mb-1">Professional Credentials</p>
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

                {/* Get Directions CTA (only for at_home/at_center) */}
                {address && serviceStyle !== 'tele' && (
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
                      placeholder="Search vet services..."
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
                          <div className="flex w-full min-w-0 items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h4 className="font-bold text-gray-900 text-base break-words">{service.name}</h4>
                                {(isVendorServicePackageRow(service as any) || (service as any).isPackage) && (
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
                              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                <span className="flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-lg">
                                  <Clock className="w-3.5 h-3.5 text-gray-600" />
                                  {service.duration} mins
                                </span>
                                {service.category && (
                                  <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-gray-600">{service.category}</span>
                                )}
                              </div>
                            </div>
                            <div className="ml-2 flex w-[7.25rem] shrink-0 flex-col items-end text-right">
                              {/* ✅ FIX GAP-7.1: Use ServicePricingDisplay for vendor discount */}
                              <ServicePricingDisplay
                                basePrice={service.originalPrice || service.price}
                                vendorDiscount={service.vendorDiscount}
                                className="mb-1"
                              />
                              <p className="mt-0.5 w-full text-[11px] leading-4 text-gray-500 break-words">{INDICATIVE_PRICING_NOTE}</p>
                              {isSelected && (
                                <div className="mt-1 flex w-full justify-end">
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
                    <Stethoscope className="w-16 h-16 text-gray-300 mx-auto mb-4" />
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
                    <p className="text-sm text-gray-500">Be the first to review this provider!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Fixed bottom bar — same width as app column (mobile shell) */}
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center">
          <div className="pointer-events-auto w-full max-w-customer border-t border-gray-200 bg-white shadow-lg pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          {selectedServices.size > 0 && (
            <div className="border-b border-orange-100 bg-orange-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {selectedServices.size} service{selectedServices.size > 1 ? 's' : ''} selected
                  </p>
                  <p className="text-lg font-bold text-orange-600">{formatPriceWithSymbol(totalPrice)}</p>
                </div>
                <button
                  onClick={() => setSelectedServices(new Set())}
                  className="text-sm font-medium text-orange-600 hover:text-orange-700"
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
              className="h-12 w-full bg-[#FF8C42] text-base text-white hover:bg-[#E67A35] disabled:cursor-not-allowed disabled:bg-gray-300 sm:text-lg"
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
    </div>
  );
  }

  // ✅ FIX: Prepare stats for ServiceDashboardHeader
  const getServiceTitle = () => {
    if (serviceStyle === 'at_center') return 'Vet Clinic';
    if (serviceStyle === 'at_home') return 'Home Visit';
    if (serviceStyle === 'tele') return 'Tele Consultation';
    return serviceTypeName || 'Veterinary Services';
  };
  
  const getServiceSubtitle = () => {
    if (serviceStyle === 'at_center') return 'Visit our veterinary clinics';
    if (serviceStyle === 'at_home') return 'Vet comes to you';
    if (serviceStyle === 'tele') return 'Video consultation with vet';
    return 'Professional pet healthcare';
  };
  
  const listingStats = EMPTY_SERVICE_HEADER_STATS;

  // Listing View Mode (when vendorId not provided or multiple providers)
  return (
    <div className="mx-auto flex min-h-[100dvh] min-h-screen w-full max-w-customer flex-col overflow-x-hidden bg-gray-50">
      <ServiceDashboardHeader
        fullWidth
        serviceName={getServiceTitle()}
        serviceSubtitle={getServiceSubtitle()}
        serviceIcon={Stethoscope}
        iconColor="text-white"
        stats={listingStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
        sheetToneClass="bg-white"
      />

      {/* Unified body panel — matches Pet Boarding pattern (one continuous white surface, no gray gaps) */}
      <div className="flex-1 -mt-4 rounded-t-[1.75rem] bg-white sm:rounded-t-[2rem]">
      {/* Info section */}
      <div className="w-full px-4 sm:px-6 pt-6 pb-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 bg-orange-100 rounded-2xl flex items-center justify-center">
            {getStyleIcon()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{serviceTypeName || 'Services'}</h1>
            <p className="text-gray-600 text-sm">
              {providers.length} provider{providers.length !== 1 ? 's' : ''} available
            </p>
          </div>
        </div>
        
        {/* Info badge for home/tele */}
        {(serviceStyle === 'at_home' || serviceStyle === 'tele') && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm mb-4">
            <div className="flex items-center gap-2 text-blue-900">
              <Shield className="w-4 h-4" />
              <span>All providers are verified and background-checked</span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="w-full px-4 sm:px-6 pb-24">
        {providers.length === 0 ? (
          <Card className="p-8 text-center bg-white">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {getStyleIcon()}
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">No Providers Available</h3>
            <p className="text-gray-500 text-sm mb-4">
              No {serviceStyle === 'at_home' ? 'home visit' : serviceStyle === 'tele' ? 'tele-consultation' : ''} providers are currently available in your area.
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
            {providers.map((provider) => {
              const expanded = selectedProvider === provider.providerId;
              const headerInteractive = expanded;
              const providerAddress = getProviderAddress(provider);
              return (
              <Card key={provider.providerId} className="bg-white overflow-hidden">
                {/* Provider Header — tap collapses when expanded; chevron → profile; View Services → expand */}
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
                  <div className="flex min-w-0 w-full items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      {/* Provider Photo or Initial */}
                      {provider.photo ? (
                        <img 
                          src={provider.photo} 
                          alt={provider.name}
                          className="h-12 w-12 shrink-0 rounded-full border-2 border-[#FF8C42] object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FF8C42] text-lg font-bold text-white">
                          {provider.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
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
                            <span className="text-gray-400 text-sm">({provider.reviewCount})</span>
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
                          <div className="mt-1 flex min-w-0 items-start gap-1 text-xs text-gray-500">
                            <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-gray-400" />
                            <span className="line-clamp-1">{providerAddress}</span>
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
                      onClick={(e) => openVetProviderProfile(e, provider)}
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
                      <div className="bg-white rounded-lg p-3 mb-3 border border-blue-100">
                        <div className="text-xs text-gray-500 mb-1">Qualifications</div>
                        <div className="text-sm text-gray-700">{provider.qualifications}</div>
                      </div>
                    )}
                    
                    <h4 className="text-sm font-medium text-gray-600 mb-2">
                      Available Services ({provider.services.length})
                    </h4>
                    {provider.services.map((service) => (
                      <div
                        key={service.id}
                        className="bg-white rounded-lg p-4 shadow-sm border border-gray-100"
                      >
                        {/* Price + CTA on the right only; left = name, desc, duration/category (same grid as ClinicListView) */}
                        <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_6.25rem] items-start gap-2">
                          <div className="min-w-0 pr-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h5 className="line-clamp-2 break-words font-medium leading-5 text-gray-900">
                                {service.name}
                              </h5>
                              {(isVendorServicePackageRow(service as any) || (service as any).isPackage) && (
                                <span className="shrink-0 rounded-full border border-purple-200 bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                                  Package
                                </span>
                              )}
                            </div>
                            {service.description?.trim() ? (
                              <div onClick={(e) => e.stopPropagation()}>
                                <ServiceDescriptionInline
                                  description={service.description}
                                  title={service.name}
                                  className="m-0 mt-1 text-sm leading-5 text-gray-500 line-clamp-3"
                                />
                              </div>
                            ) : null}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="shrink-0 text-xs">
                                <Clock className="mr-1 h-3 w-3" />
                                {service.duration} mins
                              </Badge>
                              {service.category && (
                                <Badge variant="secondary" className="max-w-full shrink-0 text-xs">
                                  {service.category}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <ServicePricingDisplay
                              basePrice={service.originalPrice || service.price}
                              vendorDiscount={service.vendorDiscount}
                              className="mb-1"
                            />
                            <p className="mb-2 text-[11px] leading-4 text-gray-500 break-words">
                              {INDICATIVE_PRICING_NOTE}
                            </p>
                            <Button
                              size="sm"
                              className="h-8 w-full bg-[#FF8C42] px-2 text-xs font-semibold text-white hover:bg-[#E67A35] sm:h-9 sm:text-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectService(provider, service);
                              }}
                            >
                              Book Now
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Book - when not expanded */}
                {!expanded && provider.services.length > 0 && (
                  <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      {provider.services.length} service{provider.services.length !== 1 ? 's' : ''} available
                      {provider.services[0] && (
                        <span className="text-gray-900 font-medium"> from {formatPriceWithSymbol(
                          Math.min(...provider.services.map(s => {
                            // ✅ FIX GAP-7.1: Use discounted price if available
                            const basePrice = s.originalPrice || s.price;
                            const finalPrice = s.vendorDiscount 
                              ? basePrice * (1 - s.vendorDiscount / 100)
                              : basePrice;
                            return finalPrice;
                          }))
                        )}</span>
                      )}
                      {provider.services[0] && (
                        <p className="mt-0.5 text-xs text-gray-500">{INDICATIVE_PRICING_NOTE}</p>
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
