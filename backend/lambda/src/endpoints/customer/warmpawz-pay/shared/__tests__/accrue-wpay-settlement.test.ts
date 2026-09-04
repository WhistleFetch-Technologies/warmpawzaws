import { query } from '../../../../../database/rds-connection';
import {
  accrueWpaySettlement,
  mapWpaySettlementLedgerStatus,
  resolveWpayPlatformWithholdPercent,
} from '../accrue-wpay-settlement';
import type { WpayPaymentRow } from '../../repos/wpay-payment.repo';

jest.mock('../../../../../database/rds-connection', () => ({
  query: jest.fn(),
}));

jest.mock('../../repos/wpay-appointment-context.repo', () => ({
  dbLoadWapptBookingSettlementFacts: jest.fn(),
}));

const { dbLoadWapptBookingSettlementFacts } = jest.requireMock('../../repos/wpay-appointment-context.repo');

const mockedQuery = query as jest.MockedFunction<typeof query>;

const basePayment: WpayPaymentRow = {
  id: 'pay-1',
  customer_id: 'cust-1',
  vendor_id: 'vendor-1',
  booking_id: null,
  amount: 900,
  original_amount: 1000,
  discount_amount: 100,
  payment_status: 'completed',
  razorpay_order_id: 'order-1',
  razorpay_payment_id: 'rzp-1',
  razorpay_signature: 'sig',
  metadata: {
    quotedOriginalAmount: 1000,
    quotedDiscountAmount: 100,
    quotedDiscountPercent: 10,
    appointmentFeeCredit: 0,
  },
  completed_at: '2026-08-04T10:00:00.000Z',
  created_at: '2026-08-04T09:00:00.000Z',
};

