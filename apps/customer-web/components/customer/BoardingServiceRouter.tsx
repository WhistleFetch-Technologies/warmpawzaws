"use client";

import { useState, useEffect, useMemo, useCallback, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Star, ChevronRight, Moon, Sun, RefreshCw, Building2, Clock, CalendarRange, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { PromotionBanner } from './shared/PromotionBanner';
import { ServiceDashboardHeader } from './shared/ServiceDashboardHeader';
import { BoardingVendorExpandableCard } from './boarding/BoardingVendorExpandableCard';
import { useBoardingVendorDiscovery } from '@/hooks/useBoardingVendorDiscovery';
import {
  buildBoardingBookPlanPayload,
  minPriceForVendor,
} from '@/lib/boarding-vendor-booking-utils';
import type { BoardingListVendor, BoardingPlanRow } from '@/lib/boarding-vendor-discovery-map';
import type { BoardingServiceSlug } from '@/lib/boarding-service-types';
import { HUB_SERVICE_ICON_WRAP } from '@/lib/hub-service-option-styles';

interface BoardingServiceRouterProps {
  phone: string;
  onBack: () => void;
  onViewBooking?: (bookingId: string) => void;
  onNavigate?: (screen: string, data?: any) => void;
}

const BOARDING_CARD_LINKS: {
  slug: BoardingServiceSlug;
  title: string;
  subtitle: string;
  Icon: typeof Moon;
  iconWrap: string;
  badge?: string;
}[] = [
  {
    slug: 'overnight',
    title: 'Overnight',
    subtitle: 'Extended stays',
    Icon: Moon,
    iconWrap: HUB_SERVICE_ICON_WRAP.overnightMoon,
    badge: 'Popular',
  },
  {
    slug: 'full-day',
    title: 'Full Day',
    subtitle: 'All-day care',
    Icon: Sun,
    iconWrap: HUB_SERVICE_ICON_WRAP.sunDaytime,
  },
  {
    slug: 'half-day',
    title: 'Half Day',
    subtitle: 'Flexible hours',
    Icon: Clock,
    iconWrap: HUB_SERVICE_ICON_WRAP.clockFlexible,
  },
  {
    slug: 'weekend',
    title: 'Weekend',
    subtitle: 'Fri–Sun stays',
    Icon: CalendarRange,
    iconWrap: HUB_SERVICE_ICON_WRAP.calendarWeekend,
  },
  {
    slug: 'weekly',
    title: 'Weekly',
    subtitle: '7-day packages',
    Icon: Calendar,
    iconWrap: HUB_SERVICE_ICON_WRAP.calendarWeekly,
  },
];

/** Hub uses the same discovery + cards as View All (`service=all`). */
const HUB_SERVICE_SLUG: BoardingServiceSlug = 'all';

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
        setPreviousFacility({
          id: response.provider.id,
          name: response.provider.businessName || response.provider.name,
          photo: response.provider.photo,
          rating: response.provider.rating || 4.8,
          lastVisit: response.provider.lastVisit,
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
              rating: 4.8,
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
      onNavigate('boarding-booking', buildBoardingBookPlanPayload(v, plan) as Record<string, unknown>);
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

  const boardingStats = useMemo(() => {
    const n = vendors.length;
    const rating =
      n > 0 ? (vendors.reduce((acc, v) => acc + v.rating, 0) / n).toFixed(1) : '4.6';
    return [
      { value: `${n > 0 ? n : 35}+`, label: 'Facilities' },
      { value: '5K+', label: 'Happy Pets' },
      { value: rating, label: 'Rating', icon: <Star className="w-4 h-4 fill-current" /> },
    ];
  }, [vendors]);

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <ServiceDashboardHeader
        serviceName="Pet Boarding"
        serviceSubtitle="Safe & comfortable pet stay"
        serviceIcon={Building2}
        iconColor="text-white"
        stats={boardingStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"
      />
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="px-4 pt-4 bg-white">
          <div className="space-y-8">
            <PromotionBanner service="boarding" maxPromotions={3} onNavigate={onNavigate} />

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
              <h2 className="text-lg font-bold text-slate-900 mb-4">Boarding Options</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {BOARDING_CARD_LINKS.map(({ slug, title, subtitle, Icon, iconWrap, badge }) => (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => router.push(`/pet-boarding/vendors?service=${encodeURIComponent(slug)}`)}
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all text-left group relative overflow-hidden"
                  >
                    <div
                      className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${iconWrap}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-slate-900 text-sm mb-0.5">{title}</h3>
                    <p className="text-xs text-slate-500">{subtitle}</p>
                    {badge ? (
                      <span className="absolute top-3 right-3 px-2 py-0.5 bg-orange-100 text-orange-600 text-[9px] font-bold rounded-full uppercase tracking-wide">
                        {badge}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">Featured Stays</h2>
                <button
                  type="button"
                  className="text-sm text-orange-600 flex items-center gap-1 font-medium"
                  onClick={() => router.push('/pet-boarding/vendors?service=all')}
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
    </div>
  );
}
