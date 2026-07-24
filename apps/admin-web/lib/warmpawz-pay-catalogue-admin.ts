import { apiClient } from '@/lib/api-client';
import type {
  MerchantBusinessType,
  MerchantReadiness,
  PlatformStatus,
  WarmpawzPayStatus,
} from '@/lib/warmpawz-pay-merchant-types';
import type { PricingDiscountType, PricingStatus } from '@/lib/warmpawz-pay-pricing-admin';

export const WPAY_CATALOGUE_API_BASE = '/admin/warmpawz-pay/catalogue';

export type PublishStatus = 'draft' | 'published';

export type CataloguePublishStatusFilter = 'draft' | 'published' | 'all';

export type CatalogueEligibilityFilter =
  | 'customer_visible'
  | 'not_customer_visible'
  | 'all';

export interface EligibilityDTO {
  readonly bankVerified: boolean;
  readonly vendorStatus: string;
  readonly customerVisible: boolean;
}

export interface CataloguePricingSummary {
  readonly configured: boolean;
  readonly pricingId?: string;
  readonly discountType?: PricingDiscountType;
  readonly discountValue?: number;
  readonly status?: PricingStatus;
  readonly effectiveFrom?: string;
  readonly effectiveUntil?: string | null;
}

export interface CatalogueListItem {
  readonly catalogueId: string;
  readonly vendorId: string;
  readonly businessName: string;
  readonly ownerName?: string;
  readonly city?: string;
  readonly phone?: string;
  readonly publishStatus: PublishStatus;
  readonly publishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string | null;
  readonly eligibility: EligibilityDTO;
  readonly warnings?: readonly string[];
  readonly category: string;
  readonly businessType: MerchantBusinessType;
  readonly platformStatus: PlatformStatus;
  readonly warmpawzPayStatus: WarmpawzPayStatus;
  readonly customerVisible: boolean;
  readonly readiness: MerchantReadiness;
  readonly pricing: CataloguePricingSummary;
}

export interface CatalogueDetail extends CatalogueListItem {
  readonly auditSummary?: readonly {
    readonly action: string;
    readonly actorId: string | null;
    readonly occurredAt: string;
  }[];
}

export interface VendorCandidateDTO {
  readonly vendorId: string;
  readonly businessName: string;
  readonly city: string | null;
  readonly status: string;
  readonly bankVerified: boolean;
  readonly category: string;
  readonly platformStatus: PlatformStatus;
}

