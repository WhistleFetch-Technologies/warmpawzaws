import { loadOwnedWpayEvaluation } from '../load-wpay-stored-evaluation';

jest.mock('../../../../../discount-engine/promo-engine/repos/promo-engine.repo', () => ({
  dbGetEvaluation: jest.fn(),
}));

const { dbGetEvaluation } = jest.requireMock(
  '../../../../../discount-engine/promo-engine/repos/promo-engine.repo',
) as { dbGetEvaluation: jest.Mock };

const EVAL_ID = '11111111-1111-4111-8111-111111111111';
const VENDOR = '22222222-2222-4222-8222-222222222222';
const expected = { amount: 1200, vendorId: VENDOR };

describe('loadOwnedWpayEvaluation', () => {
  beforeEach(() => {
    dbGetEvaluation.mockReset();
  });

  it('returns discount from an evaluation owned by the customer for the same bill', async () => {
    dbGetEvaluation.mockResolvedValue({
      user_id: 'cust-1',
      request_json: { transaction: { amount: 1200, vendorId: VENDOR } },
      result_json: { summary: { discount: 150, cashback: 30 } },
    });
    const row = await loadOwnedWpayEvaluation(EVAL_ID, 'cust-1', expected);
    expect(row).toEqual({
      evaluationId: EVAL_ID,
      engineDiscount: 150,
      pendingCashback: 30,
    });
  });

  it('rejects another customer evaluation', async () => {
    dbGetEvaluation.mockResolvedValue({
      user_id: 'other',
      request_json: { transaction: { amount: 1200, vendorId: VENDOR } },
      result_json: { summary: { discount: 150 } },
    });
    await expect(loadOwnedWpayEvaluation(EVAL_ID, 'cust-1', expected)).resolves.toBeNull();
  });

  it('rejects a quote for a different bill amount (another range may apply)', async () => {
    dbGetEvaluation.mockResolvedValue({
      user_id: 'cust-1',
      request_json: JSON.stringify({ transaction: { amount: 400, vendorId: VENDOR } }),
      result_json: { summary: { discount: 55 } },
    });
    await expect(loadOwnedWpayEvaluation(EVAL_ID, 'cust-1', expected)).resolves.toBeNull();
  });

  it('rejects a quote for a different vendor', async () => {
    dbGetEvaluation.mockResolvedValue({
      user_id: 'cust-1',
      request_json: { transaction: { amount: 1200, vendor_id: 'someone-else' } },
      result_json: { summary: { discount: 150 } },
    });
    await expect(loadOwnedWpayEvaluation(EVAL_ID, 'cust-1', expected)).resolves.toBeNull();
  });
});
