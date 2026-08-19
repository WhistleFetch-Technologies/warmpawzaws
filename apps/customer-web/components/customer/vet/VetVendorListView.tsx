"use client";

import { useState, useMemo, useCallback, type MouseEvent } from "react";
import { Search, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { useHubVendorDiscovery } from "@/hooks/useHubVendorDiscovery";
import { HUB_DISCOVERY_VET } from "@/lib/service-hub-discovery-config";
import { BoardingVendorExpandableCard } from "../boarding/BoardingVendorExpandableCard";
import { ServiceDashboardHeader } from "../shared/ServiceDashboardHeader";
import { StandardizedFooter } from "../shared/StandardizedFooter";
import { DiscoveryVendorFeedSentinel } from "../shared/DiscoveryVendorFeedSentinel";
import { minPriceForVendor } from "@/lib/boarding-vendor-booking-utils";
import type { BoardingListVendor, BoardingPlanRow } from "@/lib/boarding-vendor-discovery-map";
import { EMPTY_SERVICE_HEADER_STATS } from "@/lib/service-header-stats";
import {
  buildVetHubBookPlanNav,
  buildVetHubProviderProfileNav,
} from "@/lib/vet-hub-vendor-nav";
import type { BoardingServiceSlug } from "@/lib/boarding-service-types";
import { DiscoveryLocationRequired } from "../shared/DiscoveryLocationRequired";
import { hasStoredDiscoveryCoords } from "@/lib/customer-discovery-coords";

const HUB_SLUG: BoardingServiceSlug = "all";
const PROFILE_BACK_SCREEN = "vet-all-doctors" as const;

export interface VetVendorListViewProps {
  phone: string;
  onBack?: () => void;
  onNavigate?: (screen: string, data?: Record<string, unknown>) => void;
}

export function VetVendorListView({ phone, onBack, onNavigate }: VetVendorListViewProps) {
  const {
    loading,
    loadingMore,
    hasMore,
    loadMore,
    vendors,
    relaxedFilter,
    selectedVendorId,
    setSelectedVendorId,
    toggleVendor,
    fetchingPlansFor,
    loadVendors,
  } = useHubVendorDiscovery(phone, HUB_DISCOVERY_VET);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "rating" | "distance" | "price">(
    "all"
  );

  const filteredVendors = useMemo(() => {
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.address.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [vendors, searchQuery]);

  const sortedVendors = useMemo(() => {
    return [...filteredVendors].sort((a, b) => {
      switch (selectedFilter) {
        case "rating":
          return b.rating - a.rating;
        case "distance":
          return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
        case "price": {
          const minP = (v: BoardingListVendor) =>
            minPriceForVendor(v) ?? parseInt(String(v.price_label).replace(/[^0-9]/g, "") || "0", 10);
          return minP(a) - minP(b);
        }
        default:
          return 0;
      }
    });
  }, [filteredVendors, selectedFilter]);

  const filters = [
    { id: "all" as const, label: "All" },
    { id: "rating" as const, label: "Top rated" },
    { id: "distance" as const, label: "Nearest" },
    { id: "price" as const, label: "Price" },
  ];

  const dashboardStats = EMPTY_SERVICE_HEADER_STATS;

  const handleBack = () => {
    onBack?.();
  };

  const handleBookPlan = useCallback(
    (v: BoardingListVendor, plan: BoardingPlanRow) => {
      const target = buildVetHubBookPlanNav(v, plan, PROFILE_BACK_SCREEN);
      if (!target) return;
      onNavigate?.(target.screen, target.data);
    },
    [onNavigate]
  );

  const openVetProviderProfile = useCallback(
    (e: MouseEvent, profileKey: string) => {
      e.stopPropagation();
      const target = buildVetHubProviderProfileNav(vendors, profileKey, PROFILE_BACK_SCREEN);
      if (!target) {
        toast.error("Could not open this profile. Try View Services or refresh.");
        return;
      }
      onNavigate?.(target.screen, target.data);
    },
    [onNavigate, vendors]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <ServiceDashboardHeader
        serviceName="All Veterinarians"
        serviceSubtitle="Browse featured vets"
        serviceIcon={Stethoscope}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={handleBack}
        showBackButton
        headerColor="bg-[#FF8C42]"
        sheetToneClass="bg-gray-50"
      />

      <div className="mx-auto max-w-customer px-4 pb-28 pt-4">
        {relaxedFilter && (
          <p className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Showing all veterinary providers we could match — expand for services and prices.
          </p>
        )}

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search veterinarians..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-gray-100 bg-gray-50 py-3 pl-11 pr-4 text-gray-900 placeholder:text-gray-400 transition focus:border-[#FF8C42] focus:outline-none focus:ring-2 focus:ring-[#FF8C42]/40"
          />
        </div>

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setSelectedFilter(filter.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                selectedFilter === filter.id
                  ? "bg-[#FF8C42] text-white shadow-[0_2px_8px_rgba(255,140,66,0.35)]"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#FF8C42]/30 border-t-[#FF8C42]" />
            <p className="mt-4 text-sm text-gray-500">Finding veterinarians...</p>
          </div>
        ) : sortedVendors.length === 0 ? (
          !hasStoredDiscoveryCoords() && !searchQuery ? (
            <DiscoveryLocationRequired
              title="Detect location for veterinarians"
              description="Set your location to find veterinarians near you."
              onLocationReady={() => void loadVendors()}
            />
          ) : (
          <div className="px-4 py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF5EE] text-3xl">
              🩺
            </div>
            <p className="font-semibold text-gray-800">No veterinarians found</p>
            <p className="mt-1 text-sm text-gray-500">Try another filter or check back soon</p>
          </div>
          )
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">
              {sortedVendors.length} veterinarian{sortedVendors.length !== 1 ? "s" : ""} found
            </p>
            {sortedVendors.map((v) => {
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
                  onDetails={openVetProviderProfile}
                  onBookPlan={handleBookPlan}
                  onOpenCenterDetails={openVetProviderProfile}
                  customerId={phone}
                  serviceCategory="vet"
                />
              );
            })}
            <DiscoveryVendorFeedSentinel
              hasMore={hasMore}
              loading={loading}
              loadingMore={loadingMore}
              onLoadMore={() => void loadMore()}
            />
          </div>
        )}
      </div>

      <StandardizedFooter
        currentTab="home"
        onTabChange={(tab) => {
          if (tab === "home") onNavigate?.("home");
          else if (tab === "bookings") onNavigate?.("my-bookings");
          else if (tab === "shop") onNavigate?.("shop");
          else if (tab === "profile") onNavigate?.("profile");
        }}
        maxWidth="max-w-customer"
      />
    </div>
  );
}
