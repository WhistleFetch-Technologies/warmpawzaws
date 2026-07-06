import { query } from '../../../database/rds-connection';
import { resolveOrderCommissionByOrderId } from '../../../utils/resolve-ecommerce-commission-rate';
import { getPlatformTaxProduct } from '../platform-tax-api.service';
import {
  buildPlatformTaxInvoiceHtml,
  previewPlatformTaxInvoice,
} from '../platform-tax-issue.service';

jest.mock('../../../database/rds-connection', () => ({
  query: jest.fn(),
  insert: jest.fn(),
}));

jest.mock('../platform-tax-api.service', () => ({
  getPlatformTaxProduct: jest.fn(),
}));

jest.mock('../../../utils/resolve-ecommerce-commission-rate', () => ({
  resolveOrderCommissionByOrderId: jest.fn(),
}));

const queryMock = query as jest.MockedFunction<typeof query>;
const getPlatformTaxProductMock = getPlatformTaxProduct as jest.MockedFunction<typeof getPlatformTaxProduct>;
const resolveOrderCommissionByOrderIdMock =
  resolveOrderCommissionByOrderId as jest.MockedFunction<typeof resolveOrderCommissionByOrderId>;

describe('platform-tax-issue.service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    getPlatformTaxProductMock.mockResolvedValue({
      code: 'PLATFORM_COMMISSION',
      name: 'Platform commission',
      sac_code: '998599',
      default_gst_rate: 18,
    });
  });

  it('previews platform tax from persisted order commission audit before recomputing', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ commission: '0', row_count: 0 }] } as never)
      .mockResolvedValueOnce({ rows: [{ commission: '0', row_count: 0 }] } as never)
      .mockResolvedValueOnce({
        rows: [{ id: 'order-1', commission_amount: '12.50', subtotal: '100.00' }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const preview = await previewPlatformTaxInvoice({
      vendorId: '11111111-1111-1111-1111-111111111111',
      periodFrom: '2026-07-01',
      periodTo: '2026-07-31',
    });

    expect(preview.source).toBe('order_commission_audit');
    expect(preview.sourceRowCount).toBe(1);
    expect(preview.taxableAmount).toBe(12.5);
    expect(preview.gstAmount).toBe(2.25);
    expect(preview.totalAmount).toBe(14.75);
    expect(preview.commissionRate).toBe(12.5);
    expect(resolveOrderCommissionByOrderIdMock).not.toHaveBeenCalled();
  });

  it('falls back to recomputing delivered order commission when audit is absent', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ commission: '0', row_count: 0 }] } as never)
      .mockResolvedValueOnce({ rows: [{ commission: '0', row_count: 0 }] } as never)
      .mockResolvedValueOnce({
        rows: [{ id: 'order-1', commission_amount: null, subtotal: '100.00' }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{ id: 'order-1', commission_amount: null, subtotal: '100.00' }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    resolveOrderCommissionByOrderIdMock.mockResolvedValue({
      commissionAmount: 15,
      effectiveRate: 15,
      orderSubtotal: 100,
      lineBreakdown: [],
    });

    const preview = await previewPlatformTaxInvoice({
      vendorId: '11111111-1111-1111-1111-111111111111',
      periodFrom: '2026-07-01',
      periodTo: '2026-07-31',
    });

    expect(preview.source).toBe('recomputed_orders');
    expect(preview.sourceRowCount).toBe(1);
    expect(preview.taxableAmount).toBe(15);
    expect(preview.gstAmount).toBe(2.7);
    expect(preview.totalAmount).toBe(17.7);
    expect(resolveOrderCommissionByOrderIdMock).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'order-1'
    );
  });

  it('renders invoice HTML with tax document details', () => {
    const html = buildPlatformTaxInvoiceHtml({
      invoiceNumber: 'WP-TAX-202607-0001',
      periodFrom: '2026-07-01',
      periodTo: '2026-07-31',
      taxableAmount: 100,
      gstAmount: 18,
      totalAmount: 118,
      gstRate: 18,
      supplier: { name: 'WarmPawz Technologies', gstin: 'SUPPLIERGSTIN' },
      recipient: { name: 'Seller Pvt Ltd', gstin: 'SELLERGSTIN' },
      lines: [
        {
          description: 'Platform commission',
          sacCode: '998599',
          gstRate: 18,
          taxableAmount: 100,
          gstAmount: 18,
          totalAmount: 118,
        },
      ],
    });

    expect(html).toContain('WP-TAX-202607-0001');
    expect(html).toContain('WarmPawz Technologies');
    expect(html).toContain('Seller Pvt Ltd');
    expect(html).toContain('Platform commission');
    expect(html).toContain('998599');
  });
});
