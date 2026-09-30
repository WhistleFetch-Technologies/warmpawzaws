const mockQuery = jest.fn();
const mockInsert = jest.fn();
const mockRazorpayRequest = jest.fn();

jest.mock('../../database/rds-connection', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  insert: (...args: unknown[]) => mockInsert(...args),
}));

jest.mock('../payments/razorpay-client', () => ({
  getRazorpayConfig: jest.fn(async () => ({ keyId: 'rzp_key', keySecret: 'secret' })),
  razorpayRequest: (...args: unknown[]) => mockRazorpayRequest(...args),
}));

import {
  createWpayRazorpayOrder,
  isAbandonedRazorpayOrder,
  WpayBookingPaymentInProgressError,
} from '../wpay-razorpay-order';

const uniqueViolation = Object.assign(new Error('duplicate key'), { code: '23505' });
const BOOKING = 'fcb458e4-6c02-45e8-bea7-154aafe1aed8';
const CUSTOMER = '634d034c-2eb7-4001-886a-58cd0eaf6f6b';

function baseParams(bookingId: string | null = BOOKING) {
  return {
    customerId: CUSTOMER,
    vendorId: 'ed6f9962-9aeb-4355-be2d-f9915f56a912',
    payableAmount: 535.4,
    bookingId,
    clientRequestId: '11111111-1111-4111-8111-111111111111',
    quoteMetadata: {},
  };
}

function staleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'old-pay',
    razorpay_order_id: 'order_old',
    payment_source: 'warmpawz_pay',
    customer_id: CUSTOMER,
    created_at: new Date(Date.now() - 60_000).toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  mockQuery.mockReset();
  mockInsert.mockReset();
  mockRazorpayRequest.mockReset();
});

describe('isAbandonedRazorpayOrder', () => {
  it('treats no attempts or only failed attempts as abandoned', () => {
    expect(isAbandonedRazorpayOrder([])).toBe(true);
    expect(isAbandonedRazorpayOrder(undefined)).toBe(true);
    expect(isAbandonedRazorpayOrder([{ status: 'failed' }, { status: 'FAILED' }])).toBe(true);
  });

  it('treats created / authorized / captured attempts as in flight', () => {
    expect(isAbandonedRazorpayOrder([{ status: 'failed' }, { status: 'created' }])).toBe(false);
    expect(isAbandonedRazorpayOrder([{ status: 'authorized' }])).toBe(false);
    expect(isAbandonedRazorpayOrder([{ status: 'captured' }])).toBe(false);
  });
});

describe('createWpayRazorpayOrder booking collision', () => {
  it('supersedes an abandoned Pay Bill attempt on the same booking and retries once', async () => {
    mockRazorpayRequest.mockImplementation(async (path: string) =>
      path === '/orders' ? { id: 'order_new', amount: 53540, currency: 'INR' } : { items: [] },
    );
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [staleRow()] })
      .mockResolvedValueOnce({ rows: [] });
    mockInsert.mockRejectedValueOnce(uniqueViolation).mockResolvedValueOnce([{ id: 'new-pay' }]);

    const out = await createWpayRazorpayOrder(baseParams());

    expect(out.paymentId).toBe('new-pay');
    expect(mockInsert).toHaveBeenCalledTimes(2);
    const supersede = mockQuery.mock.calls[3];
    expect(String(supersede[0])).toMatch(/SET payment_status = 'failed'/);
    expect(supersede[1]).toEqual(['old-pay', 'superseded_stale_pay_bill']);
  });

  it('returns in-progress (no supersede) when the old order has a live attempt', async () => {
    mockRazorpayRequest.mockImplementation(async (path: string) =>
      path === '/orders'
        ? { id: 'order_new', amount: 53540, currency: 'INR' }
        : { items: [{ status: 'created' }] },
    );
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [staleRow()] });
    mockInsert.mockRejectedValueOnce(uniqueViolation);

    await expect(createWpayRazorpayOrder(baseParams())).rejects.toBeInstanceOf(
      WpayBookingPaymentInProgressError,
    );
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });

  it('never supersedes a non Pay Bill payment on the booking', async () => {
    mockRazorpayRequest.mockResolvedValue({ id: 'order_new', amount: 53540, currency: 'INR' });
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [staleRow({ payment_source: 'razorpay' })] });
    mockInsert.mockRejectedValueOnce(uniqueViolation);

    await expect(createWpayRazorpayOrder(baseParams())).rejects.toBeInstanceOf(
      WpayBookingPaymentInProgressError,
    );
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });

  it('keeps the idempotency-race message when no booking is linked', async () => {
    mockRazorpayRequest.mockResolvedValue({ id: 'order_new', amount: 53540, currency: 'INR' });
    mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    mockInsert.mockRejectedValueOnce(uniqueViolation);

    await expect(createWpayRazorpayOrder(baseParams(null))).rejects.toThrow(
      /already exists/i,
    );
  });
});
