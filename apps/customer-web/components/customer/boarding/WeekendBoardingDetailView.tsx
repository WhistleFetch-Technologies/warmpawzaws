'use client';

import { useCallback, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  CalendarRange,
  Filter,
  ListChecks,
  PawPrint,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CachedImage } from '@/components/shared/CachedImage';
import { ServiceHubVendorCard, resolveServiceHubVendorProfileKey } from '../shared/ServiceHubVendorCard';
import { StandardizedFooter } from '../shared/StandardizedFooter';
import { DiscoveryVendorFeedSentinel } from '../shared/DiscoveryVendorFeedSentinel';
import { WarmpawzPayVendorCard } from '@/components/warmpawz-pay/vendor-card/WarmpawzPayVendorCard';
import { SpecializationHighlightChips } from '../specialization-detail/SpecializationHighlightChips';
import { SpecializationImportantNotes } from '../specialization-detail/SpecializationImportantNotes';
import { WeekendBoardingRoutineTimeline } from './WeekendBoardingRoutineTimeline';
import { useBoardingVendorDiscovery } from '@/hooks/useBoardingVendorDiscovery';
import { useWarmpawzAppointmentsByCategoryFeed } from '@/hooks/useWarmpawzAppointmentsByCategoryFeed';
import { weekendBoardingMetadata } from '@/lib/boarding-service-detail/weekend-metadata';
import type { BoardingListVendor } from '@/lib/boarding-vendor-discovery-map';
import { BOARDING_SERVICE_LABELS } from '@/lib/boarding-service-types';
import { buildWapptDiscoveryVendorCardProps } from '@/lib/wappt-discovery-vendor-card';
import { mapDiscoveryRowBaseFields } from '@/lib/map-discovery-list-row';
import {
  buildWarmpawzAppointmentsProfileNav,
  isWapptHubCategoryEnabled,
  WAPPT_VENDOR_PROFILE_SCREEN,
} from '@/lib/warmpawz-appointments-customer';
import { resolveWapptVendorListConfig } from '@/lib/warmpawz-appointments/wappt-vendor-list-config';
import { resolveWapptDiscoveryListProfileServiceStyle } from '@/lib/resolve-wappt-vendor-profile-service-style';
import { pickCustomerVendorAccountId } from '@warmpawz/shared-types';
import { shouldUseWapptPayVendorCardUi } from '@/lib/commerce-switch-routing';

export interface WeekendBoardingDetailViewProps {
  phone: string;
  onBack?: () => void;
  onNavigate?: (screen: string, data?: Record<string, unknown>) => void;
}

type SortFilter = 'all' | 'rating' | 'distance' | 'price';

