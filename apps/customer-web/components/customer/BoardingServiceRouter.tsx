"use client";

import { useState, useEffect, useCallback, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CachedImage } from '@/components/shared/CachedImage';
import {
  Star,
  ChevronRight,
  Moon,
  Sun,
  RefreshCw,
  Building2,
  Clock,
  CalendarRange,
  Calendar,
  Shield,
  Heart,
  PawPrint,
  Camera,
  Cross,
  Sparkles,
  Home,
  type LucideIcon,
  Waves,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { FeaturedVendorSpotlights } from './shared/FeaturedVendorSpotlights';
import { ServiceDashboardHeader } from './shared/ServiceDashboardHeader';
import { BoardingVendorExpandableCard } from './boarding/BoardingVendorExpandableCard';
import { useBoardingVendorDiscovery } from '@/hooks/useBoardingVendorDiscovery';
import {
  navigateBoardingPlanBooking,
  minPriceForVendor,
} from '@/lib/boarding-vendor-booking-utils';
import type { BoardingListVendor, BoardingPlanRow } from '@/lib/boarding-vendor-discovery-map';
import type { BoardingServiceSlug } from '@/lib/boarding-service-types';
import { HUB_SERVICE_ICON_WRAP } from '@/lib/hub-service-option-styles';
import { EMPTY_SERVICE_HEADER_STATS } from '@/lib/service-header-stats';

const BOARDING_IMG = '/images/home/Boarding';

const BOARDING_HEADER_TRAILING = `${BOARDING_IMG}/header-img.webp`;

const BOARDING_HEADER_PILLS = [
  { icon: Shield, label: 'Verified Caregivers' },
  { icon: Camera, label: '24/7 Monitoring' },
  { icon: Heart, label: 'Happy Pets Promise' },
] as const;

const BOARDING_TRUST_BAR = [
  {
    icon: Shield,
    label: 'Trained Staff',
    sub: 'Loving & certified caregivers',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },
  {
    icon: Camera,
    label: '24/7 Monitoring',
    sub: 'CCTV & live updates',
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  {
    icon: Cross,
    label: 'Hygienic Spaces',
    sub: 'Clean, safe & sanitized',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    icon: Heart,
    label: 'Daily Updates',
    sub: 'Photos, videos & activity reports',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
  },
] as const;

const BOARDING_HEADER_ICON =
  'fill-none stroke-current [&>path]:fill-none [&>circle]:fill-none [&>rect]:fill-none [&>polygon]:fill-none';

function BoardingHeaderBackground() {
  return (
    <>
      <Building2 className={`absolute -left-1 top-3 h-14 w-14 rotate-[12deg] ${BOARDING_HEADER_ICON} sm:h-16 sm:w-16`} strokeWidth={1} />
      <PawPrint className={`absolute left-[12%] top-12 h-9 w-9 -rotate-12 ${BOARDING_HEADER_ICON}`} strokeWidth={1} />
      <Moon className={`absolute left-[28%] top-1 h-10 w-10 rotate-6 ${BOARDING_HEADER_ICON}`} strokeWidth={1} />
      <Heart className={`absolute left-[42%] bottom-4 h-8 w-8 rotate-[14deg] ${BOARDING_HEADER_ICON}`} strokeWidth={1} />
      <Building2 className={`absolute right-[38%] top-6 h-11 w-11 -rotate-[8deg] ${BOARDING_HEADER_ICON}`} strokeWidth={1} />
      <PawPrint className={`absolute right-[18%] bottom-2 h-10 w-10 rotate-[20deg] ${BOARDING_HEADER_ICON}`} strokeWidth={1} />
      <Sun className={`absolute -right-0.5 top-5 h-9 w-9 rotate-[16deg] ${BOARDING_HEADER_ICON}`} strokeWidth={1} />
    </>
  );
}

interface BoardingServiceRouterProps {
  phone: string;
  onBack: () => void;
  onViewBooking?: (bookingId: string) => void;
  onNavigate?: (screen: string, data?: any) => void;
}

const BOARDING_CARD_LINKS: {
  slug: Exclude<BoardingServiceSlug, 'all'>;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  iconWrap: string;
  image: string;
  cardBg: string;
  badge?: string;
}[] = [
  {
    slug: 'overnight',
    title: 'Overnight',
    subtitle: 'Extended stays',
    Icon: Moon,
    iconWrap: HUB_SERVICE_ICON_WRAP.overnightMoon,
    image: `${BOARDING_IMG}/overnight.webp`,
    cardBg: 'bg-indigo-50',
    badge: 'Popular',
  },
  {
    slug: 'full-day',
    title: 'Full Day',
    subtitle: 'All-day care',
    Icon: Sun,
    iconWrap: HUB_SERVICE_ICON_WRAP.sunDaytime,
    image: `${BOARDING_IMG}/full-day.webp`,
    cardBg: 'bg-amber-50',
  },
  {
    slug: 'half-day',
    title: 'Half Day',
    subtitle: 'Flexible hours',
    Icon: Clock,
    iconWrap: HUB_SERVICE_ICON_WRAP.clockFlexible,
    image: `${BOARDING_IMG}/half-day.webp`,
    cardBg: 'bg-rose-50',
  },
  {
    slug: 'swimming',
    title: 'Swimming',
    subtitle: 'Same-day pool sessions',
    Icon: Waves,
    iconWrap: HUB_SERVICE_ICON_WRAP.clockFlexible,
    image: `${BOARDING_IMG}/half-day.webp`,
    cardBg: 'bg-cyan-50',
  },
  {
    slug: 'weekend',
    title: 'Weekend',
    subtitle: 'Fri–Sun stays',
    Icon: CalendarRange,
    iconWrap: HUB_SERVICE_ICON_WRAP.calendarWeekend,
    image: `${BOARDING_IMG}/weekend-board.webp`,
    cardBg: 'bg-purple-50',
  },
  {
    slug: 'weekly',
    title: 'Weekly',
    subtitle: '7-day packages',
    Icon: Calendar,
    iconWrap: HUB_SERVICE_ICON_WRAP.calendarWeekly,
    image: `${BOARDING_IMG}/weekly-board.webp`,
    cardBg: 'bg-orange-50',
  },
];

const BOARDING_CARD_SHELL =
  'group relative flex min-h-[128px] w-full overflow-hidden rounded-2xl border border-slate-100/80 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.99] sm:min-h-[118px] sm:h-[118px]';
const BOARDING_CARD_CONTENT =
  'relative z-[1] flex min-w-0 flex-1 flex-col justify-center gap-1 p-2.5 pr-14 pb-2 sm:gap-2 sm:p-3.5 sm:pr-[5.25rem]';
const BOARDING_CARD_ICON =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 sm:rounded-xl';
const BOARDING_CARD_IMAGE =
  'pointer-events-none absolute bottom-1 right-1 z-[1] h-[52px] w-[52px] overflow-hidden rounded-xl sm:bottom-1.5 sm:right-1.5 sm:h-[84px] sm:w-[84px]';

const BOARDING_CARD_BG_ICON =
  'fill-none stroke-current [&>path]:fill-none [&>circle]:fill-none [&>rect]:fill-none [&>polygon]:fill-none';

const BOARDING_CARD_BACKGROUNDS: Record<
  Exclude<BoardingServiceSlug, 'all'>,
  { tint: string; icons: { Icon: LucideIcon; className: string }[] }
> = {
  overnight: {
    tint: 'text-indigo-400',
    icons: [
      { Icon: Moon, className: 'absolute -left-1 top-7 h-14 w-14 rotate-[10deg] opacity-[0.22]' },
      { Icon: Sparkles, className: 'absolute left-[34%] top-0 h-7 w-7 -rotate-12 opacity-[0.16]' },
      { Icon: PawPrint, className: 'absolute left-[14%] bottom-1 h-9 w-9 rotate-[18deg] opacity-[0.18]' },
      { Icon: Building2, className: 'absolute left-[38%] bottom-6 h-7 w-7 -rotate-[8deg] opacity-[0.14]' },
    ],
  },
  'full-day': {
    tint: 'text-amber-400',
    icons: [
      { Icon: Sun, className: 'absolute -left-0.5 top-8 h-14 w-14 rotate-[8deg] opacity-[0.22]' },
      { Icon: PawPrint, className: 'absolute left-[16%] bottom-2 h-9 w-9 -rotate-[14deg] opacity-[0.17]' },
      { Icon: Home, className: 'absolute left-[32%] top-1 h-8 w-8 rotate-[16deg] opacity-[0.15]' },
      { Icon: Heart, className: 'absolute left-[40%] bottom-7 h-6 w-6 rotate-6 opacity-[0.14]' },
    ],
  },
  'half-day': {
    tint: 'text-rose-400',
    icons: [
      { Icon: Clock, className: 'absolute -left-0.5 top-8 h-12 w-12 -rotate-[6deg] opacity-[0.22]' },
      { Icon: PawPrint, className: 'absolute left-[18%] bottom-1 h-9 w-9 rotate-[22deg] opacity-[0.17]' },
      { Icon: Sparkles, className: 'absolute left-[36%] top-2 h-6 w-6 -rotate-12 opacity-[0.14]' },
    ],
  },
  swimming: {
    tint: 'text-cyan-400',
    icons: [
      { Icon: Waves, className: 'absolute -left-0.5 top-7 h-12 w-12 rotate-[8deg] opacity-[0.22]' },
      { Icon: PawPrint, className: 'absolute left-[16%] bottom-2 h-9 w-9 -rotate-[14deg] opacity-[0.17]' },
      { Icon: Sun, className: 'absolute left-[34%] top-1 h-7 w-7 rotate-[12deg] opacity-[0.15]' },
    ],
  },
  weekend: {
    tint: 'text-purple-400',
    icons: [
      { Icon: CalendarRange, className: 'absolute -left-0.5 top-7 h-12 w-12 rotate-[12deg] opacity-[0.22]' },
      { Icon: Sun, className: 'absolute left-[30%] top-1 h-7 w-7 -rotate-[10deg] opacity-[0.16]' },
      { Icon: PawPrint, className: 'absolute left-[12%] bottom-2 h-8 w-8 rotate-[16deg] opacity-[0.17]' },
    ],
  },
  weekly: {
    tint: 'text-orange-400',
    icons: [
      { Icon: Calendar, className: 'absolute -left-0.5 top-8 h-12 w-12 -rotate-[8deg] opacity-[0.22]' },
      { Icon: Building2, className: 'absolute left-[28%] top-2 h-8 w-8 rotate-[14deg] opacity-[0.16]' },
      { Icon: PawPrint, className: 'absolute left-[14%] bottom-1 h-9 w-9 -rotate-[18deg] opacity-[0.17]' },
      { Icon: Heart, className: 'absolute left-[38%] bottom-7 h-6 w-6 rotate-8 opacity-[0.14]' },
    ],
  },
};

function BoardingOptionCardBackground({ slug }: { slug: Exclude<BoardingServiceSlug, 'all'> }) {
  const config = BOARDING_CARD_BACKGROUNDS[slug];
  if (!config) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${config.tint}`}
      aria-hidden
    >
      {config.icons.map(({ Icon, className }, i) => (
        <Icon key={`${slug}-bg-${i}`} className={`${BOARDING_CARD_BG_ICON} ${className}`} strokeWidth={1.25} />
      ))}
    </div>
  );
}

/** Hub uses the same discovery + cards as View All (`service=all`). */
const HUB_SERVICE_SLUG: BoardingServiceSlug = 'all';

function navigateToBoardingVendorList(
  onNavigate: BoardingServiceRouterProps['onNavigate'],
  router: { push: (href: string) => void },
  serviceSlug: string
) {
  if (onNavigate) {
    onNavigate('pet-boarding-vendors', { serviceSlug });
    return;
  }
  router.push(`/pet-boarding/vendors?service=${encodeURIComponent(serviceSlug)}`);
}

export function BoardingServiceRouter({ phone, onBack, onViewBooking, onNavigate }: BoardingServiceRouterProps) {
  const router = useRouter();
  const {
    loading: vendorsLoading,
    vendors,
    relaxedFilter,
    selectedVendorId,
    setSelectedVendorId,
    toggleVendor,
    fetchingPlansFor,
  } = useBoardingVendorDiscovery(phone, HUB_SERVICE_SLUG);

  const [previousFacility, setPreviousFacility] = useState<any>(null);

  const loadPreviousFacility = useCallback(async () => {
    try {
      const response = await apiClient.get<any>(`/customer/${phone}/previous-providers?serviceType=boarding`).catch(() => null);
      if (response?.provider) {
        const p = response.provider;
        const prc = Number(p.totalReviews ?? p.reviewCount ?? 0) || 0;
        const praw = p.rating != null ? Number(p.rating) : NaN;
        const pr = prc > 0 && Number.isFinite(praw) && praw > 0 ? praw : 0;
        setPreviousFacility({
          id: p.id,
          name: p.businessName || p.name,
          photo: p.photo,
          rating: pr,
          lastVisit: p.lastVisit,
        });
      } else {
        const pkgRes = await apiClient.get<any>(`/customer/${phone}/packages?serviceType=boarding`).catch(() => null);
        if (pkgRes?.packages?.length > 0) {
          const pkg = pkgRes.packages[0];
          if (pkg.vendorId && pkg.vendorName)
            setPreviousFacility({
              id: pkg.vendorId,
              name: pkg.vendorName,
              photo: null,
              rating: 0,
              lastVisit: pkg.lastUsed || '3 weeks ago',
            });
        }
      }
    } catch {
      /* ignore */
    }
  }, [phone]);

  useEffect(() => {
    loadPreviousFacility();
  }, [loadPreviousFacility]);

  const handleBookPlan = useCallback(
    (v: BoardingListVendor, plan: BoardingPlanRow) => {
      if (!onNavigate) {
        router.push(
          `/pet-boarding/vendor/${encodeURIComponent(v.id)}?service=${encodeURIComponent(HUB_SERVICE_SLUG)}`
        );
        return;
      }
      navigateBoardingPlanBooking(onNavigate, v, plan);
    },
    [onNavigate, router]
  );

  const openVendorProfile = useCallback(
    (e: MouseEvent, vendorId: string) => {
      e.stopPropagation();
      if (onNavigate) {
        onNavigate('pet-boarding-profile', {
          vendorId,
          serviceSlug: HUB_SERVICE_SLUG,
        });
        return;
      }
      router.push(
        `/pet-boarding/vendor/${encodeURIComponent(vendorId)}?service=${encodeURIComponent(HUB_SERVICE_SLUG)}`
      );
    },
    [onNavigate, router]
  );

  const boardingStats = EMPTY_SERVICE_HEADER_STATS;

  const handleCheckAvailability = async (facilityId: string) => {
    try {
      const data = await apiClient.get<{ available?: boolean; message?: string }>(
        `/vendor/${facilityId}/boarding/availability`
      );

      if (data.available !== false) {
        if (onNavigate) {
          onNavigate('boarding-booking', { vendorId: facilityId, serviceType: 'boarding' });
        } else {
          toast.success('Facility is available! Proceeding to booking...');
        }
      } else {
        toast.error(data.message || 'Facility is currently unavailable');
      }
    } catch (error: any) {
      console.error('Error checking availability:', error);
      if (onNavigate) {
        onNavigate('boarding-booking', { vendorId: facilityId, serviceType: 'boarding' });
      } else {
        toast.info('Proceeding to booking...');
      }
    }
  };

  if (vendorsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-50">
      <ServiceDashboardHeader
        fullWidth
        serviceName="Pet Boarding"
        serviceSubtitle="Safe & comfortable pet stay"
        serviceIcon={Building2}
        iconColor="text-white"
        stats={boardingStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"
        sheetToneClass="bg-gray-50"
        headerBackground={<BoardingHeaderBackground />}
        headerTrailingImage={BOARDING_HEADER_TRAILING}
        headerTrailingImageAlt="Golden retriever resting in a cozy pet bed"
        clipHeaderTrailingImage
        headerTrailingImageClassName="pointer-events-none absolute bottom-0 right-0 top-[2.75rem] z-[5] flex w-[78%] max-w-[440px] items-end justify-end sm:top-12"
        headerTrailingImageImgClassName="block h-full w-auto max-w-full origin-bottom-right scale-[1.32] object-contain object-right object-bottom drop-shadow-lg"
      />

      <div className="mx-auto w-full max-w-customer -mt-4 rounded-t-[1.75rem] bg-gray-50 px-4 pt-4 pb-6 sm:rounded-t-[2rem]">
        <div className="mb-5 flex flex-wrap gap-2">
          {BOARDING_HEADER_PILLS.map((pill) => (
            <span
              key={pill.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm"
            >
              <pill.icon className="h-3.5 w-3.5 text-[#FF8C42]" aria-hidden />
              {pill.label}
            </span>
          ))}
        </div>

        <div className="mb-6">
          <div className="mb-1 flex items-center gap-2">
            <div className="rounded-lg bg-orange-50 p-1.5">
              <PawPrint className="h-4 w-4 text-[#FF8C42]" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Boarding Options</h2>
          </div>
          <p className="mb-4 text-sm text-slate-500">Choose the perfect stay for your pet</p>

          <div className="grid grid-cols-2 gap-3">
            {BOARDING_CARD_LINKS.map(({ slug, title, subtitle, Icon, iconWrap, badge, image, cardBg }) => (
              <button
                key={slug}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigateToBoardingVendorList(onNavigate, router, slug);
                }}
                className={`${BOARDING_CARD_SHELL} ${cardBg}`}
              >
                <BoardingOptionCardBackground slug={slug} />
                {badge ? (
                  <span className="absolute right-2 top-2 z-[2] rounded-full bg-[#FF8C42] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white shadow-sm">
                    {badge}
                  </span>
                ) : null}
                <div className={BOARDING_CARD_CONTENT}>
                  <div className={`${BOARDING_CARD_ICON} transition-transform group-hover:scale-105 ${iconWrap}`}>
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <h3 className="text-xs font-bold leading-snug text-slate-900 sm:text-sm">{title}</h3>
                  <p className="text-[10px] leading-snug text-slate-500 sm:text-[11px]">{subtitle}</p>
                </div>

                <div className={BOARDING_CARD_IMAGE}>
                  <CachedImage
                    src={image}
                    alt={title}
                    fill
                    className="object-cover object-center"
                    sizes="(max-width: 640px) 52px, 84px"
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8 grid grid-cols-4 gap-2 rounded-2xl border border-slate-100 bg-white py-3 shadow-sm">
          {BOARDING_TRUST_BAR.map((feature) => (
            <div key={feature.label} className="flex flex-col items-center gap-1.5 px-1 text-center">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${feature.bg}`}>
                <feature.icon className={`h-4 w-4 ${feature.color}`} aria-hidden />
              </div>
              <p className="text-[9px] font-semibold leading-tight text-slate-800 sm:text-[10px]">
                {feature.label}
              </p>
              <p className="text-[8px] leading-tight text-slate-500 sm:text-[9px]">{feature.sub}</p>
            </div>
          ))}
        </div>

        <div className="space-y-8">
            <FeaturedVendorSpotlights service="boarding" phone={phone} onNavigate={onNavigate} />

            {previousFacility && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-orange-500" />
                  <h2 className="text-lg font-bold text-slate-900">Book again</h2>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-4">
                  <div className="flex items-center gap-4">
                    {previousFacility.photo ? (
                      <img
                        src={previousFacility.photo}
                        alt={previousFacility.name}
                        className="w-16 h-16 rounded-xl object-cover border-2 border-orange-200"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 font-bold text-xl border-2 border-orange-200">
                        {previousFacility.name?.charAt(0) || 'B'}
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 text-lg">{previousFacility.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                        <Star className="w-4 h-4 fill-orange-500" /> {previousFacility.rating}
                        <span>•</span>
                        <span>Last stay: {previousFacility.lastVisit || '3 weeks ago'}</span>
                      </div>
                    </div>
                    <Button
                      className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
                      onClick={() => handleCheckAvailability(previousFacility.id)}
                    >
                      Book Now
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">Featured Stays</h2>
                <button
                  type="button"
                  className="text-sm text-orange-600 flex items-center gap-1 font-medium"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigateToBoardingVendorList(onNavigate, router, 'all');
                  }}
                >
                  View All <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {relaxedFilter && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
                  No centers matched a specific service name in listings yet. Showing all pet boarding centers — expand
                  for services or open details.
                </p>
              )}

              <div className="space-y-4">
                {vendors.length === 0 ? (
                  <Card className="p-8 text-center">
                    <div className="text-4xl mb-3">🏠</div>
                    <p className="text-gray-600 mb-2">No boarding facilities available yet</p>
                    <p className="text-gray-500 text-sm">Check back soon for boarding options!</p>
                  </Card>
                ) : (
                  vendors.map((v) => {
                    const expanded = selectedVendorId === v.id;
                    const minP = minPriceForVendor(v);
                    return (
                      <BoardingVendorExpandableCard
                        key={v.id}
                        v={v}
                        serviceSlug={HUB_SERVICE_SLUG}
                        expanded={expanded}
                        fetchingPlansFor={fetchingPlansFor}
                        minPrice={minP}
                        onToggleHeader={() => toggleVendor(v.id)}
                        onViewServices={(e) => {
                          e.stopPropagation();
                          setSelectedVendorId(v.id);
                        }}
                        onDetails={openVendorProfile}
                        onBookPlan={handleBookPlan}
                        onOpenCenterDetails={openVendorProfile}
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
