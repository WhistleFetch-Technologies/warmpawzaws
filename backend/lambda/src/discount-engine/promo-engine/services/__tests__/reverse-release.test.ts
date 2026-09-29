import { reversePromotion } from '../reverse.service';

const mockFind = jest.fn();
const mockMark = jest.fn();
const mockAdjust = jest.fn();
const mockAudit = jest.fn();
const mockReverseCashback = jest.fn();

jest.mock('../../repos/promo-engine.repo', () => ({
  dbFindUsageByTransaction: (...a: unknown[]) => mockFind(...a),
  dbMarkUsageReversed: (...a: unknown[]) => mockMark(...a),
  dbAdjustBudgetConsumed: (...a: unknown[]) => mockAdjust(...a),
  dbInsertAudit: (...a: unknown[]) => mockAudit(...a),
}));
jest.mock('../wallet-cashback.service', () => ({
  reversePromoCashbackForTransaction: (...a: unknown[]) => mockReverseCashback(...a),
}));
jest.mock('../visit-writer.service', () => ({
  safeReverseVcfVisit: jest.fn().mockResolvedValue(undefined),
}));

describe('reversePromotion releases limits and budget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFind.mockResolvedValue([{ user_id: 'cust-1' }]);
    mockReverseCashback.mockResolvedValue({ reversed: true });
  });

  it('marks usage reversed, claws back cashback and returns spend to budget', async () => {
    mockMark.mockResolvedValue([
      { promotion_id: 'p1', user_id: 'cust-1', evaluation_id: 'e1', discount_amount: 100, cashback_amount: 150 },
    ]);
    const res = await reversePromotion({ transaction_id: 'pay-1', reason: 'refund' });
    expect(res).toEqual({ success: true, reversed_cashback: 150, usage_count: 1 });
    expect(mockAdjust).toHaveBeenCalledWith('p1', -250);
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'REVERSED' }));
  });

  it('is idempotent — a second reverse releases nothing', async () => {
    mockMark.mockResolvedValue([]);
    const res = await reversePromotion({ transaction_id: 'pay-1' });
    expect(res.usage_count).toBe(0);
    expect(mockAdjust).not.toHaveBeenCalled();
    expect(mockReverseCashback).not.toHaveBeenCalled();
  });
});
