jest.mock('../admin-booking-cancel.repo', () => ({
  dbFindBookingForAdmin: jest.fn(),
  dbBookingDisplayContext: jest.fn(async () => ({ customer_name: 'Asha', service_name: 'Grooming' })),
  dbPriorBookingRefunds: jest.fn(async () => ({ walletRefunded: 0, refundsRecorded: 0, pendingRefunds: 0 })),
  dbAdminCancelBooking: jest.fn(async () => ({ status: 'cancelled' })),
  dbAdminRoleRow: jest.fn(async () => null),
}));
jest.mock('../../refundable-base', () => ({ hasCustomerPaidCapture: jest.fn(async () => true) }));
jest.mock('../../cancellation-policy-service', () => ({
  previewWalletFullCancellationRefund: jest.fn(async () => ({ refundAmount: 500, refundPercentage: 100 })),
  previewCustomerCancellationRefundByMethod: jest.fn(async () => ({ refundAmount: 250, refundPercentage: 50 })),
}));
jest.mock('../../../../utils/credit-customer-wallet', () => ({
  creditCustomerWalletForBookingRefund: jest.fn(async () => ({ newBalance: 500 })),
}));
jest.mock('../../../../utils/payments/booking-original-refund', () => ({
  processBookingOriginalPaymentRefund: jest.fn(async () => ({
    refundId: 'r1',
    totalAmount: 250,
    status: 'processing',
    message: 'ok',
    walletCredited: 0,
  })),
}));
jest.mock('../../../../utils/audit-log', () => ({
  logAuditEntry: jest.fn(async () => undefined),
  logBookingStatusChange: jest.fn(async () => undefined),
}));
jest.mock('../../../../utils/booking-notifications', () => ({
  notifyBookingCancelled: jest.fn(async () => undefined),
  resolveBookingNotificationServiceName: jest.fn(() => 'Grooming'),
}));
jest.mock('../../../../utils/sns-client', () => ({ publishBookingStatusUpdated: jest.fn(async () => undefined) }));
jest.mock('../../../../utils/package-cancel-guard', () => ({ isPackageSessionOneStarted: jest.fn(async () => false) }));
jest.mock('../../../../utils/package-session-earnings-reverse', () => ({
  reversePendingPackageSessionEarnings: jest.fn(async () => 0),
}));
jest.mock('../../../../database/rds-connection', () => ({ query: jest.fn() }));

const BOOKING_ID = '11111111-2222-3333-4444-555555555555';

import * as repo from '../admin-booking-cancel.repo';
import { hasCustomerPaidCapture } from '../../refundable-base';
import { creditCustomerWalletForBookingRefund } from '../../../../utils/credit-customer-wallet';
import { processBookingOriginalPaymentRefund } from '../../../../utils/payments/booking-original-refund';
import { notifyBookingCancelled } from '../../../../utils/booking-notifications';
import {
  AdminCancelError,
  decideAdminCancelAction,
  executeAdminBookingCancel,
  normalizeAdminRefundMethod,
} from '../admin-booking-cancel-service';

const baseDecision = {
  status: 'confirmed',
  isPackageSession: false,
  packageSessionOneStarted: false,
  paid: true,
  priorRefundTotal: 0,
  pendingRefunds: 0,
  refundMethod: 'wallet' as const,
};

function bookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: BOOKING_ID,
    status: 'confirmed',
    customer_id: 'cust-1',
    vendor_id: 'vend-1',
    service_type: 'at_center',
    booking_date: '2026-10-20',
    booking_time: '10:00',
    total_amount: 500,
    commerce_mode: 'warmpawz_appointments',
    ...overrides,
  };
}

describe('decideAdminCancelAction', () => {
  it('cancels and refunds a paid confirmed booking', () => {
    expect(decideAdminCancelAction(baseDecision).action).toBe('cancel_and_refund');
  });

  it('cancels without refund when nothing was paid or admin picks none', () => {
    expect(decideAdminCancelAction({ ...baseDecision, paid: false }).action).toBe('cancel_only');
    expect(decideAdminCancelAction({ ...baseDecision, refundMethod: 'none' }).action).toBe('cancel_only');
  });

  it('never refunds twice on cancel when a refund already exists', () => {
    const d = decideAdminCancelAction({ ...baseDecision, priorRefundTotal: 200 });
    expect(d.action).toBe('cancel_only');
    expect(d.refundSkippedReason).toMatch(/already refunded/);
  });

  it('allows refund-only for a cancelled paid booking with no prior refund', () => {
    expect(decideAdminCancelAction({ ...baseDecision, status: 'cancelled' }).action).toBe('refund_only');
  });

  it('blocks cancelled bookings that were already refunded or have a pending refund', () => {
    expect(decideAdminCancelAction({ ...baseDecision, status: 'cancelled', priorRefundTotal: 1 }).action).toBe('blocked');
    expect(decideAdminCancelAction({ ...baseDecision, status: 'cancelled', pendingRefunds: 1 }).action).toBe('blocked');
  });

  it('blocks package sessions, started packages and terminal statuses', () => {
    expect(decideAdminCancelAction({ ...baseDecision, isPackageSession: true }).action).toBe('blocked');
    expect(decideAdminCancelAction({ ...baseDecision, packageSessionOneStarted: true }).action).toBe('blocked');
    expect(decideAdminCancelAction({ ...baseDecision, status: 'completed' }).action).toBe('blocked');
    expect(decideAdminCancelAction({ ...baseDecision, status: 'in_progress' }).action).toBe('blocked');
  });
});

