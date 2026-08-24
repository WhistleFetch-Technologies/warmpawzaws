'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Clock, Search } from 'lucide-react';
import { useWpayVendorFeed } from '@/hooks/useWpayVendorFeed';
import { WPAY_HISTORY_PATH } from '@/lib/warmpawz-pay/wpay-api';
import { mapWpayVendorCardToProps } from '@/lib/warmpawz-pay/map-wpay-vendor-card-to-props';
import { WarmpawzPayVendorCard } from '@/components/warmpawz-pay/vendor-card/WarmpawzPayVendorCard';
import { buildWpayVendorPayPath } from '@/lib/warmpawz-pay/wpay-guest-journey';
import { inferHubSlugFromSearchQuery } from '@/lib/search-hub-category-filter';
import { mapServiceKeyToWpayCategory } from '@/lib/commerce-switch-routing/map-service-to-wpay-category';
import { buildWapptVendorKeywordTokens } from '@/lib/search-wappt-keyword-filter';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'vet', label: 'Vet Clinics' },
  { id: 'grooming', label: 'Grooming' },
  { id: 'training', label: 'Training' },
  { id: 'walking', label: 'Walking' },
  { id: 'boarding', label: 'Boarding' },
  { id: 'sitting', label: 'Pet Sitting' },
  { id: 'nutrition', label: 'Nutrition' },
];

const SEARCH_DEBOUNCE_MS = 300;

function WarmpawzPayPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [category, setCategory] = useState('all');
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const chipSelectedByUserRef = useRef(false);

  useEffect(() => {
    const requested = searchParams.get('category');
    if (!requested) return;
    if (CATEGORIES.some((entry) => entry.id === requested)) {
      setCategory(requested);
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = searchQuery.trim();
      setDebouncedQuery(trimmed);
      if (!chipSelectedByUserRef.current && trimmed) {
        const hub = inferHubSlugFromSearchQuery(trimmed);
        if (hub) {
          const chipId = mapServiceKeyToWpayCategory(hub);
          if (chipId !== 'all') setCategory(chipId);
        }
      }
      if (!trimmed) chipSelectedByUserRef.current = false;
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const handleResolvedCategory = useCallback((resolvedId: string | null) => {
    if (chipSelectedByUserRef.current || !resolvedId) return;
    if (CATEGORIES.some((entry) => entry.id === resolvedId)) {
      setCategory(resolvedId);
    }
  }, []);

  const { vendors, loading, loadingMore, hasMore, error, loadMore } = useWpayVendorFeed({
    category,
    q: debouncedQuery || undefined,
    pageSize: 5,
    onResolvedCategory: handleResolvedCategory,
  });

  const displayedVendors = useMemo(() => {
    const q = debouncedQuery.trim();
    if (!q) return vendors;

    const inferredHub = inferHubSlugFromSearchQuery(q);
    if (inferredHub) {
      const tokens = buildWapptVendorKeywordTokens(q, inferredHub);
      if (tokens.length === 0) return vendors;
      return vendors.filter((v) => {
        const hay = v.name.toLowerCase();
        return tokens.every((token) => hay.includes(token));
      });
    }

    const qLower = q.toLowerCase();
    return vendors.filter((v) => v.name.toLowerCase().includes(qLower));
  }, [debouncedQuery, vendors]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '120px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loading, loadingMore]);

  const emptyMessage = useMemo(() => {
    if (loading) return null;
    if (error) return error;
    if (displayedVendors.length === 0) {
      return debouncedQuery
        ? 'No vendors match your search.'
        : 'No published vendors yet. Check back soon!';
    }
    return null;
  }, [debouncedQuery, displayedVendors.length, error, loading]);

  return (
    <div className="mx-auto w-full max-w-customer">
      <header className="bg-gradient-to-b from-[#FF8C42] to-[#FF6B00] px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => router.push('/')} aria-label="Back" className="p-1">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => router.push(WPAY_HISTORY_PATH)}
            aria-label="Payment history"
            className="rounded-full bg-white/20 p-2"
          >
            <Clock className="h-5 w-5" />
          </button>
        </div>
        <h1 className="text-xl font-bold">Warmpawz Pay</h1>
        <p className="text-sm text-white/90">Pay with exclusive offers</p>
        <div className="mt-4 flex items-center gap-2 rounded-full bg-white px-3 py-2 text-gray-800">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vets, trainers, grooming…"
            className="flex-1 bg-transparent text-sm outline-none"
            aria-label="Search Warmpawz Pay vendors"
          />
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              chipSelectedByUserRef.current = true;
              setCategory(c.id);
            }}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm ${
              category === c.id ? 'bg-[#FF6B00] text-white' : 'bg-white text-gray-700'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 px-4 pb-4">
        {loading ? <p className="py-8 text-center text-sm text-gray-500">Loading vendors…</p> : null}
        {emptyMessage ? (
          <p className="py-8 text-center text-sm text-gray-500">{emptyMessage}</p>
        ) : null}

        {!loading
          ? displayedVendors.map((v) => (
              <button
                key={v.vendorId}
                type="button"
                className="block w-full text-left"
                aria-label={`View ${v.name}`}
                onClick={() => {
                  router.push(buildWpayVendorPayPath(v.vendorId));
                }}
              >
                <WarmpawzPayVendorCard {...mapWpayVendorCardToProps(v)} />
              </button>
            ))
          : null}

        {hasMore ? (
          <div ref={sentinelRef} className="py-3 text-center text-sm text-gray-400">
            {loadingMore ? 'Loading more…' : ''}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function WarmpawzPayPage() {
  return (
    <Suspense fallback={<p className="py-8 text-center text-sm text-gray-500">Loading…</p>}>
      <WarmpawzPayPageContent />
    </Suspense>
  );
}
