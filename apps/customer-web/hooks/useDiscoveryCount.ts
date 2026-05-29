'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  resolveCustomerDiscoveryCoords,
  resolveCustomerDiscoveryPhone,
} from '@/lib/customer-discovery-coords';

function parseDiscoveryCountPayload(res: unknown): number {
  if (!res || typeof res !== 'object') return 0;
  const r = res as Record<string, unknown>;
  const raw = r.count;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.floor(raw));
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  const data = r.data;
  if (data && typeof data === 'object') {
    const inner = (data as Record<string, unknown>).count;
    if (typeof inner === 'number' && Number.isFinite(inner)) {
      return Math.max(0, Math.floor(inner));
    }
  }
  return 0;
}

/** Same cardinality as the listing endpoint (total / array length after filters). */
function parseDiscoverServicesCountPayload(res: unknown): number {
  if (!res || typeof res !== 'object') return 0;
  const r = res as Record<string, unknown>;
  if (typeof r.total === 'number' && Number.isFinite(r.total)) {
    return Math.max(0, Math.floor(r.total));
  }
  const vendors = r.vendors;
  if (Array.isArray(vendors)) return vendors.length;
  const providers = r.providers;
  if (Array.isArray(providers)) return providers.length;
  return 0;
}

export interface UseDiscoveryCountParams {
  /** When empty, customer phone is read from localStorage inside the query. */
  phone: string;
  serviceStyle: string;
  category?: string;
  roleId?: string;
  /** When coming from a problem-grid tile, pass the tile specialization so the count matches the listing. */
  specialization?: string;
  enabled?: boolean;
}

export function useDiscoveryCount(params: UseDiscoveryCountParams) {
  const { phone, serviceStyle, category, roleId, specialization, enabled = true } = params;

  const effectivePhone = resolveCustomerDiscoveryPhone(phone);

  return useQuery({
    queryKey: ['discovery-count', effectivePhone, serviceStyle, category ?? '', roleId ?? '', specialization ?? ''],
    enabled: enabled !== false && Boolean(serviceStyle?.trim?.()),
    staleTime: 60_000,
    retry: 2,
    placeholderData: 0,
    queryFn: async (): Promise<number> => {
      const { latitude, longitude } = await resolveCustomerDiscoveryCoords(effectivePhone);
      const qp = new URLSearchParams();
      qp.set('serviceStyle', serviceStyle);
      if (category) qp.set('category', category);
      if (roleId) qp.set('roleId', roleId);
      if (specialization) qp.set('specialization', specialization);
      if (latitude && longitude) {
        qp.set('latitude', latitude);
        qp.set('longitude', longitude);
      }
      if (effectivePhone) qp.set('phone', effectivePhone);
      const qs = qp.toString();
      try {
        const res = await apiClient.get(`/customer/discovery/count?${qs}`);
        return parseDiscoveryCountPayload(res);
      } catch {
        // Count route may be absent on older API deployments; discover-services uses the same filters.
        const res = await apiClient.get(`/customer/discover-services?${qs}`);
        return parseDiscoverServicesCountPayload(res);
      }
    },
  });
}
