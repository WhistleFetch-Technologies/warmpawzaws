/**
 * Server-side booking discount quote — unified resolver response.
 */
import { apiClient } from '@/lib/api-client';
import {
  normalizeUnifiedQuote,
  type UnifiedResolverResponse,
} from '@/lib/pricing/unified-resolver-response';

const promoStackInflight = new Map<string, Promise<UnifiedResolverResponse | null>>();
const promoStackCache = new Map<string, UnifiedResolverResponse | null>();

function promoStackCacheKey(params: {
  vendorId: string;
  serviceIds: string[];
  amount: number;
  customerId?: string;
  serviceStyle?: string;
  serviceCategory?: string;
  couponCode?: string;
  displayPromotionsOnly?: boolean;
}): string {
  const ids = [...params.serviceIds].map(String).sort().join(',');
  return [
    params.vendorId,
    params.amount,
    params.serviceCategory ?? '',
    params.serviceStyle ?? '',
    params.customerId ?? '',
    params.couponCode ?? '',
    params.displayPromotionsOnly ? 'promo-only' : 'full',
    ids,
  ].join('|');
}

export type BookingDiscountQuoteParams = {
  vendorId: string;
  serviceIds: string[];
  amount: number;
  customerId?: string;
  serviceStyle?: string;
  serviceCategory?: string;
  /** When set, resolver evaluates coupon per published policy. */
  couponCode?: string;
  /** Service listing / detail — promos only, no coupon. */
  displayPromotionsOnly?: boolean;
  /** Skip in-memory cache (e.g. after coupon apply). */
  bypassCache?: boolean;
  debugSessionId?: string;
};

export async function fetchBookingDiscountQuote(
  params: BookingDiscountQuoteParams
): Promise<UnifiedResolverResponse | null> {
  const key = promoStackCacheKey(params);
  if (!params.bypassCache) {
    const cached = promoStackCache.get(key);
    if (cached !== undefined) return cached;
    const inflight = promoStackInflight.get(key);
    if (inflight) return inflight;
  }

  const request = (async () => {
    try {
      const res = await apiClient.post<UnifiedResolverResponse>(
        '/promotions/calculate-booking',
        {
          vendorId: params.vendorId,
          serviceIds: params.serviceIds,
          amount: params.amount,
          customerId: params.customerId,
          serviceStyle: params.serviceStyle,
          serviceCategory: params.serviceCategory,
          couponCode: params.couponCode,
          displayPromotionsOnly: params.displayPromotionsOnly ?? !params.couponCode,
          debugSessionId: params.debugSessionId,
        }
      );
      const normalized = normalizeUnifiedQuote(res);
      if (!params.bypassCache) promoStackCache.set(key, normalized);
      return normalized;
    } catch {
      if (!params.bypassCache) promoStackCache.set(key, null);
      return null;
    } finally {
      if (!params.bypassCache) promoStackInflight.delete(key);
    }
  })();

  if (!params.bypassCache) promoStackInflight.set(key, request);
  return request;
}

/** @deprecated Use fetchBookingDiscountQuote — kept for existing imports. */
export async function fetchBookingPromotionStack(
  params: Omit<BookingDiscountQuoteParams, 'couponCode' | 'bypassCache'>
) {
  return fetchBookingDiscountQuote({ ...params, displayPromotionsOnly: true });
}

// ---------------------------------------------------------------------------
// Micro-batched display quotes — listing surfaces render many service cards at
// once; requests made within the batch window are grouped per vendor and sent
// as one POST /promotions/calculate-booking-batch instead of N single calls.
// ---------------------------------------------------------------------------

const BATCH_WINDOW_MS = 25;
const BATCH_MAX_ITEMS = 100;

type BatchQuoteEntry = {
  cacheKey: string;
  params: BookingDiscountQuoteParams;
  resolve: (value: UnifiedResolverResponse | null) => void;
};

const batchQueues = new Map<string, BatchQuoteEntry[]>();
let batchFlushTimer: ReturnType<typeof setTimeout> | null = null;

export type BatchedBookingQuoteParams = Omit<
  BookingDiscountQuoteParams,
  'couponCode' | 'bypassCache' | 'displayPromotionsOnly' | 'debugSessionId'
>;

/**
 * Display-only quote for listing cards. Same cache/in-flight dedup as
 * fetchBookingDiscountQuote, but transported via the batch endpoint.
 */
