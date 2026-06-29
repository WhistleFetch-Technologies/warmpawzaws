import { apiClient } from '@/lib/api-client';
import type {
  PlatformTaxApiStatus,
  PlatformTaxDocumentDetail,
  PlatformTaxDocumentFilters,
  PlatformTaxDocumentSummary,
} from './types';

function buildQuery(filters: PlatformTaxDocumentFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.documentType) params.set('documentType', filters.documentType);
  if (filters.month) params.set('periodFrom', `${filters.month}-01`);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function parseApiErrorCode(error: unknown): string | undefined {
  const err = error as { originalError?: { code?: string }; message?: string };
  return err?.originalError?.code ?? (err?.message?.includes('MIGRATION_REQUIRED') ? 'MIGRATION_REQUIRED' : undefined);
}

export async function getPlatformTaxApiStatus(vendorId: string): Promise<PlatformTaxApiStatus> {
  try {
    const res = await apiClient.get<{ success?: boolean; code?: string }>(
      `/vendor/${vendorId}/platform-tax-documents?limit=1`
    );
    if (res?.success === true) return { available: true };
    if (res?.code === 'PLATFORM_TAX_DISABLED') return { available: false, reason: 'DISABLED' };
    if (res?.code === 'MIGRATION_REQUIRED') return { available: false, reason: 'MIGRATION_REQUIRED' };
    return { available: false, reason: 'UNAVAILABLE' };
  } catch (error) {
    const code = parseApiErrorCode(error);
    if (code === 'PLATFORM_TAX_DISABLED') return { available: false, reason: 'DISABLED' };
    if (code === 'MIGRATION_REQUIRED') return { available: false, reason: 'MIGRATION_REQUIRED' };
    return { available: false, reason: 'UNAVAILABLE' };
  }
}

export async function getPlatformTaxDocuments(
  vendorId: string,
  filters: PlatformTaxDocumentFilters = {}
): Promise<{ documents: PlatformTaxDocumentSummary[]; total: number }> {
  const res = await apiClient.get<{
    success: boolean;
    documents?: PlatformTaxDocumentSummary[];
    total?: number;
  }>(`/vendor/${vendorId}/platform-tax-documents${buildQuery(filters)}`);

  return {
    documents: res.documents ?? [],
    total: res.total ?? 0,
  };
}

export async function getPlatformTaxDocument(
  vendorId: string,
  documentId: string
): Promise<PlatformTaxDocumentDetail | null> {
  const res = await apiClient.get<{ success: boolean; document?: PlatformTaxDocumentDetail }>(
    `/vendor/${vendorId}/platform-tax-documents/${documentId}`
  );
  return res.document ?? null;
}

export async function downloadPlatformTaxPdf(vendorId: string, documentId: string): Promise<Blob> {
  return apiClient.getBlob(`/vendor/${vendorId}/platform-tax-documents/${documentId}/pdf`);
}
