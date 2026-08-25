'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useWalkInNearbyFeed, WALK_IN_NEARBY_PAGE_SIZE } from '@/hooks/useWalkInNearbyProviders';
import { useWalkInDiscoveryLocation } from '@/hooks/useWalkInDiscoveryLocation';
import { useWalkInVendorActions } from '@/lib/walk-in-vendor-actions';
import {
  WALK_IN_SECTION_SUBTITLE,
  WALK_IN_SECTION_TITLE,
} from '@/lib/walk-in-constants';
import { shouldShowWalkInNearYou } from '@/lib/walk-in-commerce-gate';
import { useCommerceConfigOptional } from '@/lib/commerce-config-provider';
import { hasAuthenticatedCustomerSession } from '@/lib/guest-auth-gate';
import type { WalkInProvider } from '@/lib/mergeWalkInDiscoveryBatches';
import { DiscoveryVendorFeedSentinel } from '@/components/customer/shared/DiscoveryVendorFeedSentinel';
import { ManualLocationSheet } from '@/components/customer/ManualLocationSheet';
import { WalkInLocationSheet } from '@/components/customer/walk-in/WalkInLocationSheet';
import {
  WalkInProviderCard,
  WalkInProviderCardSkeleton,
} from '@/components/customer/home/sections/WalkInProviderCard';

function dedupeWalkInProvidersById(providers: WalkInProvider[]): WalkInProvider[] {
  const seen = new Set<string>();
  const unique: WalkInProvider[] = [];
  for (const provider of providers) {
    const id = String(provider.id ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(provider);
  }
  return unique;
}

export function WalkInVendorsPageClient() {
  const router = useRouter();
  const commerce = useCommerceConfigOptional();
  const showWalkIn = shouldShowWalkInNearYou(commerce);
  const [phone, setPhone] = useState<string | undefined>(undefined);
  const [isGuest, setIsGuest] = useState(true);
  const [addressOpen, setAddressOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    setPhone(localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone') || undefined);
    setIsGuest(!hasAuthenticatedCustomerSession());
  }, []);

  useEffect(() => {
    if (commerce?.isLoaded && !showWalkIn) {
      router.replace('/');
    }
  }, [commerce?.isLoaded, showWalkIn, router]);

  const discoveryLocation = useWalkInDiscoveryLocation({ phone, isGuest });
  const { providers, isLoading, isError, isFetching, hasMore, loadMore } = useWalkInNearbyFeed({
    phone,
    latitude: discoveryLocation.latitude,
    longitude: discoveryLocation.longitude,
    limit: WALK_IN_NEARBY_PAGE_SIZE,
    enabled: showWalkIn && discoveryLocation.ready,
  });
  const { payBill, bookNow, openVendorDetails } = useWalkInVendorActions();

  const listingProviders = useMemo(
    () => dedupeWalkInProvidersById(providers),
    [providers]
  );

  const showSkeleton = isLoading && listingProviders.length === 0;
  const showEmpty = !showSkeleton && !isError && listingProviders.length === 0;

  if (!showWalkIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-[#FF8C42]" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/40 via-white to-slate-50">
      <header className="sticky top-0 z-40 border-b border-orange-100 bg-white/90 backdrop-blur-md cw-header-safe-top">
        <div className="mx-auto flex max-w-customer items-start gap-3 pb-3 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-orange-50 active:bg-orange-100"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <MapPin className="h-5 w-5 shrink-0 text-[#FF8C42]" aria-hidden />
              {WALK_IN_SECTION_TITLE}
            </h1>
            <p className="mt-0.5 text-xs leading-[18px] text-slate-500">{WALK_IN_SECTION_SUBTITLE}</p>
            <button
              type="button"
              className="mt-1 flex min-w-0 max-w-full items-center gap-1 text-left text-xs font-medium text-[#FF8C42]"
              onClick={() => {
                if (isGuest) {
                  void discoveryLocation.selectCurrentLocation().then((ok) => {
                    if (ok) toast.success('Location updated');
                    else setManualOpen(true);
                  });
                  return;
                }
                setAddressOpen(true);
              }}
              aria-label="Change Walk-in discovery location"
            >
              <MapPin className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">
                {discoveryLocation.label || 'Set discovery location'}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-customer px-4 py-5 pb-12">
        {showSkeleton ? (
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <WalkInProviderCardSkeleton key={i} layout="stack" />
            ))}
          </div>
        ) : isError && listingProviders.length === 0 ? (
          <div className="rounded-2xl border border-amber-100 bg-white px-4 py-10 text-center">
            <p className="text-sm text-slate-600">Could not load walk-in services nearby.</p>
          </div>
        ) : showEmpty ? (
          <div className="rounded-2xl border border-orange-100 bg-white px-4 py-10 text-center">
            <p className="text-sm text-slate-600">No walk-in services found near your location.</p>
          </div>
        ) : (
          <>
            {isFetching && listingProviders.length > 0 ? (
              <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#FF8C42]" aria-hidden />
                Updating nearby vendors…
              </div>
            ) : null}
            <div className="flex flex-col gap-4">
              {listingProviders.map((provider) => (
                <WalkInProviderCard
                  key={provider.id}
                  provider={provider}
                  layout="stack"
                  onCardClick={() => openVendorDetails(provider)}
                  onSelect={() => payBill(provider)}
                  onBook={() => bookNow(provider)}
                />
              ))}
            </div>
            <DiscoveryVendorFeedSentinel
              hasMore={hasMore}
              loading={isLoading}
              loadingMore={isFetching && listingProviders.length > 0}
              onLoadMore={loadMore}
            />
          </>
        )}
      </main>
      <ManualLocationSheet open={manualOpen} onClose={() => setManualOpen(false)} />
      <WalkInLocationSheet
        open={addressOpen}
        onClose={() => setAddressOpen(false)}
        addresses={discoveryLocation.addresses}
        selectedAddressId={discoveryLocation.addressId}
        onSelectAddress={discoveryLocation.selectAddress}
        onSelectCurrent={async () => {
          const ok = await discoveryLocation.selectCurrentLocation();
          if (ok) toast.success('Location updated');
          return ok;
        }}
      />
    </div>
  );
}
