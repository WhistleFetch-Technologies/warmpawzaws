import { commitPromotion } from '../commit.service';

const repo = {
  dbGetEvaluation: jest.fn(),
  dbInsertUsage: jest.fn(),
  dbGetLimits: jest.fn(),
  dbCountUsageBatch: jest.fn(),
  dbAdjustBudgetConsumed: jest.fn(),
  dbSetUsageCashback: jest.fn(),
  dbGetUsageByIdempotencyKey: jest.fn(),
  dbInsertAudit: jest.fn(),
};
const mockCredit = jest.fn();
const mockNotify = jest.fn();

jest.mock('../../repos/promo-engine.repo', () => ({
  dbGetEvaluation: (...a: unknown[]) => repo.dbGetEvaluation(...a),
  dbInsertUsage: (...a: unknown[]) => repo.dbInsertUsage(...a),
  dbGetLimits: (...a: unknown[]) => repo.dbGetLimits(...a),
  dbCountUsageBatch: (...a: unknown[]) => repo.dbCountUsageBatch(...a),
  dbAdjustBudgetConsumed: (...a: unknown[]) => repo.dbAdjustBudgetConsumed(...a),
  dbSetUsageCashback: (...a: unknown[]) => repo.dbSetUsageCashback(...a),
  dbGetUsageByIdempotencyKey: (...a: unknown[]) => repo.dbGetUsageByIdempotencyKey(...a),
  dbInsertAudit: (...a: unknown[]) => repo.dbInsertAudit(...a),
}));

jest.mock('../wallet-cashback.service', () => ({
  creditPromoCashback: (...a: unknown[]) => mockCredit(...a),
  pickCashbackBenefits: (b: Array<{ benefit_type: string }>) => b.filter((x) => x.benefit_type === 'CASHBACK'),
}));

jest.mock('../cashback-notification.service', () => ({
  notifyPromoCashbackCredited: (...a: unknown[]) => mockNotify(...a),
}));

const evaluation = {
  user_id: 'cust-1',
  result_json: {
    benefits: [
      { promotion_id: 'p1', rule_id: 'r1', benefit_type: 'DISCOUNT', amount: 100, benefit_index: 0 },
      { promotion_id: 'p1', rule_id: 'r1', benefit_type: 'CASHBACK', amount: 150, expiry_days: 30, benefit_index: 1 },
    ],
    summary: { discount: 100, cashback: 150 },
    customer_copy: { creditedTitle: 'Yay ₹{amount}' },
  },
};

const limitsRow = (over: Record<string, number | null> = {}) => ({
  promotion_id: 'p1',
  per_user: null,
  per_transaction: null,
  daily_limit: null,
  campaign_limit: null,
  budget_limit: null,
  ...over,
});

describe('commitPromotion limits re-check + notification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repo.dbGetEvaluation.mockResolvedValue(evaluation);
    repo.dbInsertUsage.mockResolvedValue({ inserted: true });
    repo.dbGetLimits.mockResolvedValue(limitsRow());
    repo.dbCountUsageBatch.mockResolvedValue(new Map([['p1', { user: 1, campaign: 1, daily: 1 }]]));
    repo.dbAdjustBudgetConsumed.mockResolvedValue({ budget_consumed: 250, budget_limit: null });
    mockCredit.mockResolvedValue({ walletTransactionId: 'wt-1', credited: true, expiresAt: '2026-10-29T00:00:00Z' });
  });

  it('credits cashback, bumps budget atomically and notifies once', async () => {
    const res = await commitPromotion({ evaluation_id: 'e1', transaction_id: 'pay-1' });
    expect(res.cashback_credited).toBe(150);
    expect(repo.dbAdjustBudgetConsumed).toHaveBeenCalledWith('p1', 250);
    expect(mockCredit).toHaveBeenCalledWith(expect.objectContaining({ amount: 150, referenceId: 'pay-1' }));
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'cust-1',
        amount: 150,
        walletTransactionId: 'wt-1',
        copy: { creditedTitle: 'Yay ₹{amount}' },
      }),
    );
  });

  it('withholds cashback when a concurrent payment pushed per-user usage past the limit', async () => {
    repo.dbGetLimits.mockResolvedValue(limitsRow({ per_user: 1 }));
    repo.dbCountUsageBatch.mockResolvedValue(new Map([['p1', { user: 2, campaign: 2, daily: 2 }]]));
    const res = await commitPromotion({ evaluation_id: 'e1', transaction_id: 'pay-2' });
    expect(res.cashback_credited).toBe(0);
    expect(mockCredit).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
    expect(repo.dbSetUsageCashback).toHaveBeenCalledWith('p1:pay-2:all', 0);
    expect(repo.dbAdjustBudgetConsumed).toHaveBeenLastCalledWith('p1', -150);
    expect(repo.dbInsertAudit).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'LIMIT_EXCEEDED_AT_COMMIT' }),
    );
  });

  it('trims cashback to what fits in the remaining budget', async () => {
    repo.dbGetLimits.mockResolvedValue(limitsRow({ budget_limit: 300 }));
    repo.dbAdjustBudgetConsumed.mockResolvedValueOnce({ budget_consumed: 400, budget_limit: 300 });
    const res = await commitPromotion({ evaluation_id: 'e1', transaction_id: 'pay-3' });
    expect(res.cashback_credited).toBe(50);
    expect(mockCredit).toHaveBeenCalledWith(expect.objectContaining({ amount: 50 }));
    expect(repo.dbAdjustBudgetConsumed).toHaveBeenLastCalledWith('p1', -100);
  });

  it('on retry honours the first commit decision and never re-notifies', async () => {
    repo.dbInsertUsage.mockResolvedValue({ inserted: false });
    repo.dbGetUsageByIdempotencyKey.mockResolvedValue({ cashback_amount: 0, discount_amount: 100, reversed_at: null });
    const res = await commitPromotion({ evaluation_id: 'e1', transaction_id: 'pay-4' });
    expect(res.already_committed).toBe(true);
    expect(res.cashback_credited).toBe(0);
    expect(mockCredit).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
    expect(repo.dbAdjustBudgetConsumed).not.toHaveBeenCalled();
  });

  it('on retry reports the cashback already in the wallet without re-notifying', async () => {
    repo.dbInsertUsage.mockResolvedValue({ inserted: false });
    repo.dbGetUsageByIdempotencyKey.mockResolvedValue({ cashback_amount: 150, discount_amount: 100, reversed_at: null });
    mockCredit.mockResolvedValue({ walletTransactionId: 'wt-1', credited: false });
    const res = await commitPromotion({ evaluation_id: 'e1', transaction_id: 'pay-5' });
    expect(res.already_committed).toBe(true);
    expect(res.cashback_credited).toBe(150);
    expect(mockCredit).toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });
});