export interface PaginationResponse {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface CatalogueListData {
  readonly items: readonly CatalogueListItem[];
  readonly pagination: PaginationResponse;
}

export interface VendorCandidateListData {
  readonly items: readonly VendorCandidateDTO[];
  readonly pagination: PaginationResponse;
}

export interface BulkOperationResultItem {
  readonly catalogueId: string;
  readonly success: boolean;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
}

export interface BulkOperationResponse {
  readonly requested: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly results: readonly BulkOperationResultItem[];
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

export interface CatalogueListQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly sortBy?: 'updatedAt' | 'publishedAt' | 'businessName' | 'publishStatus';
  readonly sortOrder?: 'asc' | 'desc';
  readonly publishStatus?: Exclude<CataloguePublishStatusFilter, 'all'>;
  readonly q?: string;
  readonly eligibility?: Exclude<CatalogueEligibilityFilter, 'all'>;
  readonly city?: string;
  readonly vendorId?: string;
  readonly category?: string;
}

export interface VendorCandidatesQueryParams {
  readonly q?: string;
  readonly page?: number;
  readonly pageSize?: number;
  readonly status?: string;
  readonly eligibility?: Exclude<CatalogueEligibilityFilter, 'all'>;
  readonly vendorId?: string;
  readonly category?: string;
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

export async function fetchCatalogueList(
  params: CatalogueListQueryParams,
): Promise<CatalogueListData> {
  const response = await apiClient.get<SuccessEnvelope<CatalogueListData> | CatalogueListData>(
    `${WPAY_CATALOGUE_API_BASE}${buildQueryString({
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      publishStatus: params.publishStatus,
      q: params.q,
      eligibility: params.eligibility,
      city: params.city,
      vendorId: params.vendorId,
      category: params.category,
    })}`,
  );
  return assertSuccess(response);
}

export async function fetchCatalogueDetail(catalogueId: string): Promise<CatalogueDetail> {
  const response = await apiClient.get<SuccessEnvelope<CatalogueDetail> | CatalogueDetail>(
    `${WPAY_CATALOGUE_API_BASE}/${catalogueId}`,
  );
  return assertSuccess(response);
}

export async function fetchVendorCandidates(
  params: VendorCandidatesQueryParams,
): Promise<VendorCandidateListData> {
  const response = await apiClient.get<
    SuccessEnvelope<VendorCandidateListData> | VendorCandidateListData
  >(
    `${WPAY_CATALOGUE_API_BASE}/vendor-candidates${buildQueryString({
      q: params.q,
      page: params.page,
      pageSize: params.pageSize,
      status: params.status,
      eligibility: params.eligibility,
      vendorId: params.vendorId,
      category: params.category,
    })}`,
  );
  return assertSuccess(response);
}

export async function createCatalogueEntry(vendorId: string): Promise<CatalogueDetail> {
  const response = await apiClient.post<SuccessEnvelope<CatalogueDetail> | CatalogueDetail>(
    WPAY_CATALOGUE_API_BASE,
    { vendorId },
  );
  return assertSuccess(response);
}

export interface DeleteCatalogueEntryResult {
  readonly deleted: true;
}

export async function deleteCatalogueEntry(
  catalogueId: string,
): Promise<DeleteCatalogueEntryResult> {
  const response = await apiClient.delete<
    SuccessEnvelope<DeleteCatalogueEntryResult> | DeleteCatalogueEntryResult
  >(`${WPAY_CATALOGUE_API_BASE}/${catalogueId}`);
  return assertSuccess(response);
}

export async function publishCatalogueEntry(catalogueId: string): Promise<CatalogueDetail> {
  const response = await apiClient.post<SuccessEnvelope<CatalogueDetail> | CatalogueDetail>(
    `${WPAY_CATALOGUE_API_BASE}/${catalogueId}/publish`,
  );
  return assertSuccess(response);
}

export async function unpublishCatalogueEntry(catalogueId: string): Promise<CatalogueDetail> {
  const response = await apiClient.post<SuccessEnvelope<CatalogueDetail> | CatalogueDetail>(
    `${WPAY_CATALOGUE_API_BASE}/${catalogueId}/unpublish`,
  );
  return assertSuccess(response);
}

export async function bulkPublishCatalogue(
  catalogueIds: readonly string[],
): Promise<BulkOperationResponse> {
  const response = await apiClient.post<
    SuccessEnvelope<BulkOperationResponse> | BulkOperationResponse
  >(`${WPAY_CATALOGUE_API_BASE}/bulk/publish`, { catalogueIds });
  return assertSuccess(response);
}

export async function bulkUnpublishCatalogue(
  catalogueIds: readonly string[],
): Promise<BulkOperationResponse> {
  const response = await apiClient.post<
    SuccessEnvelope<BulkOperationResponse> | BulkOperationResponse
  >(`${WPAY_CATALOGUE_API_BASE}/bulk/unpublish`, { catalogueIds });
  return assertSuccess(response);
}

export async function bulkDeleteCatalogue(
  catalogueIds: readonly string[],
): Promise<BulkOperationResponse> {
  const response = await apiClient.post<
    SuccessEnvelope<BulkOperationResponse> | BulkOperationResponse
  >(`${WPAY_CATALOGUE_API_BASE}/bulk/delete`, { catalogueIds });
  return assertSuccess(response);
}

export function formatCatalogueDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export function formatCatalogueCategory(item: Pick<CatalogueListItem, 'category'>): string {
  const category = item.category?.trim();
  return category ? category : '—';
}

export function formatCatalogueDiscount(item: CatalogueListItem): string {
  if (!item.pricing.configured || item.pricing.discountValue === undefined) {
    return '—';
  }
  return `${item.pricing.discountValue}%`;
}

export function shortVendorId(vendorId: string): string {
  if (vendorId.length <= 12) {
    return vendorId;
  }
  return `${vendorId.slice(0, 8)}…`;
}

export function customerVisibleFromCandidate(candidate: VendorCandidateDTO): boolean {
  const status = candidate.status.toLowerCase();
  return (
    (status === 'active' || status === 'approved') &&
    candidate.bankVerified
  );
}

export function eligibilityWarningsFromCandidate(
  candidate: VendorCandidateDTO,
): string[] {
  const warnings: string[] = [];
  const status = candidate.status.toLowerCase();
  if (status !== 'active' && status !== 'approved') {
    warnings.push(`Vendor status is "${candidate.status}" (expected approved or active).`);
  }
  if (!candidate.bankVerified) {
    warnings.push('Bank account is not verified.');
  }
  return warnings;
}
