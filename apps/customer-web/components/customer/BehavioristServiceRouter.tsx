"use client";

import { useState, useCallback, type MouseEvent } from 'react';
import { CachedImage } from '@/components/shared/CachedImage';
import {
  Heart,
  ChevronRight,
  PawPrint,
  Brain,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ServiceDashboardHeader } from './shared/ServiceDashboardHeader';
import { BEHAVIORAL_ISSUES } from './ProblemGridSection';
import { EMPTY_SERVICE_HEADER_STATS } from '@/lib/service-header-stats';
import { BoardingVendorExpandableCard } from './boarding/BoardingVendorExpandableCard';
import { isWarmpawzAppointmentsHubEnabled } from '@/lib/warmpawz-appointments-customer';
import { buildWapptHubTile } from '@/lib/wappt-hub-registry';
import { useWapptHubFeaturedVendors } from '@/hooks/useWapptHubFeaturedVendors';
import { minPriceForVendor } from '@/lib/boarding-vendor-booking-utils';
import type { BoardingListVendor, BoardingPlanRow } from '@/lib/boarding-vendor-discovery-map';
import type { BoardingServiceSlug } from '@/lib/boarding-service-types';

const BEHAVIORIST_HEADER_BANNER = '/images/home/Training/header.webp';
const HUB_SLUG: BoardingServiceSlug = 'all';

interface BehavioristServiceRouterProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: Record<string, unknown>) => void;
}

function BehavioristHeaderBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -right-8 top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-orange-300/20 blur-xl" />
    </div>
  );
}

