'use client';

import { useCallback, useMemo, useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { ServiceDashboardHeader } from '@/components/customer/shared/ServiceDashboardHeader';
import { DiscoveryVendorFeedSentinel } from '@/components/customer/shared/DiscoveryVendorFeedSentinel';
import { StandardizedFooter } from '@/components/customer/shared/StandardizedFooter';
import { WarmpawzPayVendorCard } from '@/components/warmpawz-pay/vendor-card/WarmpawzPayVendorCard';
import { mapDiscoveryProviderToVendorCardProps } from '@/lib/warmpawz-pay/map-discovery-provider-to-vendor-card-props';
import { mapDiscoveryRowBaseFields } from '@/lib/map-discovery-list-row';
import { EMPTY_SERVICE_HEADER_STATS } from '@/lib/service-header-stats';
import { launchWarmpawzPayServiceBooking } from '@/lib/commerce-switch-routing/launch-warmpawz-pay-service-booking';
import {
  buildWarmpawzAppointmentsProfileNav,
  WAPPT_VENDOR_PROFILE_SCREEN,
} from '@/lib/warmpawz-appointments-customer';
import { resolveWapptVendorListConfig } from '@/lib/warmpawz-appointments/wappt-vendor-list-config';
import {
  WAPPT_DISCOVERY_DEFAULT_STYLE,
  WAPPT_DISCOVERY_STYLE_FILTERS,
  type WapptDiscoveryListStyle,
} from '@/lib/warmpawz-appointments/wappt-list-style-config';
import { getWapptDiscoveryCategory } from '@/lib/wappt-hub-registry';
import { useWarmpawzAppointmentsByCategoryFeed } from '@/hooks/useWarmpawzAppointmentsByCategoryFeed';

type WarmpawzAppointmentsVendorListProps = {
  category: string;
  onBack: () => void;
  onGoHome: () => void;
  onNavigate: (screen: string, data?: Record<string, unknown>) => void;
};

function resolveRowAddress(row: ReturnType<typeof mapDiscoveryRowBaseFields>): string {
  const raw = row.address?.trim();
  if (raw) return raw;
  return '';
}

function resolveCardSubtitle(
  row: ReturnType<typeof mapDiscoveryRowBaseFields>,
  fallback: string,
): string {
  const role =
    row.roleDisplayName?.trim() || row.role?.trim() || row.roleName?.trim();
  return role || fallback;
}

export function WarmpawzAppointmentsVendorList({
  category,
  onBack,
  onGoHome,
  onNavigate,
}: WarmpawzAppointmentsVendorListProps) {
  const router = useRouter();
  const listConfig = resolveWapptVendorListConfig(category);
  const discoveryCategory = getWapptDiscoveryCategory(category);
  const [styleFilter, setStyleFilter] = useState<WapptDiscoveryListStyle>(
    WAPPT_DISCOVERY_DEFAULT_STYLE,
  );
  const [searchQuery, setSearchQuery] = useState('');

  const feed = useWarmpawzAppointmentsByCategoryFeed({
    category: discoveryCategory,
    serviceStyle: styleFilter,
    enabled: true,
  });

  const mappedRows = useMemo(
    () => feed.vendors.map((row) => mapDiscoveryRowBaseFields(row)),
    [feed.vendors],
  );

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return mappedRows;
    return mappedRows.filter((row) => {
      const haystack = [row.name, row.vendorName, row.businessName, row.city, row.address]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [mappedRows, searchQuery]);

  const openVendorProfile = useCallback(
    (e: MouseEvent, row: ReturnType<typeof mapDiscoveryRowBaseFields>) => {
      e.stopPropagation();
      const vendorId = String(row.vendorId || row.providerId || '').trim();
      if (!vendorId) return;
      const style = styleFilter;
      onNavigate(WAPPT_VENDOR_PROFILE_SCREEN, {
        ...buildWarmpawzAppointmentsProfileNav({
          vendorId,
          vendorName: row.name,
          serviceStyle: style,
          category: listConfig.category,
          profileBackScreen: 'wappt-discovery',
        }),
      });
    },
    [category, onNavigate, styleFilter],
  );

  const openWarmpawzPay = useCallback(
    (e: MouseEvent, row: ReturnType<typeof mapDiscoveryRowBaseFields>) => {
      e.stopPropagation();
      const vendorId = String(row.vendorId || row.providerId || '').trim();
      if (!vendorId) return;
      launchWarmpawzPayServiceBooking({
        router,
        serviceKey: category,
        category,
        vendorId,
      });
    },
    [category, router],
  );

  return (
    <div className="mx-auto flex min-h-screen min-h-[100dvh] w-full max-w-customer flex-col bg-gray-50">
      <ServiceDashboardHeader
        fullWidth
        serviceName={listConfig.serviceName}
        serviceSubtitle={listConfig.serviceSubtitle}
        serviceIcon={listConfig.headerIcon}
        iconColor="text-white"
        stats={EMPTY_SERVICE_HEADER_STATS}
        onBack={onBack}
        onCloseToHome={onGoHome}
        showBackButton
        headerColor="bg-[#FF8C42]"
        sheetToneClass="bg-white"
      />

      <div className="flex-1 -mt-4 rounded-t-[1.75rem] bg-white px-4 pt-6 pb-36 sm:rounded-t-[2rem]">
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={listConfig.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-gray-100 bg-gray-50 py-3 pl-11 pr-4 text-gray-900 placeholder:text-gray-400 transition-all focus:border-[#FF8C42] focus:outline-none focus:ring-2 focus:ring-[#FF8C42]/40"
          />
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {WAPPT_DISCOVERY_STYLE_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStyleFilter(filter.id)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                styleFilter === filter.id
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {feed.loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#FF8C42]/30 border-t-[#FF8C42]" />
            <p className="mt-4 text-sm text-gray-500">{listConfig.loadingMessage}</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF5EE] text-3xl">
              🐾
            </div>
            <p className="font-semibold text-gray-800">{listConfig.emptyTitle}</p>
            <p className="mt-1 text-sm text-gray-500">{listConfig.emptySubtitle}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">
              {listConfig.resultsCountLabel(filteredRows.length)}
            </p>

            {filteredRows.map((row) => {
              const address = resolveRowAddress(row);
              const cardProps = mapDiscoveryProviderToVendorCardProps({
                provider: {
                  name: row.name,
                  photo: row.photo,
                  isVerified: row.isVerified,
                  rating: row.rating,
                  reviewCount: row.reviewCount,
                  distance: row.distance != null ? Number(row.distance) : null,
                  distanceText: row.distanceText,
                  nextAvailableSlot: row.nextAvailableSlot,
                  experienceYears: row.experienceYears,
                  providerType: 'vendor',
                  city: row.city,
                },
                subtitle: resolveCardSubtitle(row, listConfig.cardCategoryLabel),
                address,
                footerHint: row.nextAvailableSlot
                  ? `Next: ${row.nextAvailableSlot}`
                  : 'Tap to view profile & book',
                profileAriaLabel: `View profile: ${row.name}`,
                verifiedAriaLabel: 'Verified provider',
                primaryActionClassName:
                  'text-[#FF8C42] border-[#FF8C42] hover:bg-[#FF8C42]/10',
                primaryLabel: 'Select Slot for Appointment',
                onPrimary: (e) => openVendorProfile(e, row),
                onProfileClick: (e) => openVendorProfile(e, row),
                secondaryLabel: 'Pay with Warmpawz',
                onSecondary: (e) => openWarmpawzPay(e, row),
              });

              return (
                <WarmpawzPayVendorCard
                  key={row.providerId}
                  {...cardProps}
                />
              );
            })}

            <DiscoveryVendorFeedSentinel
              hasMore={feed.hasMore}
              loading={feed.loading}
              loadingMore={feed.loadingMore}
              onLoadMore={feed.loadMore}
            />
          </div>
        )}
      </div>

      <StandardizedFooter
        currentTab="bookings"
        onTabChange={(tab) => {
          if (tab === 'home') onGoHome();
          else if (tab === 'bookings') onNavigate('my-bookings');
          else if (tab === 'shop') onNavigate('shop');
          else if (tab === 'profile') onNavigate('profile');
        }}
        maxWidth="max-w-customer"
      />
    </div>
  );
}
