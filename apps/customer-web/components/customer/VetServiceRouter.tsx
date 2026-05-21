"use client";

import { useState, useEffect, useMemo, type MouseEvent } from 'react';
import { Video, Building2, Home as HomeIcon, Stethoscope, Star, Sparkles, ChevronRight, FlaskConical, Pill, TrendingUp, AlertCircle, Activity, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { urlCustomerPetsByPhonePath } from '@/lib/customer-service-list-urls';
import { toast } from 'sonner';
import { ProblemGridSection, VET_PROBLEMS } from './ProblemGridSection';
import { useProblemGridByRole } from './useProblemGridByRole';
import { FeaturedVendorSpotlights } from './shared/FeaturedVendorSpotlights';
import { ServiceDashboardHeader } from './shared/ServiceDashboardHeader';
import { EMPTY_SERVICE_HEADER_STATS } from '@/lib/service-header-stats';
import { ServiceDescriptionInline } from './shared/ServiceDescriptionInline';
import { StandardizedFooter } from './shared/StandardizedFooter';
import { BoardingVendorExpandableCard } from './boarding/BoardingVendorExpandableCard';
import { useHubVendorDiscovery } from '@/hooks/useHubVendorDiscovery';
import { useDiscoveryCount } from '@/hooks/useDiscoveryCount';
import { formatDiscoveryCountStat } from '@/lib/format-floored-ten-plus';
import { HUB_DISCOVERY_VET } from '@/lib/service-hub-discovery-config';
import { minPriceForVendor } from '@/lib/boarding-vendor-booking-utils';
import {
  type BoardingListVendor,
  type BoardingPlanRow,
  findBoardingListVendorByProfileKey,
} from '@/lib/boarding-vendor-discovery-map';
import { pickCustomerVendorAccountId, pickVetPractitionerProfileEntityId } from '@warmpawz/shared-types';
import type { BoardingServiceSlug } from '@/lib/boarding-service-types';
import {
  buildWalkerServiceDataForVendorPackagePurchase,
  isVendorServicePackageRow,
} from '@/lib/vendor-package-purchase-nav';

interface VetServiceRouterProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  data?: any;
}

/**
 * ✅ FIX: Added pet context validation to prevent crashes (VET-CUST-001)
 * Vet services require a pet to be selected before booking
 */
const HUB_SLUG: BoardingServiceSlug = 'all';

