import { getApiBaseUrl, isUatMode } from '@/lib/api-client';

export type WpayPaymentsFilterMode = 'month' | 'range';

export interface WpayPaymentsFilters {
  readonly mode: WpayPaymentsFilterMode;
  readonly yearMonth: string;
  readonly fromDate: string;
  readonly toDate: string;
}

export function defaultWpayPaymentsFilters(): WpayPaymentsFilters {
  return {
    mode: 'month',
    yearMonth: currentIstYearMonth(),
    fromDate: '',
    toDate: '',
  };
}

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

export function currentIstYearMonth(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '2026';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  return `${year}-${month}`;
}

export function buildWpayPaymentsExportPath(filters: WpayPaymentsFilters): string {
  const qs = new URLSearchParams();
  appendWpayPaymentsDateParams(qs, filters);
  const query = qs.toString();
  return query
    ? `/admin/warmpawz-pay/payments/export.xlsx?${query}`
    : '/admin/warmpawz-pay/payments/export.xlsx';
}

export function appendWpayPaymentsDateParams(
  qs: URLSearchParams,
  filters: WpayPaymentsFilters,
): void {
  if (filters.mode === 'month' && filters.yearMonth) {
    const match = /^(\d{4})-(\d{2})$/.exec(filters.yearMonth);
    if (match) {
      qs.set('year', match[1]);
      qs.set('month', String(parseInt(match[2], 10)));
    }
    return;
  }

  if (filters.mode === 'range' && filters.fromDate && filters.toDate) {
    qs.set('fromDate', filters.fromDate);
    qs.set('toDate', filters.toDate);
  }
}

export function areWpayPaymentsFiltersReady(filters: WpayPaymentsFilters): boolean {
  if (filters.mode === 'month') {
    return /^(\d{4})-(\d{2})$/.test(filters.yearMonth);
  }
  return Boolean(
    filters.fromDate &&
      filters.toDate &&
      filters.fromDate <= filters.toDate,
  );
}

export async function downloadWpayPaymentsExcel(filters: WpayPaymentsFilters): Promise<string> {
  const base = getApiBaseUrl().replace(/\/+$/, '');
  const path = buildWpayPaymentsExportPath(filters);
  const url = `${base}${path}`;
  const res = await fetch(url, { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) {
    const text = await res.text();
    let message = text || `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      if (parsed?.error?.message) message = parsed.error.message;
    } catch {
      /* raw text */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const filenameMatch = /filename="([^"]+)"/i.exec(disposition);
  const filename = filenameMatch?.[1] || 'warmpawz-pay-orders.xlsx';
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
  return filename;
}