export function BehavioristServiceRouter({
  phone,
  onBack,
  onNavigate,
}: BehavioristServiceRouterProps) {
  const wapptHubEnabled = isWarmpawzAppointmentsHubEnabled('behaviorist');
  const wapptTile = buildWapptHubTile('behaviorist');
  const wapptDiscovery = useWapptHubFeaturedVendors('behaviorist', wapptHubEnabled);
  const [wapptSelectedVendorId, setWapptSelectedVendorId] = useState<string | null>(null);

  const vendorsLoading = wapptDiscovery.loading;
  const vendors = wapptDiscovery.vendors;
  const relaxedFilter = wapptDiscovery.relaxedFilter;
  const selectedVendorId = wapptSelectedVendorId;
  const toggleVendor = (vendorId: string) =>
    setWapptSelectedVendorId((prev) => (prev === vendorId ? null : vendorId));

  const behavioralConcerns = BEHAVIORAL_ISSUES.filter((issue) => issue.id !== 'view_all');

  const handleWarmpawzBookAppointment = useCallback(
    (_v: BoardingListVendor) => {
      onNavigate?.('wappt-discovery', { category: 'behaviorist' });
    },
    [onNavigate],
  );

  const handleBookPlan = useCallback(
    (v: BoardingListVendor, plan: BoardingPlanRow) => {
      onNavigate?.('create-booking', {
        vendorId: v.id,
        serviceType: 'behaviorist',
        serviceId: plan.rowId,
        serviceName: plan.name,
        price: plan.price,
        duration: plan.duration,
        serviceStyle: plan.serviceStyle || 'at_home',
        vendorName: v.name,
      });
    },
    [onNavigate]
  );

  const openBehavioristDetails = useCallback(
    (e: MouseEvent, vendorId: string) => {
      e.stopPropagation();
      onNavigate?.('behaviorist-provider-profile', { embedVendorId: vendorId, vendorId });
    },
    [onNavigate]
  );

  if (vendorsLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#FF8C42]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ServiceDashboardHeader
        fullWidth
        serviceName="Pet Behavior"
        serviceSubtitle="Behavior correction"
        serviceIcon={Brain}
        iconColor="text-white"
        stats={EMPTY_SERVICE_HEADER_STATS}
        onBack={onBack}
        showBackButton
        headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"
        sheetToneClass="bg-white"
        headerBackground={<BehavioristHeaderBackground />}
        headerTrailingImage={BEHAVIORIST_HEADER_BANNER}
        headerTrailingImageAlt="Pet behavior support"
        clipHeaderTrailingImage
        headerTrailingImageClassName="pointer-events-none absolute bottom-0 right-0 top-[2.75rem] z-[5] flex w-[80%] max-w-[460px] items-end justify-end sm:top-12"
        headerTrailingImageImgClassName="block h-full w-auto max-w-full origin-bottom-right scale-[1.5] object-contain object-right object-bottom drop-shadow-lg"
      />

      <div className="mx-auto w-full max-w-customer -mt-4 rounded-t-[1.75rem] bg-white px-4 pt-6 sm:rounded-t-[2rem]">
        <div className="space-y-8">
          {wapptHubEnabled && wapptTile ? (
            <div>
              <h2 className="mb-3 text-lg font-bold text-slate-900">Choose Service Type</h2>
              <button
                type="button"
                onClick={() => onNavigate?.('wappt-discovery', { category: 'behaviorist' })}
                className="group relative w-full overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-sm transition-all hover:shadow-md"
              >
                <div className="relative h-28 w-full sm:h-32">
                  {wapptTile.image ? (
                    <CachedImage
                      src={wapptTile.image}
                      alt={wapptTile.name}
                      fill
                      className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
                      sizes="(max-width: 640px) 90vw, 400px"
                    />
                  ) : null}
                  <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide ${wapptTile.badgeClass}`}>
                    {wapptTile.badge}
                  </span>
                </div>
                <div className="relative p-3 pb-10">
                  <h3 className="text-sm font-bold text-slate-900">{wapptTile.name}</h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">{wapptTile.description}</p>
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
                    <Heart className="h-3 w-3 text-orange-400" />
                    <span>{wapptTile.trustedBy}</span>
                  </div>
                  <div className={`absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md transition-transform group-hover:scale-110 ${wapptTile.arrowClass}`}>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </button>
            </div>
          ) : null}

          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="rounded-lg bg-orange-50 p-1.5">
                <Brain className="h-4 w-4 text-[#FF8C42]" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">What&apos;s the concern?</h2>
              <PawPrint className="h-3.5 w-3.5 text-[#FF8C42]" aria-hidden />
            </div>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3">
              {behavioralConcerns.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() =>
                    onNavigate?.('problem_selected', {
                      problemId: issue.id,
                      problemTitle: issue.name,
                    })
                  }
                  className="group flex flex-col items-center gap-1.5"
                >
                  <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50/80 to-white shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:border-orange-200 group-hover:shadow-md">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-sm">
                      {issue.icon}
                    </div>
                  </div>
                  <p className="w-full px-0.5 text-center text-[9px] font-medium leading-tight text-slate-700 line-clamp-2 group-hover:text-[#FF8C42] sm:text-[10px]">
                    {issue.name}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-lg font-bold text-slate-900">Featured Behaviorists</h2>
            {relaxedFilter && (
              <p className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Showing all behavior specialists we could match — expand for services and prices.
              </p>
            )}
            <div className="space-y-4">
              {vendors.length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="mb-3 text-4xl">🧠</div>
                  <p className="mb-2 text-gray-600">No behaviorists available in your area yet</p>
                  <p className="text-sm text-gray-500">Check back soon for behavior support options!</p>
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
                      planBadgeLabel="Behavior"
                      expanded={expanded}
                      fetchingPlansFor={null}
                      minPrice={minP}
                      onToggleHeader={() => toggleVendor(v.id)}
                      onViewServices={(e) => {
                        e.stopPropagation();
                        setWapptSelectedVendorId(v.id);
                      }}
                      onDetails={openBehavioristDetails}
                      onBookPlan={handleBookPlan}
                      onOpenCenterDetails={openBehavioristDetails}
                      customerId={phone}
                      serviceCategory="behaviorist"
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
  );
}
