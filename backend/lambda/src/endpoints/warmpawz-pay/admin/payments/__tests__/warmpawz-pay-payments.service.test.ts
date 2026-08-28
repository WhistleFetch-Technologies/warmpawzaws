import {
  resolveWpayAdminPaymentSettlement,
  WarmpawzPayPaymentsService,
} from '../services/warmpawz-pay-payments.service';
import type { WpayAdminPaymentDbRow } from '../../../repositories/wpay-payments-admin.repository';

jest.mock('../../../repositories/wpay-payments-admin.repository', () => ({
  dbWpayAdminPaymentsPage: jest.fn(),
  dbWpayAdminPaymentsExport: jest.fn(),
  dbWpayPlatformWithholdPercentByVendorIds: jest.fn(),
}));

import {
  dbWpayAdminPaymentsExport,
  dbWpayAdminPaymentsPage,
  dbWpayPlatformWithholdPercentByVendorIds,
} from '../../../repositories/wpay-payments-admin.repository';

const mockedPage = dbWpayAdminPaymentsPage as jest.MockedFunction<typeof dbWpayAdminPaymentsPage>;
const mockedExport = dbWpayAdminPaymentsExport as jest.MockedFunction<typeof dbWpayAdminPaymentsExport>;
const mockedWithholdByVendor = dbWpayPlatformWithholdPercentByVendorIds as jest.MockedFunction<
  typeof dbWpayPlatformWithholdPercentByVendorIds
>;

const baseRow: WpayAdminPaymentDbRow = {
  payment_id: 'pay-1',
  customer_id: 'cust-1',
  customer_name: 'Sonu M',
  customer_phone: '+917204349568',
  vendor_id: 'vendor-1',
  business_name: 'Bindu Vet Clinic',
  owner_name: 'Bindu',
  vendor_type: 'solo',
  legacy_category: 'vet',
  customer_service: 'vet',
  role_category: 'vet',
  role_config: {},
  role_name: 'Veterinarian',
  role_display_name: 'Veterinarian (Solo)',
  original_amount: 1000,
  discount_amount: 100,
  payable_amount: 900,
  discount_percent: 10,
  paid_at: '2026-08-06T06:41:00.000Z',
  vendor_settlement_amount: null,
  platform_withhold_amount: null,
  platform_withhold_percent: null,
  payment_metadata: null,
  settlement_breakup: null,
};

describe('resolveWpayAdminPaymentSettlement', () => {
  it('uses persisted settlement amounts when present', () => {
    const result = resolveWpayAdminPaymentSettlement(
      {
        ...baseRow,
        vendor_settlement_amount: 855,
        platform_withhold_amount: 45,
        platform_withhold_percent: 5,
      },
      900,
      new Map(),
    );

    expect(result).toEqual({
      platformWithholdPercent: 5,
      platformWithholdAmount: 45,
      vendorSettlementAmount: 855,
      settlementSource: 'persisted',
    });
  });

  it('computes fallback settlement from vendor pricing when settlement row is missing', () => {
    const result = resolveWpayAdminPaymentSettlement(baseRow, 900, new Map([['vendor-1', 5]]));

    expect(result).toEqual({
      platformWithholdPercent: 5,
      platformWithholdAmount: 45,
      vendorSettlementAmount: 855,
      settlementSource: 'computed',
    });
  });
});

describe('WarmpawzPayPaymentsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps list items with persisted settlement fields', async () => {
    mockedPage.mockResolvedValue({
      total: 1,
      rows: [
        {
          ...baseRow,
          vendor_settlement_amount: 1265.4,
          platform_withhold_amount: 66.6,
          platform_withhold_percent: 5,
          payable_amount: 1332,
        },
      ],
    });

    const service = new WarmpawzPayPaymentsService();
    const result = await service.listPayments({
      page: 1,
      pageSize: 5,
      dateFilter: { mode: 'month', year: 2026, month: 8 },
    });

    expect(mockedPage).toHaveBeenCalledWith({
      page: 1,
      pageSize: 5,
      dateFilter: { mode: 'month', year: 2026, month: 8 },
    });

    expect(mockedWithholdByVendor).not.toHaveBeenCalled();
    expect(result.items[0]?.vendorSettlementAmount).toBe(1265.4);
    expect(result.items[0]?.platformWithholdAmount).toBe(66.6);
    expect(result.items[0]?.platformWithholdPercent).toBe(5);
    expect(result.items[0]?.settlementSource).toBe('persisted');
  });

  it('batch-loads pricing when any row lacks settlement', async () => {
    mockedPage.mockResolvedValue({ total: 1, rows: [baseRow] });
    mockedWithholdByVendor.mockResolvedValue(new Map([['vendor-1', 5]]));

    const service = new WarmpawzPayPaymentsService();
    const result = await service.listPayments({
      page: 1,
      pageSize: 5,
      dateFilter: { mode: 'month', year: 2026, month: 8 },
    });

    expect(mockedPage).toHaveBeenCalledWith({
      page: 1,
      pageSize: 5,
      dateFilter: { mode: 'month', year: 2026, month: 8 },
    });

    expect(mockedWithholdByVendor).toHaveBeenCalledWith(['vendor-1']);
    expect(result.items[0]?.vendorSettlementAmount).toBe(855);
    expect(result.items[0]?.settlementSource).toBe('computed');
  });

  it('exports xlsx rows with filename for month filter', async () => {
    mockedExport.mockResolvedValue([
      {
        ...baseRow,
        vendor_settlement_amount: 855,
        platform_withhold_amount: 45,
        platform_withhold_percent: 5,
      },
    ]);

    const service = new WarmpawzPayPaymentsService();
    const result = await service.exportPaymentsXlsx({
      dateFilter: { mode: 'month', year: 2026, month: 8 },
    });

    expect(mockedExport).toHaveBeenCalledWith({ mode: 'month', year: 2026, month: 8 });
    expect(result.filename).toBe('warmpawz-pay-orders-2026-08.xlsx');
    expect(result.buffer.length).toBeGreaterThan(0);
  });
});
