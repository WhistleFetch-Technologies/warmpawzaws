/**
 * Invoice GST helpers — works with legacy 021 invoices table and 1047 ecommerce columns.
 * is_inter_state / customer_gstin / place_of_supply may live only in invoice_data JSON.
 */

export function parseInvoiceDataField(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function parseTaxAmount(raw: unknown): number {
  const n = parseFloat(String(raw ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Infer inter-state from row columns and/or invoice_data (no is_inter_state column required). */
export function inferIsInterStateFromInvoiceRow(row: Record<string, unknown>): boolean {
  if (row.is_inter_state != null) return Boolean(row.is_inter_state);
  if (row.isInterState != null) return Boolean(row.isInterState);

  const data = parseInvoiceDataField(row.invoice_data);
  if (data.isInterState != null) return Boolean(data.isInterState);
  if (data.is_inter_state != null) return Boolean(data.is_inter_state);

  const igst = parseTaxAmount(row.igst_amount ?? data.igst);
  const cgst = parseTaxAmount(row.cgst_amount ?? data.cgst);
  const sgst = parseTaxAmount(row.sgst_amount ?? data.sgst);
  return igst > 0 && cgst + sgst < 0.01;
}

export function customerGstinFromInvoiceRow(row: Record<string, unknown>): string {
  const direct = row.customer_gstin ?? row.customerGstin;
  if (direct != null && String(direct).trim()) return String(direct).trim();

  const data = parseInvoiceDataField(row.invoice_data);
  const customer = data.customer as Record<string, unknown> | undefined;
  const gstin = customer?.gstin ?? customer?.gstin_number ?? data.customer_gstin;
  return gstin != null ? String(gstin).trim() : '';
}

export function placeOfSupplyFromInvoiceRow(row: Record<string, unknown>): string {
  const direct = row.place_of_supply ?? row.placeOfSupply;
  if (direct != null && String(direct).trim()) return String(direct).trim();

  const data = parseInvoiceDataField(row.invoice_data);
  const pos = data.placeOfSupply ?? data.place_of_supply;
  return pos != null ? String(pos).trim() : '';
}

/**
 * SQL boolean: inter-state for joined invoice `inv` + order `o`.
 * Does not reference invoices.is_inter_state (1047 column may be missing on legacy DBs).
 */
export const SQL_INVOICE_IS_INTER_STATE = `(
  CASE
    WHEN inv.id IS NOT NULL
      AND COALESCE(inv.invoice_data->>'isInterState', inv.invoice_data->>'is_inter_state') IN ('true', 't', '1')
      THEN true
    WHEN inv.id IS NOT NULL
      AND COALESCE(inv.invoice_data->>'isInterState', inv.invoice_data->>'is_inter_state') IN ('false', 'f', '0')
      THEN false
    WHEN COALESCE(inv.igst_amount::numeric, o.igst_amount::numeric, 0) > 0
      AND (
        COALESCE(inv.cgst_amount::numeric, o.cgst_amount::numeric, 0)
        + COALESCE(inv.sgst_amount::numeric, o.sgst_amount::numeric, 0)
      ) < 0.01
      THEN true
    ELSE false
  END
)`;
