"use client";

import { useState, useEffect, useMemo, useCallback, type MouseEvent } from 'react';
import { CachedImage } from '@/components/shared/CachedImage';
import {
  Scissors,
  Home as HomeIcon,
  Star,
  MapPin,
  ChevronRight,
  RefreshCw,
  Shield,
  Leaf,
  Users,
  Bath,
  Hand,
  Brush,
  Dog,
  Sparkles,
  ArrowRight,
  Heart,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { mergeCustomerVendorServicesPayload } from '@/lib/customer-vendor-services-merge';
import { toast } from 'sonner';
import { ServiceDashboardHeader } from './shared/ServiceDashboardHeader';
import { BoardingVendorExpandableCard } from './boarding/BoardingVendorExpandableCard';
import { useHubVendorDiscovery } from '@/hooks/useHubVendorDiscovery';
import { useDiscoveryCount } from '@/hooks/useDiscoveryCount';
import { formatDiscoveryCountStat } from '@/lib/format-floored-ten-plus';
import { HUB_DISCOVERY_GROOMING } from '@/lib/service-hub-discovery-config';
import { minPriceForVendor } from '@/lib/boarding-vendor-booking-utils';
import {
  type BoardingListVendor,
  type BoardingPlanRow,
  findBoardingListVendorByProfileKey,
} from '@/lib/boarding-vendor-discovery-map';
import type { BoardingServiceSlug } from '@/lib/boarding-service-types';
import { pickCustomerVendorAccountId } from '@warmpawz/shared-types';
import { EMPTY_SERVICE_HEADER_STATS } from '@/lib/service-header-stats';
import {
  gateServiceStyleNavigation,
  isServiceStyleHidden,
  loadCustomerServiceLaunchCatalog,
  resolveServiceStyleLaunchFromCatalog,
} from '@/lib/customer-service-style-launch';
import type { LaunchStatusValue } from '@warmpawz/service-launch-mappings';

const GROOMING_STYLE_LAUNCH_MAP: Record<string, string> = {
  grooming_center: 'at_center',
  grooming_home: 'at_home',
};

const GROOMING_IMG = '/images/home/Grooming';

const GROOMING_BANNER = {
  tag: 'LIMITED TIME OFFER',
  title: 'Premium Grooming',
  subtitle: 'Happier pets, healthier lives',
  offer: 'Up to 30% OFF',
  offerDetail: 'on full grooming for all pets',
  image: `${GROOMING_IMG}/banner-img.webp`,
  cta: 'Book Now',
};

const GROOMING_FEATURES = [
  { icon: Shield, label: 'Certified Groomers', sub: 'Trained & verified', color: 'text-orange-500', bg: 'bg-orange-50' },
  { icon: Leaf, label: 'Safe & Premium Products', sub: 'Vet approved', color: 'text-green-600', bg: 'bg-green-50' },
  { icon: HomeIcon, label: 'Doorstep Service', sub: 'At home grooming', color: 'text-purple-600', bg: 'bg-purple-50' },
  { icon: MapPin, label: 'Live Tracking', sub: 'Track groomer in real-time', color: 'text-blue-600', bg: 'bg-blue-50' },
] as const;

const GROOMING_NEED_CARDS: {
  id: string;
  name: string;
  image: string;
  Icon: LucideIcon;
  iconColor: string;
  iconBg: string;
}[] = [
  { id: 'hair_trim', name: 'Hair Trimming', image: `${GROOMING_IMG}/hair-trim.webp`, Icon: Scissors, iconColor: 'text-blue-600', iconBg: 'bg-blue-100' },
  { id: 'bath_only', name: 'Bath & Brush', image: `${GROOMING_IMG}/bathnbrush.webp`, Icon: Bath, iconColor: 'text-blue-600', iconBg: 'bg-blue-100' },
  { id: 'full_grooming', name: 'Full Grooming', image: `${GROOMING_IMG}/fullbodygroom.webp`, Icon: Scissors, iconColor: 'text-orange-600', iconBg: 'bg-orange-100' },
  { id: 'nail_care', name: 'Nail Trimming', image: `${GROOMING_IMG}/nailtrim.webp`, Icon: Hand, iconColor: 'text-purple-600', iconBg: 'bg-purple-100' },
  { id: 'haircut_styling', name: 'Haircut & Styling', image: `${GROOMING_IMG}/haircut.webp`, Icon: Brush, iconColor: 'text-pink-600', iconBg: 'bg-pink-100' },
  { id: 'deshedding', name: 'De-shedding', image: `${GROOMING_IMG}/de-shedding.webp`, Icon: Dog, iconColor: 'text-amber-600', iconBg: 'bg-amber-100' },
  { id: 'spa_treatment', name: 'Spa & Wellness', image: `${GROOMING_IMG}/spa.webp`, Icon: Sparkles, iconColor: 'text-rose-600', iconBg: 'bg-rose-100' },
];

const GROOMING_HEADER_ICON =
  'fill-none stroke-current [&>path]:fill-none [&>circle]:fill-none [&>rect]:fill-none [&>polygon]:fill-none';

function GroomingHeaderBackground() {
  return (
    <>
      <Scissors className={`absolute -right-2 top-6 h-20 w-20 rotate-[18deg] ${GROOMING_HEADER_ICON} sm:h-24 sm:w-24`} strokeWidth={1} />
      <Sparkles className={`absolute right-[28%] top-2 h-9 w-9 -rotate-12 ${GROOMING_HEADER_ICON}`} strokeWidth={1} />
      <Brush className={`absolute left-[42%] top-14 h-14 w-14 rotate-45 ${GROOMING_HEADER_ICON} sm:h-16 sm:w-16`} strokeWidth={1} />
      <Bath className={`absolute -left-1 bottom-2 h-16 w-16 -rotate-6 ${GROOMING_HEADER_ICON} sm:h-[4.5rem] sm:w-[4.5rem]`} strokeWidth={1} />
      <Hand className={`absolute right-12 bottom-4 h-11 w-11 -rotate-[20deg] ${GROOMING_HEADER_ICON} sm:right-16 sm:h-12 sm:w-12`} strokeWidth={1} />
      <Dog className={`absolute left-8 top-3 h-12 w-12 rotate-6 ${GROOMING_HEADER_ICON} sm:left-12 sm:h-14 sm:w-14`} strokeWidth={1} />
      <Heart className={`absolute right-[18%] bottom-1 h-10 w-10 rotate-12 ${GROOMING_HEADER_ICON}`} strokeWidth={1} />
      <Sparkles className={`absolute left-[22%] bottom-8 h-7 w-7 rotate-[30deg] ${GROOMING_HEADER_ICON}`} strokeWidth={1} />
      <Scissors className={`absolute left-[55%] top-1 h-8 w-8 -rotate-[35deg] ${GROOMING_HEADER_ICON}`} strokeWidth={1} />
    </>
  );
}

interface GroomingServiceRouterProps {
  phone: string;
  onBack: () => void;
  onViewBooking?: (bookingId: string) => void;
  onNavigate?: (screen: string, data?: any) => void;
}

const HUB_SLUG: BoardingServiceSlug = 'all';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function firstGroomingServiceUuid(services: any[]): string | undefined {
  for (const s of services) {
    const raw = s?.id ?? s?.service_id ?? s?.serviceId;
    if (typeof raw === 'string' && UUID_RE.test(raw)) return raw;
  }
  return undefined;
}

export function GroomingServiceRouter({ phone, onBack, onViewBooking, onNavigate }: GroomingServiceRouterProps) {
  const {
    loading: vendorsLoading,
    vendors,
    relaxedFilter,
    selectedVendorId,
    setSelectedVendorId,
    toggleVendor,
    fetchingPlansFor,
  } = useHubVendorDiscovery(phone, HUB_DISCOVERY_GROOMING);

  const {
    data: groomingCenterCount = 0,
    isLoading: groomingCenterLoading,
    isFetching: groomingCenterFetching,
    isError: groomingCenterError,
  } = useDiscoveryCount({
    phone,
    serviceStyle: 'at_center',
    category: 'grooming',
  });

  const groomingCenterBadgeText = useMemo(() => {
    const st =
      groomingCenterLoading || groomingCenterFetching
        ? 'loading'
        : groomingCenterError
          ? 'error'
          : 'success';
    const n = formatDiscoveryCountStat(groomingCenterCount, st);
    return `${n} Centres`;
  }, [groomingCenterLoading, groomingCenterFetching, groomingCenterError, groomingCenterCount]);

  const [previousGroomer, setPreviousGroomer] = useState<any>(null);
  const [styleLaunchByCard, setStyleLaunchByCard] = useState<Record<string, LaunchStatusValue>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const catalog = await loadCustomerServiceLaunchCatalog(phone);
      if (cancelled) return;
      const next: Record<string, LaunchStatusValue> = {};
      for (const [cardId, styleKey] of Object.entries(GROOMING_STYLE_LAUNCH_MAP)) {
        const { status } = resolveServiceStyleLaunchFromCatalog(catalog, 'grooming', styleKey);
        next[cardId] = status;
      }
      setStyleLaunchByCard(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [phone]);

  const navigateGroomingStyle = async (screen: string) => {
    const styleKey = GROOMING_STYLE_LAUNCH_MAP[screen];
    if (styleKey) {
      const allowed = await gateServiceStyleNavigation(phone, 'grooming', styleKey, (msg) =>
        toast.info(msg)
      );
      if (!allowed) return;
    }
    onNavigate?.(screen);
  };

  useEffect(() => {
    loadPreviousGroomer();
  }, [phone]);

  const handleBookPlan = useCallback(
    (v: BoardingListVendor, plan: BoardingPlanRow) => {
      const vid =
        pickCustomerVendorAccountId((v.raw ?? {}) as Record<string, unknown>) || v.id;
      onNavigate?.('create-booking', {
        vendorId: vid,
        serviceType: 'grooming',
        serviceId: plan.rowId,
        serviceName: plan.name,
        price: plan.price,
        duration: plan.duration,
        serviceStyle: plan.serviceStyle || 'at_center',
      });
    },
    [onNavigate]
  );

  const openVendorDetails = useCallback(
    (e: MouseEvent, profileKey: string) => {
      e.stopPropagation();
      const v = findBoardingListVendorByProfileKey(vendors, profileKey);
      if (!v) {
        toast.error('Could not open this profile. Try View Services or refresh.');
        return;
      }
      const rawObj = v.raw && typeof v.raw === 'object' ? (v.raw as Record<string, unknown>) : {};
      const row: Record<string, unknown> = {
        ...rawObj,
        id: profileKey,
        vendorId: (rawObj as { vendorId?: string }).vendorId,
        type: 'vendor',
      };
      const accountId = pickCustomerVendorAccountId(row) || v.id;
      onNavigate?.('grooming-vendor-profile', {
        vendorId: accountId,
        vendorType: 'vendor' as const,
        serviceStyle: 'at_center',
        category: 'grooming',
        vendorName: v.name,
        vendorData: v.raw,
      });
    },
    [onNavigate, vendors]
  );

  const loadPreviousGroomer = async () => {
    try {
      const response = await apiClient.get<any>(`/customer/${phone}/previous-providers?serviceType=grooming`).catch(() => null);
      const p = response?.providers?.[0] ?? response?.provider;

      if (p) {
        const vid = p.vendor_id ?? p.vendorId ?? p.id;
        if (vid) {
          const rc = Number(p.review_count ?? p.reviewCount ?? 0) || 0;
          const r = Number(p.vendor_rating ?? p.rating);
          setPreviousGroomer({
            id: vid,
            name: p.vendor_name || p.vendorName || p.business_name || p.businessName || p.name,
            photo: p.profile_image_url || p.photo || null,
            rating: rc > 0 && Number.isFinite(r) && r > 0 ? r : null,
            lastVisit: p.last_booking_date || p.lastVisit,
            sessionsCount: p.sessionsCount || 5,
            lastServiceId: p.last_service_id || p.service_id || p.serviceId,
          });
          return;
        }
      }

      const packagesResponse = await apiClient.get<any>(`/customer/${phone}/packages?serviceType=grooming`).catch(() => null);
      if (packagesResponse?.packages && packagesResponse.packages.length > 0) {
        const pkg = packagesResponse.packages[0];
        if (pkg.vendorId && pkg.vendorName) {
          setPreviousGroomer({
            id: pkg.vendorId,
            name: pkg.vendorName,
            photo: null,
            rating: null,
            lastVisit: pkg.lastUsed || '3 weeks ago',
            sessionsCount: pkg.sessionsUsed || 5,
            lastServiceId: pkg.serviceId || pkg.service_id || pkg.defaultServiceId,
          });
        }
      }
    } catch (error) {
      console.log('No previous groomer found:', error);
    }
  };

  const handleBookAgain = useCallback(async () => {
    if (!previousGroomer?.id) return;
    const vid = previousGroomer.id;
    let serviceId: string | undefined = previousGroomer.lastServiceId;
    if (!serviceId) {
      try {
        const res = await apiClient.get<any>(`/customer/vendor/${vid}/services?category=grooming`);
        const list = mergeCustomerVendorServicesPayload(res);
        serviceId = firstGroomingServiceUuid(list);
      } catch {
        /* CreateBookingPage will resolve via vendor/available + catalog */
      }
    }
    onNavigate?.('create-booking', {
      vendorId: vid,
      serviceType: 'grooming',
      serviceId,
    });
  }, [previousGroomer, onNavigate]);

  const serviceTypes = useMemo(
    () => {
      const cards = [
      {
        id: 'grooming_center',
        name: 'Grooming Centre',
        description: 'Visit our premium salons',
        image: `${GROOMING_IMG}/grooming-center.webp`,
        badge: groomingCenterBadgeText.toUpperCase(),
        badgeClass: 'bg-white/90 text-slate-700',
        trustedBy: 'Trusted by 2K+ pet parents',
        arrowClass: 'bg-orange-500 hover:bg-orange-600',
      },
      {
        id: 'grooming_home',
        name: 'At Home Grooming',
        description: 'Groomer comes to you',
        image: `${GROOMING_IMG}/home-grooming.webp`,
        badge: 'MOST POPULAR',
        badgeClass: 'bg-green-500 text-white',
        trustedBy: 'Trusted by 5K+ pet parents',
        arrowClass: 'bg-green-500 hover:bg-green-600',
      },
    ];
      return cards.filter((service) => {
        const launchStatus = styleLaunchByCard[service.id];
        return !(launchStatus && isServiceStyleHidden(launchStatus));
      });
    },
    [groomingCenterBadgeText, styleLaunchByCard]
  );

  const dashboardStats = EMPTY_SERVICE_HEADER_STATS;

  if (vendorsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF8F4]">
      <ServiceDashboardHeader
        fullWidth
        serviceName="Grooming Services"
        serviceSubtitle="Premium care for your furry friend"
        serviceIcon={Scissors}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"
        sheetToneClass="bg-[#FFF8F4]"
        headerBackground={<GroomingHeaderBackground />}
      />

      <div className="mx-auto w-full max-w-customer -mt-4 rounded-t-[1.75rem] bg-[#FFF8F4] px-4 pt-5 sm:rounded-t-[2rem]">
        <div className="space-y-6">

          {/* Hero banner */}
          <div className="relative overflow-hidden rounded-2xl border border-orange-100/60 bg-gradient-to-br from-white via-orange-50/30 to-white shadow-sm">
            {/* Faded background icons — light tones only */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              <Scissors className="absolute -right-1 top-2 h-14 w-14 rotate-12 text-orange-200/40 sm:h-16 sm:w-16" strokeWidth={1.25} />
              <Sparkles className="absolute left-3 top-10 h-9 w-9 -rotate-12 text-amber-200/50 sm:left-5 sm:h-10 sm:w-10" strokeWidth={1.25} />
              <Brush className="absolute bottom-6 left-16 h-11 w-11 rotate-[24deg] text-orange-100/80 sm:h-12 sm:w-12" strokeWidth={1.25} />
              <Bath className="absolute bottom-3 right-16 h-10 w-10 -rotate-6 text-orange-200/35 sm:right-20 sm:h-11 sm:w-11" strokeWidth={1.25} />
              <Heart className="absolute right-[38%] top-1/2 h-8 w-8 -translate-y-1/2 rotate-6 fill-none text-rose-100/70" strokeWidth={1.25} />
            </div>

            <div className="relative z-10 flex min-h-[148px]">
              <div className="flex flex-1 flex-col justify-center gap-2 p-4 sm:p-5">
                <span className="inline-flex w-fit items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-600">
                  {GROOMING_BANNER.tag}
                </span>
                <h2 className="text-lg font-bold leading-tight text-slate-900 sm:text-xl">
                  {GROOMING_BANNER.title}
                </h2>
                <p className="flex items-center gap-1 text-xs text-slate-600 sm:text-sm">
                  {GROOMING_BANNER.subtitle}
                  <Heart className="h-3 w-3 fill-orange-400 text-orange-400" />
                </p>
                <div className="rounded-xl border border-orange-100 bg-orange-50/80 px-3 py-2">
                  <p className="text-sm font-bold text-orange-600">{GROOMING_BANNER.offer}</p>
                  <p className="text-[10px] text-slate-600">{GROOMING_BANNER.offerDetail}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void navigateGroomingStyle('grooming_center')}
                  className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#FF8C42] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#FF7A35]"
                >
                  {GROOMING_BANNER.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="relative flex w-[38%] shrink-0 items-center justify-center px-2 py-3 sm:w-[40%] sm:px-3">
                <div className="grooming-banner-img-float relative aspect-[4/5] w-[88%] max-w-[130px] sm:max-w-[145px]">
                  <CachedImage
                    src={GROOMING_BANNER.image}
                    alt="Premium pet grooming"
                    fill
                    className="object-contain object-center drop-shadow-sm"
                    sizes="145px"
                    loading="eager"
                  />
                </div>
              </div>
            </div>
          </div>

          <style jsx global>{`
            @keyframes grooming-banner-float {
              0%,
              100% {
                transform: translateY(0) scale(1);
              }
              50% {
                transform: translateY(-6px) scale(1.02);
              }
            }
            .grooming-banner-img-float {
              animation: grooming-banner-float 3.8s ease-in-out infinite;
              will-change: transform;
            }
            @media (prefers-reduced-motion: reduce) {
              .grooming-banner-img-float {
                animation: none;
              }
            }
          `}</style>

          {/* Features row */}
          <div className="grid grid-cols-4 gap-2">
            {GROOMING_FEATURES.map((feature) => (
              <div key={feature.label} className="flex flex-col items-center gap-1.5 text-center">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${feature.bg}`}>
                  <feature.icon className={`h-5 w-5 ${feature.color}`} />
                </div>
                <p className="text-[9px] font-semibold leading-tight text-slate-800 sm:text-[10px]">{feature.label}</p>
                <p className="text-[8px] leading-tight text-slate-500 sm:text-[9px]">{feature.sub}</p>
              </div>
            ))}
          </div>

          {/* What does your pet need? */}
          <div>
            <h2 className="mb-3 text-lg font-bold text-slate-900">What does your pet need?</h2>
            <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
              {GROOMING_NEED_CARDS.map((need) => (
                <button
                  key={need.id}
                  type="button"
                  onClick={() => onNavigate?.('problem_selected', { problemId: need.id, problemTitle: need.name })}
                  className="group flex flex-col items-center gap-1.5 text-left"
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all group-hover:border-orange-200 group-hover:shadow-md">
                    <CachedImage
                      src={need.image}
                      alt={need.name}
                      fill
                      className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
                      sizes="(max-width: 640px) 22vw, 100px"
                    />
                    <div className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-lg ${need.iconBg} shadow-sm`}>
                      <need.Icon className={`h-3.5 w-3.5 ${need.iconColor}`} />
                    </div>
                  </div>
                  <span className="w-full text-center text-[9px] font-medium leading-tight text-slate-700 sm:text-[10px]">
                    {need.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Choose Service Type */}
          <div>
            <h2 className="mb-3 text-lg font-bold text-slate-900">Choose Service Type</h2>
            <div className="grid grid-cols-2 gap-3">
              {serviceTypes.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => void navigateGroomingStyle(service.id)}
                  className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-sm transition-all hover:shadow-md"
                >
                  <div className="relative h-28 w-full sm:h-32">
                    <CachedImage
                      src={service.image}
                      alt={service.name}
                      fill
                      className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
                      sizes="(max-width: 640px) 45vw, 200px"
                    />
                    <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide ${service.badgeClass}`}>
                      {service.badge}
                    </span>
                  </div>
                  <div className="relative p-3 pb-10">
                    <h3 className="text-sm font-bold text-slate-900">{service.name}</h3>
                    <p className="mt-0.5 text-[11px] text-slate-500">{service.description}</p>
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
                      <Users className="h-3 w-3 text-orange-400" />
                      <span>{service.trustedBy}</span>
                    </div>
                    <div className={`absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md transition-transform group-hover:scale-110 ${service.arrowClass}`}>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* YOUR GROOMER — kept below hub sections */}
          {previousGroomer && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-bold text-slate-900">🔄 YOUR GROOMER</h2>
              </div>
              
              <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 p-4">
                <div className="flex items-center gap-4">
                  {previousGroomer.photo ? (
                    <img 
                      src={previousGroomer.photo} 
                      alt={previousGroomer.name}
                      className="w-16 h-16 rounded-xl object-cover border-2 border-orange-200"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 font-bold text-xl border-2 border-orange-200">
                      {previousGroomer.name?.charAt(0) || 'G'}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 text-lg">{previousGroomer.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-600 mt-1 flex-wrap">
                      {previousGroomer.rating != null &&
                      Number(previousGroomer.rating) > 0 ? (
                        <>
                          <div className="flex items-center gap-1 text-orange-600 font-bold">
                            <Star className="w-4 h-4 fill-orange-500" />
                            {Number(previousGroomer.rating).toFixed(1)}
                          </div>
                          <span>•</span>
                        </>
                      ) : null}
                      <span>Last visit: {previousGroomer.lastVisit || '3 weeks ago'}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {previousGroomer.sessionsCount || 5} sessions with you
                    </p>
                  </div>
                  <Button 
                    size="sm"
                    className="bg-orange-600 text-white hover:bg-orange-700 whitespace-nowrap"
                    onClick={() => void handleBookAgain()}
                  >
                    Book Again
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* Top Groomers — same expandable cards as View All (grooming_center) */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Top Groomers</h2>
              <button 
                className="text-sm text-orange-600 flex items-center gap-1 font-medium"
                onClick={() => void navigateGroomingStyle('grooming_center')}
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            {relaxedFilter && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
                Showing all grooming providers we could match — expand a card for services and prices.
              </p>
            )}
            <div className="space-y-4">
              {vendors.length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="text-4xl mb-3">✂️</div>
                  <p className="text-gray-600 mb-2">No groomers available in your area yet</p>
                  <p className="text-gray-500 text-sm">Check back soon for grooming options!</p>
                </Card>
              ) : (
                vendors.map((v) => {
                  const expanded = selectedVendorId === v.id;
                  const minP = minPriceForVendor(v);
                  return (
                    <BoardingVendorExpandableCard
                      key={v.id}
                      v={v}
                      serviceSlug={HUB_SLUG}
                      planBadgeLabel="Grooming"
                      expanded={expanded}
                      fetchingPlansFor={fetchingPlansFor}
                      minPrice={minP}
                      onToggleHeader={() => toggleVendor(v.id)}
                      onViewServices={(e) => {
                        e.stopPropagation();
                        setSelectedVendorId(v.id);
                      }}
                      onDetails={openVendorDetails}
                      onBookPlan={handleBookPlan}
                      onOpenCenterDetails={openVendorDetails}
                      customerId={phone}
                      serviceCategory="grooming"
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
