import type { PlatformTaxDocumentRow, PlatformTaxDocumentLineRow } from '../lib/platform-tax/platform-tax-api.service';

export function toDocumentSummaryDto(row: PlatformTaxDocumentRow) {
  return {
    id: String(row.id),
    documentType: row.document_type,
    invoiceNumber: row.invoice_number,
    status: row.status,
    periodFrom: String(row.period_from).slice(0, 10),
    periodTo: String(row.period_to).slice(0, 10),
    taxableAmount: parseFloat(String(row.taxable_amount)),
    gstAmount: parseFloat(String(row.gst_amount)),
    totalAmount: parseFloat(String(row.total_amount)),
    issuedAt: row.issued_at,
    pdfUrl: row.pdf_url,
  };
}

export function toDocumentDetailDto(
  row: PlatformTaxDocumentRow & { lines: PlatformTaxDocumentLineRow[] }
) {
  return {
    ...toDocumentSummaryDto(row),
    lines: (row.lines ?? []).map((line) => ({
      id: String(line.id),
      chargeType: line.charge_type,
      description: line.description,
      sacCode: line.sac_code,
      gstRate: parseFloat(String(line.gst_rate)),
      taxableAmount: parseFloat(String(line.taxable_amount)),
      gstAmount: parseFloat(String(line.gst_amount)),
      totalAmount: parseFloat(String(line.total_amount)),
    })),
    supplierSnapshot:
      typeof row.supplier_snapshot === 'string'
        ? JSON.parse(row.supplier_snapshot)
        : row.supplier_snapshot,
    recipientSnapshot:
      typeof row.recipient_snapshot === 'string'
        ? JSON.parse(row.recipient_snapshot)
        : row.recipient_snapshot,
  };
}

export interface IssueTaxDocumentRequestDto {
  vendorId: string;
  periodFrom: string;
  periodTo: string;
}