describe('normalizeAdminRefundMethod', () => {
  it('defaults to wallet', () => {
    expect(normalizeAdminRefundMethod(undefined)).toBe('wallet');
    expect(normalizeAdminRefundMethod('ORIGINAL')).toBe('original');
    expect(normalizeAdminRefundMethod('none')).toBe('none');
  });
});

describe('executeAdminBookingCancel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (repo.dbFindBookingForAdmin as jest.Mock).mockResolvedValue({ kind: 'found', row: bookingRow() });
    (repo.dbPriorBookingRefunds as jest.Mock).mockResolvedValue({ walletRefunded: 0, refundsRecorded: 0, pendingRefunds: 0 });
    (hasCustomerPaidCapture as jest.Mock).mockResolvedValue(true);
  });

  const run = (overrides: Partial<Parameters<typeof executeAdminBookingCancel>[0]> = {}) =>
    executeAdminBookingCancel({
      idOrPrefix: BOOKING_ID,
      adminId: 'admin-1',
      reason: 'Vendor unavailable',
      refundMethod: 'wallet',
      amountMode: 'full',
      ...overrides,
    });

  it('full wallet refund credits 100% to wallet and notifies as admin', async () => {
    const res = await run();
    expect(repo.dbAdminCancelBooking).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: BOOKING_ID, fromStatuses: ['pending', 'pending_payment', 'confirmed'] }),
    );
    expect(creditCustomerWalletForBookingRefund).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cust-1', refundAmount: 500, refundPercentage: 100, label: 'appointment' }),
    );
    expect(processBookingOriginalPaymentRefund).not.toHaveBeenCalled();
    expect(notifyBookingCancelled).toHaveBeenCalledWith(expect.objectContaining({ cancelledBy: 'admin' }));
    expect(res.status).toBe('cancelled');
    expect(res.refund?.status).toBe('completed');
  });

  it('policy amount to original method goes through the gateway refund with admin initiator', async () => {
    await run({ refundMethod: 'original', amountMode: 'policy' });
    expect(processBookingOriginalPaymentRefund).toHaveBeenCalledWith(
      expect.objectContaining({ refundAmount: 250, refundPercentage: 50, initiatedBy: 'admin' }),
    );
    expect(creditCustomerWalletForBookingRefund).not.toHaveBeenCalled();
  });

  it('refund-only on an already cancelled booking does not re-cancel or re-notify', async () => {
    (repo.dbFindBookingForAdmin as jest.Mock).mockResolvedValue({ kind: 'found', row: bookingRow({ status: 'cancelled' }) });
    const res = await run();
    expect(repo.dbAdminCancelBooking).not.toHaveBeenCalled();
    expect(notifyBookingCancelled).not.toHaveBeenCalled();
    expect(creditCustomerWalletForBookingRefund).toHaveBeenCalled();
    expect(res.action).toBe('refund_only');
  });

  it('refuses a second refund on an already refunded cancelled booking', async () => {
    (repo.dbFindBookingForAdmin as jest.Mock).mockResolvedValue({ kind: 'found', row: bookingRow({ status: 'cancelled' }) });
    (repo.dbPriorBookingRefunds as jest.Mock).mockResolvedValue({ walletRefunded: 500, refundsRecorded: 0, pendingRefunds: 0 });
    await expect(run()).rejects.toBeInstanceOf(AdminCancelError);
    expect(creditCustomerWalletForBookingRefund).not.toHaveBeenCalled();
  });

  it('reports a stale status instead of refunding when the conditional update matches nothing', async () => {
    (repo.dbAdminCancelBooking as jest.Mock).mockResolvedValueOnce(null);
    await expect(run()).rejects.toMatchObject({ status: 409, code: 'STALE_STATUS' });
    expect(creditCustomerWalletForBookingRefund).not.toHaveBeenCalled();
  });

  it('keeps the booking cancelled and reports failure when the refund throws', async () => {
    (creditCustomerWalletForBookingRefund as jest.Mock).mockRejectedValueOnce(new Error('wallet down'));
    const res = await run();
    expect(res.status).toBe('cancelled');
    expect(res.refund?.status).toBe('failed');
  });

  it('requires a reason', async () => {
    await expect(run({ reason: ' ' })).rejects.toMatchObject({ status: 400 });
  });
});
