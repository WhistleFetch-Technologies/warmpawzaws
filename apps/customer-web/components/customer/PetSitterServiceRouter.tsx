"use client";

import { useState, useEffect, useRef, useMemo, useCallback, type MouseEvent } from "react";
import {
  Home,
  Star,
  ChevronRight,
  RefreshCw,
  Moon,
  Sun,
  Calendar,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { PromotionBanner } from "./shared/PromotionBanner";
import { ServiceDashboardHeader } from "./shared/ServiceDashboardHeader";
import { BoardingVendorExpandableCard } from "./boarding/BoardingVendorExpandableCard";
import { useHubVendorDiscovery } from "@/hooks/useHubVendorDiscovery";
import { HUB_DISCOVERY_SITTING } from "@/lib/service-hub-discovery-config";
import { fetchPetSitterHubRows } from "@/lib/pet-sitter-hub-fetch";
import { minPriceForVendor } from "@/lib/boarding-vendor-booking-utils";
import type { BoardingListVendor, BoardingPlanRow } from "@/lib/boarding-vendor-discovery-map";
import type { BoardingServiceSlug } from "@/lib/boarding-service-types";
import { HUB_SERVICE_ICON_WRAP } from "@/lib/hub-service-option-styles";

interface PetSitterServiceRouterProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  /** When false (e.g. “View all”), list all sitters and hide the redundant View all control. */
  hubMode?: boolean;
  /** Set when opening full list from hub with a pre-selected sitting tile (`pet-sitter-facility` only). */
  initialSittingOptionId?: string | null;
}

/** In-home sitting offerings (2×2 grid) — same pattern as Boarding “options”; user books via a sitter below. */
const SITTING_OPTIONS = [
  {
    id: "overnight_sitting",
    title: "Overnight sitting",
    desc: "Sitter stays at your home",
    price: "₹899+",
    icon: Moon,
    iconWrap: HUB_SERVICE_ICON_WRAP.overnightMoon,
  },
  {
    id: "day_visits",
    title: "Day visits",
    desc: "Scheduled daytime check-ins",
    price: "₹549+",
    icon: Sun,
    iconWrap: HUB_SERVICE_ICON_WRAP.sunDaytime,
  },
  {
    id: "extended_home",
    title: "Extended stay",
    desc: "Multi-day in-home care",
    price: "₹1,499+",
    icon: Calendar,
    iconWrap: HUB_SERVICE_ICON_WRAP.calendarWeekly,
  },
  {
    id: "drop_in",
    title: "Drop-in visits",
    desc: "Quick feeding & breaks",
    price: "₹249+",
    icon: Clock,
    iconWrap: HUB_SERVICE_ICON_WRAP.clockFlexible,
  },
];

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
        setPreviousSitter({
          id: response.provider.id,
          name:
            response.provider.businessName ||
            response.provider.name,
          photo: response.provider.photo,
          rating: response.provider.rating || 4.8,
          lastVisit: response.provider.lastVisit,
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
              rating: 4.8,
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

  const openSitterDetails = (e: MouseEvent, vendorId: string) => {
    e.stopPropagation();
    goBook(vendorId);
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
    onNavigate?.("pet-sitter-facility", { sittingOptionId: optionId });
  };

  const handleStatClick = (index: number) => {
    if (index === 0) {
      onNavigate?.("pet-sitter-facility");
      return;
    }
    if (displaySitters.length === 0) {
      toast.info("No sitters to show yet — opening the full list.");
      onNavigate?.("pet-sitter-facility");
      return;
    }
    scrollToFeatured();
  };

  if (vendorsLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#FF8C42] border-t-transparent" />
      </div>
    );
  }

  const headerStats = useMemo(() => {
    const n = vendors.length;
    const rating =
      n > 0
        ? (vendors.reduce((a, v) => a + v.rating, 0) / n).toFixed(1)
        : "4.7";
    return [
      { value: `${n > 0 ? n : 12}+`, label: "Sitters" },
      { value: "8K+", label: "Visits" },
      {
        value: rating,
        label: "Rating",
        icon: <Star className="h-4 w-4 fill-current" />,
      },
    ];
  }, [vendors]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <ServiceDashboardHeader
        serviceName="Pet Sitting"
        serviceSubtitle="Trusted care at your home"
        serviceIcon={Home}
        iconColor="text-white"
        stats={headerStats}
        onStatClick={handleStatClick}
        onBack={onBack}
        showBackButton
        headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"
      />
      <div
        ref={scrollRootRef}
        className="relative z-[12] min-h-0 flex-1 touch-pan-y overflow-y-auto bg-white"
      >
        <div className="bg-white px-4 pt-4">
          <div className="space-y-8">
            <PromotionBanner
              service="sitting"
              maxPromotions={3}
              onNavigate={onNavigate}
            />

            <button
              type="button"
              onClick={() => {
                if (displaySitters.length === 0) {
                  toast.info("We’ll show every sitter we can find on the next screen.");
                  onNavigate?.("pet-sitter-facility");
                  return;
                }
                scrollToFeatured();
              }}
              className="w-full rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 p-4 text-left transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8C42]"
              aria-label="Jump to sitters near you"
            >
              <div className="flex items-center gap-3">
                <Home className="h-8 w-8 shrink-0 text-[#FF8C42]" />
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Care at your doorstep
                  </h3>
                  <p className="text-sm text-slate-600">
                    Vetted sitters for walks, feeds, and overnight stays
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#FF8C42]">
                    Tap to see sitters
                  </p>
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

            <div>
              <h2 className="mb-4 text-lg font-bold text-slate-900">
                Sitting options
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {SITTING_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSittingOptionPress(opt.id)}
                      className={`group relative overflow-hidden rounded-2xl border p-4 text-left shadow-sm transition-all hover:shadow-md ${
                        selectedSittingOption === opt.id
                          ? "border-[#FF8C42] ring-2 ring-[#FF8C42]/30"
                          : "border-slate-100 bg-white"
                      }`}
                    >
                      <div
                        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${opt.iconWrap}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mb-0.5 text-sm font-semibold text-slate-900">
                        {opt.title}
                      </h3>
                      <p className="text-xs text-slate-500">{opt.desc}</p>
                      <p className="mt-2 text-xs font-bold text-[#FF8C42]">
                        {opt.price}
                      </p>
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
                    onClick={() => onNavigate?.("pet-sitter-facility")}
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
                        onDetails={openSitterDetails}
                        onBookPlan={handleBookPlan}
                        onOpenCenterDetails={openSitterDetails}
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
