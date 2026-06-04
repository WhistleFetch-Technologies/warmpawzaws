import {
  approveAndExecuteMealRefundCase,
  reconcileMealRefundCaseFromRefundRow,
} from '../meal-refund-case-execution';
import { query } from '../../database/rds-connection';
import { processMealOrderAdminOriginalRefund } from '../payments/meal-order-original-refund';
import { notifyMealEvent } from '../meal-delivery-notifications';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
}));

jest.mock('../payments/meal-order-original-refund', () => ({
  processMealOrderAdminOriginalRefund: jest.fn(),
}));

jest.mock('../meal-delivery-notifications', () => ({
  notifyMealEvent: jest.fn().mockResolvedValue({ sent: true }),
}));

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedRefund = processMealOrderAdminOriginalRefund as jest.MockedFunction<
  typeof processMealOrderAdminOriginalRefund
>;
const mockedNotify = notifyMealEvent as jest.MockedFunction<typeof notifyMealEvent>;

const CASE_ID = '22222222-2222-4222-8222-222222222222';
const ORDER_ID = '11111111-1111-4111-8111-111111111111';

function executionContext(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: CASE_ID,
    meal_order_id: ORDER_ID,
    status: 'pending_review',
    recommended_refund_amount: '250.00',
    cancellation_reason: 'Pidge cancel',
    payment_status: 'paid',
    total_amount: '250.00',
    cancelled_by: 'system_pidge',
    picked_up_at: null,
    delivered_at: null,
    payment_amount: '250.00',
    tracking_status: 'pending',
    ...overrides,
  };
}

describe('approveAndExecuteMealRefundCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('success: locks case, executes refund, stores linkage', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [executionContext()] } as any)
      .mockResolvedValueOnce({ rows: [{ id: CASE_ID, meal_order_id: ORDER_ID }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({
        rows: [
          {
            customer_id: 'cust-1',
            order_number: 'MO-1',
            vendor_name: 'Kitchen',
          },
        ],
      } as any);

    mockedRefund.mockResolvedValueOnce({
      refundId: 'ref-row-1',
      razorpayRefundId: 'rz_ref_1',
      walletCredited: 0,
      razorpayAmount: 250,
      totalAmount: 250,
      status: 'processing',
      message: 'ok',
    });

    const result = await approveAndExecuteMealRefundCase(CASE_ID, 'admin@test.com');
    expect(result.ok).toBe(true);
    expect(result.status).toBe('refund_processing');
    expect(result.refundsRowId).toBe('ref-row-1');
    expect(result.razorpayRefundId).toBe('rz_ref_1');
    expect(mockedRefund).toHaveBeenCalledWith(
      ORDER_ID,
      250,
      'Pidge cancel',
      expect.objectContaining({ mealRefundCaseId: CASE_ID, initiatedBy: 'admin' }),
    );
    expect(mockedNotify).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'meal_refund_approved' }),
    );
  });

  it('failed: Razorpay error sets refund_failed', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [executionContext()] } as any)
      .mockResolvedValueOnce({ rows: [{ id: CASE_ID, meal_order_id: ORDER_ID }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    mockedRefund.mockRejectedValueOnce(new Error('Razorpay gateway error'));

    const result = await approveAndExecuteMealRefundCase(CASE_ID, 'admin@test.com');
    expect(result.ok).toBe(false);
    expect(result.status).toBe('refund_failed');
    expect(result.error).toContain('Razorpay');
  });

  it('duplicate approve: already refund_processing', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [executionContext({ status: 'refund_processing' })],
    } as any);

    const result = await approveAndExecuteMealRefundCase(CASE_ID, 'admin@test.com');
    expect(result.ok).toBe(false);
    expect(result.alreadyProcessed).toBe(true);
    expect(mockedRefund).not.toHaveBeenCalled();
  });

  it('partial amount: passes recommended amount to refund helper', async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [executionContext({ recommended_refund_amount: '100.50' })],
      } as any)
      .mockResolvedValueOnce({ rows: [{ id: CASE_ID, meal_order_id: ORDER_ID }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ customer_id: 'cust-1' }] } as any);

    mockedRefund.mockResolvedValueOnce({
      refundId: 'ref-partial',
      razorpayAmount: 100.5,
      walletCredited: 0,
      totalAmount: 100.5,
      status: 'processing',
      message: 'ok',
    });

    await approveAndExecuteMealRefundCase(CASE_ID, 'admin@test.com');
    expect(mockedRefund).toHaveBeenCalledWith(ORDER_ID, 100.5, expect.any(String), expect.any(Object));
  });

  it('already refunded order rejected', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [executionContext({ payment_status: 'refunded' })],
    } as any);

    const result = await approveAndExecuteMealRefundCase(CASE_ID, 'admin@test.com');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('order_already_refunded');
  });
});

describe('reconcileMealRefundCaseFromRefundRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('webhook processed: marks refunded and notifies', async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: CASE_ID,
            status: 'refund_processing',
            meal_order_id: ORDER_ID,
            customer_id: 'cust-1',
            order_number: 'MO-1',
            vendor_name: 'V',
            refund_amount_executed: '250',
          },
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [{ id: CASE_ID }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const result = await reconcileMealRefundCaseFromRefundRow({
      razorpayRefundId: 'rz_ref_done',
      webhookStatus: 'completed',
    });
    expect(result.updated).toBe(true);
    expect(result.caseId).toBe(CASE_ID);
    expect(mockedNotify).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'meal_refund_completed' }),
    );
  });

  it('duplicate webhook: idempotent when already refunded', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          id: CASE_ID,
          status: 'refunded',
          meal_order_id: ORDER_ID,
          customer_id: 'cust-1',
        },
      ],
    } as any);

    const result = await reconcileMealRefundCaseFromRefundRow({
      razorpayRefundId: 'rz_ref_done',
      webhookStatus: 'completed',
    });
    expect(result.updated).toBe(false);
    expect(mockedNotify).not.toHaveBeenCalled();
  });
});
