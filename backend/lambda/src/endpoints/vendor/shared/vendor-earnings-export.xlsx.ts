import ExcelJS from 'exceljs';
import { EARNINGS_PERIOD_TZ } from '../../../utils/vendor-earnings-period-sql';

export const VENDOR_EARNINGS_EXPORT_HEADERS = [
  'Customer',
  'Channel',
  'Date/time (IST)',
  'Amount to receive',
  'Status',
] as const;

export type VendorEarningsExportSource = {
  customerName?: string | null;
  serviceName?: string | null;
  flowType?: string | null;
  realizedAt?: string | null;
  amount?: number | null;
  status?: string | null;
};

function formatIstDateTime(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: EARNINGS_PERIOD_TZ,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

export function mapVendorEarningsExportRow(item: VendorEarningsExportSource): [
  string,
  string,
  string,
  number,
  string,
] {
  const customer = String(item.customerName || 'Customer').trim() || 'Customer';
  const channel = item.flowType === 'pay_bill' ? 'Pay Bill' : String(item.serviceName || 'Booking');
  const amount = Number(item.amount);
  return [
    customer,
    channel,
    formatIstDateTime(item.realizedAt),
    Number.isFinite(amount) ? amount : 0,
    String(item.status || 'pending'),
  ];
}

export function buildVendorEarningsExportFilename(period: string, suffix?: string): string {
  const safePeriod = period.replace(/[^a-z0-9_-]/gi, '') || 'earnings';
  const extra = suffix ? `-${suffix.replace(/[^a-z0-9_-]/gi, '')}` : '';
  return `vendor-earnings-${safePeriod}${extra}.xlsx`;
}

export async function buildVendorEarningsExportXlsx(
  items: readonly VendorEarningsExportSource[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Earnings');
  sheet.addRow([...VENDOR_EARNINGS_EXPORT_HEADERS]);
  for (const item of items) {
    sheet.addRow(mapVendorEarningsExportRow(item));
  }
  sheet.getRow(1).font = { bold: true };
  sheet.columns = [
    { width: 22 },
    { width: 18 },
    { width: 22 },
    { width: 18, style: { numFmt: '#,##0.00' } },
    { width: 14 },
  ];
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
