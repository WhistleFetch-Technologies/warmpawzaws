"use client";

import { useState, useEffect, useRef } from "react";
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
import { PromotionBanner } from "./shared/PromotionBanner";
import { ServiceDashboardHeader } from "./shared/ServiceDashboardHeader";
import { FeaturedProviderCard } from "./shared/FeaturedProviderCard";
import { normalizeAndDedupeDiscoveryProviders } from "@/lib/featured-provider";
import { HUB_SERVICE_ICON_WRAP } from "@/lib/hub-service-option-styles";

interface PetSitterServiceRouterProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  /** When false (e.g. “View all”), list all sitters and hide the redundant View all control. */
  hubMode?: boolean;
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

export function PetSitterServiceRouter({
  phone,
  onBack,
  onNavigate,
  hubMode = true,
}: PetSitterServiceRouterProps) {
  const [loading, setLoading] = useState(true);
  const [sitters, setSitters] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [previousSitter, setPreviousSitter] = useState<any>(null);
  const featuredRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSitters();
    loadPreviousSitter();
  }, []);

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

  const loadSitters = async () => {
    try {
      setLoading(true);
      // discover-services requires serviceStyle; pet sitting is always at_home (matches HomeServiceProviderListView / WalkerService).
      const locationParams = await (async (): Promise<string> => {
        try {
          const lat =
            typeof localStorage !== "undefined" &&
            localStorage.getItem("customer_latitude");
          const lng =
            typeof localStorage !== "undefined" &&
            localStorage.getItem("customer_longitude");
          if (lat && lng)
            return `&latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}`;
        } catch {
          /* ignore */
        }
        if (phone) {
          try {
            const profileRes = (await apiClient.get(
              `/customer/profile?phone=${encodeURIComponent(phone)}`
            )) as any;
            const profile = profileRes?.profile || profileRes;
            if (
              profile?.latitude != null &&
              profile?.longitude != null
            ) {
              return `&latitude=${encodeURIComponent(String(profile.latitude))}&longitude=${encodeURIComponent(String(profile.longitude))}`;
            }
          } catch {
            /* ignore */
          }
        }
        if (
          typeof navigator !== "undefined" &&
          navigator.geolocation
        ) {
          try {
            const pos = await new Promise<GeolocationPosition>(
              (resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                  resolve,
                  reject,
                  { timeout: 8000, maximumAge: 600000 }
                );
              }
            );
            return `&latitude=${encodeURIComponent(String(pos.coords.latitude))}&longitude=${encodeURIComponent(String(pos.coords.longitude))}`;
          } catch {
            /* ignore */
          }
        }
        return "";
      })();

      const phoneParam = phone
        ? `&phone=${encodeURIComponent(phone)}`
        : "";

      const base =
        "/customer/discover-services?category=sitting&serviceStyle=at_home";

      const extractProviderList = (payload: any): any[] => {
        if (!payload || typeof payload !== "object") return [];
        const inner = payload.data && typeof payload.data === "object" ? payload.data : payload;
        return (
          inner.vendors ||
          inner.providers ||
          inner.services ||
          []
        );
      };

      const fetchSittersWithLocationSuffix = async (
        locSuffix: string
      ): Promise<any[]> => {
        let list: any[] = [];

        try {
          const data = await apiClient.get<Record<string, unknown>>(
            `${base}&roleId=pet_sitter${locSuffix}${phoneParam}`
          );
          list = extractProviderList(data);
        } catch {
          list = [];
        }

        if (list.length === 0) {
          try {
            const fallback = await apiClient.get<Record<string, unknown>>(
              `${base}${locSuffix}${phoneParam}`
            );
            list = extractProviderList(fallback);
          } catch {
            list = [];
          }
        }

        if (list.length === 0) {
          try {
            const alt = await apiClient.get<Record<string, unknown>>(
              `${base}&roleId=sitter${locSuffix}${phoneParam}`
            );
            list = extractProviderList(alt);
          } catch {
            list = [];
          }
        }

        if (list.length === 0) {
          try {
            const svc = await apiClient.get<{ services?: any[] }>(
              `/customer/services?roleId=pet_sitter&serviceStyle=at_home${locSuffix}`
            );
            const services = svc.services || [];
            const byVendor = new Map<string, any>();
            for (const s of services) {
              const vid = s.vendorId;
              if (!vid || byVendor.has(vid)) continue;
              byVendor.set(vid, {
                id: vid,
                vendorId: vid,
                businessName: s.vendorName,
                name: s.vendorName,
                rating: 4.7,
                basePrice: s.price,
              });
            }
            list = Array.from(byVendor.values());
          } catch {
            /* ignore */
          }
        }

        return list;
      };

      let list = await fetchSittersWithLocationSuffix(locationParams);
      /* When lat/lng is present, API applies a radius; sitters outside it or without geocode vanish. Retry without coords so the list is stable. */
      if (list.length === 0 && locationParams) {
        list = await fetchSittersWithLocationSuffix("");
      }

      setSitters(list);
      const dedupedSitters = normalizeAndDedupeDiscoveryProviders(list, "sitting");
      setStats({
        activeSitters: dedupedSitters.length || list.length || 12,
        visits: "8K+",
        rating:
          dedupedSitters.length > 0
            ? Number(
                dedupedSitters.reduce(
                  (acc, v) => acc + Number(v.rating || 0),
                  0
                ) / dedupedSitters.length
              ).toFixed(1)
            : list.length > 0
              ? Number(
                  list.reduce(
                    (acc: number, v: any) =>
                      acc + Number(v.rating || 4.7),
                    0
                  ) / list.length
                ).toFixed(1)
              : "4.7",
      });
    } catch (e) {
      console.error("Error loading pet sitters:", e);
      setSitters([]);
      setStats({ activeSitters: 12, visits: "8K+", rating: "4.7" });
    } finally {
      setLoading(false);
    }
  };

  const goBook = (vendorId: string) => {
    onNavigate?.("pet-sitter-booking", {
      vendorId,
      serviceType: "sitting",
    });
  };

  const featuredSitters = normalizeAndDedupeDiscoveryProviders(sitters, "sitting");
  const displaySitters = hubMode
    ? featuredSitters.slice(0, 5)
    : featuredSitters;

  const scrollToFeatured = () => {
    featuredRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#FF8C42] border-t-transparent" />
      </div>
    );
  }

  const headerStats = stats
    ? [
        { value: `${stats.activeSitters}+`, label: "Sitters" },
        { value: stats.visits, label: "Visits" },
        {
          value: stats.rating,
          label: "Rating",
          icon: <Star className="h-4 w-4 fill-current" />,
        },
      ]
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <ServiceDashboardHeader
        serviceName="Pet Sitting"
        serviceSubtitle="Trusted care at your home"
        serviceIcon={Home}
        iconColor="text-white"
        stats={headerStats}
        onBack={onBack}
        showBackButton
        headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"
      />
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="bg-white px-4 pt-4">
          <div className="space-y-8">
            <PromotionBanner
              service="sitting"
              maxPromotions={3}
              onNavigate={onNavigate}
            />

            <div className="rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 p-4">
              <div className="flex items-center gap-3">
                <Home className="h-8 w-8 shrink-0 text-[#FF8C42]" />
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Care at your doorstep
                  </h3>
                  <p className="text-sm text-slate-600">
                    Vetted sitters for walks, feeds, and overnight stays
                  </p>
                </div>
              </div>
            </div>

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
                      onClick={() => goBook(previousSitter.id)}
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
                      onClick={scrollToFeatured}
                      className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md"
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
                    {featuredSitters.length} nearby
                  </span>
                )}
              </div>
              <div className="space-y-3">
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
                  displaySitters.map((provider) => (
                    <FeaturedProviderCard
                      key={provider.id}
                      provider={provider}
                      onClick={() => goBook(provider.id)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
