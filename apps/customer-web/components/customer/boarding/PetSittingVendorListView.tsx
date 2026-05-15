"use client";

import { useState, useMemo, useCallback, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, Star, Home } from "lucide-react";
import { useHubVendorDiscovery } from "@/hooks/useHubVendorDiscovery";
import { HUB_DISCOVERY_SITTING } from "@/lib/service-hub-discovery-config";
import { fetchPetSitterHubRows } from "@/lib/pet-sitter-hub-fetch";
import { BoardingVendorExpandableCard } from "./BoardingVendorExpandableCard";
import { ServiceDashboardHeader } from "../shared/ServiceDashboardHeader";
import { StandardizedFooter } from "../shared/StandardizedFooter";
import { minPriceForVendor } from "@/lib/boarding-vendor-booking-utils";
import type { BoardingListVendor, BoardingPlanRow } from "@/lib/boarding-vendor-discovery-map";
import { pickCustomerVendorAccountId } from "@warmpawz/shared-types";

const HUB_SLUG = "all" as const;

const OPTION_TITLES: Record<string, string> = {
  overnight_sitting: "Overnight sitting",
  day_visits: "Day visits",
  extended_home: "Extended stay",
  drop_in: "Drop-in visits",
};

export interface PetSittingVendorListViewProps {
  phone: string;
  sittingOptionId?: string | null;
  onBack?: () => void;
  onNavigate?: (screen: string, data?: Record<string, unknown>) => void;
}

export function PetSittingVendorListView({
  phone,
  sittingOptionId,
  onBack,
  onNavigate,
}: PetSittingVendorListViewProps) {
  const router = useRouter();
  const loadRows = useCallback(() => fetchPetSitterHubRows(phone), [phone]);
  const {
    loading,
    vendors,
    relaxedFilter,
    selectedVendorId,
    setSelectedVendorId,
    toggleVendor,
    fetchingPlansFor,
  } = useHubVendorDiscovery(phone, HUB_DISCOVERY_SITTING, loadRows);

  const subtitle =
    sittingOptionId && OPTION_TITLES[sittingOptionId]
      ? `${OPTION_TITLES[sittingOptionId]} — choose a sitter`
      : "All sitters — choose a sitter";

  const handleBookPlan = useCallback(
    (v: BoardingListVendor, plan: BoardingPlanRow) => {
      if (onNavigate) {
        onNavigate("pet-sitter-booking", {
          vendorId: v.id,
          serviceType: "sitting",
          serviceId: plan.rowId,
          serviceName: plan.name,
          price: plan.price,
          sittingOptionId: sittingOptionId || undefined,
        });
        return;
      }
      router.push("/");
    },
    [onNavigate, router, sittingOptionId]
  );

  const openSitterVendorProfile = useCallback(
    (e: MouseEvent, v: BoardingListVendor) => {
      e.stopPropagation();
      const row: Record<string, unknown> = {
        ...(v.raw && typeof v.raw === "object" ? (v.raw as Record<string, unknown>) : {}),
        id: v.id,
        type: "vendor",
      };
      const vid = pickCustomerVendorAccountId(row) || v.id;
      if (onNavigate) {
        onNavigate("pet-sitter-provider-profile", { vendorId: vid });
        return;
      }
      router.push("/");
    },
    [onNavigate, router]
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "rating" | "distance" | "price">("all");

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

  const dashboardStats = [
    { value: `${sortedVendors.length > 0 ? sortedVendors.length : 0}+`, label: "Sitters", icon: <Home className="h-4 w-4" /> },
    { value: "8K+", label: "Visits" },
    { value: "—", label: "Rating", icon: <Star className="h-4 w-4 fill-white" /> },
  ];

  const handleBack = () => {
    if (onBack) onBack();
    else router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ServiceDashboardHeader
        serviceName="Pet Sitting"
        serviceSubtitle={subtitle}
        serviceIcon={Home}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={handleBack}
        showBackButton
        headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"
        sheetToneClass="bg-gray-50"
      />

      <div className="mx-auto max-w-customer px-4 pb-28 pt-4">
        {relaxedFilter && (
          <p className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Showing all sitters we could match — expand for services and prices.
          </p>
        )}

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search sitters..."
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
            <p className="mt-4 text-sm text-gray-500">Finding sitters...</p>
          </div>
        ) : sortedVendors.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF5EE] text-3xl">🏠</div>
            <p className="font-semibold text-gray-800">No sitters found</p>
            <p className="mt-1 text-sm text-gray-500">Try another filter or check back soon</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">{sortedVendors.length} sitters found</p>
            {sortedVendors.map((v) => {
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
                />
              );
            })}
          </div>
        )}
      </div>

      <StandardizedFooter
        currentTab="home"
        onTabChange={(tab) => {
          if (tab === "home") router.push("/");
          else if (tab === "bookings") router.push("/bookings");
          else if (tab === "cart") router.push("/cart");
          else if (tab === "profile") router.push("/profile");
        }}
        maxWidth="max-w-customer"
      />
    </div>
  );
}