export function VetServiceRouter({ phone, onBack, onNavigate, data }: VetServiceRouterProps) {
  const vetProblems = useProblemGridByRole('vet');
  const {
    loading: vendorsLoading,
    vendors,
    relaxedFilter,
    selectedVendorId,
    setSelectedVendorId,
    toggleVendor,
    fetchingPlansFor,
  } = useHubVendorDiscovery(phone, HUB_DISCOVERY_VET);
  const [spotlightDeals, setSpotlightDeals] = useState<any[]>([]);
  const [allowedServiceStyles, setAllowedServiceStyles] = useState<string[]>([]);
  const [pets, setPets] = useState<any[]>([]);
  const [hasPets, setHasPets] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  // ✅ FIX #13: Track all error states
  
  // User profile data for header
  const [userName, setUserName] = useState('User');
  const [userProfilePhoto, setUserProfilePhoto] = useState<string | undefined>(undefined);

  const [previousVet, setPreviousVet] = useState<any>(null);

  useEffect(() => {
    loadPets();
    loadDashboardConfig();
    loadUserProfile();
    loadPreviousVet();
  }, [phone]);

  const loadPreviousVet = async () => {
    try {
      const response = await apiClient.get<any>(`/customer/${phone}/previous-providers?serviceType=vet`).catch(() => null);
      if (response?.provider) {
        const p = response.provider;
        const prc = Number(p.totalReviews ?? p.reviewCount ?? 0) || 0;
        const praw = p.rating != null ? Number(p.rating) : NaN;
        const pr = prc > 0 && Number.isFinite(praw) && praw > 0 ? praw : 0;
        setPreviousVet({
          id: p.id,
          name: p.businessName || p.name,
          photo: p.photo || null,
          rating: pr,
          lastVisit: p.lastVisit,
          sessionsCount: p.sessionsCount || 1
        });
      } else {
        const packagesResponse = await apiClient.get<any>(`/customer/${phone}/packages?serviceType=vet`).catch(() => null);
        if (packagesResponse?.packages?.length > 0) {
          const pkg = packagesResponse.packages[0];
          if (pkg.vendorId && pkg.vendorName) {
            setPreviousVet({ id: pkg.vendorId, name: pkg.vendorName, photo: null, rating: 0, lastVisit: pkg.lastUsed || '3 weeks ago', sessionsCount: pkg.sessionsUsed || 1 });
          }
        }
      }
    } catch { /* ignore */ }
  };
  
  const loadUserProfile = async () => {
    try {
      const profileResponse = await apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`) as any;
      if (profileResponse?.profile || profileResponse) {
        const profile = profileResponse.profile || profileResponse;
        setUserName(profile.name || profile.fullName || 'User');
        setUserProfilePhoto(profile.profilePhoto || profile.profile_image_url || profile.photo);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadPets = async () => {
    try {
      const petsData = await apiClient.get(urlCustomerPetsByPhonePath(phone)) as any;
      const petsList = petsData?.pets || [];
      setPets(petsList);
      setHasPets(petsList.length > 0);
    } catch (err: any) {
      console.error('Error loading pets:', err);
      setError('Failed to load pets. Please try again.');
      setHasPets(false);
    }
  };

  const {
    data: vetClinicCount = 0,
    isLoading: vetClinicCountLoading,
    isFetching: vetClinicCountFetching,
    isError: vetClinicCountError,
  } = useDiscoveryCount({
    phone,
    serviceStyle: 'at_center',
    category: 'vet',
  });

  const vetClinicBadgeText = useMemo(() => {
    const st =
      vetClinicCountLoading || vetClinicCountFetching
        ? 'loading'
        : vetClinicCountError
          ? 'error'
          : 'success';
    const n = formatDiscoveryCountStat(vetClinicCount, st);
    return `${n} Clinics`;
  }, [vetClinicCountLoading, vetClinicCountFetching, vetClinicCountError, vetClinicCount]);

  const loadDashboardConfig = async () => {
    try {
      // Get customer's role
      const profile = await apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`).catch(() => null);
      const profileData = profile as any;
      const roleId = profileData?.profile?.role_id || profileData?.role_id || profileData?.roleId || 'veterinarian';
      
      // Fetch dashboard config
      const config = await apiClient.get(`/config/ui/dashboard?roleId=${roleId}`).catch(() => null);
      
      if (config && (config as any).success) {
        const configData = (config as any).config;
        const buttons = configData.buttons || configData.widgets || [];
        
        // Find vet-related button
        const vetButton = buttons.find((btn: any) => 
          btn.id?.includes('vet') || 
          btn.serviceId === 'vet' ||
          btn.label?.toLowerCase().includes('vet') ||
          btn.label?.toLowerCase().includes('consultation')
        );
        
        if (vetButton?.allowedServiceStyles && vetButton.allowedServiceStyles.length > 0) {
          setAllowedServiceStyles(vetButton.allowedServiceStyles);
        }
      }
    } catch (error) {
      console.error('Error loading dashboard config:', error);
    }
  };

  // Map service types to dashboard config styles
  const serviceTypeStyleMap: Record<string, string[]> = {
    'tele': ['tele', 'video_consultation', 'video'],
    'home': ['at_home', 'home_visit'],
    'clinic': ['at_clinic', 'at_center', 'clinic'],
    'lab': ['lab', 'diagnostics'],
    'medicine': ['pharmacy', 'medicine'],
    'physiotherapy': ['at_center', 'at_home', 'physiotherapy', 'rehabilitation'],
  };

  const serviceTypes = useMemo(() => {
    const allServiceTypes = [
      {
        id: 'tele',
        name: 'Tele Consultation',
        description: 'Video call with vets',
        icon: Video,
        color: '#FF8C42',
        bgColor: 'bg-orange-50',
        badge: '24/7 Available'
      },
      {
        id: 'clinic',
        name: 'Clinic Visit',
        description: 'Book appointment',
        icon: Building2,
        color: '#7FD47F',
        bgColor: 'bg-green-50',
        badge: vetClinicBadgeText,
      },
      {
        id: 'home',
        name: 'Home Visit',
        description: 'Vet comes to you',
        icon: HomeIcon,
        color: '#FF8C42',
        bgColor: 'bg-orange-50',
        badge: 'Track Live'
      },
      {
        id: 'lab',
        name: 'Lab Tests',
        description: 'Sample collection',
        icon: FlaskConical,
        color: '#9F7FFF',
        bgColor: 'bg-purple-50',
        badge: 'Digital Reports'
      },
      {
        id: 'medicine',
        name: 'Medicine',
        description: 'Order medicines',
        icon: Pill,
        color: '#FF6B9F',
        bgColor: 'bg-pink-50',
        badge: 'Fast Delivery',
        comingSoon: true,
      },
      {
        id: 'physiotherapy',
        name: 'Physiotherapy',
        description: 'Rehabilitation & follow-up',
        icon: Activity,
        color: '#0D9488',
        bgColor: 'bg-teal-50',
        badge: 'Follow-up care',
        comingSoon: true,
      }
    ];

    if (!allowedServiceStyles || allowedServiceStyles.length === 0) {
      return allServiceTypes;
    }

    return allServiceTypes.filter(service => {
      const styleMap = serviceTypeStyleMap[service.id] || [];
      return styleMap.some(style => 
        allowedServiceStyles.some(allowed => 
          allowed.toLowerCase().includes(style.toLowerCase()) ||
          style.toLowerCase().includes(allowed.toLowerCase())
        )
      );
    });
  }, [allowedServiceStyles, vetClinicBadgeText]);

  // ✅ FIX: Validate pet context before allowing navigation
  const handleNavigate = (screen: string, navData?: any) => {
    console.log('🔵 [VetServiceRouter] handleNavigate called:', screen, navData);
    
    // Booking flows only — browsing vet list / profiles / services-by-style must work without a pet.
    const requiresPet = ['vet-booking', 'vet-clinic-booking'].includes(screen);
    
    if (requiresPet && (!hasPets || pets.length === 0)) {
      console.warn('⚠️ [VetServiceRouter] Pet required but not found');
      toast.error('Please add a pet first before booking vet services');
      onNavigate('pets', { action: 'add' });
      return;
    }
    
    try {
      console.log('🔵 [VetServiceRouter] Calling onNavigate with:', screen);
      if (typeof onNavigate !== 'function') {
        console.error('❌ [VetServiceRouter] onNavigate is not a function:', typeof onNavigate);
        toast.error('Navigation error. Please refresh the page.');
        return;
      }
      onNavigate(screen, navData);
      console.log('✅ [VetServiceRouter] Navigation successful');
    } catch (err: any) {
      console.error('❌ [VetServiceRouter] Navigation error:', err);
      toast.error('Failed to navigate. Please try again.');
    }
  };

  const handleVetBookPlan = (v: BoardingListVendor, plan: BoardingPlanRow) => {
    const raw = (v.raw || {}) as Record<string, unknown>;
    const providerType = String(raw.providerType || raw.provider_type || '').toLowerCase();

    const serviceObj: Record<string, unknown> = {
      /** Prefer vendor_services UUID over composite row keys so package purchase resolves strict intent in prod. */
      id: plan.vendorServiceId ?? plan.rowId,
      vendorServiceId: plan.vendorServiceId,
      serviceId: plan.serviceId,
      serviceName: plan.name,
      name: plan.name,
      price: plan.price,
      duration: plan.duration,
      serviceStyle: plan.serviceStyle,
      description: plan.description,
      isPackage: plan.isPackage,
      packageDetails: plan.packageDetails,
      metadata: plan.metadata,
    };

    /** Solo / staff practitioner — doctor profile + booking */
    if (providerType === 'staff' || providerType === 'individual') {
      const doctorId =
        pickVetPractitionerProfileEntityId(raw) ||
        String(raw.providerId || raw.provider_id || v.id);
      const vendorForPkg = String(raw.vendorId || raw.vendor_id || doctorId || '').trim();
      if (isVendorServicePackageRow(serviceObj) && vendorForPkg) {
        const pkgNav = buildWalkerServiceDataForVendorPackagePurchase({
          vendorId: vendorForPkg,
          vendorName: v.name,
          serviceRow: serviceObj,
          serviceTypeCategory: 'vet',
          serviceStyle: String(plan.serviceStyle || 'at_center'),
        });
        if (pkgNav) {
          handleNavigate('purchase-package', pkgNav);
          return;
        }
      }
      handleNavigate('vet-doctor-details', {
        doctorId,
        serviceId: plan.rowId,
        serviceName: plan.name,
        price: plan.price,
      });
      return;
    }

    /** Facility / clinic vendor */
    const vendorId = String(
      pickCustomerVendorAccountId(raw) || raw.vendorId || raw.vendor_id || v.id || ''
    ).trim();

    if (vendorId && isVendorServicePackageRow(serviceObj)) {
      const pkgNav = buildWalkerServiceDataForVendorPackagePurchase({
        vendorId,
        vendorName: v.name,
        serviceRow: serviceObj,
        serviceTypeCategory: 'vet',
        serviceStyle: String(plan.serviceStyle || 'at_center'),
      });
      if (pkgNav) {
        handleNavigate('purchase-package', pkgNav);
        return;
      }
    }

    handleNavigate('vet-booking', {
      vendorId,
      vendorName: v.name,
      serviceId: plan.rowId,
      serviceName: plan.name,
      price: plan.price,
      duration: plan.duration,
      serviceStyle: plan.serviceStyle || 'at_center',
      serviceType: 'at_center',
      service: serviceObj,
    });
  };

  /**
   * Chevron + "Details" should open the real provider profile: doctor screen for staff/individual,
   * clinic/center screen for facility vendors. Uses `raw.vendorId` when the card key is not the clinic id.
   */
  const openVetProviderProfile = (e: MouseEvent, profileKey: string) => {
    e.stopPropagation();
    const v = findBoardingListVendorByProfileKey(vendors, profileKey);
    if (!v) {
      toast.error('Could not open this profile. Try View Services or refresh.');
      return;
    }
    const raw = (v.raw || {}) as Record<string, unknown>;
    const providerType = String(raw.providerType || raw.provider_type || '').toLowerCase();
    const rawVendorId = String(raw.vendorId || raw.vendor_id || '').trim();
    const rawProviderId = String(raw.providerId || raw.provider_id || '').trim();

    if (providerType === 'staff' || providerType === 'individual') {
      const doctorId =
        pickVetPractitionerProfileEntityId(raw) || rawProviderId || v.id;
      handleNavigate('vet-doctor-details', {
        doctorId,
        doctorProfileBackScreen: 'vet',
      });
      return;
    }

    const clinicVendorId =
      pickCustomerVendorAccountId(raw) || rawVendorId || v.id;
    handleNavigate('vet-services-by-style', {
      vendorId: clinicVendorId,
      serviceStyle: 'at_center',
      serviceTypeName: 'Vet Clinic',
      category: 'vet',
      returnScreen: 'vet',
    });
  };

  const openVetDetails = openVetProviderProfile;

  const openVetCenterProfile = openVetProviderProfile;

  const dashboardStats = EMPTY_SERVICE_HEADER_STATS;

  if (vendorsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <>
        <div className="px-6 pt-8">
          <Card className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Unable to Load</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={loadPets} variant="outline">
                Retry Pets
              </Button>
            </div>
          </Card>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ position: 'relative', zIndex: 0 }}>
      {/* ✅ FIX: Restore Frame UI with ServiceDashboardHeader */}
      <ServiceDashboardHeader
        fullWidth
        serviceName="Veterinary Services"
        serviceSubtitle="Professional pet healthcare"
        serviceIcon={Stethoscope}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
        sheetToneClass="bg-gray-50"
      />

      {/* Main Content — negative margin pulls body under the sheet curve */}
      <div className="max-w-customer mx-auto -mt-4 px-4 pt-6 pb-24" style={{ position: 'relative', zIndex: 1 }}>
        {/* Phase 0.1: Promotion Banner Component */}
        <div className="mb-6 space-y-4">
          <FeaturedVendorSpotlights service="vet" onNavigate={onNavigate} />
        </div>

        {/* Phase 1: Book again with previous vet */}
        {previousVet && (
          <div className="mb-6 space-y-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-bold text-slate-900">Book again</h2>
            </div>
            <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 p-4">
              <div className="flex items-center gap-4">
                {previousVet.photo ? (
                  <img src={previousVet.photo} alt={previousVet.name} className="w-16 h-16 rounded-xl object-cover border-2 border-orange-200" />
                ) : (
                  <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 font-bold text-xl border-2 border-orange-200">
                    {previousVet.name?.charAt(0) || 'V'}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 text-lg">{previousVet.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                    <div className="flex items-center gap-1 text-orange-600 font-bold">
                      <Star className="w-4 h-4 fill-orange-500" />
                      {previousVet.rating}
                    </div>
                    <span>•</span>
                    <span>Last visit: {previousVet.lastVisit || '3 weeks ago'}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{previousVet.sessionsCount || 1} visit(s) with you</p>
                </div>
                <Button
                  className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
                  onClick={() => handleNavigate('vet-booking', { vendorId: previousVet.id })}
                >
                  Book Now
                </Button>
              </div>
            </Card>
          </div>
        )}
        
        {/* Legacy Spotlight Banners - Fallback if no promotions */}
        {false && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-[#FF8C42]" />
            <h2 className="text-lg font-semibold">Spotlight Offers</h2>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6">
            {/* First Consultation Offer - WHITE BACKGROUND */}
            <Card className="min-w-[280px] flex-shrink-0 bg-white border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge className="bg-blue-100 text-blue-600 border-none mb-2">Limited Time</Badge>
                  <div className="text-3xl font-bold text-blue-600 mb-1">50% OFF</div>
                  <div className="text-gray-700 text-sm">First Tele Consultation</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl">
                  <Video className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-sm">
                  <span className="line-through text-gray-400">₹599</span>
                  <span className="ml-2 font-bold text-lg text-gray-900">₹299</span>
                </div>
                <Button 
                  size="sm" 
                  className="bg-blue-600 text-white hover:bg-blue-700 h-8"
                  onClick={() => handleNavigate('vet-tele-consultation')}
                >
                  Book Now
                </Button>
              </div>
            </Card>

            {/* Free Lab Tests Offer - WHITE BACKGROUND */}
            <Card className="min-w-[280px] flex-shrink-0 bg-white border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge className="bg-purple-100 text-purple-600 border-none mb-2">New</Badge>
                  <div className="text-3xl font-bold text-purple-600 mb-1">FREE</div>
                  <div className="text-gray-700 text-sm">Home Sample Collection</div>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl">
                  <FlaskConical className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-sm text-gray-600">On orders above ₹999</div>
                <Button 
                  size="sm" 
                  className="bg-purple-600 text-white hover:bg-purple-700 h-8"
                  onClick={() => handleNavigate('vet-lab-tests')}
                >
                  Book Test
                </Button>
              </div>
            </Card>
          </div>
        </div>
        )}

        {/* Service Types */}
        <div className="mb-6">
          <div className="flex items-center mb-3">
            <h2 className="text-lg font-semibold">Choose Service</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-3" style={{ position: 'relative', zIndex: 1 }}>
            {serviceTypes.map((service) => {
              const isComingSoon = !!(service as { comingSoon?: boolean }).comingSoon;

              const handleServiceClick = () => {
                console.log('🔵 [VetServiceRouter] Service clicked:', service.id);
                
                try {
                  // Map service IDs to service styles
                  const styleMap: Record<string, string> = {
                    'tele': 'tele',
                    'home': 'at_home', 
                    'clinic': 'at_center',
                    'lab': 'lab',
                    'medicine': 'medicine'
                  };
                  const serviceStyle = styleMap[service.id] || service.id;
                  
                  // Navigate to dedicated flow for each service type
                  if (service.id === 'clinic') {
                    // Clinic: list of clinics → clinic profile → services → booking
                    console.log('🔵 [VetServiceRouter] Navigating to vet-clinic-list');
                    handleNavigate('vet-clinic-list');
                  } else if (service.id === 'tele') {
                    console.log('🔵 [VetServiceRouter] Navigating to vet-tele-consultation');
                    handleNavigate('vet-tele-consultation');
                  } else if (service.id === 'home') {
                    // ✅ NEW: Home Visit with provider list → profile → booking
                    console.log('🔵 [VetServiceRouter] Navigating to vet-home-visit');
                    handleNavigate('vet-home-visit');
                  } else if (service.id === 'medicine') {
                    // ✅ FIX: Medicine should go to pharmacy store, not booking flow
                    console.log('🔵 [VetServiceRouter] Navigating to pharmacy_store');
                    handleNavigate('pharmacy_store');
                  } else if (service.id === 'lab') {
                    // Lab diagnostics flow
                    console.log('🔵 [VetServiceRouter] Navigating to lab-diagnostics');
                    handleNavigate('lab-diagnostics');
                  } else if (service.id === 'physiotherapy') {
                    // Phase 3: Physiotherapy & rehabilitation – list vets offering follow-up care
                    handleNavigate('vet-services-by-style', {
                      serviceStyle: 'at_center',
                      serviceTypeName: 'Physiotherapy',
                      category: 'vet',
                    });
                  } else {
                    handleNavigate('vet-booking', { serviceType: service.id });
                  }
                } catch (error) {
                  console.error('❌ [VetServiceRouter] Service click error:', error);
                  toast.error('Failed to navigate. Please try again.');
                }
              };

              const cardInner = (
                <>
                  {isComingSoon && (
                    <span className="absolute top-2 right-2 z-[1] text-[10px] font-semibold uppercase tracking-wide text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                      Coming soon
                    </span>
                  )}
                  <div className="flex flex-col h-full">
                    <div
                      className={`w-12 h-12 ${service.bgColor} rounded-xl flex items-center justify-center mb-3`}
                    >
                      <service.icon className="w-6 h-6" style={{ color: service.color }} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{service.name}</h3>
                      {service.description?.trim() ? (
                        <div onClick={(e) => !isComingSoon && e.stopPropagation()} className="mb-2">
                          <ServiceDescriptionInline
                            description={service.description}
                            title={service.name}
                            className="m-0 text-xs leading-snug text-gray-500"
                            linkClassName={
                              isComingSoon
                                ? 'inline align-baseline text-[10px] font-semibold text-gray-400 cursor-default'
                                : 'inline cursor-pointer align-baseline text-[10px] font-semibold text-[#FF8C42] hover:underline'
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                    {service.badge && (
                      <Badge variant="secondary" className="text-xs w-fit">
                        {service.badge}
                      </Badge>
                    )}
                  </div>
                </>
              );

              if (isComingSoon) {
                return (
                  <div
                    key={service.id}
                    className="p-4 border border-gray-100 bg-white shadow-sm rounded-xl relative text-left w-full transition-all cursor-default opacity-80 saturate-75 pointer-events-none select-none"
                    aria-label={`${service.name} — coming soon`}
                    style={{ zIndex: 10, position: 'relative' }}
                  >
                    {cardInner}
                  </div>
                );
              }

              return (
              <button
                key={service.id}
                type="button"
                aria-label={service.name}
                className="p-4 cursor-pointer hover:shadow-md transition-all border border-gray-100 bg-white shadow-sm rounded-xl relative active:scale-95 text-left w-full"
                onClick={(e) => {
                  console.log('🔵 [VetServiceRouter] Card onClick triggered for:', service.id);
                  e.preventDefault();
                  e.stopPropagation();
                  handleServiceClick();
                }}
                onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    console.log('🔵 [VetServiceRouter] Keyboard navigation for:', service.id);
                    handleServiceClick();
                  }
                }}
                style={{ 
                  pointerEvents: 'auto', 
                  userSelect: 'none',
                  zIndex: 10,
                  position: 'relative'
                }}
              >
                {cardInner}
              </button>
              );
            })}
          </div>
        </div>

        {/* Health Problems Grid - Dynamic from specialization_master, fallback to VET_PROBLEMS */}
        <ProblemGridSection
          roleId="veterinarian"
          roleName="Veterinarian"
          title="Consult by Problem"
          icon={Stethoscope}
          problems={vetProblems.length > 0 ? vetProblems : VET_PROBLEMS}
          onNavigate={(screen, data) => {
            console.log('🔵 [Vet] Problem grid navigation:', screen, data);
            handleNavigate(screen, data);
          }}
        />

        {/* Featured Vets — same expandable pattern as vet-all-doctors */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Featured Vets</h2>
            <button 
              className="text-sm text-[#FF8C42] flex items-center gap-1"
              onClick={() => handleNavigate('vet-all-doctors')}
            >
              View All
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {relaxedFilter && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
              Showing all veterinary providers we could match — expand for services and prices.
            </p>
          )}
          <div className="space-y-4">
            {vendors.length > 0 ? (
              vendors.map((v) => {
                const expanded = selectedVendorId === v.id;
                const minP = minPriceForVendor(v);
                return (
                  <BoardingVendorExpandableCard
                    key={v.id}
                    v={v}
                    serviceSlug={HUB_SLUG}
                    planBadgeLabel="Vet"
                    showPriceDisclaimer={true}
                    expanded={expanded}
                    fetchingPlansFor={fetchingPlansFor}
                    minPrice={minP}
                    onToggleHeader={() => toggleVendor(v.id)}
                    onViewServices={(e) => {
                      e.stopPropagation();
                      setSelectedVendorId(v.id);
                    }}
                    onDetails={openVetDetails}
                    onBookPlan={handleVetBookPlan}
                    onOpenCenterDetails={openVetCenterProfile}
                  />
                );
              })
            ) : (
              <Card className="p-6 text-center bg-gray-50 border border-gray-200">
                <p className="text-gray-500 text-sm">No veterinarians available in your area yet.</p>
                <p className="text-gray-400 text-xs mt-1">Check back soon!</p>
              </Card>
            )}
          </div>
        </div>

        {/* What's New */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-[#FF8C42]" />
            <h2 className="text-lg font-semibold">What's New</h2>
          </div>
          
          <div className="space-y-3">
            <Card
              role="button"
              tabIndex={0}
              className="p-4 bg-white border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#FF8C42] focus-visible:ring-offset-2"
              onClick={() => handleNavigate('vet-tele-consultation')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleNavigate('vet-tele-consultation');
                }
              }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Video className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">24/7 Tele Consultation</h3>
                  <p className="text-sm text-gray-600">Connect with vets anytime via video call</p>
                </div>
              </div>
            </Card>

            <Card
              role="button"
              tabIndex={0}
              className="p-4 bg-white border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#FF8C42] focus-visible:ring-offset-2"
              onClick={() => handleNavigate('lab-diagnostics')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleNavigate('lab-diagnostics');
                }
              }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FlaskConical className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Digital Lab Reports</h3>
                  <p className="text-sm text-gray-600">View reports instantly in your pet's health records</p>
                </div>
              </div>
            </Card>

            <Card
              role="button"
              tabIndex={0}
              className="p-4 bg-white border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#FF8C42] focus-visible:ring-offset-2"
              onClick={() => handleNavigate('my-bookings')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleNavigate('my-bookings');
                }
              }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <HomeIcon className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Live Tracking</h3>
                  <p className="text-sm text-gray-600">Track your vet's location for home visits</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Standardized Footer */}
      <StandardizedFooter
        currentTab="home"
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
