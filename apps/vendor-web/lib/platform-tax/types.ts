export type PlatformTaxDocumentType = 'TAX_INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
export type PlatformTaxDocumentStatus = 'DRAFT' | 'ISSUED' | 'VOID';

export interface PlatformTaxDocumentSummary {
  id: string;
  documentType: PlatformTaxDocumentType;
  invoiceNumber: string | null;
  status: PlatformTaxDocumentStatus;
  periodFrom: string;
  periodTo: string;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
  issuedAt: string | null;
  pdfUrl: string | null;
}

export interface PlatformTaxDocumentLine {
  id: string;
  chargeType: string;
  description: string;
  sacCode: string | null;
  gstRate: number;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
}

export interface PlatformTaxDocumentDetail extends PlatformTaxDocumentSummary {
  lines: PlatformTaxDocumentLine[];
  supplierSnapshot?: Record<string, unknown>;
  recipientSnapshot?: Record<string, unknown>;
}

export type PlatformTaxApiStatus =
  | { available: true }
  | { available: false; reason: 'DISABLED' | 'MIGRATION_REQUIRED' | 'UNAVAILABLE' };

export interface PlatformTaxDocumentFilters {
  status?: string;
  documentType?: string;
  month?: string;
  limit?: number;
  offset?: number;
}
