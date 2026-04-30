"use client";

import { useState, useEffect, useMemo, useCallback, type MouseEvent } from 'react';
import * as LucideIcons from 'lucide-react';
import { Scissors, Building2, Home as HomeIcon, Star, MapPin, Sparkles, ChevronRight, RefreshCw, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { GROOMING_NEEDS } from './ProblemGridSection';
import { FeaturedVendorSpotlights } from './shared/FeaturedVendorSpotlights';
import { ServiceDashboardHeader } from './shared/ServiceDashboardHeader';
import { ServiceDescriptionInline } from './shared/ServiceDescriptionInline';
import { BoardingVendorExpandableCard } from './boarding/BoardingVendorExpandableCard';
import { useHubVendorDiscovery } from '@/hooks/useHubVendorDiscovery';
import { HUB_DISCOVERY_GROOMING } from '@/lib/service-hub-discovery-config';
import { minPriceForVendor } from '@/lib/boarding-vendor-booking-utils';
import {
  type BoardingListVendor,
  type BoardingPlanRow,
  findBoardingListVendorByProfileKey,
} from '@/lib/boarding-vendor-discovery-map';
import type { BoardingServiceSlug } from '@/lib/boarding-service-types';
import { problemIconTextColorToBgClass } from '@/lib/problem-grid-icon-bg';
import { pickCustomerVendorAccountId } from '@warmpawz/shared-types';

function DynamicProblemIcon({ iconName, iconColor }: { iconName?: string; iconColor?: string }) {
  if (!iconName || !(LucideIcons as any)[iconName]) {
    return <Scissors className="w-6 h-6 text-gray-500" />;
  }
  const Icon = (LucideIcons as any)[iconName];
  return <Icon className={`w-6 h-6 ${iconColor || 'text-gray-600'}`} />;
}

interface GroomingServiceRouterProps {
  phone: string;
  onBack: () => void;
  onViewBooking?: (bookingId: string) => void;
  onNavigate?: (screen: string, data?: any) => void;
}

const GROOMING_ROLE_IDS = ['groomer', 'groomer_solo', 'groomer_center', 'pet_groomer'];

const HUB_SLUG: BoardingServiceSlug = 'all';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function firstGroomingServiceUuid(services: any[]): string | undefined {
  for (const s of services) {
    const raw = s?.id ?? s?.service_id ?? s?.serviceId;
    if (typeof raw === 'string' && UUID_RE.test(raw)) return raw;
  }
  return undefined;
}

export function GroomingServiceRouter({ phone, onBack, onViewBooking, onNavigate }: GroomingServiceRouterProps) {
  const {
    loading: vendorsLoading,
    vendors,
    relaxedFilter,
    selectedVendorId,
    setSelectedVendorId,
    toggleVendor,
    fetchingPlansFor,
  } = useHubVendorDiscovery(phone, HUB_DISCOVERY_GROOMING);

  const [previousGroomer, setPreviousGroomer] = useState<any>(null);
  const [groomingNeeds, setGroomingNeeds] = useState<any[]>([]);

  useEffect(() => {
    loadPreviousGroomer();
    loadGroomingNeeds();
  }, [phone]);

  const loadGroomingNeeds = async () => {
    try {
      for (const roleId of GROOMING_ROLE_IDS) {
        const res = await apiClient.get<{ success?: boolean; problems?: any[] }>(`/public/problem-grid/${roleId}`);
        if (res?.success && Array.isArray(res.problems) && res.problems.length > 0) {
          const withViewAll = [
            ...res.problems.map((p: any) => {
              const iconColor = p.iconColor ?? p.icon_color;
              return {
                id: p.id || p.problemId,
                name: p.displayName || p.name,
                icon: <DynamicProblemIcon iconName={p.iconName} iconColor={iconColor} />,
                iconBg: problemIconTextColorToBgClass(iconColor),
              };
            }),
            { id: 'view_all', name: 'View All', icon: <Plus className="w-6 h-6 text-orange-600" /> },
          ];
          setGroomingNeeds(withViewAll);
          return;
        }
      }
    } catch (_) {
      // Keep groomingNeeds empty so we use GROOMING_NEEDS fallback
    }
  };

  const handleBookPlan = useCallback(
    (v: BoardingListVendor, plan: BoardingPlanRow) => {
      const vid =
        pickCustomerVendorAccountId((v.raw ?? {}) as Record<string, unknown>) || v.id;
      onNavigate?.('create-booking', {
        vendorId: vid,
        serviceType: 'grooming',
        serviceId: plan.rowId,
        serviceName: plan.name,
        price: plan.price,
        duration: plan.duration,
        serviceStyle: plan.serviceStyle || 'at_center',
      });
    },
    [onNavigate]
  );

  const openVendorDetails = useCallback(
    (e: MouseEvent, profileKey: string) => {
      e.stopPropagation();
      const v = findBoardingListVendorByProfileKey(vendors, profileKey);
      if (!v) {
        toast.error('Could not open this profile. Try View Services or refresh.');
        return;
      }
      const rawObj = v.raw && typeof v.raw === 'object' ? (v.raw as Record<string, unknown>) : {};
      const row: Record<string, unknown> = {
        ...rawObj,
        id: profileKey,
        vendorId: (rawObj as { vendorId?: string }).vendorId,
        type: 'vendor',
      };
      const accountId = pickCustomerVendorAccountId(row) || v.id;
      onNavigate?.('grooming-vendor-profile', {
        vendorId: accountId,
        vendorType: 'vendor' as const,
        serviceStyle: 'at_center',
        category: 'grooming',
        vendorName: v.name,
        vendorData: v.raw,
      });
    },
    [onNavigate, vendors]
  );

  const loadPreviousGroomer = async () => {
    try {
      const response = await apiClient.get<any>(`/customer/${phone}/previous-providers?serviceType=grooming`).catch(() => null);
      const p = response?.providers?.[0] ?? response?.provider;

      if (p) {
        const vid = p.vendor_id ?? p.vendorId ?? p.id;
        if (vid) {
          setPreviousGroomer({
            id: vid,
            name: p.vendor_name || p.vendorName || p.business_name || p.businessName || p.name,
            photo: p.profile_image_url || p.photo || null,
            rating: Number(p.vendor_rating ?? p.rating) || 4.9,
            lastVisit: p.last_booking_date || p.lastVisit,
            sessionsCount: p.sessionsCount || 5,
            lastServiceId: p.last_service_id || p.service_id || p.serviceId,
          });
          return;
        }
      }

      const packagesResponse = await apiClient.get<any>(`/customer/${phone}/packages?serviceType=grooming`).catch(() => null);
      if (packagesResponse?.packages && packagesResponse.packages.length > 0) {
        const pkg = packagesResponse.packages[0];
        if (pkg.vendorId && pkg.vendorName) {
          setPreviousGroomer({
            id: pkg.vendorId,
            name: pkg.vendorName,
            photo: null,
            rating: 4.9,
            lastVisit: pkg.lastUsed || '3 weeks ago',
            sessionsCount: pkg.sessionsUsed || 5,
            lastServiceId: pkg.serviceId || pkg.service_id || pkg.defaultServiceId,
          });
        }
      }
    } catch (error) {
      console.log('No previous groomer found:', error);
    }
  };

  const handleBookAgain = useCallback(async () => {
    if (!previousGroomer?.id) return;
    const vid = previousGroomer.id;
    let serviceId: string | undefined = previousGroomer.lastServiceId;
    if (!serviceId) {
      try {
        const res = await apiClient.get<any>(`/customer/vendor/${vid}/services?category=grooming`);
        const list = Array.isArray(res?.services) ? res.services : [];
        serviceId = firstGroomingServiceUuid(list);
      } catch {
        /* CreateBookingPage will resolve via vendor/available + catalog */
      }
    }
    onNavigate?.('create-booking', {
      vendorId: vid,
      serviceType: 'grooming',
      serviceId,
    });
  }, [previousGroomer, onNavigate]);

  const serviceTypes = [
    {
      id: 'grooming_center',
      name: 'Grooming Centre',
      description: 'Visit our salons',
      icon: Building2,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      badge: '50+ Centres'
    },
    {
      id: 'grooming_home',
      name: 'At Home Grooming',
      description: 'Groomer comes to you',
      icon: HomeIcon,
      color: 'text-green-600',
      bg: 'bg-green-50',
      badge: 'Track Live'
    }
  ];

  const dashboardStats = useMemo(() => {
    const n = vendors.length;
    const rating = n > 0 ? (vendors.reduce((a, v) => a + v.rating, 0) / n).toFixed(1) : '-';
    const sessions = n > 0 ? `${Math.max(n * 25, 100)}+` : '0';
    return [
      { value: `${n}+`, label: 'Pros', icon: <Scissors className="w-4 h-4" /> },
      { value: sessions, label: 'Sessions' },
      { value: rating, label: 'Rating', icon: <Star className="w-4 h-4 fill-white" /> },
    ];
  }, [vendors]);

  if (vendorsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ✅ FIX: Restore Frame UI with ServiceDashboardHeader */}
      <ServiceDashboardHeader
        serviceName="Grooming Services"
        serviceSubtitle="Premium pet grooming"
        serviceIcon={Scissors}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
        sheetToneClass="bg-white"
      />

      {/* Main Content */}
      <div className="max-w-md mx-auto -mt-4 rounded-t-[1.75rem] bg-white px-4 pt-6 sm:rounded-t-[2rem]">
        <div className="space-y-8">
          
          {/* YOUR GROOMER Section - As per Master Plan */}
          {previousGroomer && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-bold text-slate-900">🔄 YOUR GROOMER</h2>
              </div>
              
              <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 p-4">
                <div className="flex items-center gap-4">
                  {previousGroomer.photo ? (
                    <img 
                      src={previousGroomer.photo} 
                      alt={previousGroomer.name}
                      className="w-16 h-16 rounded-xl object-cover border-2 border-orange-200"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 font-bold text-xl border-2 border-orange-200">
                      {previousGroomer.name?.charAt(0) || 'G'}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 text-lg">{previousGroomer.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                      <div className="flex items-center gap-1 text-orange-600 font-bold">
                        <Star className="w-4 h-4 fill-orange-500" />
                        {previousGroomer.rating}
                      </div>
                      <span>•</span>
                      <span>Last visit: {previousGroomer.lastVisit || '3 weeks ago'}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {previousGroomer.sessionsCount || 5} sessions with you
                    </p>
                  </div>
                  <Button 
                    size="sm"
                    className="bg-orange-600 text-white hover:bg-orange-700 whitespace-nowrap"
                    onClick={() => void handleBookAgain()}
                  >
                    Book Again
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* PHASE 1.2: Vendor spotlights + promotion banners (from Admin Marketing) */}
          <div className="space-y-3">
            <FeaturedVendorSpotlights service="grooming" onNavigate={onNavigate} className="mb-1" />
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-bold text-slate-900">Spotlight Offers</h2>
            </div>
          </div>

          {/* Grooming Needs Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">What does your pet need?</h2>
              <button 
                onClick={() => {
                  console.log('🔵 [Grooming] View All problem grid clicked');
                  onNavigate?.('problem_grid');
                }}
                className="text-sm text-orange-600 font-medium hover:text-orange-700"
              >
                View All
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3" style={{ position: 'relative', zIndex: 1 }}>
              {(groomingNeeds.length > 0 ? groomingNeeds : GROOMING_NEEDS).map((need) => {
                const isViewAll = need.id === 'view_all';
                const hasAdminTint = Boolean((need as { iconBg?: string }).iconBg) && !isViewAll;
                return (
                  <button
                    key={need.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🔵 [Grooming] Problem grid clicked:', need.id, isViewAll);
                      if (isViewAll) {
                        console.log('🔵 [Grooming] Navigating to problem_grid');
                        onNavigate?.('problem_grid');
                      } else {
                        console.log('🔵 [Grooming] Navigating to problem_selected:', need.id);
                        onNavigate?.('problem_selected', { problemId: need.id, problemTitle: need.name });
                      }
                    }}
                    className="group flex flex-col items-center gap-2 cursor-pointer"
                    style={{ 
                      pointerEvents: 'auto', 
                      zIndex: 1,
                      position: 'relative'
                    }}
                  >
                    <div className={`
                      w-full aspect-square rounded-2xl flex items-center justify-center text-2xl shadow-sm transition-all duration-200
                      ${isViewAll 
                        ? 'bg-orange-50 border border-orange-100 text-orange-600' 
                        : 'bg-white border border-slate-100 text-slate-700 group-hover:border-orange-200 group-hover:shadow-md group-hover:-translate-y-0.5'
                      }
                    `}>
                      {typeof need.icon === 'string' ? (
                        <span className="text-2xl">{need.icon}</span>
                      ) : hasAdminTint ? (
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${(need as { iconBg?: string }).iconBg} group-hover:opacity-90`}
                        >
                          {need.icon}
                        </div>
                      ) : (
                        <div className="text-slate-600 group-hover:text-orange-600">
                          {need.icon}
                        </div>
                      )}
                    </div>
                    <span className={`text-[10px] font-medium text-center leading-tight line-clamp-2 ${isViewAll ? 'text-orange-600' : 'text-slate-600'}`}>
                      {need.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Service Types */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Choose Service Type</h2>
            <div className="grid grid-cols-2 gap-3" style={{ position: 'relative', zIndex: 1 }}>
              {serviceTypes.map((service) => (
              <button
                key={service.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('🔵 [Grooming] Service style clicked:', service.id);
                  onNavigate?.(service.id);
                }}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all text-left group relative overflow-hidden cursor-pointer"
                style={{ 
                  pointerEvents: 'auto', 
                  zIndex: 1,
                  position: 'relative'
                }}
              >
                  <div className={`w-10 h-10 rounded-xl ${service.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <service.icon className={`w-5 h-5 ${service.color}`} />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm mb-0.5">{service.name}</h3>
                  <div onClick={(e) => e.stopPropagation()} className="relative z-20">
                    <ServiceDescriptionInline
                      description={service.description}
                      title={service.name}
                      className="m-0 text-xs leading-snug text-slate-500"
                      linkClassName="inline cursor-pointer align-baseline text-[10px] font-semibold text-orange-600 hover:underline"
                    />
                  </div>
                  {service.badge && (
                    <span className="absolute top-3 right-3 px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold rounded-full uppercase tracking-wide">
                      {service.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Top Groomers — same expandable cards as View All (grooming_center) */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Top Groomers</h2>
              <button 
                className="text-sm text-orange-600 flex items-center gap-1 font-medium"
                onClick={() => onNavigate?.('grooming_center')}
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            {relaxedFilter && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
                Showing all grooming providers we could match — expand a card for services and prices.
              </p>
            )}
            <div className="space-y-4">
              {vendors.length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="text-4xl mb-3">✂️</div>
                  <p className="text-gray-600 mb-2">No groomers available in your area yet</p>
                  <p className="text-gray-500 text-sm">Check back soon for grooming options!</p>
                </Card>
              ) : (
                vendors.map((v) => {
                  const expanded = selectedVendorId === v.id;
                  const minP = minPriceForVendor(v);
                  return (
                    <BoardingVendorExpandableCard
                      key={v.id}
                      v={v}
                      serviceSlug={HUB_SLUG}
                      planBadgeLabel="Grooming"
                      expanded={expanded}
                      fetchingPlansFor={fetchingPlansFor}
                      minPrice={minP}
                      onToggleHeader={() => toggleVendor(v.id)}
                      onViewServices={(e) => {
                        e.stopPropagation();
                        setSelectedVendorId(v.id);
                      }}
                      onDetails={openVendorDetails}
                      onBookPlan={handleBookPlan}
                      onOpenCenterDetails={openVendorDetails}
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
