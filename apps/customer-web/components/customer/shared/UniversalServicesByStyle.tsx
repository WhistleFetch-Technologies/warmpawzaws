'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Star, MapPin, Clock, Video, Home, Building2, ChevronRight, Filter, Loader2, Shield, User, Heart, Share2, Navigation, Phone, Award, Stethoscope, Check, Search, X, TrendingUp, GraduationCap, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { ServicePricingDisplay } from '../ServicePricingDisplay'; // ✅ FIX GAP-7.1: Vendor discount display
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import { getRoleConfig, RoleId, ServiceStyle } from './roleConfig';
import { ServiceDashboardHeader } from './ServiceDashboardHeader';
import { ServiceDescriptionInline } from './ServiceDescriptionInline';
import { buildTeleInstantAutoPayBookingUrl } from '@/lib/tele-direct-booking';

interface UniversalServicesByStyleProps {
  phone: string;
  roleId: RoleId; // ✅ NEW: Role ID for universal component
  serviceStyle: ServiceStyle; // 'tele', 'at_home', 'at_center'
  serviceTypeName?: string;
  category?: string;
  vendorId?: string; // Optional: filter to show only this vendor's services (vendor profile mode)
  specialization?: string; // ✅ RULE 2 FIX: Specialization filter from problem grid
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  bookingScreen?: string; // ✅ NEW: Screen name for booking (e.g., 'vet-booking', 'grooming-booking')
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
  nextAvailableSlot?: string;
  specialization?: string;
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
    inActivePackage?: boolean;
  }[];
}

