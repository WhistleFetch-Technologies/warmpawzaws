"use client";

import { useState, useEffect, useMemo, useCallback, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Star,
  MapPin,
  Clock,
  Search,
  ChevronRight,
  Building2,
  Home,
  Shield,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { ServiceDashboardHeader } from '../shared/ServiceDashboardHeader';
import { StandardizedFooter } from '../shared/StandardizedFooter';
import { ServiceDescriptionInline } from '../shared/ServiceDescriptionInline';
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import {
  BOARDING_SERVICE_LABELS,
  type BoardingServiceSlug,
  normalizeBoardingServiceSlug,
  vendorOffersBoardingSlug,
  boardingSlugMatchesText,
} from '@/lib/boarding-service-types';

export interface BoardingVendorListViewProps {
  phone: string;
  serviceSlug: string;
  onBack?: () => void;
  /** When set (e.g. from CustomerHomeWrapper), Book Now uses the same boarding-booking flow as the vendor profile. */
  onNavigate?: (screen: string, data?: Record<string, unknown>) => void;
}

interface BoardingVendorCard {
  id: string;
  name: string;
  address: string;
  rating: number;
  review_count: number;
  distance?: string | null;
  distanceKm: number | null;
  timing: string;
  services: string[];
  price_label: string;
  is_open?: boolean;
  photo?: string;
  raw?: Record<string, unknown>;
}

/** One bookable boarding row — stable row id for booking (matches BoardingVendorProfileView). */
export interface BoardingPlanRow {
  rowId: string;
  serviceId?: string;
  name: string;
  price: number;
  duration?: number;
  serviceStyle?: string;
  description?: string;
}

interface BoardingListVendor extends BoardingVendorCard {
  planRows: BoardingPlanRow[];
  needsServiceFetch: boolean;
  isVerified?: boolean;
}

/**
 * discover-services returns one object per vendor with nested `services[]` ({ name, price, ... }).
 * Flat legacy rows use top-level serviceName / name per row — we merge both for filtering chips.
 */
function collectPublishedPlanLabels(row: any): string[] {
  const labels: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (t && !labels.includes(t)) labels.push(t);
  };
  const arr = row?.services;
  if (Array.isArray(arr)) {
    for (const item of arr) {
      if (item == null) continue;
      if (typeof item === 'string') {
        push(item);
        continue;
      }
      const label =
        item.name ||
        item.serviceName ||
        item.service_name ||
        item.displayName ||
        item.title ||
        '';
      if (label) push(String(label));
    }
  }
  const top =
    row?.serviceName ||
    row?.service_name ||
    (typeof row?.service === 'string' ? row.service : '') ||
    '';
  if (top) push(String(top));

  return labels;
}

function pickBestDescription(p: Record<string, unknown>): string {
  const candidates: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) candidates.push(v.trim());
  };
  push(p.longDescription);
  push(p.long_description);
  push(p.description);
  push(p.custom_description);
  push(p.customDescription);
  push(p.shortDescription);
  if (candidates.length === 0) return '';
  return candidates.reduce((a, b) => (b.length > a.length ? b : a), '');
}

function planRowsFromDiscoveryServices(services: unknown[] | undefined): BoardingPlanRow[] {
  if (!Array.isArray(services)) return [];
  const out: BoardingPlanRow[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < services.length; i++) {
    const s = services[i] as Record<string, unknown> | string | null;
    if (s == null || typeof s === 'string') continue;
    const rowId = String(s.id ?? s.vendorServiceId ?? s.serviceId ?? '');
    const name = String(s.serviceName || s.name || s.service_name || '').trim();
    if (!rowId || !name) continue;
    if (seen.has(rowId)) continue;
    seen.add(rowId);
    const price = parseFloat(String(s.price ?? s.custom_price ?? s.base_price ?? '0')) || 0;
    const desc = pickBestDescription(s);
    out.push({
      rowId,
      serviceId: (s.serviceId || s.service_id) as string | undefined,
      name: name || 'Boarding',
      price,
      duration: (s.duration || s.duration_minutes) as number | undefined,
      serviceStyle: (s.serviceStyle || s.service_style) as string | undefined,
      description: desc || undefined,
    });
  }
  return out;
}

