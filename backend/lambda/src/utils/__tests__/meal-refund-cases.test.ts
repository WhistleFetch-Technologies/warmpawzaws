import {
  approveMealRefundCase,
  computeMealRefundRecommendation,
  createMealRefundCaseOnPidgeCancel,
  rejectMealRefundCase,
} from '../meal-refund-cases';
import { approveAndExecuteMealRefundCase } from '../meal-refund-case-execution';
import { query, insert } from '../../database/rds-connection';
import { notifyMealEvent } from '../meal-delivery-notifications';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
  insert: jest.fn(),
}));

jest.mock('../meal-delivery-notifications', () => ({
  notifyMealEvent: jest.fn().mockResolvedValue({ sent: true }),
}));

jest.mock('../meal-refund-case-execution', () => ({
  approveAndExecuteMealRefundCase: jest.fn(),
}));

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedInsert = insert as jest.MockedFunction<typeof insert>;
const mockedNotify = notifyMealEvent as jest.MockedFunction<typeof notifyMealEvent>;
const mockedExecute = approveAndExecuteMealRefundCase as jest.MockedFunction<
  typeof approveAndExecuteMealRefundCase
>;

const PAID_ORDER_ID = '11111111-1111-4111-8111-111111111111';

function paidOrderContext(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: PAID_ORDER_ID,
    payment_status: 'paid',
    cancelled_by: 'system_pidge',
    total_amount: '500.00',
    picked_up_at: null,
    delivered_at: null,
    payment_amount: '500.00',
    tracking_status: 'pending',
    ...overrides,
  };
}

describe('computeMealRefundRecommendation', () => {
  it('recommends 100% when system_pidge cancel before pickup/delivery', () => {
    const rec = computeMealRefundRecommendation(paidOrderContext() as any);
    expect(rec).toEqual({
      recommendedRefundAmount: 500,
      recommendationReason:
        'Pidge logistics cancelled before pickup/delivery; recommend 100% of customer-paid total.',
    });
  });

  it('does not recommend full refund when already picked up', () => {
    const rec = computeMealRefundRecommendation(
      paidOrderContext({ picked_up_at: '2026-01-01T00:00:00Z' }) as any,
    );
    expect(rec?.recommendedRefundAmount).toBe(0);
  });

  it('recommends 100% when case has system_pidge source but order cancelled_by is unset (backfill)', () => {
    const rec = computeMealRefundRecommendation(
      paidOrderContext({ cancelled_by: null, tracking_status: 'failed' }) as any,
      { cancellationSource: 'system_pidge' },
    );
    expect(rec?.recommendedRefundAmount).toBe(500);
  });
});

describe('createMealRefundCaseOnPidgeCancel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates case with recommendation for paid order', async () => {
    mockedQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM meal_orders mo') && sql.includes('payment_amount')) {
        return { rows: [paidOrderContext()] } as any;
      }
      if (sql.includes('INSERT INTO meal_refund_cases')) {
        return { rows: [{ id: 'case-1' }] } as any;
      }
      if (sql.includes('mo.order_number')) {
        return {
          rows: [
            {
              order_number: 'MO-100',
              customer_id: 'cust-1',
              vendor_name: 'Kitchen',
            },
          ],
        } as any;
      }
      return { rows: [] } as any;
    });
    mockedInsert.mockResolvedValue({} as any);

    const result = await createMealRefundCaseOnPidgeCancel({
      mealOrderId: PAID_ORDER_ID,
      pidgeOrderId: 'pidge-1',
      cancellationReason: 'Rider unavailable',
      webhookEventId: 'wh-1',
    });

    expect(result.created).toBe(true);
    expect(result.caseId).toBe('case-1');
    expect(mockedNotify).toHaveBeenCalled();
    expect(mockedInsert).toHaveBeenCalledWith(
      'notifications',
      expect.objectContaining({ notification_type: 'meal_refund_case_created' }),
    );
  });

  it('skips unpaid orders', async () => {
    jest.clearAllMocks();
    mockedQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM meal_orders mo') && sql.includes('payment_amount')) {
        return {
          rows: [
            paidOrderContext({
              payment_status: 'pending',
              payment_amount: null,
              total_amount: '0',
            }),
          ],
        } as any;
      }
      return { rows: [] } as any;
    });

    const result = await createMealRefundCaseOnPidgeCancel({
      mealOrderId: PAID_ORDER_ID,
      pidgeOrderId: 'pidge-1',
    });

    expect(result).toEqual({ created: false, skipped: 'not_paid' });
    expect(mockedNotify).not.toHaveBeenCalled();
  });

  it('is idempotent on duplicate case', async () => {
    mockedQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM meal_orders mo') && sql.includes('payment_amount')) {
        return { rows: [paidOrderContext()] } as any;
      }
      if (sql.includes('INSERT INTO meal_refund_cases')) {
        return { rows: [] } as any;
      }
      return { rows: [] } as any;
    });

    const result = await createMealRefundCaseOnPidgeCancel({
      mealOrderId: PAID_ORDER_ID,
      pidgeOrderId: 'pidge-1',
    });

    expect(result).toEqual({ created: false, skipped: 'duplicate_case' });
    expect(mockedNotify).not.toHaveBeenCalled();
  });
});

describe('approveMealRefundCase / rejectMealRefundCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('approve delegates to execution module', async () => {
    mockedExecute.mockResolvedValueOnce({
      ok: true,
      status: 'refund_processing',
      refundsRowId: 'ref-1',
    });
    const result = await approveMealRefundCase('case-1', 'admin@test.com');
    expect(result.ok).toBe(true);
    expect(mockedExecute).toHaveBeenCalledWith('case-1', 'admin@test.com');
  });

  it('reject transitions pending_review to rejected with notes', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: 'case-1' }] } as any);
    const result = await rejectMealRefundCase('case-1', 'admin@test.com', 'Not eligible');
    expect(result.ok).toBe(true);
  });

  it('approve fails when execution rejects', async () => {
    mockedExecute.mockResolvedValueOnce({ ok: false, error: 'case_not_found_or_not_pending' });
    const result = await approveMealRefundCase('case-1', 'admin@test.com');
    expect(result.ok).toBe(false);
  });
});
