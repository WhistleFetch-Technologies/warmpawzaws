import { apiClient } from '@/lib/api-client';
import {
  appendWpayPaymentsDateParams,
  type WpayPaymentsFilters,
} from '@/lib/warmpawz-pay-payments-export';

export type { WpayPaymentsFilters, WpayPaymentsFilterMode } from '@/lib/warmpawz-pay-payments-export';
export { defaultWpayPaymentsFilters } from '@/lib/warmpawz-pay-payments-export';

export const WPAY_PAYMENTS_API_BASE = '/admin/warmpawz-pay/payments';

export interface WpayAdminPaymentItem {
  readonly paymentId: string;
  readonly customer: {
    readonly name: string;
    readonly phone: string;
  };
  readonly vendor: {
    readonly name: string;
    readonly category: string;
  };
  readonly originalAmount: number;
  readonly discountPercent: number;
  readonly discountAmount: number;
  readonly payableAmount: number;
  readonly platformWithholdPercent: number;
  readonly platformWithholdAmount: number;
  readonly vendorSettlementAmount: number;
  readonly settlementSource?: 'persisted' | 'computed';
  readonly paidAt: string;
}

export interface WpayAdminPaymentsListData {
  readonly items: readonly WpayAdminPaymentItem[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
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

export async function fetchWarmpawzPayPayments(params: {
  page: number;
  pageSize: number;
  filters: WpayPaymentsFilters;
}): Promise<WpayAdminPaymentsListData> {
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  appendWpayPaymentsDateParams(qs, params.filters);
  const response = await apiClient.get<
    SuccessEnvelope<WpayAdminPaymentsListData> | WpayAdminPaymentsListData
  >(`${WPAY_PAYMENTS_API_BASE}?${qs.toString()}`);
  return assertSuccess(response);
}

export function formatWpayInr(value: number): string {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatWpayPercent(value: number): string {
  return `${value}%`;
}

export function formatWpayPaidAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatWpayPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone || '—';
}

export function customerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}
