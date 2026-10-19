/**
 * Admin cancel & refund for service bookings (marketplace + Warmpawz Appointments).
 *
 * Refund amounts always come from the existing cancellation previews (no new Customer Paid math):
 *   full   → previewWalletFullCancellationRefund (100% of what the customer paid)
 *   policy → previewCustomerCancellationRefundByMethod (what the customer would get cancelling now)
 */
import { query } from '../../../database/rds-connection';
import {
  previewCustomerCancellationRefundByMethod,
  previewWalletFullCancellationRefund,
  type BookingForPolicy,
} from '../cancellation-policy-service';
import { hasCustomerPaidCapture } from '../refundable-base';
import { creditCustomerWalletForBookingRefund } from '../../../utils/credit-customer-wallet';
import { processBookingOriginalPaymentRefund } from '../../../utils/payments/booking-original-refund';
import { logAuditEntry, logBookingStatusChange } from '../../../utils/audit-log';
import { notifyBookingCancelled, resolveBookingNotificationServiceName } from '../../../utils/booking-notifications';
import { isPackageSessionOneStarted } from '../../../utils/package-cancel-guard';
import { reversePendingPackageSessionEarnings } from '../../../utils/package-session-earnings-reverse';
import type { SqlClient } from '../../../utils/package-session-sync';
import { hasAdminPermission, resolveAdminPermissions } from '../../../utils/admin-rbac-permissions';
import {
  dbAdminCancelBooking,
  dbAdminRoleRow,
  dbBookingDisplayContext,
  dbFindBookingForAdmin,
  dbPriorBookingRefunds,
} from './admin-booking-cancel.repo';

export type AdminRefundMethod = 'wallet' | 'original' | 'none';
export type AdminRefundAmountMode = 'full' | 'policy';
export type AdminCancelAction = 'cancel_and_refund' | 'cancel_only' | 'refund_only' | 'blocked';

export const ADMIN_CANCELLABLE_STATUSES = ['pending', 'pending_payment', 'confirmed'];
const UAT_SYNTHETIC_ADMIN = 'uat-admin-user';
const WAPPT_COMMERCE_MODE = 'warmpawz_appointments';

export class AdminCancelError extends Error {
  constructor(message: string, public status: 400 | 403 | 404 | 409, public code: string) {
    super(message);
  }
}

export function normalizeAdminRefundMethod(value: unknown): AdminRefundMethod {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === 'original' || v === 'none') return v;
  return 'wallet';
}

export function normalizeAdminRefundAmountMode(value: unknown): AdminRefundAmountMode {
  return String(value ?? '').trim().toLowerCase() === 'policy' ? 'policy' : 'full';
}

/** Pure decision table — what the admin action will do for this booking. */
export function decideAdminCancelAction(input: {
  status: string;
  isPackageSession: boolean;
  packageSessionOneStarted: boolean;
  paid: boolean;
  priorRefundTotal: number;
  pendingRefunds: number;
  refundMethod: AdminRefundMethod;
}): { action: AdminCancelAction; reason?: string; refundSkippedReason?: string } {
  const status = String(input.status || '').toLowerCase();
  if (input.isPackageSession) {
    return { action: 'blocked', reason: 'This is a package session. Cancel the package booking instead.' };
  }
  const alreadyRefunded = input.priorRefundTotal > 0.009 || input.pendingRefunds > 0;
  const refundedNote = input.pendingRefunds > 0
    ? 'A refund for this booking is pending approval in the Refund hub.'
    : `₹${input.priorRefundTotal.toFixed(2)} was already refunded for this booking.`;

  if (ADMIN_CANCELLABLE_STATUSES.includes(status)) {
    if (input.packageSessionOneStarted) {
      return { action: 'blocked', reason: 'The first package session has already started.' };
    }
    if (!input.paid) return { action: 'cancel_only', refundSkippedReason: 'Nothing was paid for this booking.' };
    if (input.refundMethod === 'none') return { action: 'cancel_only', refundSkippedReason: 'Admin chose no refund.' };
    if (alreadyRefunded) return { action: 'cancel_only', refundSkippedReason: refundedNote };
    return { action: 'cancel_and_refund' };
  }

  if (status === 'cancelled') {
    if (!input.paid) return { action: 'blocked', reason: 'Already cancelled and nothing was paid.' };
    if (alreadyRefunded) return { action: 'blocked', reason: `Already cancelled. ${refundedNote}` };
    if (input.refundMethod === 'none') {
      return { action: 'blocked', reason: 'Already cancelled. Pick wallet or original to issue the refund.' };
    }
    return { action: 'refund_only' };
  }

  return { action: 'blocked', reason: `Bookings in status "${status || 'unknown'}" can't be cancelled from admin.` };
}