function mergePlanRows(a: BoardingPlanRow[], b: BoardingPlanRow[]): BoardingPlanRow[] {
  const seen = new Set<string>();
  const out: BoardingPlanRow[] = [];
  for (const row of [...a, ...b]) {
    if (!row.rowId || seen.has(row.rowId)) continue;
    seen.add(row.rowId);
    out.push(row);
  }
  return out;
}

function mapServicesApiResponseToPlanRows(servicesResponse: any): BoardingPlanRow[] {
  let services: any[] = [];
  const servicesData = servicesResponse as any;
  if (servicesData?.services && Array.isArray(servicesData.services)) {
    services = servicesData.services;
  } else if (servicesData?.services?.at_center) {
    services = servicesData.services.at_center?.services || [];
  } else if (Array.isArray(servicesData)) {
    services = servicesData;
  }
  const seen = new Set<string>();
  const mapped: BoardingPlanRow[] = [];
  for (const s of services) {
    const rowId = String(s.id ?? s.vendorServiceId ?? s.serviceId ?? '');
    if (!rowId || seen.has(rowId)) continue;
    seen.add(rowId);
    const desc = pickBestDescription(s);
    mapped.push({
      rowId,
      serviceId: s.serviceId || s.service_id,
      name: s.serviceName || s.name || s.service_name || 'Boarding',
      price: parseFloat(String(s.price || '0')) || 0,
      duration: s.duration || s.duration_minutes,
      serviceStyle: s.serviceStyle || s.service_style,
      description: desc || undefined,
    });
  }
  return mapped;
}

