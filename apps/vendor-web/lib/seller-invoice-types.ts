/** Normalized vendor sales invoice (GET /vendor/:vendorId/invoices). */

export interface VendorSalesInvoice {
  id: string;
  invoiceNumber: string;
  orderNumber?: string | null;
  orderId?: string | null;
  customerName?: string | null;
  date: string;
  subtotal: number;
  tax: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  isInterState: boolean;
  status: string;
}

export interface VendorInvoiceSummary {
  totalInvoices: number;
  totalSubtotal: number;
  totalTax: number;
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  totalAmount: number;
}

export interface VendorInvoicesListResponse {
  invoices: VendorSalesInvoice[];
  summary: VendorInvoiceSummary;
  pagination?: { limit: number; offset: number };
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown): string {
  return v != null ? String(v) : '';
}

/** Map API row (camelCase or legacy snake_case) to VendorSalesInvoice. */
export function normalizeVendorSalesInvoice(raw: Record<string, unknown>): VendorSalesInvoice {
  return {
    id: str(raw.id),
    invoiceNumber: str(raw.invoiceNumber ?? raw.invoice_number),
    orderNumber: (raw.orderNumber ?? raw.order_number) as string | null | undefined,
    orderId: (raw.orderId ?? raw.order_id) as string | null | undefined,
    customerName: (raw.customerName ?? raw.customer_name) as string | null | undefined,
    date: str(raw.date ?? raw.invoice_date ?? raw.created_at),
    subtotal: num(raw.subtotal),
    tax: num(raw.tax ?? raw.tax_amount ?? raw.gst_amount),
    cgst: num(raw.cgst ?? raw.cgst_amount),
    sgst: num(raw.sgst ?? raw.sgst_amount),
    igst: num(raw.igst ?? raw.igst_amount),
    total: num(raw.total ?? raw.total_amount),
    isInterState: Boolean(raw.isInterState ?? raw.is_inter_state),
    status: str(raw.status || 'generated'),
  };
}

export function normalizeVendorInvoiceSummary(raw: Record<string, unknown> | undefined): VendorInvoiceSummary {
  const s = raw ?? {};
  return {
    totalInvoices: num(s.totalInvoices ?? s.total_invoices),
    totalSubtotal: num(s.totalSubtotal ?? s.total_subtotal),
    totalTax: num(s.totalTax ?? s.total_tax),
    totalCGST: num(s.totalCGST ?? s.total_cgst),
    totalSGST: num(s.totalSGST ?? s.total_sgst),
    totalIGST: num(s.totalIGST ?? s.total_igst),
    totalAmount: num(s.totalAmount ?? s.total_amount),
  };
}

export function normalizeVendorInvoicesListResponse(data: unknown): VendorInvoicesListResponse {
  const root = (data ?? {}) as Record<string, unknown>;
  const payload = (root.data ?? root) as Record<string, unknown>;
  const rawList = Array.isArray(payload.invoices) ? payload.invoices : [];
  return {
    invoices: rawList.map((row) => normalizeVendorSalesInvoice(row as Record<string, unknown>)),
    summary: normalizeVendorInvoiceSummary(payload.summary as Record<string, unknown>),
    pagination: payload.pagination as VendorInvoicesListResponse['pagination'],
  };
}

/** Effective GST % from summary totals (for banner when invoices exist). */
export function effectiveGstRateFromSummary(summary: VendorInvoiceSummary): number | null {
  if (summary.totalSubtotal <= 0 || summary.totalTax <= 0) return null;
  return Math.round((summary.totalTax / summary.totalSubtotal) * 10000) / 100;
}