export async function adminCanCancelAndRefund(adminId: string | undefined): Promise<boolean> {
  if (!adminId) return false;
  if (adminId === UAT_SYNTHETIC_ADMIN) return true;
  const row = await dbAdminRoleRow(adminId);
  if (!row) return false;
  const perms = await resolveAdminPermissions(String(row.id), row.role, row.email);
  return hasAdminPermission(perms, 'admin.refunds');
}

function toPolicyBooking(row: Record<string, unknown>): BookingForPolicy {
  return {
    id: String(row.id),
    vendor_id: (row.vendor_id as string) ?? null,
    service_id: (row.service_id as string) ?? null,
    service_type: (row.service_type as string) ?? null,
    booking_datetime: (row.booking_datetime as string) ?? null,
    scheduled_at: (row.scheduled_at as string) ?? null,
    booking_date: String(row.booking_date ?? '').split('T')[0],
    booking_time: String(row.booking_time ?? ''),
    vendor_timezone: (row.vendor_timezone as string) ?? null,
    total_amount: (row.total_amount as number | string) ?? 0,
    discount_amount: (row.discount_amount as number | string | null) ?? null,
    commerce_mode: (row.commerce_mode as string) ?? null,
    service_category: (row.service_category as string) ?? null,
    booking_category: (row.service_category as string) ?? null,
  };
}

async function previewRefund(row: Record<string, unknown>, method: AdminRefundMethod, mode: AdminRefundAmountMode) {
  const booking = toPolicyBooking(row);
  const full = await previewWalletFullCancellationRefund(booking);
  const policy = await previewCustomerCancellationRefundByMethod(booking, method === 'wallet' ? 'wallet' : 'original');
  const chosen = mode === 'policy' ? policy : full;
  return {
    fullAmount: Math.round(full.refundAmount * 100) / 100,
    policyAmount: Math.round(policy.refundAmount * 100) / 100,
    policyPercentage: policy.refundPercentage,
    amount: method === 'none' ? 0 : Math.round(chosen.refundAmount * 100) / 100,
    percentage: method === 'none' ? 0 : chosen.refundPercentage,
  };
}

async function loadState(idOrPrefix: string, refundMethod: AdminRefundMethod) {
  const lookup = await dbFindBookingForAdmin(idOrPrefix);
  if (lookup.kind === 'invalid') {
    throw new AdminCancelError('Enter a booking ID (full ID or at least the first 8 characters).', 400, 'VALIDATION_ERROR');
  }
  if (lookup.kind === 'not_found') throw new AdminCancelError('Booking not found', 404, 'NOT_FOUND');
  if (lookup.kind === 'ambiguous') {
    throw new AdminCancelError('More than one booking matches that ID prefix. Paste the full booking ID.', 409, 'AMBIGUOUS');
  }
  const row = lookup.row;
  const bookingId = String(row.id);
  const packagePurchaseId = String(row.package_purchase_id ?? '').trim() || null;
  const isPackageSession = Boolean(row.is_package_session);
  const isPackageParent = Boolean(packagePurchaseId) && !isPackageSession;

  const [paid, prior, display, sessionOneStarted] = await Promise.all([
    hasCustomerPaidCapture(bookingId, {
      total_amount: row.total_amount as number | string,
      discount_amount: row.discount_amount as number | string | null,
      payment_status: (row.payment_status as string | null) ?? null,
    }),
    dbPriorBookingRefunds(bookingId),
    dbBookingDisplayContext(bookingId),
    isPackageParent && packagePurchaseId
      ? isPackageSessionOneStarted({ query } as SqlClient, packagePurchaseId)
      : Promise.resolve(false),
  ]);

  const priorRefundTotal = Math.round((prior.walletRefunded + prior.refundsRecorded) * 100) / 100;
  const decision = decideAdminCancelAction({
    status: String(row.status ?? ''),
    isPackageSession,
    packageSessionOneStarted: sessionOneStarted,
    paid,
    priorRefundTotal,
    pendingRefunds: prior.pendingRefunds,
    refundMethod,
  });

  return { row, bookingId, packagePurchaseId, isPackageParent, isPackageSession, paid, prior, priorRefundTotal, display, decision };
}

