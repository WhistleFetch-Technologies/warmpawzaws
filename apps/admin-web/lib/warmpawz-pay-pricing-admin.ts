import { apiClient } from '@/lib/api-client';

export const WPAY_PRICING_API_BASE = '/admin/warmpawz-pay/pricing';

export type PricingDiscountType = 'percentage';
export type PricingStatus = 'active' | 'disabled';

export interface PricingListItem {
  readonly pricingId: string;
  readonly vendorId: string;
  readonly merchantName: string;
  readonly businessName: string;
  readonly category: string;
  readonly discountType: PricingDiscountType;
  readonly discountValue: number;
  readonly status: PricingStatus;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly updatedAt: string;
}

export interface PricingDetail extends PricingListItem {
  readonly catalogueId: string | null;
  readonly createdAt: string;
  readonly createdBy: string | null;
}

export interface PaginationResponse {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface PricingListData {
  readonly items: readonly PricingListItem[];
  readonly pagination: PaginationResponse;
}

export type PricingStatusFilter = 'active' | 'disabled' | 'all';
export type PricingDiscountTypeFilter = 'percentage' | 'all';

export interface PricingListQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly sortBy?: 'updatedAt' | 'effectiveFrom' | 'businessName';
  readonly sortOrder?: 'asc' | 'desc';
  readonly q?: string;
  readonly category?: string;
  readonly status?: PricingStatusFilter;
  readonly discountType?: PricingDiscountTypeFilter;
}

export interface CreatePricingPayload {
  readonly vendorId: string;
  readonly discountType: PricingDiscountType;
  readonly discountValue: number;
  readonly status: PricingStatus;
  readonly effectiveFrom: string;
  readonly effectiveUntil?: string | null;
}

export interface UpdatePricingPayload {
  readonly discountType?: PricingDiscountType;
  readonly discountValue?: number;
  readonly status?: PricingStatus;
  readonly effectiveFrom?: string;
  readonly effectiveUntil?: string | null;
}

interface SuccessEnvelope<T> {
  readonly success: true;
  readonly data: T;
}

interface ErrorEnvelope {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
}

function assertSuccess<T>(response: SuccessEnvelope<T> | ErrorEnvelope | T): T {
  if (response && typeof response === 'object' && 'success' in response) {
    if (response.success === true && 'data' in response) {
      return response.data;
    }
    if (response.success === false && 'error' in response) {
      throw new Error(response.error.message || 'Request failed');
    }
  }
  return response as T;
}

function buildQueryString(
  params: Record<string, string | number | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export async function fetchPricingList(
  params: PricingListQueryParams,
): Promise<PricingListData> {
  const response = await apiClient.get<SuccessEnvelope<PricingListData> | PricingListData>(
    `${WPAY_PRICING_API_BASE}${buildQueryString({
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      q: params.q,
      category: params.category,
      status: params.status && params.status !== 'all' ? params.status : undefined,
      discountType:
        params.discountType && params.discountType !== 'all'
          ? params.discountType
          : undefined,
    })}`,
  );
  return assertSuccess(response);
}

export async function fetchPricingDetail(vendorId: string): Promise<PricingDetail> {
  const response = await apiClient.get<SuccessEnvelope<PricingDetail> | PricingDetail>(
    `${WPAY_PRICING_API_BASE}/${vendorId}`,
  );
  return assertSuccess(response);
}

export async function createPricing(payload: CreatePricingPayload): Promise<PricingDetail> {
  const response = await apiClient.post<SuccessEnvelope<PricingDetail> | PricingDetail>(
    WPAY_PRICING_API_BASE,
    payload,
  );
  return assertSuccess(response);
}

export async function updatePricing(
  vendorId: string,
  payload: UpdatePricingPayload,
): Promise<PricingDetail> {
  const response = await apiClient.put<SuccessEnvelope<PricingDetail> | PricingDetail>(
    `${WPAY_PRICING_API_BASE}/${vendorId}`,
    payload,
  );
  return assertSuccess(response);
}

export async function disablePricing(
  vendorId: string,
): Promise<{ disabled: true; vendorId: string }> {
  const response = await apiClient.delete<
    SuccessEnvelope<{ disabled: true; vendorId: string }> | { disabled: true; vendorId: string }
  >(`${WPAY_PRICING_API_BASE}/${vendorId}`);
  return assertSuccess(response);
}

export function formatPricingDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDiscountValue(
  discountType: PricingDiscountType,
  discountValue: number,
): string {
  if (discountType === 'percentage') {
    return `${discountValue}%`;
  }
  return String(discountValue);
}

export function shortVendorId(vendorId: string): string {
  return vendorId.length > 8 ? `${vendorId.slice(0, 8)}…` : vendorId;
}

export function validatePricingForm(input: {
  discountValue: number;
  effectiveFrom: string;
  effectiveUntil?: string | null;
}): string | null {
  if (Number.isNaN(input.discountValue) || input.discountValue < 0 || input.discountValue > 100) {
    return 'Discount value must be between 0 and 100 for percentage pricing.';
  }
  if (!input.effectiveFrom) {
    return 'Effective from date is required.';
  }
  if (input.effectiveUntil) {
    const from = new Date(input.effectiveFrom);
    const until = new Date(input.effectiveUntil);
    if (until.getTime() < from.getTime()) {
      return 'Effective until must be on or after effective from.';
    }
  }
  return null;
}