function InfoPairCard({
  title,
  icon: Icon,
  items,
  toneClass,
}: {
  title: string;
  icon: typeof ListChecks;
  items: string[];
  toneClass: string;
}) {
  if (!items.length) return null;

  return (
    <div className="rounded-[20px] border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneClass}`}>
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF8C42]" />
            <span className="min-w-0 leading-snug">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WeekendBoardingDetailView({
  phone,
  onBack,
  onNavigate,
}: WeekendBoardingDetailViewProps) {
  const router = useRouter();
  const facilitiesRef = useRef<HTMLElement>(null);
  const content = weekendBoardingMetadata;
  const serviceSlug = 'weekend' as const;

  const useWapptList =
    isWapptHubCategoryEnabled('boarding') &&
    Boolean(onNavigate) &&
    shouldUseWapptPayVendorCardUi('boarding');

  const marketplaceDiscovery = useBoardingVendorDiscovery(phone, serviceSlug);
  const wapptFeed = useWarmpawzAppointmentsByCategoryFeed({
    category: 'boarding',
    serviceStyle: 'at_center',
    enabled: useWapptList,
  });

  const listConfig = resolveWapptVendorListConfig('boarding', 'at_center');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<SortFilter>('all');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const wapptRows = useMemo(
    () => wapptFeed.vendors.map((row) => mapDiscoveryRowBaseFields(row)),
    [wapptFeed.vendors],
  );

  const filteredWapptRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return wapptRows;
    return wapptRows.filter((row) => {
      const haystack = [row.name, row.vendorName, row.businessName, row.city, row.address]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [wapptRows, searchQuery]);

  const filteredMarketplaceVendors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return marketplaceDiscovery.vendors.filter(
      (v) =>
        !q ||
        v.name.toLowerCase().includes(q) ||
        v.address.toLowerCase().includes(q),
    );
  }, [marketplaceDiscovery.vendors, searchQuery]);

  const sortedWapptRows = useMemo(() => {
    const distanceKm = (row: (typeof filteredWapptRows)[number]) => {
      const raw = row.distance;
      const n = typeof raw === 'number' ? raw : raw != null ? Number(raw) : NaN;
      return Number.isFinite(n) ? n : 999;
    };
    return [...filteredWapptRows].sort((a, b) => {
      switch (selectedFilter) {
        case 'rating':
          return (b.rating ?? 0) - (a.rating ?? 0);
        case 'distance':
          return distanceKm(a) - distanceKm(b);
        default:
          return 0;
      }
    });
  }, [filteredWapptRows, selectedFilter]);

  const sortedMarketplaceVendors = useMemo(() => {
    return [...filteredMarketplaceVendors].sort((a, b) => {
      switch (selectedFilter) {
        case 'rating':
          return b.rating - a.rating;
        case 'distance':
          return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
        case 'price': {
          const minP = (v: BoardingListVendor) =>
            parseInt(String(v.price_label).replace(/[^0-9]/g, '') || '0', 10);
          return minP(a) - minP(b);
        }
        default:
          return 0;
      }
    });
  }, [filteredMarketplaceVendors, selectedFilter]);

  const loading = useWapptList ? wapptFeed.loading : marketplaceDiscovery.loading;
  const vendorCount = useWapptList ? sortedWapptRows.length : sortedMarketplaceVendors.length;
  const relaxedFilter = !useWapptList && marketplaceDiscovery.relaxedFilter;

  const handleBack = () => {
    if (onBack) onBack();
    else router.push('/');
  };

  const scrollToFacilities = useCallback(() => {
    facilitiesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const openMarketplaceProfile = useCallback(
    (e: MouseEvent, vendorId: string) => {
      e.stopPropagation();
      if (onNavigate) {
        onNavigate('pet-boarding-profile', { vendorId, serviceSlug });
        return;
      }
      router.push(
        `/pet-boarding/vendor/${encodeURIComponent(vendorId)}?service=${encodeURIComponent(serviceSlug)}`,
      );
    },
    [onNavigate, router],
  );

  const openWapptProfile = useCallback(
    (e: MouseEvent, row: ReturnType<typeof mapDiscoveryRowBaseFields>) => {
      e.stopPropagation();
      if (!onNavigate) return;
      const vendorId =
        pickCustomerVendorAccountId({
          ...(row.raw ?? {}),
          vendorId: row.vendorId,
          providerId: row.providerId,
          id: row.id,
        }) || String(row.vendorId || row.providerId || '').trim();
      if (!vendorId) return;
      const style = resolveWapptDiscoveryListProfileServiceStyle({
        activeStyleFilter: 'at_center',
        row: {
          ...(row.raw ?? {}),
          roleDisplayName: row.roleDisplayName ?? row.role,
          preferredServiceStyle:
            row.preferredServiceStyle ??
            (row.raw as Record<string, unknown> | undefined)?.preferredServiceStyle,
          serviceStyle:
            row.serviceStyle ?? (row.raw as Record<string, unknown> | undefined)?.serviceStyle,
          services: row.services,
        },
        category: listConfig.category,
      });
      onNavigate(WAPPT_VENDOR_PROFILE_SCREEN, {
        ...buildWarmpawzAppointmentsProfileNav({
          vendorId,
          vendorName: row.name,
          serviceStyle: style,
          category: listConfig.category,
          profileBackScreen: 'pet-boarding-vendors',
        }),
      });
    },
    [listConfig.category, onNavigate],
  );

  const resolveWapptSubtitle = (row: ReturnType<typeof mapDiscoveryRowBaseFields>) => {
    const role =
      row.roleDisplayName?.trim() || row.role?.trim() || row.roleName?.trim();
    return role || listConfig.cardCategoryLabel;
  };

  const sortLabels: Record<SortFilter, string> = {
    all: 'All',
    rating: 'Top Rated',
    distance: 'Nearest',
    price: 'Price',
  };

  const footerTabHandler = (tab: 'home' | 'shop' | 'bookings' | 'profile') => {
    if (onNavigate) {
      if (tab === 'home') router.push('/');
      else if (tab === 'bookings') onNavigate('my-bookings');
      else if (tab === 'shop') onNavigate('shop');
      else if (tab === 'profile') onNavigate('profile');
      return;
    }
    if (tab === 'home') router.push('/');
    else if (tab === 'bookings') router.push('/bookings');
    else if (tab === 'shop') router.push('/shop');
    else if (tab === 'profile') router.push('/profile');
  };

  return (
    <div className="mx-auto flex min-h-screen min-h-[100dvh] w-full max-w-customer flex-col overflow-x-hidden bg-white">
      <div className="flex-1 px-4 pb-36 pt-4">
        <div className="mb-5 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="relative z-10 h-11 min-h-[44px] min-w-[44px] shrink-0 p-0 touch-manipulation"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-slate-800" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-slate-900">{content.title}</h1>
            <p className="text-sm text-slate-500">Service details &amp; booking mode</p>
          </div>
        </div>

        <section className="mb-5 overflow-hidden rounded-[24px] border border-orange-100/80 bg-white shadow-[0_8px_32px_rgba(255,140,66,0.08)]">
          <div className="relative h-44 sm:h-48">
            <CachedImage
              src={content.heroImage}
              alt={content.title}
              fill
              className="object-cover"
              style={
                content.heroImagePosition
                  ? { objectFit: 'cover', objectPosition: content.heroImagePosition }
                  : undefined
              }
              sizes="(max-width: 640px) 100vw, 480px"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
            <div className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-md">
              <PawPrint className="h-5 w-5 text-[#FF8C42]" strokeWidth={2} />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h2 className="text-xl font-bold tracking-tight text-white drop-shadow-sm">
                {content.title}
              </h2>
            </div>
          </div>
        </section>

        <p className="mb-4 text-[15px] leading-relaxed text-slate-600">{content.description}</p>

        <div className="mb-6">
          <SpecializationHighlightChips chips={content.highlightChips} />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InfoPairCard
            title={content.whatsIncludedTitle ?? "What's Included"}
            icon={ListChecks}
            items={content.whatsIncluded.map((item) => item.label)}
            toneClass="bg-orange-50 text-[#FF8C42]"
          />
          <InfoPairCard
            title={content.audienceTitle ?? 'Best For'}
            icon={CalendarRange}
            items={content.whoIsThisFor}
            toneClass="bg-purple-50 text-purple-600"
          />
        </div>

        <div className="mb-6">
          <WeekendBoardingRoutineTimeline
            items={content.timeline}
            title={content.timelineTitle}
          />
        </div>

        <section
          id="boarding-facilities-section"
          ref={facilitiesRef}
          className="mb-6 scroll-mt-4"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50">
                  <Building2 className="h-4 w-4 text-[#FF8C42]" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Available Boarding Facilities</h2>
              </div>
              {!loading ? (
                <p className="text-sm text-slate-500">
                  {useWapptList
                    ? listConfig.resultsCountLabel(vendorCount)
                    : `${vendorCount} ${vendorCount === 1 ? 'center' : 'centers'} found`}
                </p>
              ) : null}
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowSortMenu((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm"
              >
                <Filter className="h-3.5 w-3.5" />
                Sort
              </button>
              {showSortMenu ? (
                <div className="absolute right-0 top-full z-20 mt-2 min-w-[8.5rem] overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-lg">
                  {(Object.keys(sortLabels) as SortFilter[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSelectedFilter(key);
                        setShowSortMenu(false);
                      }}
                      className={`block w-full px-3 py-2 text-left text-sm ${
                        selectedFilter === key
                          ? 'bg-orange-50 font-semibold text-[#FF8C42]'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {sortLabels[key]}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {relaxedFilter && vendorCount > 0 ? (
            <p className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              No centers listed <strong>{BOARDING_SERVICE_LABELS[serviceSlug]}</strong> by service
              name yet. Showing all boarding centers below — expand or open details to see what they
              offer.
            </p>
          ) : null}

          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={
                useWapptList ? listConfig.searchPlaceholder : 'Search boarding centers...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-gray-100 bg-gray-50 py-3 pl-11 pr-4 text-gray-900 placeholder:text-gray-400 transition-all focus:border-[#FF8C42] focus:outline-none focus:ring-2 focus:ring-[#FF8C42]/40"
            />
          </div>

          {!useWapptList ? (
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {(Object.keys(sortLabels) as SortFilter[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedFilter(key)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                    selectedFilter === key
                      ? 'bg-[#FF8C42] text-white shadow-[0_2px_8px_rgba(255,140,66,0.35)]'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {sortLabels[key]}
                </button>
              ))}
            </div>
          ) : null}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#FF8C42]/30 border-t-[#FF8C42]" />
              <p className="mt-4 text-sm text-gray-500">
                {useWapptList ? listConfig.loadingMessage : 'Finding boarding centers...'}
              </p>
            </div>
          ) : vendorCount === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-12 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF5EE] text-2xl">
                🏠
              </div>
              <p className="font-semibold text-gray-800">
                {useWapptList ? listConfig.emptyTitle : 'No boarding centers found'}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {useWapptList ? listConfig.emptySubtitle : 'Try another search or check back soon'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {useWapptList
                ? sortedWapptRows.map((row) => {
                    const address = row.address?.trim() || '';
                    return (
                      <WarmpawzPayVendorCard
                        key={row.providerId}
                        {...buildWapptDiscoveryVendorCardProps({
                          provider: {
                            name: row.name,
                            photo: row.photo,
                            isVerified: row.isVerified,
                            rating: row.rating,
                            reviewCount: row.reviewCount,
                            distance: row.distance != null ? Number(row.distance) : null,
                            distanceText: row.distanceText,
                            nextAvailableSlot: row.nextAvailableSlot,
                            providerType: 'vendor',
                            city: row.city,
                            vendorId: row.vendorId,
                            providerId: row.providerId,
                          },
                          subtitle: resolveWapptSubtitle(row),
                          address,
                          category: listConfig.category,
                          serviceKey: 'boarding',
                          onPrimary: (e) => openWapptProfile(e, row),
                          onProfileClick: (e) => openWapptProfile(e, row),
                          router,
                          primaryLabel: 'Select Slot for Appointment',
                          secondaryLabel: 'Pay with Warmpawz',
                          showPayCta: true,
                        })}
                      />
                    );
                  })
                : sortedMarketplaceVendors.map((v) => (
                    <ServiceHubVendorCard
                      key={v.id}
                      vendor={v}
                      category="boarding"
                      categoryLabelFallback={BOARDING_SERVICE_LABELS[serviceSlug]}
                      onSelectSlot={(_vendor, e) =>
                        openMarketplaceProfile(e, resolveServiceHubVendorProfileKey(_vendor))
                      }
                      onOpenProfile={(e, vendor) =>
                        openMarketplaceProfile(e, resolveServiceHubVendorProfileKey(vendor))
                      }
                    />
                  ))}

              {useWapptList ? (
                <DiscoveryVendorFeedSentinel
                  hasMore={wapptFeed.hasMore}
                  loading={wapptFeed.loading}
                  loadingMore={wapptFeed.loadingMore}
                  onLoadMore={wapptFeed.loadMore}
                />
              ) : marketplaceDiscovery.hasMore ? (
                <DiscoveryVendorFeedSentinel
                  hasMore={marketplaceDiscovery.hasMore}
                  loading={marketplaceDiscovery.loading}
                  loadingMore={marketplaceDiscovery.loadingMore}
                  onLoadMore={marketplaceDiscovery.loadMore}
                />
              ) : null}
            </div>
          )}
        </section>

        <SpecializationImportantNotes
          title={content.importantNotesTitle}
          items={content.importantNotes ?? []}
        />
      </div>

      <div className="fixed bottom-[4.5rem] left-0 right-0 z-30 mx-auto max-w-customer px-4 pb-2">
        <button
          type="button"
          onClick={scrollToFacilities}
          className="w-full rounded-2xl bg-[#FF8C42] py-3.5 text-base font-bold text-white shadow-[0_8px_24px_rgba(255,140,66,0.35)] transition-colors hover:bg-[#FF7A2E]"
        >
          Find Weekend Boarding Facilities
        </button>
      </div>

      <StandardizedFooter
        currentTab="bookings"
        onTabChange={footerTabHandler}
        maxWidth="max-w-customer"
      />
    </div>
  );
}
