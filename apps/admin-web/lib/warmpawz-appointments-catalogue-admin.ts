import { apiClient } from '@/lib/api-client';
import type {
  MerchantBusinessType,
  MerchantReadiness,
  PlatformStatus,
  WarmpawzAppointmentsStatus,
} from '@/lib/warmpawz-appointments-merchant-types';

export const WAPPT_CATALOGUE_API_BASE = '/admin/warmpawz-appointments/catalogue';

export type PublishStatus = 'draft' | 'published';

export type CataloguePublishStatusFilter =
  | 'draft'
  | 'published'
  | 'not_in_catalogue'
  | 'all';

export type CatalogueEligibilityFilter =
  | 'customer_visible'
  | 'not_customer_visible'
  | 'all';

export interface EligibilityDTO {
  readonly bankVerified: boolean;
  readonly vendorStatus: string;
  readonly customerVisible: boolean;
}

export interface CatalogueListItem {
  readonly catalogueId: string | null;
  readonly inCatalogue: boolean;
  readonly vendorId: string;
  readonly businessName: string;
  readonly ownerName?: string;
  readonly city?: string;
  readonly phone?: string;
  readonly appointmentFee: number | null;
  readonly publishStatus: PublishStatus | null;
  readonly publishedAt: string | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
  readonly createdBy: string | null;
  readonly eligibility: EligibilityDTO;
  readonly warnings?: readonly string[];
  readonly category: string;
  readonly serviceCategory: string;
  readonly serviceCategoryId: string;
  readonly roleLabel: string;
  readonly categoryDisplay: string;
  readonly businessType: MerchantBusinessType;
  readonly platformStatus: PlatformStatus;
  readonly warmpawzAppointmentsStatus: WarmpawzAppointmentsStatus;
  readonly customerVisible: boolean;
  readonly readiness: MerchantReadiness;
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
  readonly serviceCategory: string;
  readonly serviceCategoryId: string;
  readonly roleLabel: string;
  readonly categoryDisplay: string;
  readonly platformStatus: PlatformStatus;
}

export interface ServiceCategoryOption {
  readonly id: string;
  readonly label: string;
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

type RawCatalogueListItem = Omit<CatalogueListItem, 'warmpawzAppointmentsStatus' | 'readiness'> & {
  readonly warmpawzAppointmentsStatus?: WarmpawzAppointmentsStatus;
  readonly WarmpawzAppointmentsStatus?: WarmpawzAppointmentsStatus;
  readonly readiness: MerchantReadiness & { readonly readyForPayBill?: boolean };
};

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
  readonly serviceCategory?: string;
  /** @deprecated Use serviceCategory (launch id slug). */
  readonly category?: string;
}

