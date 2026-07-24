'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, Clock, Search } from 'lucide-react';
import { useWpayVendorFeed } from '@/hooks/useWpayVendorFeed';
import { DiscoveryProviderAvatar } from '@/components/customer/shared/DiscoveryProviderAvatar';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'vet', label: 'Vet Clinics' },
  { id: 'grooming', label: 'Grooming' },
  { id: 'training', label: 'Training' },
  { id: 'walking', label: 'Walking' },
  { id: 'boarding', label: 'Boarding' },
];

function matchesVendorSearch(name: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return name.toLowerCase().includes(q);
}

export default function WarmpawzPayPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('all');
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { vendors, loading, loadingMore, hasMore, error, loadMore } = useWpayVendorFeed({
    category,
    pageSize: 5,
  });

  const filteredVendors = useMemo(
    () => vendors.filter((v) => matchesVendorSearch(v.name, searchQuery)),
    [searchQuery, vendors]
  );

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
    if (vendors.length === 0) return 'No published vendors yet. Check back soon!';
    if (filteredVendors.length === 0) return 'No vendors match your search.';
    return null;
  }, [error, filteredVendors.length, loading, vendors.length]);

  return (
    <div className="mx-auto w-full max-w-customer">
      <header className="bg-gradient-to-b from-[#FF8C42] to-[#FF6B00] px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => router.push('/')} aria-label="Back" className="p-1">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => router.push('/warmpawz-pay/history')}
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
            placeholder="Search vendors..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
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

        {filteredVendors.map((v) => (
          <button
            key={v.vendorId}
            type="button"
            onClick={() => router.push(`/warmpawz-pay/vendors/${encodeURIComponent(v.vendorId)}`)}
            className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm"
          >
            <DiscoveryProviderAvatar name={v.name} photo={v.photoUrl ?? undefined} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-gray-900">{v.name}</p>
              {v.phone ? <p className="truncate text-xs text-gray-500">{v.phone}</p> : null}
              <p className="truncate text-xs text-gray-500">{v.address}</p>
              {v.discountPercent > 0 ? (
                <span className="mt-1 inline-block rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                  {v.discountPercent}% OFF
                </span>
              ) : null}
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
          </button>
        ))}

        {hasMore ? (
          <div ref={sentinelRef} className="py-3 text-center text-sm text-gray-400">
            {loadingMore ? 'Loading more…' : ''}
          </div>
        ) : null}
      </div>
    </div>
  );
}
