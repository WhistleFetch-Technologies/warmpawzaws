import { buildWpayPaymentsExportXlsx } from '../wpay-payments-export.xlsx';
import type { WpayAdminPaymentItemDTO } from '../../dto/payments.responses';

const sampleItem: WpayAdminPaymentItemDTO = {
  paymentId: 'pay-1',
  customer: { name: 'Sonu M', phone: '+917204349568' },
  vendor: { id: 'vend-1', name: 'Bindu Vet Clinic', category: 'Veterinarian' },
  commercialModel: 'withhold',
  originalAmount: 1000,
  discountPercent: 10,
  discountAmount: 100,
  payableAmount: 900,
  walletAmount: 50,
  razorpayChargeAmount: 850,
  pendingCashback: 25,
  awardedCashback: 25,
  evaluationId: 'eval-1',
  platformWithholdPercent: 5,
  platformWithholdAmount: 45,
  vendorSettlementAmount: 855,
  settlementSource: 'persisted',
  payoutStatus: 'pending',
  paidAt: '2026-08-06T06:41:00.000Z',
};

describe('buildWpayPaymentsExportXlsx', () => {
  it('builds worksheet with header row and payment data', async () => {
    const buffer = await buildWpayPaymentsExportXlsx([sampleItem]);
    expect(buffer.length).toBeGreaterThan(0);

    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.getWorksheet('Warmpawz Pay Orders');
    expect(sheet).toBeTruthy();

    const headerRow = sheet!.getRow(1);
    expect(headerRow.getCell(1).value).toBe('Payment ID');
    expect(headerRow.getCell(11).value).toBe('Wallet Used');
    expect(headerRow.getCell(14).value).toBe('Cashback Awarded');
    expect(headerRow.getCell(21).value).toBe('Paid At (IST)');

    const dataRow = sheet!.getRow(2);
    expect(dataRow.getCell(1).value).toBe('pay-1');
    expect(dataRow.getCell(7).value).toBe(1000);
    expect(dataRow.getCell(11).value).toBe(50);
    expect(dataRow.getCell(14).value).toBe(25);
    expect(dataRow.getCell(20).value).toBe(855);
  });
});
