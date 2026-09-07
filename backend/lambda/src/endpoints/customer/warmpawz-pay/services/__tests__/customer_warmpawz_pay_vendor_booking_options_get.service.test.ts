import { executeCustomerWarmpawzPayVendorBookingOptionsGet } from '../customer_warmpawz_pay_vendor_booking_options_get.service';
import {
  dbVendorPublishedPayPackages,
  dbVendorWarmpawzPayPublished,
  dbVendorWapptPublished,
} from '../../repos/wpay-vendor-booking-options.repo';

jest.mock('../../repos/wpay-vendor-booking-options.repo', () => ({
  dbVendorWarmpawzPayPublished: jest.fn(),
  dbVendorWapptPublished: jest.fn(),
  dbVendorPublishedPayPackages: jest.fn(),
}));

const mockedPay = dbVendorWarmpawzPayPublished as jest.MockedFunction<typeof dbVendorWarmpawzPayPublished>;
const mockedAppt = dbVendorWapptPublished as jest.MockedFunction<typeof dbVendorWapptPublished>;
const mockedPkgs = dbVendorPublishedPayPackages as jest.MockedFunction<typeof dbVendorPublishedPayPackages>;

function mockCtx(vendorId: string) {
  return {
    req: { param: (k: string) => (k === 'vendorId' ? vendorId : '') },
    json: (body: unknown, status?: number) => ({ body, status: status ?? 200 }),
  };
}

describe('executeCustomerWarmpawzPayVendorBookingOptionsGet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns bookPackages only when Pay-published and packages exist', async () => {
    mockedPay.mockResolvedValue(true);
    mockedAppt.mockResolvedValue(true);
    mockedPkgs.mockResolvedValue([
      {
        id: 'pkg-1',
        service_name: 'Walk 10',
        custom_price: 10000,
        price: 10000,
        metadata: { isPackage: true, packageDetails: { totalSessions: 10, price: 10000 } },
        service_style: 'at_home',
        duration_minutes: 30,
        category: 'walking',
        publish_status: 'published',
      },
    ]);

    const res = (await executeCustomerWarmpawzPayVendorBookingOptionsGet(
      mockCtx('11111111-1111-4111-8111-111111111111') as any,
    )) as { body: any };
    expect(res.body.bookAppointment).toBe(true);
    expect(res.body.bookPackages).toBe(true);
    expect(res.body.packages).toHaveLength(1);
    expect(res.body.packages[0].price).toBe(10000);
  });

  it('hides Book Packages when vendor has no published packages', async () => {
    mockedPay.mockResolvedValue(true);
    mockedAppt.mockResolvedValue(true);
    mockedPkgs.mockResolvedValue([]);
    const res = (await executeCustomerWarmpawzPayVendorBookingOptionsGet(
      mockCtx('11111111-1111-4111-8111-111111111111') as any,
    )) as { body: any };
    expect(res.body.bookPackages).toBe(false);
    expect(res.body.packages).toEqual([]);
  });

  it('hides packages when vendor is not Pay-published', async () => {
    mockedPay.mockResolvedValue(false);
    mockedAppt.mockResolvedValue(true);
    mockedPkgs.mockResolvedValue([
      {
        id: 'pkg-1',
        service_name: 'Walk 10',
        custom_price: 10000,
        price: 10000,
        metadata: { isPackage: true },
        service_style: 'at_home',
        duration_minutes: 30,
        category: 'walking',
        publish_status: 'published',
      },
    ]);
    const res = (await executeCustomerWarmpawzPayVendorBookingOptionsGet(
      mockCtx('11111111-1111-4111-8111-111111111111') as any,
    )) as { body: any };
    expect(res.body.bookPackages).toBe(false);
    expect(res.body.packages).toEqual([]);
  });
});
