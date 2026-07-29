"use client";

import { useState, useEffect, useRef, useMemo, useCallback, type MouseEvent } from "react";
import { CachedImage } from "@/components/shared/CachedImage";
import {
  Home,
  Star,
  ChevronRight,
  RefreshCw,
  Moon,
  Sun,
  Calendar,
  Clock,
  Heart,
  ArrowRight,
  PawPrint,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { FeaturedVendorSpotlights } from "./shared/FeaturedVendorSpotlights";
import { ServiceDashboardHeader } from "./shared/ServiceDashboardHeader";
import { BoardingVendorExpandableCard } from "./boarding/BoardingVendorExpandableCard";
import { useHubVendorDiscovery } from "@/hooks/useHubVendorDiscovery";
import { HUB_DISCOVERY_SITTING } from "@/lib/service-hub-discovery-config";
import { buildHubWarmpawzBookingNav } from "@/lib/wappt-hub-booking-nav";
import { fetchPetSitterHubRows } from "@/lib/pet-sitter-hub-fetch";
import { pickCustomerVendorAccountId } from "@warmpawz/shared-types";
import { minPriceForVendor } from "@/lib/boarding-vendor-booking-utils";
import type { BoardingListVendor, BoardingPlanRow } from "@/lib/boarding-vendor-discovery-map";
import { EMPTY_SERVICE_HEADER_STATS } from "@/lib/service-header-stats";
import type { BoardingServiceSlug } from "@/lib/boarding-service-types";
import { HUB_SERVICE_ICON_WRAP } from "@/lib/hub-service-option-styles";

const SITTING_IMG = "/images/home/Sitting";

const SITTING_HEADER_TRAILING = `${SITTING_IMG}/header.webp`;
const SITTING_BANNER_IMAGE = `${SITTING_IMG}/banner-img.webp`;

const SITTING_HEADER_ICON =
  "fill-none stroke-current [&>path]:fill-none [&>circle]:fill-none [&>rect]:fill-none [&>polygon]:fill-none";

function SittingHeaderBackground() {
  return (
    <>
      <Heart
        className={`absolute right-[6%] top-3 h-16 w-16 rotate-6 ${SITTING_HEADER_ICON} sm:right-[8%] sm:h-[4.5rem] sm:w-[4.5rem]`}
        strokeWidth={1}
      />
      <Home
        className={`absolute left-[18%] top-10 h-10 w-10 -rotate-12 ${SITTING_HEADER_ICON} opacity-80`}
        strokeWidth={1}
      />
      <PawPrint
        className={`absolute left-[42%] bottom-3 h-9 w-9 rotate-[18deg] ${SITTING_HEADER_ICON}`}
        strokeWidth={1}
      />
      <Heart
        className={`absolute left-[8%] top-4 h-8 w-8 -rotate-[14deg] ${SITTING_HEADER_ICON}`}
        strokeWidth={1}
      />
    </>
  );
}

interface PetSitterServiceRouterProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  /** When false (e.g. “View all”), list all sitters and hide the redundant View all control. */
  hubMode?: boolean;
  /** Set when opening `pet-sitter-vendors` from hub with a pre-selected tile (browse list). */
  initialSittingOptionId?: string | null;
}

type SittingOptionId =
  | "overnight_sitting"
  | "day_visits"
  | "extended_home"
  | "drop_in";

/** In-home sitting offerings (2×2 grid) — same pattern as Boarding “options”; user books via a sitter below. */
const SITTING_OPTIONS: {
  id: SittingOptionId;
  title: string;
  desc: string;
  price: string;
  icon: LucideIcon;
  iconWrap: string;
  image: string;
  cardBg: string;
}[] = [
  {
    id: "overnight_sitting",
    title: "Overnight sitting",
    desc: "Sitter stays at your home overnight",
    price: "₹899+",
    icon: Moon,
    iconWrap: HUB_SERVICE_ICON_WRAP.overnightMoon,
    image: `${SITTING_IMG}/overnight.webp`,
    cardBg: "bg-indigo-50",
  },
  {
    id: "day_visits",
    title: "Day visits",
    desc: "Scheduled daytime check-ins",
    price: "₹549+",
    icon: Sun,
    iconWrap: HUB_SERVICE_ICON_WRAP.sunDaytime,
    image: `${SITTING_IMG}/day-visit.webp`,
    cardBg: "bg-amber-50",
  },
  {
    id: "extended_home",
    title: "Extended stay",
    desc: "Multi-day in-home care & companionship",
    price: "₹1,499+",
    icon: Calendar,
    iconWrap: HUB_SERVICE_ICON_WRAP.calendarWeekly,
    image: `${SITTING_IMG}/extended-sitting.webp`,
    cardBg: "bg-orange-50",
  },
  {
    id: "drop_in",
    title: "Drop-in visits",
    desc: "Quick feeding & breaks",
    price: "₹249+",
    icon: Clock,
    iconWrap: HUB_SERVICE_ICON_WRAP.clockFlexible,
    image: `${SITTING_IMG}/dropin-visit.webp`,
    cardBg: "bg-rose-50",
  },
];

