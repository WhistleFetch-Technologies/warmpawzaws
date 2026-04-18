"use client";

import { useState, useMemo, useCallback, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Star, Home, Building2 } from 'lucide-react';
import { useBoardingVendorDiscovery } from '@/hooks/useBoardingVendorDiscovery';
import { BoardingVendorExpandableCard } from './BoardingVendorExpandableCard';
import { ServiceDashboardHeader } from '../shared/ServiceDashboardHeader';
import { StandardizedFooter } from '../shared/StandardizedFooter';
import { BOARDING_SERVICE_LABELS, normalizeBoardingServiceSlug } from '@/lib/boarding-service-types';
import {
  minPriceForVendor,
  buildBoardingBookPlanPayload,
} from '@/lib/boarding-vendor-booking-utils';
import type { BoardingListVendor, BoardingPlanRow } from '@/lib/boarding-vendor-discovery-map';

export type { BoardingPlanRow, BoardingListVendor } from '@/lib/boarding-vendor-discovery-map';

export interface BoardingVendorListViewProps {
  phone: string;
  serviceSlug: string;
  onBack?: () => void;
  onNavigate?: (screen: string, data?: Record<string, unknown>) => void;
}

export function BoardingVendorListView({
  phone,
  serviceSlug: serviceSlugProp,
  onBack,
  onNavigate,
}: BoardingVendorListViewProps) {
  const router = useRouter();
  const serviceSlug = normalizeBoardingServiceSlug(serviceSlugProp);
  const {
    loading,
    vendors,
    relaxedFilter,
    selectedVendorId,
    setSelectedVendorId,
    toggleVendor,
    fetchingPlansFor,
  } = useBoardingVendorDiscovery(phone, serviceSlug);

  const handleBookPlan = useCallback(
    (v: BoardingListVendor, plan: BoardingPlanRow) => {
      if (!onNavigate) {
        router.push(
          `/pet-boarding/vendor/${encodeURIComponent(v.id)}?service=${encodeURIComponent(serviceSlug)}`
        );
        return;
      }
      onNavigate('boarding-booking', buildBoardingBookPlanPayload(v, plan) as Record<string, unknown>);
    },
    [onNavigate, router, serviceSlug]
  );

  const openVendorProfile = useCallback(
    (e: MouseEvent, vendorId: string) => {
      e.stopPropagation();
      router.push(
        `/pet-boarding/vendor/${encodeURIComponent(vendorId)}?service=${encodeURIComponent(serviceSlug)}`
      );
    },
    [router, serviceSlug]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'rating' | 'distance' | 'price'>('all');

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
          const minP = (v: BoardingListVendor) =>
            minPriceForVendor(v) ?? parseInt(String(v.price_label).replace(/[^0-9]/g, '') || '0', 10);
          return minP(a) - minP(b);
        }
        default:
          return 0;
      }
    });
  }, [filteredVendors, selectedFilter]);

  const filters = [
    { id: 'all' as const, label: 'All' },
    { id: 'rating' as const, label: 'Top Rated' },
    { id: 'distance' as const, label: 'Nearest' },
    { id: 'price' as const, label: 'Price' },
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
            No centers matched this service name in listings yet. Showing all pet boarding centers — expand a center or
            open details for exact services and prices.
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
              onClick={() => setSelectedFilter(filter.id)}
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
                <BoardingVendorExpandableCard
                  key={v.id}
                  v={v}
                  serviceSlug={serviceSlug}
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
