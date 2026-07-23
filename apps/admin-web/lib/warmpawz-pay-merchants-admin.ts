import { apiClient } from '@/lib/api-client';

export const WPAY_MERCHANTS_API_BASE = '/admin/warmpawz-pay/merchants';

export type PlatformStatus =
  | 'Approved'
  | 'Pending'
  | 'Suspended'
  | 'Inactive'
  | 'Deleted';

export type WarmpawzPayStatus = 'Draft' | 'Published' | 'Hidden';

export type MerchantBusinessType = 'Solo' | 'Business' | 'Center';

export type ReadinessSeverity = 'blocker' | 'warning';

export interface ReadinessCheck {
  readonly key: string;
  readonly label: string;
  readonly passed: boolean;
  readonly severity: ReadinessSeverity;
  readonly detail?: string;
}

export interface MerchantReadiness {
  readonly checks: readonly ReadinessCheck[];
  readonly blockersPassed: number;
  readonly blockersTotal: number;
  readonly readyForPayBill: boolean;
}

export interface MerchantListItem {
  readonly catalogueId: string;
  readonly vendorId: string;
  readonly vendorName: string;
  readonly businessName: string;
  readonly city: string | null;
  readonly category: string;
  readonly businessType: MerchantBusinessType;
  readonly platformStatus: PlatformStatus;
  readonly warmpawzPayStatus: WarmpawzPayStatus;
  readonly readiness: MerchantReadiness;
  readonly customerVisible: boolean;
  readonly updatedAt: string;
}

export interface PaginationResponse {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface MerchantListData {
  readonly items: readonly MerchantListItem[];
  readonly pagination: PaginationResponse;
}

export type PlatformStatusFilter =
  | 'approved'
  | 'pending'
  | 'suspended'
  | 'inactive'
  | 'deleted'
  | 'all';

export type WarmpawzPayStatusFilter = 'draft' | 'published' | 'hidden' | 'all';

export type BusinessTypeFilter = 'solo' | 'business' | 'center' | 'all';

export type CustomerVisibleFilter = 'visible' | 'hidden' | 'all';

export interface MerchantListQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly sortBy?: 'updatedAt' | 'publishedAt' | 'businessName' | 'publishStatus';
  readonly sortOrder?: 'asc' | 'desc';
  readonly q?: string;
  readonly category?: string;
  readonly businessType?: BusinessTypeFilter;
  readonly platformStatus?: PlatformStatusFilter;
  readonly warmpawzPayStatus?: WarmpawzPayStatusFilter;
  readonly customerVisible?: CustomerVisibleFilter;
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

export async function fetchMerchantList(
  params: MerchantListQueryParams,
): Promise<MerchantListData> {
  const response = await apiClient.get<SuccessEnvelope<MerchantListData> | MerchantListData>(
    `${WPAY_MERCHANTS_API_BASE}${buildQueryString({
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      q: params.q,
      category: params.category,
      businessType:
        params.businessType && params.businessType !== 'all'
          ? params.businessType
          : undefined,
      platformStatus:
        params.platformStatus && params.platformStatus !== 'all'
          ? params.platformStatus
          : undefined,
      warmpawzPayStatus:
        params.warmpawzPayStatus && params.warmpawzPayStatus !== 'all'
          ? params.warmpawzPayStatus
          : undefined,
      customerVisible:
        params.customerVisible && params.customerVisible !== 'all'
          ? params.customerVisible
          : undefined,
    })}`,
  );
  return assertSuccess(response);
}

export function formatReadinessScore(readiness: MerchantReadiness): string {
  return `${readiness.blockersPassed}/${readiness.blockersTotal}`;
}
