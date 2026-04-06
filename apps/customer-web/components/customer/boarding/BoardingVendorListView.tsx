"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Star, MapPin, Clock, Search, ChevronRight, Building2, Home } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { ServiceDashboardHeader } from '../shared/ServiceDashboardHeader';
import { StandardizedFooter } from '../shared/StandardizedFooter';
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
}

interface BoardingVendorCard {
  id: string;
  name: string;
  address: string;
  rating: number;
  review_count: number;
  distance?: string | null;
  timing: string;
  services: string[];
  price_label: string;
  is_open?: boolean;
  photo?: string;
  raw?: Record<string, unknown>;
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

export function BoardingVendorListView({ phone, serviceSlug: serviceSlugProp, onBack }: BoardingVendorListViewProps) {
  const router = useRouter();
  const serviceSlug = normalizeBoardingServiceSlug(serviceSlugProp);
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<BoardingVendorCard[]>([]);
  const [relaxedFilter, setRelaxedFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'rating' | 'distance' | 'price'>('all');

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

      const vendorMap = new Map<string, BoardingVendorCard & { raw: Record<string, unknown> }>();

      rows.forEach((service: any) => {
        const vendorId = String(service.vendorId || service.id || '');
        if (!vendorId) return;

        const planLabels = collectPublishedPlanLabels(service);

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
            distance: service.distance != null ? `${Number(service.distance).toFixed(1)} km` : null,
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
          });
        } else {
          const v = vendorMap.get(vendorId)!;
          for (const lbl of planLabels) {
            if (!v.services.includes(lbl)) v.services.push(lbl);
          }
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

  const priceForCard = (v: BoardingVendorCard, slug: BoardingServiceSlug) => {
    for (const s of v.services) {
      if (boardingSlugMatchesText(slug, s)) {
        return v.price_label;
      }
    }
    return v.price_label;
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
          return parseFloat(String(a.distance || '999')) - parseFloat(String(b.distance || '999'));
        case 'price':
          return (
            parseInt(String(a.price_label).replace(/[^0-9]/g, '') || '0', 10) -
            parseInt(String(b.price_label).replace(/[^0-9]/g, '') || '0', 10)
          );
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

  const openVendor = (id: string) => {
    router.push(`/pet-boarding/vendor/${encodeURIComponent(id)}?service=${encodeURIComponent(serviceSlug)}`);
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
            No centers matched this service name in listings yet. Showing all pet boarding centers — open a profile to see exact services and prices.
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
            {sortedVendors.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => openVendor(v.id)}
                className="w-full card card-interactive rounded-2xl p-4 text-left border border-gray-100 hover:border-orange-100 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-200"
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
                      <h3 className="font-bold text-gray-900 truncate">{v.name}</h3>
                      <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span className="font-semibold text-sm text-gray-800">{v.rating}</span>
                      <span className="text-gray-400 text-sm">({v.review_count})</span>
                      {v.distance && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="text-sm text-gray-500">{v.distance}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 text-sm text-gray-500">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{v.address}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-gray-500">{v.timing}</span>
                      </div>
                      <span className="text-sm font-bold text-[#FF8C42]">{priceForCard(v, serviceSlug)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {v.services.slice(0, 4).map((s, idx) => (
                        <span key={idx} className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-600">
                          {s}
                        </span>
                      ))}
                      {v.services.length > 4 && (
                        <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-500">
                          +{v.services.length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
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