describe('accrue-wpay-settlement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dbLoadWapptBookingSettlementFacts.mockResolvedValue(null);
  });

  it('maps settlement statuses for vendor earnings UI', () => {
    expect(mapWpaySettlementLedgerStatus('pending')).toBe('pending');
    expect(mapWpaySettlementLedgerStatus('completed')).toBe('settled');
    expect(mapWpaySettlementLedgerStatus('failed')).toBe('cancelled');
  });

  it('uses platformWithholdPercent snapshot from payment metadata', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'settlement-snap' }] } as never);

    const result = await accrueWpaySettlement({
      ...basePayment,
      metadata: {
        ...basePayment.metadata,
        platformWithholdPercent: 8,
      },
    });

    expect(result.inserted).toBe(true);
    expect(mockedQuery).toHaveBeenCalledTimes(2);
    const insertArgs = mockedQuery.mock.calls[1]?.[1];
    expect(insertArgs?.[4]).toBe(72);
    expect(insertArgs?.[5]).toBe(828);
  });

  it('computes withhold and inserts settlement row', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ platform_withhold_percent: '5' }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'settlement-1' }] } as never);

    const result = await accrueWpaySettlement(basePayment);

    expect(result.inserted).toBe(true);
    expect(result.settlementId).toBe('settlement-1');
    expect(mockedQuery).toHaveBeenCalledTimes(3);
    const insertArgs = mockedQuery.mock.calls[2]?.[1];
    expect(insertArgs?.[2]).toBeNull();
    expect(insertArgs?.[4]).toBe(45);
    expect(insertArgs?.[5]).toBe(855);
  });

  it('passes booking_id into settlement insert for appointment pay', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ platform_withhold_percent: '5' }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'settlement-2' }] } as never);

    dbLoadWapptBookingSettlementFacts.mockResolvedValue({
      id: 'booking-1',
      otp_verified: true,
      commerce_mode: 'warmpawz_appointments',
    });

    const result = await accrueWpaySettlement({
      ...basePayment,
      booking_id: 'booking-1',
      metadata: {
        ...basePayment.metadata,
        appointmentFeeBookingId: 'booking-1',
        appointmentFeeCredit: 200,
      },
    });

    expect(result.inserted).toBe(true);
    const insertArgs = mockedQuery.mock.calls[2]?.[1];
    expect(insertArgs?.[2]).toBe('booking-1');
  });

  it('accrues appointment-linked settlement before OTP verified', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ platform_withhold_percent: '5' }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'settlement-pre-otp' }] } as never);

    dbLoadWapptBookingSettlementFacts.mockResolvedValue({
      id: 'booking-1',
      otp_verified: false,
      commerce_mode: 'warmpawz_appointments',
    });

    const result = await accrueWpaySettlement({
      ...basePayment,
      booking_id: 'booking-1',
      metadata: {
        appointmentFeeBookingId: 'booking-1',
        appointmentFeeCredit: 200,
      },
    });

    expect(result.inserted).toBe(true);
    expect(result.settlementId).toBe('settlement-pre-otp');
  });

  it('is idempotent when settlement already exists', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-settlement' }] } as never);

    const result = await accrueWpaySettlement(basePayment);

    expect(result.inserted).toBe(false);
    expect(result.settlementId).toBe('existing-settlement');
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });

  it('clamps withhold percent to 0-100', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ platform_withhold_percent: '150' }] } as never);

    await expect(resolveWpayPlatformWithholdPercent('vendor-1')).resolves.toBe(100);
  });

  it('uses tier commission snapshot for settlement insert', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'settlement-tier' }] } as never);

    const result = await accrueWpaySettlement({
      ...basePayment,
      amount: 8523.6,
      metadata: {
        commercialModel: 'tier_commission',
        tierId: 'tier-1',
        quotedOriginalAmount: 10_000,
        quotedDiscountAmount: 1500,
        quotedDiscountPercent: 15,
        commissionPercentSnapshot: 20,
        grossCommissionAmount: 2000,
        vendorPayableAmount: 8000,
        servicePayableAmount: 8500,
        wpayRevenueAmount: 500,
        platformGstAmount: 76.27,
        convenienceFee: 20,
        convenienceGstAmount: 3.6,
        finalGstAmount: 79.87,
        payNowAmount: 8523.6,
        appointmentFeeCredit: 0,
      },
    });

    expect(result.inserted).toBe(true);
    const insertArgs = mockedQuery.mock.calls[1]?.[1];
    expect(insertArgs?.[4]).toBe(500);
    expect(insertArgs?.[5]).toBe(8000);
    const breakup = JSON.parse(String(insertArgs?.[7]));
    expect(breakup.commercialModel).toBe('tier_commission');
    expect(breakup.finalGstAmount).toBe(79.87);
  });

  it('uses burn snapshot: vendor payable is Q and platform revenue is 0', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'settlement-burn' }] } as never);

    const result = await accrueWpaySettlement({
      ...basePayment,
      amount: 7500,
      original_amount: 10_000,
      discount_amount: 2500,
      metadata: {
        commercialModel: 'tier_commission',
        tierId: 'tier-zero',
        quotedOriginalAmount: 10_000,
        quotedDiscountAmount: 2500,
        quotedDiscountPercent: 25,
        commissionPercentSnapshot: 0,
        grossCommissionAmount: 0,
        vendorPayableAmount: 10_000,
        servicePayableAmount: 7500,
        wpayRevenueAmount: 0,
        burnMode: true,
        burnAmount: 2500,
        payNowAmount: 7500,
        appointmentFeeCredit: 0,
      },
    });

    expect(result.inserted).toBe(true);
    const insertArgs = mockedQuery.mock.calls[1]?.[1];
    expect(insertArgs?.[4]).toBe(0);
    expect(insertArgs?.[5]).toBe(10_000);
    const breakup = JSON.parse(String(insertArgs?.[7]));
    expect(breakup.commercialModel).toBe('tier_commission');
    expect(breakup.burnMode).toBe(true);
    expect(breakup.burnAmount).toBe(2500);
    expect(breakup.vendorPayableAmount).toBe(10_000);
    expect(breakup.wpayRevenueAmount).toBe(0);
  });
});