const SITTING_CARD_SHELL =
  "group relative flex min-h-[128px] w-full overflow-hidden rounded-2xl border text-left shadow-sm transition-all hover:shadow-md active:scale-[0.99] sm:min-h-[118px] sm:h-[118px]";
const SITTING_CARD_CONTENT =
  "relative z-[1] flex min-w-0 flex-1 flex-col justify-center gap-1 p-2.5 pr-14 pb-2 sm:gap-1.5 sm:p-3.5 sm:pr-[5.25rem]";
const SITTING_CARD_ICON =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 sm:rounded-xl";
const SITTING_CARD_IMAGE =
  "pointer-events-none absolute bottom-1 right-1 z-[1] h-[52px] w-[52px] sm:bottom-1.5 sm:right-1.5 sm:h-[76px] sm:w-[76px]";

const SITTING_CARD_BG_ICON =
  "fill-none stroke-current [&>path]:fill-none [&>circle]:fill-none [&>rect]:fill-none [&>polygon]:fill-none";

const SITTING_OPTION_BACKGROUNDS: Record<
  SittingOptionId,
  { tint: string; icons: { Icon: LucideIcon; className: string }[] }
> = {
  overnight_sitting: {
    tint: "text-indigo-400",
    icons: [
      { Icon: Moon, className: "absolute -left-1 top-7 h-14 w-14 rotate-[10deg] opacity-[0.22]" },
      { Icon: Sparkles, className: "absolute left-[34%] top-0 h-7 w-7 -rotate-12 opacity-[0.16]" },
      { Icon: PawPrint, className: "absolute left-[14%] bottom-1 h-9 w-9 rotate-[18deg] opacity-[0.18]" },
    ],
  },
  day_visits: {
    tint: "text-amber-400",
    icons: [
      { Icon: Sun, className: "absolute -left-0.5 top-8 h-14 w-14 rotate-[8deg] opacity-[0.22]" },
      { Icon: PawPrint, className: "absolute left-[16%] bottom-2 h-9 w-9 -rotate-[14deg] opacity-[0.17]" },
      { Icon: Home, className: "absolute left-[32%] top-1 h-8 w-8 rotate-[16deg] opacity-[0.15]" },
    ],
  },
  extended_home: {
    tint: "text-orange-400",
    icons: [
      { Icon: Calendar, className: "absolute -left-0.5 top-8 h-12 w-12 -rotate-[8deg] opacity-[0.22]" },
      { Icon: PawPrint, className: "absolute left-[14%] bottom-1 h-9 w-9 -rotate-[18deg] opacity-[0.17]" },
      { Icon: Heart, className: "absolute left-[38%] bottom-7 h-6 w-6 rotate-8 opacity-[0.14]" },
    ],
  },
  drop_in: {
    tint: "text-rose-400",
    icons: [
      { Icon: Clock, className: "absolute -left-0.5 top-8 h-12 w-12 -rotate-[6deg] opacity-[0.22]" },
      { Icon: Heart, className: "absolute left-[28%] top-2 h-5 w-5 rotate-6 opacity-[0.18]" },
      { Icon: Heart, className: "absolute left-[40%] bottom-6 h-4 w-4 -rotate-12 opacity-[0.16]" },
      { Icon: PawPrint, className: "absolute left-[18%] bottom-1 h-9 w-9 rotate-[22deg] opacity-[0.17]" },
    ],
  },
};