export function BoardingVendorListView({
  phone,
  serviceSlug: serviceSlugProp,
  onBack,
  onNavigate,
}: BoardingVendorListViewProps) {
  const router = useRouter();
  const serviceSlug = normalizeBoardingServiceSlug(serviceSlugProp);
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<BoardingListVendor[]>([]);
  const [relaxedFilter, setRelaxedFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'rating' | 'distance' | 'price'>('all');
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [fetchingPlansFor, setFetchingPlansFor] = useState<string | null>(null);

  useEffect(() => {
    loadVendors();
  }, [phone, serviceSlug]);

  const loadVendors = async () => {
    try {
      setLoading(true);
      let latitude: string | undefined;
      let longitude: string | undefined;
      try {
        const profileRes = (await apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`)) as any;
        const profile = profileRes?.profile || profileRes;
        if (profile?.latitude != null && profile?.longitude != null) {
          latitude = String(profile.latitude);
          longitude = String(profile.longitude);
        }
      } catch {
        /* ignore */
      }
      if (latitude == null && typeof window !== 'undefined') {
        try {
          const lat = localStorage.getItem('customer_latitude');
          const lng = localStorage.getItem('customer_longitude');
          if (lat && lng) {
            latitude = lat;
            longitude = lng;
          }
        } catch {
          /* ignore */
        }
      }
      const locationParams =
        latitude && longitude
          ? `&latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`
          : '';
      const phoneParam = phone ? `&customerPhone=${encodeURIComponent(phone)}` : '';

      let rows: any[] = [];
      try {
        const endpoint = `/customer/discover-services?category=boarding&roleId=pet_boarding&serviceStyle=at_center${locationParams}${phoneParam}`;
        const data = await apiClient.get<any>(endpoint);
        if (Array.isArray(data)) rows = data;
        else if (data?.vendors && Array.isArray(data.vendors)) rows = data.vendors;
        else if (data?.providers && Array.isArray(data.providers)) rows = data.providers;
        else if (data?.services && Array.isArray(data.services)) rows = data.services;
      } catch (e) {
        console.warn('[BoardingVendorListView] discover-services failed:', e);
      }

      if (rows.length === 0) {
        try {
          const altRes = await apiClient.get<any>(
            `/customer/services/by-style?style=at_center&category=boarding&roleId=pet_boarding${locationParams}${phoneParam}`
          );
          const alt = altRes?.vendors ?? altRes?.providers ?? altRes;
          if (Array.isArray(alt)) rows = alt;
        } catch (e) {
          console.warn('[BoardingVendorListView] by-style fallback failed:', e);
        }
      }

      const vendorMap = new Map<string, BoardingListVendor>();

      rows.forEach((service: any) => {
        const vendorId = String(service.vendorId || service.id || '');
        if (!vendorId) return;

        const planLabels = collectPublishedPlanLabels(service);
        const fromNested = planRowsFromDiscoveryServices(service.services);

        const timing =
          (() => {
            if (service.operatingHours && typeof service.operatingHours === 'object') {
              const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
              const today = days[new Date().getDay()];
              const todayHours = service.operatingHours[today];
              if (todayHours?.isOpen) return `${todayHours.open} - ${todayHours.close}`;
            }
            return service.businessHours || service.timing || '9 AM - 8 PM';
          })() || '9 AM - 8 PM';

        const basePrice =
          service.priceRange ||
          service.price_range ||
          (service.price ? `₹${service.price}` : '') ||
          (service.priceMin ? `From ₹${service.priceMin}` : '') ||
          (service.basePrice ? `₹${service.basePrice}` : '₹800+');

        const distKm = service.distance != null && service.distance !== '' ? Number(service.distance) : null;
        const distanceStr =
          distKm != null && Number.isFinite(distKm) ? `${distKm.toFixed(1)} km` : null;

        if (!vendorMap.has(vendorId)) {
          const venueName =
            service.vendorName ||
            service.businessName ||
            service.business_name ||
            service.name ||
            'Boarding center';
          const serviceLabelsForCard =
            planLabels.length > 0
              ? planLabels
              : service.name && String(service.name) !== String(venueName)
                ? [String(service.name)]
                : [];

          vendorMap.set(vendorId, {
            id: vendorId,
            name: venueName,
            address:
              service.vendorLocation?.address ||
              service.address ||
              `${service.city || ''}${service.city ? ', ' : ''}${service.pincode || ''}`.trim() ||
              'Location on booking',
            rating: parseFloat(service.vendorRating || service.rating || service.avgRating || '4.6'),
            review_count: parseInt(service.vendorReviewCount || service.reviewsCount || service.review_count || '0', 10),
            distance: distanceStr,
            distanceKm: distKm != null && Number.isFinite(distKm) ? distKm : null,
            timing,
            services: serviceLabelsForCard,
            price_label: basePrice,
            is_open:
              service.is_open !== undefined
                ? service.is_open
                : service.isAvailableToday !== undefined
                  ? service.isAvailableToday
                  : true,
            photo: service.vendorPhoto || service.photo || service.photoUrl || service.vendorProfileImage || service.businessPhoto,
            raw: { ...service },
            planRows: fromNested,
            needsServiceFetch: fromNested.length === 0,
            isVerified: !!service.isVerified,
          });
        } else {
          const v = vendorMap.get(vendorId)!;
          for (const lbl of planLabels) {
            if (!v.services.includes(lbl)) v.services.push(lbl);
          }
          v.planRows = mergePlanRows(v.planRows, fromNested);
          v.needsServiceFetch = v.planRows.length === 0;
        }
      });

      let list = Array.from(vendorMap.values());
      const filtered = list.filter((v) => {
        const raw = v.raw as Record<string, unknown>;
        const servicesForMatch =
          v.services.length > 0 ? v.services : raw?.services;
        return vendorOffersBoardingSlug({ ...raw, services: servicesForMatch }, serviceSlug);
      });
      if (filtered.length === 0 && list.length > 0) {
        setRelaxedFilter(true);
        list = list;
      } else {
        setRelaxedFilter(false);
        list = filtered;
      }

      setVendors(list);
    } catch (e) {
      console.error('[BoardingVendorListView]', e);
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendorPlans = useCallback(
    async (vendorId: string) => {
      setFetchingPlansFor(vendorId);
      try {
        const servicesResponse = await apiClient
          .get(`/customer/vendor/${vendorId}/services?category=boarding`)
          .catch(() => apiClient.get(`/customer/vendor/${vendorId}/services?serviceStyle=at_center`));
        const rows = mapServicesApiResponseToPlanRows(servicesResponse);
        setVendors((prev) =>
          prev.map((v) =>
            v.id === vendorId ? { ...v, planRows: rows, needsServiceFetch: false } : v
          )
        );
      } catch (e) {
        console.error('[BoardingVendorListView] vendor services fetch failed', e);
      } finally {
        setFetchingPlansFor(null);
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedVendorId) return;
    const v = vendors.find((x) => x.id === selectedVendorId);
    if (!v || !v.needsServiceFetch || v.planRows.length > 0) return;
    if (fetchingPlansFor === selectedVendorId) return;
    fetchVendorPlans(selectedVendorId);
  }, [selectedVendorId, vendors, fetchingPlansFor, fetchVendorPlans]);

  const toggleVendor = (vendorId: string) => {
    setSelectedVendorId((prev) => (prev === vendorId ? null : vendorId));
  };

  const priceForCard = (v: BoardingListVendor, slug: BoardingServiceSlug) => {
    for (const s of v.services) {
      if (boardingSlugMatchesText(slug, s)) {
        return v.price_label;
      }
    }
    return v.price_label;
  };

  const minPriceForVendor = (v: BoardingListVendor) => {
    if (!v.planRows.length) return null;
    return Math.min(...v.planRows.map((p) => p.price));
  };

  const buildFacilityPayload = (v: BoardingListVendor) => {
    const raw = (v.raw || {}) as Record<string, unknown>;
    return {
      id: v.id,
      name: v.name,
      description: (typeof raw.description === 'string' && raw.description) || '',
      address: v.address,
      city: String(raw.city || ''),
      pincode: String(raw.pincode || ''),
      phone: String(raw.phone || ''),
      rating: v.rating,
      review_count: v.review_count,
      timing: v.timing,
      photos: v.photo ? [v.photo] : [],
      amenities: Array.isArray(raw.amenities) ? (raw.amenities as string[]) : [],
    };
  };

  const handleBookPlan = (v: BoardingListVendor, plan: BoardingPlanRow) => {
    if (!onNavigate) {
      router.push(`/pet-boarding/vendor/${encodeURIComponent(v.id)}?service=${encodeURIComponent(serviceSlug)}`);
      return;
    }
    onNavigate('boarding-booking', {
      vendorId: v.id,
      serviceType: 'boarding',
      serviceId: plan.rowId,
      serviceName: plan.name,
      price: plan.price,
      duration: plan.duration || 1440,
      serviceStyle: plan.serviceStyle || 'at_center',
      facility: buildFacilityPayload(v),
    });
  };

  const openVendorProfile = (e: MouseEvent, vendorId: string) => {
    e.stopPropagation();
    router.push(`/pet-boarding/vendor/${encodeURIComponent(vendorId)}?service=${encodeURIComponent(serviceSlug)}`);
  };

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
        case 'rating':
          return b.rating - a.rating;
        case 'distance':
          return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
        case 'price': {
          const minP = (v: BoardingListVendor) => minPriceForVendor(v) ?? parseInt(String(v.price_label).replace(/[^0-9]/g, '') || '0', 10);
          return minP(a) - minP(b);
        }
        default:
          return 0;
      }
    });
  }, [filteredVendors, selectedFilter]);

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'rating', label: 'Top Rated' },
    { id: 'distance', label: 'Nearest' },
    { id: 'price', label: 'Price' },
  ];

  const dashboardStats = [
    { value: `${sortedVendors.length}+`, label: 'Centers', icon: <Home className="w-4 h-4" /> },
    { value: '5K+', label: 'Stays' },
    { value: '4.8', label: 'Rating', icon: <Star className="w-4 h-4 fill-white" /> },
  ];

  const subtitle = BOARDING_SERVICE_LABELS[serviceSlug];

  const handleBack = () => {
    if (onBack) onBack();
    else router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ServiceDashboardHeader
        serviceName="Pet Boarding"
        serviceSubtitle={subtitle}
        serviceIcon={Building2}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={handleBack}
        showBackButton={true}
        headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"
      />

      <div className="max-w-customer mx-auto px-4 pt-4 pb-28">
        {relaxedFilter && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
            No centers matched this service name in listings yet. Showing all pet boarding centers — expand a center or open details for exact services and prices.
          </p>
        )}

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search boarding centers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF8C42]/40 focus:border-[#FF8C42] transition-all"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mb-5">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setSelectedFilter(filter.id as typeof selectedFilter)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                selectedFilter === filter.id
                  ? 'bg-[#FF8C42] text-white shadow-[0_2px_8px_rgba(255,140,66,0.35)]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#FF8C42]/30 border-t-[#FF8C42]" />
            <p className="text-gray-500 text-sm mt-4">Finding boarding centers...</p>
          </div>
        ) : sortedVendors.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#FFF5EE] flex items-center justify-center text-3xl">🏠</div>
            <p className="text-gray-800 font-semibold">No boarding centers found</p>
            <p className="text-sm text-gray-500 mt-1">Try another service or check back soon</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">{sortedVendors.length} centers found</p>
            {sortedVendors.map((v) => {
              const expanded = selectedVendorId === v.id;
              const minP = minPriceForVendor(v);
              return (
                <Card key={v.id} className="bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleVendor(v.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleVendor(v.id);
                      }
                    }}
                    className="p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 text-left w-full"
                  >
                    <div className="flex gap-3">
                      {v.photo ? (
                        <img
                          src={v.photo}
                          alt={v.name}
                          className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#FF8C42]/20 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFF5EE] to-[#FFE8D6] flex items-center justify-center text-2xl flex-shrink-0 border border-orange-100/50">
                          <Building2 className="w-7 h-7 text-[#FF8C42]" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className="font-bold text-gray-900 truncate">{v.name}</h3>
                            {v.isVerified && (
                              <Shield className="w-4 h-4 text-green-500 shrink-0" aria-hidden />
                            )}
                          </div>
                          <ChevronRight
                            className={`w-5 h-5 text-gray-300 flex-shrink-0 transition-transform ${
                              expanded ? 'rotate-90' : ''
                            }`}
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                          <span className="font-semibold text-sm text-gray-800">{v.rating}</span>
                          <span className="text-gray-400 text-sm">({v.review_count})</span>
                          {v.distance && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="text-sm text-gray-500">{v.distance}</span>
                            </>
                          )}
                          {minP != null && v.planRows.length > 0 && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="text-sm font-semibold text-[#FF8C42]">
                                from {formatPriceWithSymbol(minP)}
                              </span>
                            </>
                          )}
                          {v.planRows.length === 0 && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="text-sm font-bold text-[#FF8C42]">{priceForCard(v, serviceSlug)}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 text-sm text-gray-500">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{v.address}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1.5 text-sm text-gray-500">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>{v.timing}</span>
                        </div>
                        {!expanded && v.planRows.length === 0 && v.services.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {v.services.slice(0, 4).map((s, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-600"
                              >
                                {s}
                              </span>
                            ))}
                            {v.services.length > 4 && (
                              <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-500">
                                +{v.services.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {expanded && (
                    <div className="bg-gray-50 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-gray-700">
                          Available Services ({v.planRows.length})
                        </h4>
                        <button
                          type="button"
                          onClick={(e) => openVendorProfile(e, v.id)}
                          className="text-xs font-medium text-[#FF8C42] hover:underline"
                        >
                          Center details
                        </button>
                      </div>

                      {fetchingPlansFor === v.id && v.planRows.length === 0 ? (
                        <div className="flex items-center justify-center py-8 text-gray-500 gap-2">
                          <Loader2 className="w-5 h-5 animate-spin text-[#FF8C42]" />
                          <span className="text-sm">Loading services…</span>
                        </div>
                      ) : v.planRows.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                          No services listed for this center.
                        </p>
                      ) : (
                        <div className="max-h-[min(60vh,28rem)] overflow-y-auto pr-1 space-y-3">
                          {v.planRows.map((plan) => {
                            const descTrim = plan.description?.trim() ?? '';
                            return (
                              <div
                                key={plan.rowId}
                                className="bg-white rounded-lg p-4 shadow-sm border border-gray-100"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <h5 className="font-medium text-gray-900">{plan.name}</h5>
                                    {descTrim ? (
                                      <div onClick={(e) => e.stopPropagation()}>
                                        <ServiceDescriptionInline
                                          description={descTrim}
                                          title={plan.name}
                                          className="m-0 mt-1 text-sm leading-5 text-gray-500"
                                          dialogHint="Full description from the center (vendor-provided)"
                                        />
                                      </div>
                                    ) : (
                                      <p className="text-gray-400 text-sm mt-1 line-clamp-2 italic">
                                        Boarding plan — tap Book Now to continue.
                                      </p>
                                    )}
                                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                                      <span className="text-lg font-bold text-[#FF8C42]">
                                        {formatPriceWithSymbol(plan.price)}
                                      </span>
                                      {plan.duration != null && plan.duration > 0 && (
                                        <Badge variant="outline" className="text-xs shrink-0">
                                          <Clock className="w-3 h-3 mr-1" />
                                          {plan.duration >= 60 ? `${Math.round(plan.duration / 60)} hrs` : `${plan.duration} mins`}
                                        </Badge>
                                      )}
                                      <Badge variant="secondary" className="text-xs shrink-0">
                                        Boarding
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0 ml-2 min-w-[6.5rem]">
                                    <div className="text-lg font-bold text-gray-900 mb-2 tabular-nums">
                                      {formatPriceWithSymbol(plan.price)}
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="bg-[#FF8C42] hover:bg-[#E67A35] text-white w-full sm:w-auto"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleBookPlan(v, plan);
                                      }}
                                    >
                                      Book Now
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {!expanded && (
                    <div className="px-4 py-3 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="text-sm text-gray-600">
                        {v.planRows.length > 0 ? (
                          <>
                            {v.planRows.length} service{v.planRows.length !== 1 ? 's' : ''} available
                            {minP != null && (
                              <span className="text-gray-900 font-medium">
                                {' '}
                                from {formatPriceWithSymbol(minP)}
                              </span>
                            )}
                          </>
                        ) : v.needsServiceFetch ? (
                          <span className="text-gray-500">Tap to load services & prices</span>
                        ) : (
                          <span className="text-gray-500">No priced services in listing — open details</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-[#FF8C42] border-[#FF8C42] hover:bg-[#FF8C42]/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVendorId(v.id);
                          }}
                        >
                          View Services
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-gray-600"
                          onClick={(e) => openVendorProfile(e, v.id)}
                        >
                          Details
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <StandardizedFooter
        currentTab="bookings"
        onTabChange={(tab) => {
          if (tab === 'home') router.push('/');
          else if (tab === 'bookings') router.push('/bookings');
          else if (tab === 'cart') router.push('/cart');
          else if (tab === 'profile') router.push('/profile');
        }}
        maxWidth="max-w-customer"
      />
    </div>
  );
}
