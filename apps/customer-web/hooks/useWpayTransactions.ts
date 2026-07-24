import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  buildWpayTransactionsUrl,
  wpayNextCursor,
  wpayTransactionsFromResponse,
  type WpayTransactionCard,
} from '@/lib/warmpawz-pay/wpay-api';

function readCustomerPhone(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone') || '';
}

export function useWpayTransactions(opts?: { limit?: number; enabled?: boolean }) {
  const limit = opts?.limit ?? 5;
  const enabled = opts?.enabled ?? true;

  const [phone, setPhone] = useState('');
  const [rows, setRows] = useState<WpayTransactionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);

  useEffect(() => {
    setPhone(readCustomerPhone());
  }, []);

  const load = useCallback(
    async (append: boolean, nextCursor?: string | null) => {
      const p = readCustomerPhone();
      if (!p) {
        setError('Please log in to view payment history');
        setLoading(false);
        return;
      }
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        const url = buildWpayTransactionsUrl({
          limit,
          phone: p,
          cursor: append ? nextCursor ?? undefined : undefined,
        });
        const data = await apiClient.get(url);
        const batch = wpayTransactionsFromResponse(data);
        const nc = wpayNextCursor(data);
        setCursor(nc);
        setRows((prev) => (append ? [...prev, ...batch] : batch));
        setError(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load history');
        if (!append) setRows([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [limit],
  );

  useEffect(() => {
    if (!enabled || !phone) {
      if (!phone) setLoading(false);
      return;
    }
    void load(false);
  }, [enabled, load, phone]);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore) return;
    void load(true, cursor);
  }, [cursor, load, loadingMore]);

  return {
    rows,
    loading,
    loadingMore,
    error,
    hasMore: Boolean(cursor),
    loadMore,
    refresh: () => load(false),
  };
}
