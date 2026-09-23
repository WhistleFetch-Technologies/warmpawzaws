/**
 * @jest-environment node
 */

import { commitWpayPromoEngine } from '../commit-wpay-promo-engine';

const mockQuery = jest.fn();
const mockSafeCommit = jest.fn();
const mockSafeEvaluate = jest.fn();
const mockLoadCtx = jest.fn();
const mockRecordVisit = jest.fn();

jest.mock('../../../../../database/rds-connection', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

jest.mock('../../../../../discount-engine/promo-engine', () => ({
  safeCommitPromotion: (...args: unknown[]) => mockSafeCommit(...args),
  safeEvaluatePromotions: (...args: unknown[]) => mockSafeEvaluate(...args),
  loadServerPaymentContext: (...args: unknown[]) => mockLoadCtx(...args),
  safeRecordVcfVisitFromPayBill: (...args: unknown[]) => mockRecordVisit(...args),
}));

describe('commitWpayPromoEngine awardedCashback writeback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadCtx.mockResolvedValue({ vendorId: 'vend-1', categoryId: 'training' });
    mockRecordVisit.mockResolvedValue(undefined);
    mockQuery.mockResolvedValue({ rows: [] });
  });

  it('writes awardedCashback from commit cashback onto payment + settlement', async () => {
    mockSafeCommit.mockResolvedValue({ ok: true, cashback: 150 });

    const result = await commitWpayPromoEngine({
      paymentId: 'pay-1',
      customerId: 'cust-1',
      vendorId: 'vend-1',
      razorpayPaymentId: 'rp_1',
      originalAmount: 1000,
      metadata: {
        evaluationId: 'eval-1',
        promoEngine: { pendingCashback: 150, evaluationId: 'eval-1' },
      },
    });

    expect(result.awardedCashback).toBe(150);
    expect(mockSafeCommit).toHaveBeenCalledWith(
      expect.objectContaining({ evaluationId: 'eval-1', transactionId: 'pay-1' }),
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE payments'),
      expect.arrayContaining(['pay-1', expect.stringContaining('"awardedCashback":150')]),
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE settlements'),
      expect.arrayContaining(['pay-1', 150, 'eval-1', 150]),
    );
  });

  it('on already-committed retry, falls back to pendingCashback for awarded amount', async () => {
    mockSafeCommit.mockResolvedValue({ ok: true, already: true, cashback: 0 });

    const result = await commitWpayPromoEngine({
      paymentId: 'pay-2',
      customerId: 'cust-1',
      vendorId: 'vend-1',
      metadata: {
        evaluationId: 'eval-2',
        promoEngine: { pendingCashback: 200 },
      },
    });

    expect(result.awardedCashback).toBe(200);
  });
});
