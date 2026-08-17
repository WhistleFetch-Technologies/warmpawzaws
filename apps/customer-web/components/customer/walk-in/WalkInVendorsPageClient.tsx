'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, MapPin } from 'lucide-react';
import { useWalkInNearbyProviders } from '@/hooks/useWalkInNearbyProviders';
import { useWalkInVendorActions } from '@/lib/walk-in-vendor-actions';
import {
  WALK_IN_SECTION_SUBTITLE,
  WALK_IN_SECTION_TITLE,
} from '@/lib/walk-in-constants';
import { shouldShowWalkInNearYou } from '@/lib/walk-in-commerce-gate';
import { useCommerceConfigOptional } from '@/lib/commerce-config-provider';
import type { WalkInProvider } from '@/lib/mergeWalkInDiscoveryBatches';
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

  useEffect(() => {
    setPhone(localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone') || undefined);
  }, []);

  useEffect(() => {
    if (commerce?.isLoaded && !showWalkIn) {
      router.replace('/');
    }
  }, [commerce?.isLoaded, showWalkIn, router]);

  const { data: providers = [], isLoading, isError, isFetching } = useWalkInNearbyProviders({
    phone,
    enabled: showWalkIn,
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
          </>
        )}
      </main>
    </div>
  );
}