export function UniversalServicesByStyle({ 
  phone,
  roleId,
  serviceStyle, 
  serviceTypeName,
  category,
  vendorId,
  specialization,
  onBack, 
  onNavigate,
  bookingScreen = 'booking' // Default booking screen
}: UniversalServicesByStyleProps) {
  const router = useRouter();
  const config = getRoleConfig(roleId);
  const finalCategory = category || config.category;
  const RoleIcon = config.icon;
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  
  // Profile view state (when vendorId is provided)
  const [vendor, setVendor] = useState<any>(null);
  const [facility, setFacility] = useState<any>(null);
  const [rating, setRating] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
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
  }, [serviceStyle, vendorId, specialization]); // ✅ RULE 2 FIX: Reload when specialization changes

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
      
      // ✅ CRITICAL FIX: Different endpoints for different service styles
      // Rule 1: at_center (clinic) uses /customer/services/by-style (returns clinic profiles with services)
      // Rule 2 & 3: at_home/tele use /customer/discover-services (returns solo vendors and staff only)
      
      if (serviceStyle === 'at_center') {
        // ✅ CLINIC FLOWS: Use original endpoint that returns clinic profiles with services
        const specializationParam = specialization 
          ? `&specialization=${encodeURIComponent(specialization)}` 
          : '';
        const phoneParam = phone ? `&customerPhone=${encodeURIComponent(phone)}` : '';
        
        const response = await apiClient.get(
          `/customer/services/by-style?style=${serviceStyle}&category=${category}${locationParams}${specializationParam}${phoneParam}`
        ) as any;

        if (response.success) {
          // API returns 'providers' or 'vendors' array with services already included
          let providerData = response.providers || response.vendors || [];
          
          // Filter to specific vendor if vendorId is provided (vendor profile mode)
          if (vendorId) {
            providerData = providerData.filter((p: any) => 
              (p.providerId || p.vendorId || p.id) === vendorId
            );
          }
          
          // ✅ FIX: Normalize nextAvailableSlot to always be a string
          // Handle all possible field names: nextAvailable (API), nextAvailableSlot, nextAvailability
          providerData = providerData.map((p: any) => {
            // ✅ FIX: Map photoUrl to photo for frontend compatibility
            if (!p.photo && p.photoUrl) {
              p.photo = p.photoUrl;
            }
            
            // Priority 1: nextAvailable (returned by by-style API)
            if (p.nextAvailable && typeof p.nextAvailable === 'object') {
              p.nextAvailableSlot = p.nextAvailable.display || p.nextAvailable.formattedDisplay || 
                (p.nextAvailable.date && p.nextAvailable.time 
                  ? `${p.nextAvailable.date} ${p.nextAvailable.time}` 
                  : undefined);
            } else if (typeof p.nextAvailable === 'string') {
              p.nextAvailableSlot = p.nextAvailable;
            }
            // Priority 2: nextAvailableSlot (if already set as object, normalize to string)
            if (!p.nextAvailableSlot && p.nextAvailableSlot && typeof p.nextAvailableSlot === 'object') {
              p.nextAvailableSlot = p.nextAvailableSlot.formattedDisplay || p.nextAvailableSlot.display || 
                (p.nextAvailableSlot.date && p.nextAvailableSlot.time 
                  ? `${p.nextAvailableSlot.date} ${p.nextAvailableSlot.time}` 
                  : undefined);
            }
            // Priority 3: nextAvailability (legacy)
            if (!p.nextAvailableSlot && p.nextAvailability && typeof p.nextAvailability === 'object') {
              p.nextAvailableSlot = p.nextAvailability.formattedDisplay || p.nextAvailability.display || 
                (p.nextAvailability.date && p.nextAvailability.time 
                  ? `${p.nextAvailability.date} ${p.nextAvailability.time}` 
                  : undefined);
            } else if (!p.nextAvailableSlot && typeof p.nextAvailability === 'string') {
              p.nextAvailableSlot = p.nextAvailability;
            }
            return p;
          });
          
          setProviders(providerData);
          console.log(`✅ [${config.roleName}] Loaded ${providerData.length} clinic${vendorId ? ' (filtered)' : 's'} with ${serviceStyle} services`);
        } else {
          console.warn(`⚠️ [${config.roleName}] API returned success=false`);
          setProviders([]);
        }
      } else {
        // ✅ HOME/TELE FLOWS: Use discover-services endpoint (solo vendors and staff only)
        // ✅ FIX: Don't pass roleId - it causes filtering issues. Category is sufficient.
        const phoneParam = phone ? `&phone=${encodeURIComponent(phone)}` : '';
        const discoverResponse = await apiClient.get(
          `/customer/discover-services?category=${finalCategory}&serviceStyle=${serviceStyle}${locationParams}${phoneParam}`
        ) as any;
        
        // The endpoint returns providers array (solo vendors and staff)
        const providersData = discoverResponse.providers || discoverResponse.vendors || [];
        
        // For each provider, fetch their services
        const providersWithServices = await Promise.all(
          providersData.map(async (provider: any) => {
            const providerId = provider.id || provider.vendorId || provider.providerId;
            const isStaff = provider.isStaffMember || provider.providerType === 'staff';
            
            // Fetch services for this provider
            let services: any[] = [];
            try {
              const phoneParam = phone ? `&customerPhone=${encodeURIComponent(phone)}` : '';
              if (isStaff) {
                // For staff, services are linked via vendor_services of their vendor
                const vendorId = provider.vendorId || providerId;
                const servicesResponse = await apiClient.get(
                  `/customer/vendor/${vendorId}/services?serviceStyle=${serviceStyle}&category=${finalCategory}${phoneParam}`
                ) as any;
                
                // ✅ FIX: Handle response format correctly - API returns { success: true, services: [...] }
                // API returns { services, packages }; merge both so packages appear in list with isPackage flag
                let servicesArray = [
                  ...(servicesResponse?.services || []),
                  ...(servicesResponse?.packages || []),
                ];
                if (servicesArray.length === 0 && Array.isArray(servicesResponse)) servicesArray = servicesResponse;

                services = servicesArray.map((s: any) => ({
                  id: s.id || s.service_id,
                  serviceId: s.id || s.service_id,
                  name: s.name || s.service_name || `${config.roleName} Service`,
                  price: Number(s.price || s.custom_price || 499),
                  originalPrice: Number(s.price || s.custom_price || 499),
                  vendorDiscount: s.vendor_discount || s.discount || 0,
                  duration: Number(s.duration || s.custom_duration || s.duration_minutes || 30),
                  description: s.description || s.custom_description,
                  category: s.category_name || s.category,
                  isPackage: !!(s.isPackage ?? (s.metadata && (s.metadata as any).isPackage)),
                  inActivePackage: !!s.inActivePackage,
                }));
              } else {
                // For solo vendors, fetch their services
                const servicesResponse = await apiClient.get(
                  `/customer/vendor/${providerId}/services?serviceStyle=${serviceStyle}&category=${finalCategory}${phoneParam}`
                ) as any;

                let servicesArray = [
                  ...(servicesResponse?.services || []),
                  ...(servicesResponse?.packages || []),
                ];
                if (servicesArray.length === 0 && Array.isArray(servicesResponse)) servicesArray = servicesResponse;

                services = servicesArray.map((s: any) => ({
                  id: s.id || s.service_id,
                  serviceId: s.id || s.service_id,
                  name: s.name || s.service_name || `${config.roleName} Service`,
                  price: Number(s.price || s.custom_price || 499),
                  originalPrice: Number(s.price || s.custom_price || 499),
                  vendorDiscount: s.vendor_discount || s.discount || 0,
                  duration: Number(s.duration || s.custom_duration || s.duration_minutes || 30),
                  description: s.description || s.custom_description,
                  category: s.category_name || s.category,
                  isPackage: !!(s.isPackage ?? (s.metadata && (s.metadata as any).isPackage)),
                  inActivePackage: !!s.inActivePackage,
                }));
              }
            } catch (serviceError) {
              console.warn(`⚠️ [${config.roleName}] Could not fetch services for provider ${providerId}:`, serviceError);
              console.warn(`⚠️ [${config.roleName}] Provider details:`, { providerId, isStaff, vendorId: provider.vendorId });
              // ✅ FIX: Return null to filter out providers with no services
              return null;
            }
            
            // ✅ FIX: If no services found, filter out this provider
            if (!services || services.length === 0) {
              console.warn(`⚠️ [${config.roleName}] No services found for provider ${providerId}`);
              return null;
            }
            
            console.log(`✅ [${config.roleName}] Fetched ${services.length} service(s) for provider ${providerId}`);
            
            return {
              providerId: providerId,
              providerType: isStaff ? 'staff' : 'vendor',
              vendorId: provider.vendorId || (isStaff ? null : providerId),
              staffId: isStaff ? providerId : undefined,
              name: provider.businessName || provider.name || config.roleName,
              phone: provider.phone,
              photo: provider.photo || provider.photoUrl, // ✅ Support both photo and photoUrl
              address: provider.address || provider.location,
              city: provider.city,
              role: provider.role,
              experienceYears: provider.experienceYears,
              qualifications: provider.qualifications,
              rating: Number(provider.rating || 4.5),
              reviewCount: Number(provider.reviewCount || 0),
              distance: provider.distance || null,
              isVerified: provider.isVerified,
              isOnline: provider.isOnline ?? provider.is_online,
              isIndividualProvider: provider.isIndividualProvider || !provider.vendorId,
              nextAvailableSlot: (() => {
                // Priority 1: nextAvailable (API returns this field name)
                if (provider.nextAvailable && typeof provider.nextAvailable === 'object') {
                  return provider.nextAvailable.display || provider.nextAvailable.formattedDisplay || 
                    (provider.nextAvailable.date && provider.nextAvailable.time 
                      ? `${provider.nextAvailable.date} ${provider.nextAvailable.time}` 
                      : undefined);
                }
                if (typeof provider.nextAvailable === 'string') {
                  return provider.nextAvailable;
                }
                // If nextAvailableSlot is already a string, use it
                if (typeof provider.nextAvailableSlot === 'string') {
                  return provider.nextAvailableSlot;
                }
                // If nextAvailableSlot is an object, extract formattedDisplay or display
                if (provider.nextAvailableSlot && typeof provider.nextAvailableSlot === 'object') {
                  return provider.nextAvailableSlot.formattedDisplay || provider.nextAvailableSlot.display || 
                    (provider.nextAvailableSlot.date && provider.nextAvailableSlot.time 
                      ? `${provider.nextAvailableSlot.date} ${provider.nextAvailableSlot.time}` 
                      : undefined);
                }
                // If nextAvailability is a string, use it
                if (typeof provider.nextAvailability === 'string') {
                  return provider.nextAvailability;
                }
                // If nextAvailability is an object, extract formattedDisplay or display
                if (provider.nextAvailability && typeof provider.nextAvailability === 'object') {
                  return provider.nextAvailability.formattedDisplay || provider.nextAvailability.display || 
                    (provider.nextAvailability.date && provider.nextAvailability.time 
                      ? `${provider.nextAvailability.date} ${provider.nextAvailability.time}` 
                      : undefined);
                }
                return undefined;
              })(),
              specialization: provider.specialization || provider.specialisation,
              services: services
            };
          })
        );
        
        // ✅ FIX: Filter out null providers first (from catch blocks), then filter by services
        const filteredProviders = providersWithServices
          .filter(p => p !== null && p !== undefined) // Remove null/undefined providers
          .filter(p => p && p.services && Array.isArray(p.services) && p.services.length > 0); // Only keep providers with services
        
        console.log(`✅ [${config.roleName}] Filtered providers: ${filteredProviders.length} out of ${providersWithServices.length} (removed ${providersWithServices.length - filteredProviders.length} with no services)`);
        
        // Filter to specific vendor if vendorId is provided (vendor profile mode)
        let finalProviders = filteredProviders;
        if (vendorId) {
          finalProviders = filteredProviders.filter(p => 
            p.providerId === vendorId || 
            p.vendorId === vendorId || 
            p.staffId === vendorId
          );
        }
        
        setProviders(finalProviders);
        console.log(`✅ [${config.roleName}] Loaded ${finalProviders.length} solo/staff provider${vendorId ? ' (filtered)' : 's'} with ${serviceStyle} services`);
      }
    } catch (error) {
      console.error(`❌ [${config.roleName}] Error loading services by style:`, error);
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

  const handleSelectService = (provider: Provider, service: any) => {
    if (serviceStyle === 'tele' && roleId === 'veterinarian') {
      const sid = String(service.id || service.serviceId || '');
      const vid =
        provider.providerType === 'vendor'
          ? provider.providerId || provider.vendorId
          : provider.vendorId || provider.providerId;
      if (sid) {
        const url = buildTeleInstantAutoPayBookingUrl({
          serviceId: sid,
          vendorId: vid ? String(vid) : undefined,
        });
        console.log('[UniversalServicesByStyle] vet tele Book Now →', url);
        router.push(url);
        return;
      }
    }

    // ✅ FIX: Pass complete service data to booking router
    const bookingData: any = {
      serviceId: service.id || service.serviceId,
      serviceName: service.name || service.serviceName,
      serviceStyle: serviceStyle, // ✅ CRITICAL: Pass service style
      price: service.price || 0,
      duration: service.duration || 30,
      providerName: provider.name,
      // ✅ FIX: Include all service details
      service: {
        id: service.id || service.serviceId,
        serviceId: service.id || service.serviceId,
        name: service.name || service.serviceName,
        price: service.price || 0,
        duration: service.duration || 30,
        description: service.description,
        category: service.category
      }
    };

    if (provider.providerType === 'vendor') {
      bookingData.vendorId = provider.providerId || provider.vendorId;
      bookingData.vendorName = provider.name;
      bookingData.doctorId = provider.providerId; // For compatibility
    } else {
      // Staff or individual provider
      bookingData.staffId = provider.staffId || provider.providerId;
      bookingData.staffName = provider.name;
      bookingData.vendorId = provider.vendorId; // May be null for individual providers
      bookingData.vendorName = provider.vendorName;
      bookingData.isIndividualProvider = provider.isIndividualProvider;
      bookingData.doctorId = provider.staffId || provider.providerId; // For compatibility
    }

    console.log(`✅ [${config.roleName}] Navigating to booking with data:`, bookingData);
    onNavigate(bookingScreen, bookingData);
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

  // ✅ FIX: Pass all selected services to booking (matches vet/grooming flow)
  const handleBookServices = () => {
    if (selectedServices.size === 0) {
      if (profileProvider?.services && profileProvider.services.length > 0) {
        handleSelectService(profileProvider, profileProvider.services[0]);
      }
      return;
    }

    const selectedServicesData = Array.from(selectedServices).map(id => 
      profileProvider?.services.find(s => s.id === id || s.serviceId === id)
    ).filter(Boolean);

    if (selectedServicesData.length > 0) {
      if (
        serviceStyle === 'tele' &&
        roleId === 'veterinarian' &&
        profileProvider
      ) {
        handleSelectService(profileProvider, selectedServicesData[0]);
        return;
      }

      const firstService = selectedServicesData[0];
      const bookingData: any = {
        vendorId: profileProvider!.providerId || profileProvider!.vendorId,
        vendorName: profileProvider!.name,
        serviceStyle,
        selectedServices: selectedServicesData,
        serviceId: firstService?.id || firstService?.serviceId,
        serviceName: firstService?.name,
        price: totalPrice,
        duration: selectedServicesData.reduce((sum, s) => sum + (s?.duration || 0), 0),
        providerName: profileProvider!.name,
        service: firstService, // Backward compatibility
      };
      if (profileProvider!.providerType === 'vendor') {
        bookingData.vendorId = profileProvider!.providerId;
        bookingData.vendorName = profileProvider!.name;
      } else {
        bookingData.staffId = profileProvider!.staffId || profileProvider!.providerId;
        bookingData.staffName = profileProvider!.name;
        bookingData.vendorId = profileProvider!.vendorId;
        bookingData.vendorName = profileProvider!.vendorName;
      }
      onNavigate(bookingScreen, bookingData);
    }
  };

  const totalPrice = Array.from(selectedServices).reduce((sum, id) => {
    const service = profileProvider?.services.find(s => s.id === id || s.serviceId === id);
    return sum + (service?.price || 0);
  }, 0);

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: profileProvider?.name || `${config.roleName} Provider`,
          text: `Check out ${profileProvider?.name || `this ${config.roleName.toLowerCase()} provider`} on Warmpawz`,
          url: window.location.href
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#FF8C42] mx-auto mb-3" />
          <p className="text-gray-600">Loading {vendorId ? 'provider profile' : 'available services'}...</p>
        </div>
      </div>
    );
  }

  // Profile View Mode - Zomato-style for vet provider (tele/at_home/at_center)
  if (isProfileView && profileProvider) {
    const providerName = vendor?.business_name || vendor?.name || profileProvider.name;
    const photos = facility?.photos || vendor?.photos || (profileProvider.photo ? [profileProvider.photo] : []);
    const hasPhotos = photos.length > 0;
    const amenities = facility?.amenities || vendor?.amenities || [];
    const address = vendor?.address || facility?.address || profileProvider.address || '';
    const phoneNumber = vendor?.phone || facility?.phone || profileProvider.phone || '';
    const description = vendor?.description || facility?.description || `${providerName} provides professional ${config.category} services.`;
    const specializationText = facility?.specialization || vendor?.specialization || specialization || `General ${config.roleName} Care`;

    // ✅ FIX: Prepare stats for ServiceDashboardHeader
    const dashboardStats = [
      { value: `${providers.length}+`, label: 'Providers', icon: <RoleIcon className="w-4 h-4" /> },
      { value: '1K+', label: 'Bookings' },
      { value: `${Number(profileProvider.rating).toFixed(1)}`, label: 'Rating', icon: <Star className="w-4 h-4 fill-white" /> }
    ];

    return (
      <div className="min-h-screen bg-gray-50 relative overflow-hidden">
        {/* ✅ FIX: Restore Frame UI with ServiceDashboardHeader */}
        <ServiceDashboardHeader
          serviceName={providerName}
          serviceSubtitle={specializationText}
          serviceIcon={RoleIcon}
          iconColor="text-white"
          stats={dashboardStats}
          onBack={onBack}
          showBackButton={true}
          headerColor="bg-[#FF8C42]"
        />

        {/* Main Content - White Card */}
        <div className="max-w-md mx-auto bg-white relative z-10">

        {/* Large Hero Photo Gallery - Vet Provider Style */}
        {hasPhotos ? (
          <div className="relative w-full bg-gray-200">
            <div className="relative h-[280px] sm:h-[320px] overflow-hidden">
              <img 
                src={photos[selectedPhotoIndex]} 
                alt={providerName} 
                className="w-full h-full object-cover" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              
              {photos.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedPhotoIndex(Math.max(0, selectedPhotoIndex - 1))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-800 shadow-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={selectedPhotoIndex === 0}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setSelectedPhotoIndex(Math.min(photos.length - 1, selectedPhotoIndex + 1))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-800 shadow-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={selectedPhotoIndex === photos.length - 1}
                  >
                    <ArrowLeft className="w-5 h-5 rotate-180" />
                  </button>
                  <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-sm font-medium">
                    {selectedPhotoIndex + 1} / {photos.length}
                  </div>
                </>
              )}
            </div>
            
            {/* Photo thumbnails strip */}
            {photos.length > 1 && photos.length <= 5 && (
              <div className="flex gap-2 p-3 bg-white overflow-x-auto scrollbar-hide">
                {photos.map((photo: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedPhotoIndex(idx)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedPhotoIndex === idx 
                        ? 'border-[#FF8C42] ring-2 ring-[#FF8C42]/30' 
                        : 'border-gray-200 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img 
                      src={photo} 
                      alt={`${providerName} photo ${idx + 1}`} 
                      className="w-full h-full object-cover" 
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="relative w-full h-[280px] bg-gradient-to-br from-[#FF8C42] to-[#FF7029] flex items-center justify-center">
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
        )}

        <div className="max-w-md mx-auto px-4 pb-32">
          {/* Provider Header Info - Vet-Focused */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4 -mt-6 relative z-10">
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{providerName}</h1>
              
              {/* Rating and Reviews */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-1.5 bg-orange-50 px-3 py-1.5 rounded-lg">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-lg text-gray-900">
                    {Number(rating?.averageRating || profileProvider.rating || 4.5).toFixed(1)}
                  </span>
                  <span className="text-gray-600 text-sm">
                    ({rating?.totalReviews || profileProvider.reviewCount || 0} reviews)
                  </span>
                </div>
                
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
                    {config.styleLabels[serviceStyle] || serviceTypeName || 'Service'}
                  </span>
                </div>
                {specializationText && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg">
                    <RoleIcon className="w-4 h-4 text-[#FF8C42]" />
                    <span className="text-sm font-medium text-gray-700">{specializationText}</span>
                  </div>
                )}
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
                    <RoleIcon className="w-5 h-5 text-[#FF8C42]" />
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
                      placeholder={`Search ${config.category} services...`}
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
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {(service as any).isPackage && (
                                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 border border-purple-200">Package</span>
                                  )}
                                  {(service as any).inActivePackage && (
                                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-[#FF8C42] border border-orange-200">In your package</span>
                                  )}
                                </div>
                                {isSelected && (
                                  <span className="px-2.5 py-0.5 bg-green-500 text-white rounded-full text-xs font-semibold flex items-center gap-1 flex-shrink-0">
                                    <Check className="w-3 h-3" />
                                    Selected
                                  </span>
                                )}
                              </div>
                              {service.description?.trim() && (
                                <div className="mb-3" onClick={(e) => e.stopPropagation()}>
                                  <ServiceDescriptionInline
                                    description={service.description!}
                                    title={service.name}
                                    className="m-0 text-sm leading-5 text-gray-600"
                                  />
                                </div>
                              )}
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-lg">
                                  <Clock className="w-3.5 h-3.5 text-gray-600" />
                                  {(service.duration ?? 0)} mins
                                </span>
                                {service.category && (
                                  <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-gray-600">{service.category}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {/* ✅ FIX GAP-7.1: Use ServicePricingDisplay for vendor discount */}
                              <ServicePricingDisplay
                                basePrice={service.originalPrice || service.price}
                                vendorDiscount={service.vendorDiscount}
                                className="mb-1"
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
                ) : (
                  <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <RoleIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
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
                            {Number(rating?.averageRating || profileProvider.rating || 4.5).toFixed(1)}
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

        {/* Fixed Bottom Service Selection Summary & Book Button */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
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
  // ✅ FIX: Prepare stats for ServiceDashboardHeader
  const listingStats = [
    { value: `${providers.length}+`, label: config.roleName === 'Veterinarian' ? 'Vets' : config.roleName === 'Groomer' ? 'Pros' : 'Providers' },
    { value: '1K+', label: 'Bookings' },
    { value: '4.7', label: 'Rating' }
  ];

  const getServiceSubtitle = () => {
    if (serviceStyle === 'at_center') return config.styleDescriptions.at_center;
    if (serviceStyle === 'at_home') return config.styleDescriptions.at_home;
    if (serviceStyle === 'tele') return config.styleDescriptions.tele || 'Video consultation';
    return serviceTypeName || 'Choose a provider';
  };

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      {/* ✅ FIX: Use ServiceDashboardHeader to match vet service UI frame */}
      <ServiceDashboardHeader
        serviceName={config.displayName}
        serviceSubtitle={getServiceSubtitle()}
        serviceIcon={config.icon}
        iconColor="text-white"
        stats={listingStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
      />
      
      {/* Info section */}
      <div className="max-w-md mx-auto px-6 pt-4 pb-2 bg-white">
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
      <div className="max-w-md mx-auto px-4 pb-24">
        {providers.length === 0 ? (
          <Card className="p-8 text-center bg-white">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {getStyleIcon()}
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">No Providers Available</h3>
            <p className="text-gray-500 text-sm mb-4">
              No {config.styleLabels[serviceStyle]?.toLowerCase() || 'service'} providers are currently available in your area.
            </p>
            <Button 
              onClick={onBack}
              variant="outline"
            >
              Try Other Services
            </Button>
          </Card>
        ) : (
          <div className="space-y-4  ">
            {providers.map((provider) => (
              <Card key={provider.providerId} className="bg-white overflow-hidden">
                {/* Provider Header */}
                <div 
                  className="p-4 border-b cursor-pointer hover:bg-gray-50"
                  onClick={() => setSelectedProvider(
                    selectedProvider === provider.providerId ? null : provider.providerId
                  )}
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
                            <span className="text-gray-400 text-sm">({provider.reviewCount})</span>
                          </div>
                          {provider.city && (
                            <div className="flex items-center gap-1 text-gray-500 text-sm">
                              <MapPin className="w-3 h-3" />
                              {provider.city}
                            </div>
                          )}
                          {serviceStyle === 'at_center' && provider.distance != null && (
                            <span className="text-xs text-blue-600 font-medium">
                              {Number(provider.distance).toFixed(1)} km away
                            </span>
                          )}
                        </div>
                        {/* Show experience for staff/individual */}
                        {provider.experienceYears && provider.providerType !== 'vendor' && (
                          <div className="text-xs text-gray-500 mt-1">
                            {provider.experienceYears} years experience
                          </div>
                        )}
                        {provider.specialization && (
                          <Badge variant="secondary" className="text-xs mt-1">{provider.specialization}</Badge>
                        )}
                        {provider.nextAvailableSlot && (
                          <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                            <Clock className="w-3 h-3" />
                            <span>Next: {provider.nextAvailableSlot}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${
                      selectedProvider === provider.providerId ? 'rotate-90' : ''
                    }`} />
                  </div>
                </div>

                {/* Services List - Expanded */}
                {selectedProvider === provider.providerId && (
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
                    {provider.services.map((service) => {
                        return (
                      <div 
                        key={service.id}
                        className="bg-white rounded-lg p-4 shadow-sm border border-gray-100"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="font-medium text-gray-900">{service.name}</h5>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {(service as any).isPackage && (
                                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 border border-purple-200">Package</span>
                                )}
                                {(service as any).inActivePackage && (
                                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-[#FF8C42] border border-orange-200">In your package</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                {(service.duration ?? 0)} mins
                              </Badge>
                              {service.category && (
                                <Badge variant="secondary" className="text-xs">
                                  {service.category}
                                </Badge>
                              )}
                            </div>
                            {service.description?.trim() && (
                              <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                                <ServiceDescriptionInline
                                  description={service.description!}
                                  title={service.name}
                                  className="m-0 text-sm leading-5 text-gray-500"
                                />
                              </div>
                            )}
                          </div>
                          <div className="text-right ml-4 flex-shrink-0">
                            <ServicePricingDisplay
                              basePrice={service.originalPrice || service.price}
                              vendorDiscount={service.vendorDiscount}
                              className="mb-2"
                            />
                            <Button
                              size="sm"
                              className="mt-2 bg-[#FF8C42] hover:bg-[#E67A35] text-white"
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
                    );})}
                  </div>
                )}

                {/* Quick Book - when not expanded */}
                {selectedProvider !== provider.providerId && provider.services.length > 0 && (
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
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[#FF8C42] border-[#FF8C42] hover:bg-[#FF8C42]/10"
                      onClick={() => setSelectedProvider(provider.providerId)}
                    >
                      View Services
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
