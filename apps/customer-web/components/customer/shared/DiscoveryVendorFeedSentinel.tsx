'use client';

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

type DiscoveryVendorFeedSentinelProps = {
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
};

/** IntersectionObserver sentinel for cursor-paginated discovery vendor lists. */
export function DiscoveryVendorFeedSentinel({
  hasMore,
  loading,
  loadingMore,
  onLoadMore,
}: DiscoveryVendorFeedSentinelProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || loadingMore || loading) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMore();
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, onLoadMore]);

  if (!hasMore && !loadingMore) return null;

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div ref={sentinelRef} className="h-1 w-full" aria-hidden />
      {loadingMore ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading more…
        </div>
      ) : null}
    </div>
  );
}
