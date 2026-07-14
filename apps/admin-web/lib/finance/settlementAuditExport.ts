import { getApiBaseUrl, isUatMode } from '@/lib/api-client';

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window === 'undefined') return headers;
  const token =
    localStorage.getItem('adminAuthToken') ||
    (() => {
      try {
        const { getCognitoIdToken } = require('@/lib/cognito-auth');
        return getCognitoIdToken();
      } catch {
        return null;
      }
    })();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (isUatMode()) {
    headers['X-UAT-Mode'] = 'true';
    if (token?.startsWith('uat-token-')) headers['X-UAT-Token'] = token;
  }
  return headers;
}

export async function downloadFinanceCsv(urlPath: string, fallbackFilename: string): Promise<string> {
  const base = getApiBaseUrl().replace(/\/+$/, '');
  const url = `${base}${urlPath.startsWith('/') ? urlPath : `/${urlPath}`}`;
  const res = await fetch(url, { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) {
    const text = await res.text();
    let message = text || `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error) message = String(parsed.error);
    } catch {
      /* raw */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const filenameMatch = /filename="([^"]+)"/i.exec(disposition);
  const filename = filenameMatch?.[1] || fallbackFilename;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return filename;
}

export type SettlementAuditExportParams =
  | { periodType: 'day'; reportDate: string }
  | { periodType: 'month'; year: number; month: number };

export function settlementAuditExportPath(params: SettlementAuditExportParams): string {
  if (params.periodType === 'month') {
    return `/admin/finance/vendor-booking-earnings/export-settlement-audit.csv?year=${params.year}&month=${params.month}`;
  }
  return `/admin/finance/vendor-booking-earnings/export-settlement-audit.csv?reportDate=${encodeURIComponent(params.reportDate)}`;
}

export async function downloadSettlementAuditCsv(params: SettlementAuditExportParams): Promise<void> {
  const label =
    params.periodType === 'month'
      ? `${params.year}-${String(params.month).padStart(2, '0')}`
      : params.reportDate;
  await downloadFinanceCsv(
    settlementAuditExportPath(params),
    `booking-settlement-audit-${label}.csv`,
  );
}

export async function downloadReconciliationPack(year: number, month: number): Promise<void> {
  await downloadFinanceCsv(
    `/admin/finance/vendor-daily-accrual/monthly/export.csv?year=${year}&month=${month}`,
    `vendor-monthly-accrual-${year}-${String(month).padStart(2, '0')}.csv`,
  );
  await new Promise((r) => setTimeout(r, 400));
  await downloadSettlementAuditCsv({ periodType: 'month', year, month });
}

export function buildBookingEarningsFinanceUrl(opts: {
  periodType?: 'day' | 'month';
  reportDate?: string;
  year?: number;
  month?: number;
  vendorId?: string;
  bookingId?: string;
}): string {
  const params = new URLSearchParams({ tab: 'vendor-booking-earnings' });
  if (opts.periodType === 'month' && opts.year != null && opts.month != null) {
    params.set('period', 'month');
    params.set('year', String(opts.year));
    params.set('month', String(opts.month));
  } else if (opts.reportDate) {
    params.set('period', 'day');
    params.set('reportDate', opts.reportDate);
  }
  if (opts.vendorId) params.set('vendorId', opts.vendorId);
  if (opts.bookingId) params.set('bookingId', opts.bookingId);
  return `/finance?${params.toString()}`;
}

export function navigateToBookingEarnings(opts: Parameters<typeof buildBookingEarningsFinanceUrl>[0]) {
  if (typeof window === 'undefined') return;
  window.location.href = buildBookingEarningsFinanceUrl(opts);
}
