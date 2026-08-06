import { ensureVendorEarningsForCompletedBooking } from '../vendor-earnings-on-completion';
import { WAPPT_COMMERCE_MODE } from '../../endpoints/warmpawz-appointments/shared/wappt-earnings-policy';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
  select: jest.fn(),
}));

jest.mock('../vendor-resolve', () => ({
  resolveVendorId: jest.fn(async (id: string) => id),
}));

jest.mock('../vendor-commission-rate', () => ({
  isCanonicalPackageParentBooking: jest.fn(() => false),
  getVendorCommissionRate: jest.fn(async () => 20),
}));

jest.mock('../package-session-sync', () => ({
  backfillPackageSessionEarningsForCompletedBookings: jest.fn(),
  completePackageSessionForBooking: jest.fn(),
}));

jest.mock('../../finance/settlement/finance-settlement-mode', () => ({
  isFinanceFundingAwareSettlementEnabled: jest.fn(() => false),
  useFundingAwareVendorEarnings: jest.fn(() => false),
}));

import { query } from '../../database/rds-connection';

const mockedQuery = query as jest.MockedFunction<typeof query>;

describe('ensureVendorEarningsForCompletedBooking — WAPPT', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns false without inserting vendor_earnings for WAPPT bookings', async () => {
    const created = await ensureVendorEarningsForCompletedBooking(
      {
        vendor_id: 'vendor-1',
        commerce_mode: WAPPT_COMMERCE_MODE,
        total_amount: 72,
        status: 'completed',
      },
      'booking-wappt-1',
      '[TEST]',
    );

    expect(created).toBe(false);
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});