export function fetchBookingDiscountQuoteBatched(
  params: BatchedBookingQuoteParams
): Promise<UnifiedResolverResponse | null> {
  const fullParams: BookingDiscountQuoteParams = {
    ...params,
    displayPromotionsOnly: true,
  };
  const cacheKey = promoStackCacheKey(fullParams);
  const cached = promoStackCache.get(cacheKey);
  if (cached !== undefined) return Promise.resolve(cached);
  const inflight = promoStackInflight.get(cacheKey);
  if (inflight) return inflight;

  const request = new Promise<UnifiedResolverResponse | null>((resolve) => {
    enqueueBatchEntry({ cacheKey, params: fullParams, resolve });
  }).finally(() => {
    promoStackInflight.delete(cacheKey);
  });
  promoStackInflight.set(cacheKey, request);
  return request;
}

function enqueueBatchEntry(entry: BatchQuoteEntry): void {
  const groupKey = `${entry.params.vendorId}|${entry.params.customerId ?? ''}`;
  const queue = batchQueues.get(groupKey);
  if (queue) {
    queue.push(entry);
  } else {
    batchQueues.set(groupKey, [entry]);
  }
  if (!batchFlushTimer) {
    batchFlushTimer = setTimeout(() => {
      batchFlushTimer = null;
      const groups = [...batchQueues.values()];
      batchQueues.clear();
      for (const entries of groups) void flushBatchGroup(entries);
    }, BATCH_WINDOW_MS);
  }
}

async function flushBatchGroup(entries: BatchQuoteEntry[]): Promise<void> {
  const { vendorId, customerId } = entries[0].params;
  for (let i = 0; i < entries.length; i += BATCH_MAX_ITEMS) {
    const chunk = entries.slice(i, i + BATCH_MAX_ITEMS);
    try {
      const res = await apiClient.post<{
        success: boolean;
        quotes?: Array<{ key: string } & UnifiedResolverResponse>;
      }>('/promotions/calculate-booking-batch', {
        vendorId,
        customerId,
        items: chunk.map((entry) => ({
          key: entry.cacheKey,
          serviceIds: entry.params.serviceIds,
          amount: entry.params.amount,
          serviceStyle: entry.params.serviceStyle,
          serviceCategory: entry.params.serviceCategory,
        })),
      });
      const byKey = new Map((res.quotes ?? []).map((q) => [q.key, q]));
      for (const entry of chunk) {
        const raw = byKey.get(entry.cacheKey) ?? null;
        const normalized = raw ? normalizeUnifiedQuote(raw) : null;
        promoStackCache.set(entry.cacheKey, normalized);
        entry.resolve(normalized);
      }
    } catch {
      // Batch endpoint unavailable — fall back to per-item quotes so listings
      // still show promo pricing (e.g. UI deployed ahead of API).
      await Promise.all(
        chunk.map(async (entry) => {
          const quote = await fetchBookingDiscountQuote({
            ...entry.params,
            bypassCache: true,
          });
          promoStackCache.set(entry.cacheKey, quote);
          entry.resolve(quote);
        })
      );
    }
  }
}

export type ServiceBookingQuote = {
  basePrice: number;
  discount: number;
  tax: number;
  finalPrice: number;
  taxBreakdown?: Array<{ name: string; rate: number; amount: number }>;
  appliedPromotions?: Array<{
    id: string;
    type: string;
    name: string;
    discountAmount: number;
  }>;
  vendorPromotionId?: string;
  platformPromotionId?: string;
};

export async function fetchServiceBookingQuote(params: {
  serviceId: string;
  vendorId: string;
  customerId?: string;
  serviceStyle?: string;
  customerState?: string;
  customerCity?: string;
}): Promise<ServiceBookingQuote | null> {
  try {
    const res = await apiClient.post<ServiceBookingQuote & { success?: boolean }>(
      '/customer/pricing/quote',
      {
        serviceId: params.serviceId,
        vendorId: params.vendorId,
        customerId: params.customerId,
        serviceStyle: params.serviceStyle,
        customerState: params.customerState,
        customerCity: params.customerCity,
      }
    );
    if ((res as { success?: boolean }).success === false) return null;
    return res as ServiceBookingQuote;
  } catch {
    return null;
  }
}

export function clearBookingDiscountQuoteCache(): void {
  promoStackCache.clear();
  promoStackInflight.clear();
}