export interface VendorCandidatesQueryParams {
  readonly q?: string;
  readonly page?: number;
  readonly pageSize?: number;
  readonly status?: string;
  readonly eligibility?: Exclude<CatalogueEligibilityFilter, 'all'>;
  readonly vendorId?: string;
  readonly serviceCategory?: string;
  /** @deprecated Use serviceCategory (launch id slug). */
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

function normalizeReadiness(readiness: RawCatalogueListItem['readiness']): MerchantReadiness {
  return {
    checks: readiness.checks,
    blockersPassed: readiness.blockersPassed,
    blockersTotal: readiness.blockersTotal,
    readyForAppointments:
      readiness.readyForAppointments ?? readiness.readyForPayBill ?? false,
  };
}

function normalizeCatalogueListItem(raw: RawCatalogueListItem): CatalogueListItem {
  const { WarmpawzAppointmentsStatus, warmpawzAppointmentsStatus, readiness, ...rest } = raw;
  return {
    ...rest,
    warmpawzAppointmentsStatus:
      warmpawzAppointmentsStatus ?? WarmpawzAppointmentsStatus ?? 'Hidden',
    readiness: normalizeReadiness(readiness),
  };
}

function normalizeCatalogueDetail(raw: RawCatalogueListItem & CatalogueDetail): CatalogueDetail {
  return normalizeCatalogueListItem(raw);
}

function normalizeCatalogueListData(data: {
  readonly items: readonly RawCatalogueListItem[];
  readonly pagination: PaginationResponse;
}): CatalogueListData {
  return {
    items: data.items.map(normalizeCatalogueListItem),
    pagination: data.pagination,
  };
}

export async function fetchCatalogueList(
  params: CatalogueListQueryParams,
): Promise<CatalogueListData> {
  const response = await apiClient.get<
    SuccessEnvelope<{ items: readonly RawCatalogueListItem[]; pagination: PaginationResponse }> | CatalogueListData
  >(
    `${WAPPT_CATALOGUE_API_BASE}${buildQueryString({
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      publishStatus: params.publishStatus,
      q: params.q,
      eligibility: params.eligibility,
      city: params.city,
      vendorId: params.vendorId,
      serviceCategory: params.serviceCategory ?? params.category,
    })}`,
  );
  const data = assertSuccess(response);
  return normalizeCatalogueListData(data as { items: readonly RawCatalogueListItem[]; pagination: PaginationResponse });
}

export async function fetchCatalogueDetail(catalogueId: string): Promise<CatalogueDetail> {
  const response = await apiClient.get<SuccessEnvelope<RawCatalogueListItem & CatalogueDetail> | CatalogueDetail>(
    `${WAPPT_CATALOGUE_API_BASE}/${catalogueId}`,
  );
  return normalizeCatalogueDetail(assertSuccess(response) as RawCatalogueListItem & CatalogueDetail);
}

export async function fetchVendorCandidates(
  params: VendorCandidatesQueryParams,
): Promise<VendorCandidateListData> {
  const response = await apiClient.get<
    SuccessEnvelope<VendorCandidateListData> | VendorCandidateListData
  >(
    `${WAPPT_CATALOGUE_API_BASE}/vendor-candidates${buildQueryString({
      q: params.q,
      page: params.page,
      pageSize: params.pageSize,
      status: params.status,
      eligibility: params.eligibility,
      vendorId: params.vendorId,
      serviceCategory: params.serviceCategory ?? params.category,
    })}`,
  );
  return assertSuccess(response);
}

export async function fetchServiceCategories(): Promise<readonly ServiceCategoryOption[]> {
  const response = await apiClient.get<
    SuccessEnvelope<readonly ServiceCategoryOption[]> | readonly ServiceCategoryOption[]
  >(`${WAPPT_CATALOGUE_API_BASE}/service-categories`);
  return assertSuccess(response);
}

export async function createCatalogueEntry(
  vendorId: string,
  appointmentFee?: number,
): Promise<CatalogueDetail> {
  const response = await apiClient.post<SuccessEnvelope<RawCatalogueListItem & CatalogueDetail> | CatalogueDetail>(
    WAPPT_CATALOGUE_API_BASE,
    {
      vendorId,
      ...(appointmentFee !== undefined ? { appointmentFee } : {}),
    },
  );
  return normalizeCatalogueDetail(assertSuccess(response) as RawCatalogueListItem & CatalogueDetail);
}

export interface DeleteCatalogueEntryResult {
  readonly deleted: true;
}

export async function deleteCatalogueEntry(
  catalogueId: string,
): Promise<DeleteCatalogueEntryResult> {
  const response = await apiClient.delete<
    SuccessEnvelope<DeleteCatalogueEntryResult> | DeleteCatalogueEntryResult
  >(`${WAPPT_CATALOGUE_API_BASE}/${catalogueId}`);
  return assertSuccess(response);
}

export async function updateCatalogueFee(
  catalogueId: string,
  appointmentFee: number,
): Promise<CatalogueDetail> {
  const response = await apiClient.put<SuccessEnvelope<RawCatalogueListItem & CatalogueDetail> | CatalogueDetail>(
    `${WAPPT_CATALOGUE_API_BASE}/${catalogueId}/fee`,
    { appointmentFee },
  );
  return normalizeCatalogueDetail(assertSuccess(response) as RawCatalogueListItem & CatalogueDetail);
}

export async function bulkUpdateCatalogueFee(
  catalogueIds: readonly string[],
  appointmentFee: number,
): Promise<BulkOperationResponse> {
  const response = await apiClient.post<
    SuccessEnvelope<BulkOperationResponse> | BulkOperationResponse
  >(`${WAPPT_CATALOGUE_API_BASE}/bulk-fee`, { catalogueIds, appointmentFee });
  return assertSuccess(response);
}

export async function publishCatalogueEntry(catalogueId: string): Promise<CatalogueDetail> {
  const response = await apiClient.post<SuccessEnvelope<RawCatalogueListItem & CatalogueDetail> | CatalogueDetail>(
    `${WAPPT_CATALOGUE_API_BASE}/${catalogueId}/publish`,
  );
  return normalizeCatalogueDetail(assertSuccess(response) as RawCatalogueListItem & CatalogueDetail);
}

export async function unpublishCatalogueEntry(catalogueId: string): Promise<CatalogueDetail> {
  const response = await apiClient.post<SuccessEnvelope<RawCatalogueListItem & CatalogueDetail> | CatalogueDetail>(
    `${WAPPT_CATALOGUE_API_BASE}/${catalogueId}/unpublish`,
  );
  return normalizeCatalogueDetail(assertSuccess(response) as RawCatalogueListItem & CatalogueDetail);
}

export async function bulkPublishCatalogue(
  catalogueIds: readonly string[],
): Promise<BulkOperationResponse> {
  const response = await apiClient.post<
    SuccessEnvelope<BulkOperationResponse> | BulkOperationResponse
  >(`${WAPPT_CATALOGUE_API_BASE}/bulk/publish`, { catalogueIds });
  return assertSuccess(response);
}

export async function bulkUnpublishCatalogue(
  catalogueIds: readonly string[],
): Promise<BulkOperationResponse> {
  const response = await apiClient.post<
    SuccessEnvelope<BulkOperationResponse> | BulkOperationResponse
  >(`${WAPPT_CATALOGUE_API_BASE}/bulk/unpublish`, { catalogueIds });
  return assertSuccess(response);
}

export async function bulkDeleteCatalogue(
  catalogueIds: readonly string[],
): Promise<BulkOperationResponse> {
  const response = await apiClient.post<
    SuccessEnvelope<BulkOperationResponse> | BulkOperationResponse
  >(`${WAPPT_CATALOGUE_API_BASE}/bulk/delete`, { catalogueIds });
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

export function formatCatalogueCategory(
  item: Pick<CatalogueListItem, 'category' | 'serviceCategory' | 'roleLabel'>,
): string {
  const serviceCategory = item.serviceCategory?.trim() || item.category?.trim();
  if (!serviceCategory) {
    return '—';
  }
  const roleLabel = item.roleLabel?.trim();
  return roleLabel ? `${serviceCategory} · ${roleLabel}` : serviceCategory;
}

export function formatAppointmentFee(fee: number | null | undefined): string {
  if (fee === null || fee === undefined) {
    return '—';
  }
  return `₹${fee.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function isValidAppointmentFee(value: string): boolean {
  if (value.trim() === '') {
    return false;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return false;
  }
  return Math.round(parsed * 100) === parsed * 100;
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
