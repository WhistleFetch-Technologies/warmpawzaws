/**
 * Multi-service GST line helpers.
 * Per-line GST is calculated by taxCalculationService; this module only
 * allocates taxable bases, maps engine items, aggregates, and reads gstLines.
 */

export type AuthoritativeGstLineInput = {
  serviceId?: string | null;
  vendorServiceId?: string | null;
  /** Customer list amount for this line (custom_price ?? price) × qty, before discount allocation. */
  listAmount: number;
  quantity?: number;
  category?: string | null;
  serviceStyle?: string | null;
};

export type AuthoritativeGstLine = {
  serviceId?: string;
  vendorServiceId?: string;
  category?: string;
  gstRate: number;
  taxableAmount: number;
  gstAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
};

export type GstEngineItem = {
  itemId?: string;
  gstRate?: number;
  baseAmount?: number;
  totalTax?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
};

function money(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function selectedServiceLineAmount(service: {
  originalPrice?: unknown;
  original_price?: unknown;
  price?: unknown;
  custom_price?: unknown;
  quantity?: unknown;
}): number {
  const qty = Math.max(1, parseInt(String(service.quantity ?? 1), 10) || 1);
  const list =
    money(service.originalPrice ?? service.original_price) ||
    money(service.price) ||
    money(service.custom_price);
  return money(list * qty);
}

/** Allocate a post-discount taxable total across line list amounts. Last line absorbs remainder. */
export function allocateTaxableAcrossLines(
  listAmounts: number[],
  postDiscountTotal: number,
): number[] {
  const lists = listAmounts.map((n) => Math.max(0, money(n)));
  const listSum = money(lists.reduce((sum, n) => sum + n, 0));
  const target = Math.max(0, money(postDiscountTotal));
  if (lists.length === 0) return [];
  if (listSum <= 0.009) return lists.map(() => 0);
  if (Math.abs(listSum - target) <= 0.009) return lists;

  const allocated = lists.map((list) => money((list / listSum) * target));
  const allocatedSum = money(allocated.reduce((sum, n) => sum + n, 0));
  allocated[allocated.length - 1] = money(allocated[allocated.length - 1] + (target - allocatedSum));
  return allocated;
}

export function gstLinesFromEngineItems(
  items: GstEngineItem[],
  lineInputs: AuthoritativeGstLineInput[],
): AuthoritativeGstLine[] {
  return items.map((item, index) => {
    const input = lineInputs[index];
    return {
      serviceId: input?.serviceId ? String(input.serviceId) : undefined,
      vendorServiceId: input?.vendorServiceId ? String(input.vendorServiceId) : undefined,
      category: input?.category ? String(input.category) : undefined,
      gstRate: money(item.gstRate),
      taxableAmount: money(item.baseAmount),
      gstAmount: money(item.totalTax),
      cgst: money(item.cgstAmount),
      sgst: money(item.sgstAmount),
      igst: money(item.igstAmount),
    };
  });
}

export function aggregateGstLines(lines: AuthoritativeGstLine[], isInterState: boolean): {
  taxableAmount: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstRate: number;
  isInterState: boolean;
  splitAvailable: true;
} {
  const taxableAmount = money(lines.reduce((sum, line) => sum + money(line.taxableAmount), 0));
  const gstAmount = money(lines.reduce((sum, line) => sum + money(line.gstAmount), 0));
  const cgstAmount = money(lines.reduce((sum, line) => sum + money(line.cgst), 0));
  const sgstAmount = money(lines.reduce((sum, line) => sum + money(line.sgst), 0));
  const igstAmount = money(lines.reduce((sum, line) => sum + money(line.igst), 0));
  const rates = [...new Set(lines.map((line) => money(line.gstRate)))];
  const gstRate =
    rates.length === 1
      ? rates[0]
      : taxableAmount > 0.009 && gstAmount > 0.009
        ? money((gstAmount / taxableAmount) * 100)
        : rates[0] ?? 0;

  return {
    taxableAmount,
    gstAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    gstRate,
    isInterState,
    splitAvailable: true,
  };
}

export function parseGstLines(raw: unknown): AuthoritativeGstLine[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const lines: AuthoritativeGstLine[] = [];
  for (const row of raw) {
    if (row == null || typeof row !== 'object') continue;
    const line = row as Record<string, unknown>;
    lines.push({
      serviceId: line.serviceId != null ? String(line.serviceId) : undefined,
      vendorServiceId: line.vendorServiceId != null ? String(line.vendorServiceId) : undefined,
      category: line.category != null ? String(line.category) : undefined,
      gstRate: money(line.gstRate ?? line.gst_rate),
      taxableAmount: money(line.taxableAmount ?? line.taxable_amount),
      gstAmount: money(line.gstAmount ?? line.gst_amount),
      cgst: money(line.cgst),
      sgst: money(line.sgst),
      igst: money(line.igst),
    });
  }
  return lines;
}

export type InvoiceServiceLine = {
  name: string;
  hsn: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
};

export function invoiceItemsFromGstLines(params: {
  gstLines: AuthoritativeGstLine[];
  selectedServices?: Array<{
    id?: unknown;
    serviceId?: unknown;
    service_id?: unknown;
    name?: unknown;
    serviceName?: unknown;
    quantity?: unknown;
    price?: unknown;
  }>;
  fallbackName?: string;
  fallbackHsn?: string;
}): InvoiceServiceLine[] | null {
  const lines = params.gstLines;
  if (!lines.length) return null;

  const selected = params.selectedServices ?? [];
  return lines.map((line, index) => {
    const match =
      selected.find((service) => {
        const ids = [service.id, service.serviceId, service.service_id].map((id) =>
          id != null ? String(id) : '',
        );
        return (
          (line.vendorServiceId && ids.includes(line.vendorServiceId)) ||
          (line.serviceId && ids.includes(line.serviceId))
        );
      }) ?? selected[index];

    const qty = Math.max(1, parseInt(String(match?.quantity ?? 1), 10) || 1);
    const taxable = money(line.taxableAmount);
    const itemTax = money(line.cgst + line.sgst + line.igst) || money(line.gstAmount);
    return {
      name: String(match?.name || match?.serviceName || params.fallbackName || 'Service'),
      hsn: params.fallbackHsn || '—',
      quantity: qty,
      unitPrice: qty > 0 ? money(taxable / qty) : taxable,
      gstRate: money(line.gstRate),
      taxableValue: taxable,
      cgst: money(line.cgst),
      sgst: money(line.sgst),
      igst: money(line.igst),
      total: money(taxable + itemTax),
    };
  });
}