function SittingOptionCardBackground({ optionId }: { optionId: SittingOptionId }) {
  const config = SITTING_OPTION_BACKGROUNDS[optionId];
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${config.tint}`}
      aria-hidden
    >
      {config.icons.map(({ Icon, className }, i) => (
        <Icon
          key={`${optionId}-bg-${i}`}
          className={`${SITTING_CARD_BG_ICON} ${className}`}
          strokeWidth={1.25}
        />
      ))}
    </div>
  );
}

const HUB_SLUG: BoardingServiceSlug = "all";

export function PetSitterServiceRouter({
  phone,
  onBack,
  onNavigate,
  hubMode = true,
  initialSittingOptionId,
}: PetSitterServiceRouterProps) {
  const loadSitterRows = useCallback(() => fetchPetSitterHubRows(phone), [phone]);
  const {
    loading: vendorsLoading,
    vendors,
    relaxedFilter,
    selectedVendorId,
    setSelectedVendorId,
    toggleVendor,
    fetchingPlansFor,
  } = useHubVendorDiscovery(phone, HUB_DISCOVERY_SITTING, loadSitterRows);
  const [previousSitter, setPreviousSitter] = useState<any>(null);
  /** Carried into `pet-sitter-booking` so the sitting flow can pre-match the vendor’s service row. */
  const [selectedSittingOption, setSelectedSittingOption] = useState<string | null>(null);
  const featuredRef = useRef<HTMLDivElement>(null);
  const scrollRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPreviousSitter();
  }, [phone]);

  useEffect(() => {
    if (hubMode) return;
    setSelectedSittingOption(initialSittingOptionId ?? null);
  }, [hubMode, initialSittingOptionId]);

  const loadPreviousSitter = async () => {
    try {
      const response = await apiClient
        .get<any>(
          `/customer/${phone}/previous-providers?serviceType=sitting`
        )
        .catch(() => null);
      if (response?.provider) {
        const p = response.provider;
        const prc = Number(p.totalReviews ?? p.reviewCount ?? 0) || 0;
        const praw = p.rating != null ? Number(p.rating) : NaN;
        const pr = prc > 0 && Number.isFinite(praw) && praw > 0 ? praw : 0;
        setPreviousSitter({
          id: p.id,
          name: p.businessName || p.name,
          photo: p.photo,
          rating: pr,
          lastVisit: p.lastVisit,
        });
      } else {
        const pkgRes = await apiClient
          .get<any>(`/customer/${phone}/packages?serviceType=sitting`)
          .catch(() => null);
        if (pkgRes?.packages?.length > 0) {
          const pkg = pkgRes.packages[0];
          if (pkg.vendorId && pkg.vendorName) {
            setPreviousSitter({
              id: pkg.vendorId,
              name: pkg.vendorName,
              photo: null,
              rating: 0,
              lastVisit: pkg.lastUsed || "Recently",
            });
          }
        }
      }
    } catch {
      /* ignore */
    }
  };

  const goBook = (vendorId: string) => {
    onNavigate?.("pet-sitter-booking", {
      vendorId,
      serviceType: "sitting",
      sittingOptionId: selectedSittingOption || undefined,
    });
  };

  const handleWarmpawzBookAppointment = useCallback(
    (v: BoardingListVendor) => {
      onNavigate?.(
        'grooming-booking',
        buildHubWarmpawzBookingNav(v, { category: 'sitting', serviceStyle: 'at_center' })
      );
    },
    [onNavigate]
  );

  const handleBookPlan = (v: BoardingListVendor, plan: BoardingPlanRow) => {
    onNavigate?.("pet-sitter-booking", {
      vendorId: v.id,
      serviceType: "sitting",
      serviceId: plan.rowId,
      serviceName: plan.name,
      price: plan.price,
      sittingOptionId: selectedSittingOption || undefined,
    });
  };

  /** Chevron / “Details” → vendor profile (not the booking stepper). */
  const openSitterVendorProfile = (e: MouseEvent, v: BoardingListVendor) => {
    e.stopPropagation();
    const row: Record<string, unknown> = {
      ...(v.raw && typeof v.raw === "object" ? (v.raw as Record<string, unknown>) : {}),
      id: v.id,
      type: "vendor",
    };
    const vid = pickCustomerVendorAccountId(row) || v.id;
    onNavigate?.("pet-sitter-provider-profile", { vendorId: vid });
  };

  const displaySitters = vendors;

  const scrollToFeatured = () => {
    const scrollEl = scrollRootRef.current;
    const target = featuredRef.current;
    if (scrollEl && target) {
      const rootRect = scrollEl.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const nextTop =
        targetRect.top - rootRect.top + scrollEl.scrollTop - 16;
      scrollEl.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
      return;
    }
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSittingOptionPress = (optionId: string) => {
    setSelectedSittingOption(optionId);
    if (displaySitters.length === 0) {
      toast.info("No sitters in your area yet — browse the full list or check back soon.", {
        duration: 4500,
      });
    }
    /** Always navigate so taps reliably change screen (scroll-only felt broken on mobile / overlap cases). */
    onNavigate?.("pet-sitter-vendors", { sittingOptionId: optionId });
  };

  const handleStatClick = (index: number) => {
    if (index === 0) {
      onNavigate?.("pet-sitter-vendors");
      return;
    }
    if (displaySitters.length === 0) {
      toast.info("No sitters to show yet — opening the full list.");
      onNavigate?.("pet-sitter-vendors");
      return;
    }
    scrollToFeatured();
  };

  const headerStats = EMPTY_SERVICE_HEADER_STATS;

  if (vendorsLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#FF8C42] border-t-transparent" />
      </div>
    );
  }

  const handleDoorstepBannerPress = () => {
    if (displaySitters.length === 0) {
      toast.info("We'll show every sitter we can find on the next screen.");
      onNavigate?.("pet-sitter-vendors");
      return;
    }
    scrollToFeatured();
  };

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-gray-50">
      <ServiceDashboardHeader
        fullWidth
        serviceName="Pet Sitting"
        serviceSubtitle="Trusted care at your home."
        serviceIcon={Home}
        iconColor="text-white"
        stats={headerStats}
        onStatClick={handleStatClick}
        onBack={onBack}
        showBackButton
        headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"
        sheetToneClass="bg-white"
        headerBackground={<SittingHeaderBackground />}
        headerTrailingImage={SITTING_HEADER_TRAILING}
        headerTrailingImageAlt="Kitten and puppy peeking over the header"
        clipHeaderTrailingImage
        headerTrailingImageClassName="pointer-events-none absolute bottom-0 right-0 top-[2.75rem] z-[5] flex w-[72%] max-w-[400px] items-end justify-end sm:top-12"
        headerTrailingImageImgClassName="block h-full w-auto max-w-full origin-bottom-right scale-[1.28] object-contain object-right object-bottom drop-shadow-lg"
      />
      <div
        ref={scrollRootRef}
        className="relative z-[30] -mt-4 min-h-0 flex-1 touch-pan-y overflow-y-auto overflow-x-hidden rounded-t-[1.75rem] bg-white sm:rounded-t-[2rem]"
      >
        <div className="mx-auto w-full max-w-customer bg-white px-4 pt-5 pb-2">
          <div className="space-y-8">
            <FeaturedVendorSpotlights service="sitting" phone={phone} onNavigate={onNavigate} />

            <button
              type="button"
              onClick={handleDoorstepBannerPress}
              className="group w-full overflow-hidden rounded-2xl border border-orange-100/80 bg-white text-left shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8C42]"
              aria-label="Jump to sitters near you"
            >
              <div className="relative flex min-h-[132px]">
                <div className="relative z-10 flex flex-1 flex-col justify-center gap-1.5 p-4 pr-2 sm:p-5">
                  <div className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
                    <Home className="h-5 w-5 text-[#FF8C42]" aria-hidden />
                  </div>
                  <h3 className="text-base font-bold leading-tight text-slate-900 sm:text-lg">
                    Care at your doorstep
                  </h3>
                  <p className="text-xs leading-snug text-slate-500 sm:text-sm">
                    Vetted sitters for walks, feeds, and overnight stays
                  </p>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#FF8C42] sm:text-sm">
                    Tap to see sitters
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
                <div className="relative flex w-[42%] shrink-0 items-end justify-center pb-5 pr-2 pt-2 sm:w-[44%] sm:pb-6 sm:pr-3">
                  <div className="relative aspect-[5/4] w-full max-w-[168px]">
                    <CachedImage
                      src={SITTING_BANNER_IMAGE}
                      alt="Dog and cat relaxing at home"
                      fill
                      className="object-contain object-bottom"
                      sizes="168px"
                      loading="eager"
                    />
                  </div>
                </div>
              </div>
            </button>

            {previousSitter && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-[#FF8C42]" />
                  <h2 className="text-lg font-bold text-slate-900">
                    Book again
                  </h2>
                </div>
                <div className="rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 p-4">
                  <div className="flex items-center gap-4">
                    {previousSitter.photo ? (
                      <img
                        src={previousSitter.photo}
                        alt={previousSitter.name}
                        className="h-16 w-16 rounded-xl border-2 border-orange-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-orange-200 bg-orange-100 text-xl font-bold text-[#FF8C42]">
                        {previousSitter.name?.charAt(0) || "S"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-bold text-slate-900">
                        {previousSitter.name}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                        <Star className="h-4 w-4 fill-[#FF8C42] text-[#FF8C42]" />{" "}
                        {previousSitter.rating}
                        <span>•</span>
                        <span>
                          Last:{" "}
                          {previousSitter.lastVisit || "Recently"}
                        </span>
                      </div>
                    </div>
                    <Button
                      className="shrink-0 bg-[#FF8C42] text-white hover:bg-[#FF7A35]"
                      onClick={() => {
                        setSelectedSittingOption(null);
                        goBook(previousSitter.id);
                      }}
                    >
                      Book
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="relative z-[1]">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-lg bg-orange-50 p-1.5">
                  <PawPrint className="h-4 w-4 text-[#FF8C42]" aria-hidden />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Sitting options</h2>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {SITTING_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const selected = selectedSittingOption === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSittingOptionPress(opt.id);
                      }}
                      className={`touch-manipulation ${SITTING_CARD_SHELL} ${opt.cardBg} ${
                        selected
                          ? "border-[#FF8C42] ring-2 ring-[#FF8C42]/30"
                          : "border-slate-100/80"
                      }`}
                    >
                      <SittingOptionCardBackground optionId={opt.id} />
                      <div className={SITTING_CARD_CONTENT}>
                        <div
                          className={`${SITTING_CARD_ICON} transition-transform group-hover:scale-105 ${opt.iconWrap}`}
                        >
                          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                        <h3 className="text-xs font-bold leading-snug text-slate-900 sm:text-sm">
                          {opt.title}
                        </h3>
                        <p className="text-[10px] leading-snug text-slate-500 sm:text-[11px]">
                          {opt.desc}
                        </p>
                        <p className="text-[11px] font-bold text-[#FF8C42] sm:text-xs">
                          {opt.price}
                        </p>
                      </div>
                      <div className={SITTING_CARD_IMAGE}>
                        <CachedImage
                          src={opt.image}
                          alt={opt.title}
                          fill
                          className="object-contain object-bottom"
                          sizes="(max-width: 640px) 52px, 76px"
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div ref={featuredRef}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  {hubMode ? "Featured sitters" : "All sitters"}
                </h2>
                {hubMode ? (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-sm font-medium text-[#FF8C42]"
                    onClick={() => onNavigate?.("pet-sitter-vendors")}
                  >
                    View all <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">
                    {vendors.length} nearby
                  </span>
                )}
              </div>
              {relaxedFilter && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
                  Showing all sitters we could match — expand for services and prices.
                </p>
              )}
              <div className="space-y-4">
                {displaySitters.length === 0 ? (
                  <Card className="p-8 text-center">
                    <div className="mb-3 text-4xl">🏠</div>
                    <p className="mb-2 text-gray-600">
                      No pet sitters in your area yet
                    </p>
                    <p className="text-sm text-gray-500">
                      Check back soon for in-home sitting.
                    </p>
                  </Card>
                ) : (
                  displaySitters.map((v) => {
                    const expanded = selectedVendorId === v.id;
                    const minP = minPriceForVendor(v);
                    return (
                      <BoardingVendorExpandableCard
                        key={v.id}
                        v={v}
                        serviceSlug={HUB_SLUG}
                        planBadgeLabel="Sitting"
                        expanded={expanded}
                        fetchingPlansFor={fetchingPlansFor}
                        minPrice={minP}
                        onToggleHeader={() => toggleVendor(v.id)}
                        onViewServices={(e) => {
                          e.stopPropagation();
                          setSelectedVendorId(v.id);
                        }}
                        onDetails={(e) => openSitterVendorProfile(e, v)}
                        onBookPlan={handleBookPlan}
                        onOpenCenterDetails={(e) => openSitterVendorProfile(e, v)}
                        customerId={phone}
                        serviceCategory="pet_sitting"
                        onBookAppointment={handleWarmpawzBookAppointment}
                      />
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
