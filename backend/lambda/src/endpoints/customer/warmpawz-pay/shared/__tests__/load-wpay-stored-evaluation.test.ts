import { loadOwnedWpayEvaluation } from '../load-wpay-stored-evaluation';

jest.mock('../../../../../discount-engine/promo-engine/repos/promo-engine.repo', () => ({
  dbGetEvaluation: jest.fn(),
}));

const { dbGetEvaluation } = jest.requireMock(
  '../../../../../discount-engine/promo-engine/repos/promo-engine.repo',
) as { dbGetEvaluation: jest.Mock };

describe('loadOwnedWpayEvaluation', () => {
  beforeEach(() => {
    dbGetEvaluation.mockReset();
  });

  it('returns discount from an evaluation owned by the customer', async () => {
    dbGetEvaluation.mockResolvedValue({
      user_id: 'cust-1',
      result_json: { summary: { discount: 150, cashback: 30 } },
    });
    const row = await loadOwnedWpayEvaluation('11111111-1111-4111-8111-111111111111', 'cust-1');
    expect(row).toEqual({
      evaluationId: '11111111-1111-4111-8111-111111111111',
      engineDiscount: 150,
      pendingCashback: 30,
    });
  });

  it('rejects another customer evaluation', async () => {
    dbGetEvaluation.mockResolvedValue({
      user_id: 'other',
      result_json: { summary: { discount: 150 } },
    });
    await expect(
      loadOwnedWpayEvaluation('11111111-1111-4111-8111-111111111111', 'cust-1'),
    ).resolves.toBeNull();
  });
});
