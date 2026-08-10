import { finalizeBookingServiceCompleted } from '../../../../warmpawz-appointments/shared/finalize-booking-service-completed';
import { onWapptServiceCompleted } from '../../../../warmpawz-appointments/shared/on-wappt-service-completed';
import { accrueWpaySettlement } from '../accrue-wpay-settlement';
import { assertWapptSettlementEligible } from '../wpay-settlement-policy';
import type { WpayPaymentRow } from '../../repos/wpay-payment.repo';

jest.mock('../../../../warmpawz-appointments/shared/on-wappt-service-completed', () => ({
  onWapptServiceCompleted: jest.fn(async () => undefined),
}));

jest.mock('../../../../../utils/vendor-commission-rate', () => ({
  isCanonicalPackageParentBooking: jest.fn(() => false),
}));

jest.mock('../../../../../utils/vendor-earnings-on-completion', () => ({
  ensureVendorEarningsForCompletedBooking: jest.fn(async () => false),
}));

jest.mock('../../../../../database/rds-connection', () => ({
  query: jest.fn(),
  select: jest.fn(async () => [
    {
      id: 'booking-1',
      commerce_mode: 'warmpawz_appointments',
      otp_verified: true,
      status: 'completed',
    },
  ]),
}));

jest.mock('../../repos/wpay-appointment-context.repo', () => ({
  dbLoadWapptBookingSettlementFacts: jest.fn(async () => ({
    id: 'booking-1',
    otp_verified: true,
    commerce_mode: 'warmpawz_appointments',
  })),
}));

const { query } = jest.requireMock('../../../../../database/rds-connection');
const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedOnWappt = onWapptServiceCompleted as jest.MockedFunction<typeof onWapptServiceCompleted>;

const appointmentPayment: WpayPaymentRow = {
  id: 'pay-1',
  customer_id: 'cust-1',
  vendor_id: 'vendor-1',
  booking_id: 'booking-1',
  amount: 800,
  original_amount: 1000,
  discount_amount: 0,
  payment_status: 'completed',
  razorpay_order_id: 'order-1',
  razorpay_payment_id: 'rzp-1',
  razorpay_signature: 'sig',
  metadata: {
    appointmentFeeBookingId: 'booking-1',
    appointmentFeeCredit: 200,
    quotedOriginalAmount: 1000,
  },
  completed_at: '2026-08-04T10:00:00.000Z',
  created_at: '2026-08-04T09:00:00.000Z',
};

describe('WAPPT Pay Bill → Settlement → OTP completion (policy integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Pay Bill first: settlement accrues immediately before OTP', async () => {
    const gate = assertWapptSettlementEligible(appointmentPayment, {
      id: 'booking-1',
      otp_verified: false,
      commerce_mode: 'warmpawz_appointments',
    });
    expect(gate).toEqual({ ok: true });

    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ platform_withhold_percent: '5' }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'settlement-1' }] } as never);

    const result = await accrueWpaySettlement(appointmentPayment);
    expect(result.inserted).toBe(true);
    expect(result.settlementId).toBe('settlement-1');
  });

  it('OTP after Pay Bill: completion hook still runs as settlement safety net', async () => {
    const gate = assertWapptSettlementEligible(appointmentPayment, {
      id: 'booking-1',
      otp_verified: false,
      commerce_mode: 'warmpawz_appointments',
    });
    expect(gate).toEqual({ ok: true });

    await finalizeBookingServiceCompleted({
      bookingId: 'booking-1',
      booking: {
        id: 'booking-1',
        commerce_mode: 'warmpawz_appointments',
        otp_verified: true,
        status: 'completed',
      },
      logPrefix: '[TEST-OTP-AFTER-PAY]',
    });

    expect(mockedOnWappt).toHaveBeenCalledWith(
      'booking-1',
      expect.objectContaining({ commerce_mode: 'warmpawz_appointments' }),
      '[TEST-OTP-AFTER-PAY]',
    );
  });
});