function bookingSummary(state: Awaited<ReturnType<typeof loadState>>) {
  const { row, display } = state;
  return {
    id: state.bookingId,
    status: String(row.status ?? ''),
    paymentStatus: (row.payment_status as string) ?? null,
    bookingDate: String(row.booking_date ?? '').split('T')[0] || null,
    bookingTime: (row.booking_time as string) ?? null,
    serviceType: (row.service_type as string) ?? null,
    totalAmount: Number(row.total_amount ?? 0) || 0,
    commerceMode: (row.commerce_mode as string) ?? null,
    customerId: (row.customer_id as string) ?? null,
    customerName: display.customer_name ?? null,
    customerPhone: display.customer_phone ?? null,
    vendorName: display.vendor_name ?? null,
    serviceName: display.service_name ?? null,
    isPackage: state.isPackageParent,
    isPackageSession: state.isPackageSession,
  };
}

export async function previewAdminBookingCancel(params: {
  idOrPrefix: string;
  refundMethod: AdminRefundMethod;
  amountMode: AdminRefundAmountMode;
}) {
  const state = await loadState(params.idOrPrefix, params.refundMethod);
  const refund = state.paid
    ? await previewRefund(state.row, params.refundMethod, params.amountMode)
    : { fullAmount: 0, policyAmount: 0, policyPercentage: 0, amount: 0, percentage: 0 };
  const willRefund = state.decision.action === 'cancel_and_refund' || state.decision.action === 'refund_only';
  return {
    booking: bookingSummary(state),
    action: state.decision.action,
    blockedReason: state.decision.reason ?? null,
    refundSkippedReason: state.decision.refundSkippedReason ?? null,
    paid: state.paid,
    priorRefunds: { ...state.prior, total: state.priorRefundTotal },
    refund: {
      method: params.refundMethod,
      amountMode: params.amountMode,
      amount: willRefund ? refund.amount : 0,
      percentage: willRefund ? refund.percentage : 0,
      fullAmount: refund.fullAmount,
      policyAmount: refund.policyAmount,
      policyPercentage: refund.policyPercentage,
    },
  };
}

