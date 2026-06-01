"use client";

import { useState, useEffect, useMemo, type MouseEvent } from 'react';
import Image from 'next/image';
import { Stethoscope, Star, ChevronRight, FlaskConical, TrendingUp, AlertCircle, Home as HomeIcon, Video, PawPrint, RefreshCw, Heart, Pill, Syringe, Dog, Cat, Activity, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { VET_PROBLEMS } from './ProblemGridSection';
import { useProblemGridByRole } from './useProblemGridByRole';
import { ServiceDashboardHeader } from './shared/ServiceDashboardHeader';
import { VetProblemGrid } from './vet/VetProblemGrid';
import { VetServiceCardBackground } from './vet/VetServiceCardBackground';
import { VET_HEADER_BANNER, VET_SERVICE_CARDS } from './vet/constants/vet-hub-assets';
import { EMPTY_SERVICE_HEADER_STATS } from '@/lib/service-header-stats';
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

const VET_HEADER_ICON =
  'fill-none stroke-current [&>path]:fill-none [&>circle]:fill-none [&>rect]:fill-none [&>polygon]:fill-none [&>line]:fill-none';

function VetHeaderBackground() {
  return (
    <>
      {/* Far left */}
      <Syringe className={`absolute -left-0.5 top-2 h-7 w-7 rotate-[32deg] ${VET_HEADER_ICON} sm:h-8 sm:w-8`} strokeWidth={1} />
      <PawPrint className={`absolute left-0 bottom-5 h-8 w-8 -rotate-[18deg] ${VET_HEADER_ICON}`} strokeWidth={1} />
      <Activity className={`absolute left-1 top-[3.5rem] h-6 w-6 rotate-12 ${VET_HEADER_ICON}`} strokeWidth={1} />

      {/* Left band */}
      <Heart className={`absolute left-[6%] top-11 h-9 w-9 rotate-6 ${VET_HEADER_ICON} sm:left-[8%] sm:h-10 sm:w-10`} strokeWidth={1} />
      <Video className={`absolute left-[14%] top-1 h-7 w-7 rotate-[22deg] ${VET_HEADER_ICON}`} strokeWidth={1} />
      <Pill className={`absolute left-[10%] bottom-2 h-8 w-8 -rotate-[24deg] ${VET_HEADER_ICON}`} strokeWidth={1} />

      {/* Center */}
      <Stethoscope className={`absolute left-[32%] top-0 h-14 w-14 -rotate-12 ${VET_HEADER_ICON} sm:left-[34%] sm:h-16 sm:w-16`} strokeWidth={1} />
      <Dog className={`absolute left-[26%] top-14 h-10 w-10 -rotate-6 ${VET_HEADER_ICON} sm:h-11 sm:w-11`} strokeWidth={1} />
      <Cat className={`absolute left-[44%] top-7 h-8 w-8 rotate-12 ${VET_HEADER_ICON} sm:h-9 sm:w-9`} strokeWidth={1} />
      <FlaskConical className={`absolute left-[40%] bottom-0 h-11 w-11 rotate-[15deg] ${VET_HEADER_ICON} sm:h-12 sm:w-12`} strokeWidth={1} />
      <PawPrint className={`absolute left-[36%] bottom-6 h-7 w-7 rotate-[-30deg] ${VET_HEADER_ICON}`} strokeWidth={1} />

      {/* Center-right */}
      <Building2 className={`absolute right-[36%] top-3 h-9 w-9 -rotate-[8deg] ${VET_HEADER_ICON} sm:h-10 sm:w-10`} strokeWidth={1} />
      <HomeIcon className={`absolute right-[40%] bottom-5 h-8 w-8 rotate-6 ${VET_HEADER_ICON}`} strokeWidth={1} />
      <Heart className={`absolute right-[32%] top-12 h-7 w-7 rotate-[14deg] ${VET_HEADER_ICON}`} strokeWidth={1} />

      {/* Right band — wraps around the pet banner */}
      <Stethoscope className={`absolute right-[22%] bottom-1 h-10 w-10 rotate-[20deg] ${VET_HEADER_ICON} sm:h-11 sm:w-11`} strokeWidth={1} />
      <Syringe className={`absolute right-[14%] top-2 h-8 w-8 -rotate-[28deg] ${VET_HEADER_ICON}`} strokeWidth={1} />
      <Pill className={`absolute right-[10%] top-11 h-7 w-7 rotate-[16deg] ${VET_HEADER_ICON}`} strokeWidth={1} />
      <Dog className={`absolute right-[6%] bottom-8 h-8 w-8 -rotate-6 ${VET_HEADER_ICON}`} strokeWidth={1} />
      <Cat className={`absolute right-[18%] bottom-3 h-7 w-7 rotate-10 ${VET_HEADER_ICON}`} strokeWidth={1} />

      {/* Far right */}
      <FlaskConical className={`absolute -right-0.5 top-4 h-8 w-8 rotate-[12deg] ${VET_HEADER_ICON} sm:h-9 sm:w-9`} strokeWidth={1} />
      <Activity className={`absolute right-0 bottom-3 h-7 w-7 -rotate-[14deg] ${VET_HEADER_ICON}`} strokeWidth={1} />
      <PawPrint className={`absolute right-1 top-[3.25rem] h-6 w-6 rotate-[24deg] ${VET_HEADER_ICON}`} strokeWidth={1} />
    </>
  );
}

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
      const petsData = await apiClient.get(`/customer/pets/${phone}`) as any;
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
    const allServiceTypes = VET_SERVICE_CARDS.map((service) =>
      service.id === 'clinic' ? { ...service, badge: vetClinicBadgeText } : service,
    );

    if (!allowedServiceStyles || allowedServiceStyles.length === 0) {
      return allServiceTypes;
    }

    return allServiceTypes.filter((service) => {
      const styleMap = serviceTypeStyleMap[service.id] || [];
      return styleMap.some((style) =>
        allowedServiceStyles.some(
          (allowed) =>
            allowed.toLowerCase().includes(style.toLowerCase()) ||
            style.toLowerCase().includes(allowed.toLowerCase()),
        ),
      );
    });
  }, [allowedServiceStyles, vetClinicBadgeText]);

  const problemGridItems = useMemo(
    () => (vetProblems.length > 0 ? vetProblems : VET_PROBLEMS),
    [vetProblems],
  );

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
        headerBackground={<VetHeaderBackground />}
        headerTrailingImage={VET_HEADER_BANNER}
        headerTrailingImageAlt="Dog and cat"
      />

      {/* Main Content — negative margin pulls body under the sheet curve */}
      <div className="max-w-customer mx-auto -mt-4 px-4 pt-6 pb-24" style={{ position: 'relative', zIndex: 1 }}>
        {/* Choose Service */}
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="rounded-lg bg-orange-50 p-1.5">
              <PawPrint className="h-4 w-4 text-[#FF8C42]" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Choose Service</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {serviceTypes.map((service) => {
              const isComingSoon = !!service.comingSoon;

              const handleServiceClick = () => {
                try {
                  if (service.id === 'clinic') {
                    handleNavigate('vet-clinic-list');
                  } else if (service.id === 'tele') {
                    handleNavigate('vet-tele-consultation');
                  } else if (service.id === 'home') {
                    handleNavigate('vet-home-visit');
                  } else if (service.id === 'medicine') {
                    handleNavigate('pharmacy_store');
                  } else if (service.id === 'lab') {
                    handleNavigate('lab-diagnostics');
                  } else if (service.id === 'physiotherapy') {
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

              const cardBody = (
                <>
                  <VetServiceCardBackground serviceId={service.id} />
                  {isComingSoon && (
                    <span className="absolute right-2 top-2 z-[2] rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800">
                      Coming soon
                    </span>
                  )}
                  <div className="relative z-[1] flex min-h-[108px] flex-col p-3 pr-[42%]">
                    <div
                      className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl ${service.iconBg}`}
                    >
                      <service.Icon className={`h-5 w-5 ${service.iconColor}`} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">{service.name}</h3>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{service.description}</p>
                    {service.badge ? (
                      <span className="mt-auto pt-2 text-[10px] font-semibold text-slate-600">
                        {service.badge}
                      </span>
                    ) : null}
                  </div>
                  <div className="pointer-events-none absolute bottom-0 right-0 z-[2] h-[78%] w-[48%]">
                    <Image
                      src={service.image}
                      alt=""
                      fill
                      className="object-contain object-bottom-right"
                      sizes="(max-width: 640px) 45vw, 180px"
                    />
                  </div>
                </>
              );

              if (isComingSoon) {
                return (
                  <div
                    key={service.id}
                    className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white text-left opacity-80 shadow-sm saturate-75"
                    aria-label={`${service.name} — coming soon`}
                  >
                    {cardBody}
                  </div>
                );
              }

              return (
                <button
                  key={service.id}
                  type="button"
                  aria-label={service.name}
                  className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white text-left shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
                  onClick={handleServiceClick}
                >
                  {cardBody}
                </button>
              );
            })}
          </div>
        </div>

        <VetProblemGrid
          problems={problemGridItems}
          onNavigate={(screen, navData) => handleNavigate(screen, navData)}
        />

        {/* Book again with previous vet */}
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
