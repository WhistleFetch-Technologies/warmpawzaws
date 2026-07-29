'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

export type AppointmentVendorCard = {
  id: string;
  vendorId: string;
  name: string;
  photoUrl: string | null;
  roleDisplayName: string;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  isOnline: boolean;
  distanceKm: number | null;
  distanceText: string | null;
  shortAddress: string | null;
  availabilityText: string;
  serviceStyle?: string;
};

export type WapptStyleFilter = 'all' | 'at_center' | 'at_home';

type DiscoveryResponse = {
  success: boolean;
  vendors?: AppointmentVendorCard[];
  nextCursor?: string | null;
  total?: number;
};

export function useWarmpawzAppointmentsDiscovery(opts: {
  category: string;
  serviceStyle: WapptStyleFilter;
  enabled?: boolean;
}) {
  const { category, serviceStyle, enabled = true } = opts;
  const [vendors, setVendors] = useState<AppointmentVendorCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!enabled || !category) return;
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({
          category,
          serviceStyle,
          page: String(pageNum),
          limit: '20',
        });
        const res = await apiClient.get<DiscoveryResponse>(
          `/customer/warmpawz-appointments/discovery/by-category?${qs}`,
        );
        const list = res.vendors ?? [];
        setVendors((prev) => (append ? [...prev, ...list] : list));
        setHasMore(Boolean(res.nextCursor));
        setPage(pageNum);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load providers';
        setError(msg);
        if (!append) setVendors([]);
      } finally {
        setLoading(false);
      }
    },
    [category, enabled, serviceStyle],
  );

  useEffect(() => {
    void load(1, false);
  }, [load]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    void load(page + 1, true);
  }, [hasMore, load, loading, page]);

  return { vendors, loading, error, hasMore, loadMore, reload: () => load(1, false) };
}