async function issueRefund(
  state: Awaited<ReturnType<typeof loadState>>,
  method: AdminRefundMethod,
  mode: AdminRefundAmountMode,
  reason: string,
) {
  const { row, bookingId } = state;
  const customerId = String(row.customer_id ?? '');
  const label = row.commerce_mode === WAPPT_COMMERCE_MODE ? 'appointment' : 'booking';
  const preview = await previewRefund(row, method, mode);
  if (preview.amount <= 0.009) {
    return { amount: 0, percentage: preview.percentage, method, status: 'not_eligible', message: 'Refund amount is ₹0 for this booking.' };
  }
  if (!customerId) {
    return { amount: preview.amount, percentage: preview.percentage, method, status: 'failed', message: 'Booking has no customer — refund not issued.' };
  }
  try {
    if (method === 'wallet') {
      const credit = await creditCustomerWalletForBookingRefund({
        customerId,
        bookingId,
        refundAmount: preview.amount,
        refundPercentage: preview.percentage,
        label,
      });
      return {
        amount: preview.amount,
        percentage: preview.percentage,
        method,
        status: credit.alreadyCredited ? 'already_credited' : 'completed',
        message: credit.alreadyCredited
          ? 'Wallet refund was already credited for this booking.'
          : `₹${preview.amount.toFixed(2)} credited to the customer's wallet`,
      };
    }
    const result = await processBookingOriginalPaymentRefund({
      bookingId,
      customerId,
      vendorId: row.vendor_id ? String(row.vendor_id) : null,
      refundAmount: preview.amount,
      refundPercentage: preview.percentage,
      reason: `Admin cancellation: ${reason} (${preview.percentage}% refund)`,
      initiatedBy: 'admin',
      label,
    });
    return {
      refundId: result.refundId,
      amount: result.totalAmount,
      percentage: preview.percentage,
      method,
      status: result.status,
      message: result.message,
      razorpayRefundId: result.razorpayRefundId,
      walletCredited: result.walletCredited,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Refund failed';
    console.error('[ADMIN-CANCEL] refund failed', { bookingId, method, msg });
    return {
      amount: preview.amount,
      percentage: preview.percentage,
      method,
      status: 'failed',
      message: `Refund failed: ${msg}. The booking stays cancelled; retry the refund from this tool.`,
    };
  }
}

async function notifyCancelled(state: Awaited<ReturnType<typeof loadState>>, reason: string, refundInfo: unknown, requestId?: string) {
  const { row, bookingId, display } = state;
  const customerId = String(row.customer_id ?? '');
  const vendorId = String(row.vendor_id ?? '');
  try {
    const { publishBookingStatusUpdated } = await import('../../../utils/sns-client');
    await publishBookingStatusUpdated({ bookingId, customerId, vendorId, oldStatus: String(row.status ?? ''), newStatus: 'cancelled', reason, requestId });
  } catch (err) {
    console.warn('[ADMIN-CANCEL] SNS publish failed:', (err as Error)?.message);
  }
  if (!customerId || !vendorId) return;
  try {
    const serviceType = String(row.service_type ?? '');
    await notifyBookingCancelled({
      bookingId,
      vendorId,
      customerId,
      customerName: display.customer_name || 'Customer',
      serviceName: resolveBookingNotificationServiceName(row, display.service_name || 'Booking'),
      serviceTypeLabel:
        serviceType === 'at_home' ? 'Home visit'
        : serviceType === 'tele' ? 'Tele consultation'
        : serviceType === 'at_center' ? 'At center'
        : 'service',
      bookingDateDisplay: row.booking_date
        ? new Date(String(row.booking_date)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : '',
      bookingTimeDisplay: String(row.booking_time ?? ''),
      reason,
      refundInfo,
      cancelledBy: 'admin',
    });
  } catch (err) {
    console.warn('[ADMIN-CANCEL] notifications failed:', (err as Error)?.message);
  }
}

export async function executeAdminBookingCancel(params: {
  idOrPrefix: string;
  adminId: string | undefined;
  reason: string;
  refundMethod: AdminRefundMethod;
  amountMode: AdminRefundAmountMode;
  requestId?: string;
}) {
  const reason = params.reason.trim();
  if (reason.length < 3) throw new AdminCancelError('Enter a reason (at least 3 characters).', 400, 'VALIDATION_ERROR');

  const state = await loadState(params.idOrPrefix, params.refundMethod);
  const { decision, bookingId, row } = state;
  if (decision.action === 'blocked') {
    throw new AdminCancelError(decision.reason || 'This booking cannot be cancelled from admin.', 409, 'NOT_ALLOWED');
  }

  const oldStatus = String(row.status ?? '');
  const cancels = decision.action === 'cancel_and_refund' || decision.action === 'cancel_only';
  if (cancels) {
    const updated = await dbAdminCancelBooking({
      bookingId,
      reason,
      fromStatuses: ADMIN_CANCELLABLE_STATUSES,
      packagePurchaseId: state.packagePurchaseId,
      isPackageParent: state.isPackageParent,
    });
    if (!updated) {
      throw new AdminCancelError('Booking status changed while cancelling. Refresh and try again.', 409, 'STALE_STATUS');
    }
    if (state.packagePurchaseId) {
      await reversePendingPackageSessionEarnings({ query } as SqlClient, state.packagePurchaseId, '[ADMIN-CANCEL-PACKAGE]')
        .catch((e: unknown) => console.warn('[ADMIN-CANCEL] package earnings reverse:', (e as Error)?.message));
    }
    await logBookingStatusChange(bookingId, oldStatus, 'cancelled', params.adminId, 'admin', reason, {
      refundMethod: params.refundMethod,
      amountMode: params.amountMode,
    });
  }

  const refund = decision.action === 'cancel_and_refund' || decision.action === 'refund_only'
    ? await issueRefund(state, params.refundMethod, params.amountMode, reason)
    : null;

  await logAuditEntry({
    entityType: 'booking',
    entityId: bookingId,
    action: cancels ? 'admin_cancel' : 'admin_refund',
    oldValues: { status: oldStatus },
    newValues: {
      status: cancels ? 'cancelled' : oldStatus,
      reason,
      refundMethod: params.refundMethod,
      amountMode: params.amountMode,
      refundAmount: refund?.amount ?? 0,
      refundStatus: refund?.status ?? null,
    },
    changedFields: cancels ? ['status', 'cancelled_at', 'cancellation_reason', 'cancelled_by'] : ['refund'],
    actorId: params.adminId,
    actorType: 'admin',
    requestId: params.requestId,
  });

  if (cancels) await notifyCancelled(state, reason, refund, params.requestId);

  return {
    bookingId,
    action: decision.action,
    previousStatus: oldStatus,
    status: cancels ? 'cancelled' : oldStatus,
    refund,
    refundSkippedReason: decision.refundSkippedReason ?? null,
  };
}
