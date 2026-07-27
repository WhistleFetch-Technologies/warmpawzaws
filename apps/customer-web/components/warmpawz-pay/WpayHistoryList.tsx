'use client';

import { WpayTransactionCardView } from '@/components/warmpawz-pay/WpayTransactionCard';
import { useWpayTransactions } from '@/hooks/useWpayTransactions';

interface WpayHistoryListProps {
  limit?: number;
  showLoadMore?: boolean;
  emptyMessage?: string;
}

export function WpayHistoryList({
  limit = 5,
  showLoadMore = true,
  emptyMessage = 'No Warmpawz Pay payments yet.',
}: WpayHistoryListProps) {
  const { rows, loading, loadingMore, error, hasMore, loadMore } = useWpayTransactions({ limit });

  if (loading) {
    return <p className="py-4 text-center text-sm text-gray-500">Loading…</p>;
  }
  if (error) {
    return <p className="py-4 text-center text-sm text-red-600">{error}</p>;
  }
  if (rows.length === 0) {
    return <p className="py-4 text-center text-sm text-gray-500">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <WpayTransactionCardView key={row.paymentId} row={row} />
      ))}
      {showLoadMore && hasMore ? (
        <button
          type="button"
          disabled={loadingMore}
          onClick={loadMore}
          className="w-full rounded-xl border border-gray-200 bg-white py-2 text-sm text-gray-700"
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      ) : null}
    </div>
  );
}
