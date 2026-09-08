import { apiClient } from '@/lib/api-client';
import {
  buildWpayTransactionsUrl,
  readCustomerPhoneFromStorage,
} from '@/lib/warmpawz-pay/wpay-api';

/**
 * Same GET as Pay Bill history — that route already asks Razorpay about
 * pending checkouts and completes captured ones.
 */
export async function reconcileWpayPendingOnHome(phone?: string): Promise<void> {
  const resolved = String(phone || readCustomerPhoneFromStorage() || '').trim();
  if (!resolved) return;
  await apiClient.get(buildWpayTransactionsUrl({ limit: 5, phone: resolved }));
}
