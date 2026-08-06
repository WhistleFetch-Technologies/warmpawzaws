import ExcelJS from 'exceljs';
import type { WpayAdminPaymentItemDTO } from '../dto/payments.responses';
import type { WpayPaymentsDateFilter } from '../dto/payments.requests';
import { wpayPaymentsFilterLabel } from '../dto/payments.requests';

const HEADERS = [
  'Payment ID',
  'Customer',
  'Phone',
  'Vendor',
  'Category',
  'Amount Quoted',
  'Discount (%)',
  'Discount Amount',
  'Amount Paid',
  'Platform Withhold (%)',
  'Platform Withhold (₹)',
  'Vendor Settlement',
  'Paid At (IST)',
] as const;

function formatPaidAtIst(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function buildWpayPaymentsExportFilename(filter: WpayPaymentsDateFilter): string {
  const label = wpayPaymentsFilterLabel(filter);
  if (filter.mode === 'none') {
    return 'warmpawz-pay-orders-all.xlsx';
  }
  return `warmpawz-pay-orders-${label}.xlsx`;
}

export async function buildWpayPaymentsExportXlsx(
  items: readonly WpayAdminPaymentItemDTO[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Warmpawz Pay Orders');

  sheet.addRow([...HEADERS]);

  for (const item of items) {
    sheet.addRow([
      item.paymentId,
      item.customer.name,
      item.customer.phone,
      item.vendor.name,
      item.vendor.category,
      item.originalAmount,
      item.discountPercent,
      item.discountAmount,
      item.payableAmount,
      item.platformWithholdPercent,
      item.platformWithholdAmount,
      item.vendorSettlementAmount,
      formatPaidAtIst(item.paidAt),
    ]);
  }

  sheet.getRow(1).font = { bold: true };
  sheet.columns = HEADERS.map((header, index) => {
    if (index >= 5 && index <= 11) {
      return { width: 18, style: { numFmt: '#,##0.00' } };
    }
    return { width: Math.max(header.length + 2, 14) };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
