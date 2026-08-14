/**
 * Deterministic CGST/SGST/IGST reconstruction when only gst_total is stored.
 * Matches booking invoice split rules (intra-state 50/50, inter-state IGST).
 * Do not use this to mutate historical payment rows — reporting only, or new inserts.
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function money(raw: unknown): number {
  const n = parseFloat(String(raw ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? round2(n) : 0;
}

export function splitGstAmount(
  taxAmount: number,
  isInterState: boolean,
): { cgst: number; sgst: number; igst: number } {
  const tax = money(taxAmount);
  if (tax <= 0.009) return { cgst: 0, sgst: 0, igst: 0 };
  if (isInterState) return { cgst: 0, sgst: 0, igst: tax };
  const cgst = round2(tax / 2);
  const sgst = round2(tax - cgst);
  return { cgst, sgst, igst: 0 };
}

export type GstSplitParts = {
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstTotal: number;
};

/** If a split is missing but gstTotal is present, reconstruct using invoice rules. */
export function reconstructGstSplit(parts: {
  cgstAmount?: unknown;
  sgstAmount?: unknown;
  igstAmount?: unknown;
  gstTotal?: unknown;
  isInterState?: boolean;
}): GstSplitParts {
  const cgst = money(parts.cgstAmount);
  const sgst = money(parts.sgstAmount);
  const igst = money(parts.igstAmount);
  const splitSum = round2(cgst + sgst + igst);
  const gstTotal = splitSum > 0.009 ? splitSum : money(parts.gstTotal);

  if (gstTotal <= 0.009) {
    return { cgstAmount: 0, sgstAmount: 0, igstAmount: 0, gstTotal: 0 };
  }
  if (splitSum > 0.009) {
    return { cgstAmount: cgst, sgstAmount: sgst, igstAmount: igst, gstTotal };
  }

  const reconstructed = splitGstAmount(gstTotal, Boolean(parts.isInterState));
  return {
    cgstAmount: reconstructed.cgst,
    sgstAmount: reconstructed.sgst,
    igstAmount: reconstructed.igst,
    gstTotal,
  };
}

export function gstFinancialIdentity(params: {
  paymentId?: unknown;
  parentBookingId?: unknown;
  bookingId: string;
}): string {
  const paymentId = String(params.paymentId ?? '').trim();
  if (paymentId) return `payment:${paymentId}`;
  const parentId = String(params.parentBookingId ?? '').trim();
  if (parentId) return `parent:${parentId}`;
  return `booking:${params.bookingId}`;
}

/** Common exclusive GST rates for Indian pet-care services. */
export const INDIA_GST_RATES_PCT = [5, 12, 18, 28] as const;

const EMPTY_SPLIT: GstSplitParts = { cgstAmount: 0, sgstAmount: 0, igstAmount: 0, gstTotal: 0 };

/**
 * Recover GST that was charged on top of taxable value but never stored on
 * payments.gst_amount / bookings.tax_amount (Sara Pets 3cae9785: 1485 + 18% = 1752.30).
 * Only accepts a delta that matches a real GST rate (or catalogGstRate) within ₹0.05.
 * Does not invent GST when charged == taxable (tele / tax_amount=0).
 */
export function inferExclusiveGstFromChargedDelta(params: {
  taxableValue: number;
  chargedTotal: number;
  knownFees?: number;
  catalogGstRate?: number;
  isInterState?: boolean;
}): GstSplitParts {
  const taxable = money(params.taxableValue);
  const charged = money(params.chargedTotal);
  const fees = money(params.knownFees);
  if (taxable <= 0.009 || charged <= 0.009) return { ...EMPTY_SPLIT };

  const implied = round2(charged - taxable - fees);
  if (implied <= 0.009) return { ...EMPTY_SPLIT };

  const catalog = money(params.catalogGstRate);
  const rates: number[] = [];
  if (catalog > 0.009) rates.push(catalog);
  for (const rate of INDIA_GST_RATES_PCT) {
    if (!rates.some((existing) => Math.abs(existing - rate) < 0.001)) rates.push(rate);
  }

  for (const rate of rates) {
    const expected = round2(taxable * (rate / 100));
    if (Math.abs(implied - expected) <= 0.05) {
      return reconstructGstSplit({ gstTotal: expected, isInterState: Boolean(params.isInterState) });
    }
  }

  return { ...EMPTY_SPLIT };
}

/**
 * Recover GST baked into a GST-inclusive list price when checkout stored tax_amount=0.
 * July 2026: Pawsome 1350 × 1.18 = 1593; K9 boarding paid 1800 inclusive.
 * Does not invent GST for explicit 0% catalogue (veterinary).
 */
export function inferInclusiveGstFromListedPrice(params: {
  taxableValue: number;
  chargedTotal?: number;
  vendorGross?: number;
  catalogGstRate?: number;
  isInterState?: boolean;
  zeroRated?: boolean;
}): GstSplitParts {
  if (params.zeroRated) return { ...EMPTY_SPLIT };

  const taxable = money(params.taxableValue);
  if (taxable <= 0.009) return { ...EMPTY_SPLIT };

  const catalogPresent =
    params.catalogGstRate !== undefined && params.catalogGstRate !== null && !Number.isNaN(Number(params.catalogGstRate));
  const catalog = money(params.catalogGstRate);
  if (catalogPresent && catalog <= 0.009) return { ...EMPTY_SPLIT };

  const rates: number[] = [];
  if (catalog > 0.009) rates.push(catalog);
  else rates.push(18);

  const gross = money(params.vendorGross);
  const charged = money(params.chargedTotal);
  const isInterState = Boolean(params.isInterState);
  const chargedLooksInclusive = charged <= 0.009 || Math.abs(charged - taxable) <= 0.05;

  for (const rate of rates) {
    if (gross > 0.009) {
      const expectedListed = round2(gross * (1 + rate / 100));
      if (Math.abs(expectedListed - taxable) <= 0.05) {
        const fromGross = round2(taxable - gross);
        if (fromGross > 0.009) {
          return reconstructGstSplit({ gstTotal: fromGross, isInterState });
        }
      }
    }
  }

  if (!chargedLooksInclusive) return { ...EMPTY_SPLIT };

  for (const rate of rates) {
    const gst = round2((taxable * rate) / (100 + rate));
    if (gst <= 0.009) continue;
    const exclusive = round2(taxable - gst);
    if (Math.abs(round2(exclusive * (1 + rate / 100)) - taxable) <= 0.05) {
      return reconstructGstSplit({ gstTotal: gst, isInterState });
    }
  }

  return { ...EMPTY_SPLIT };
}

/** Veterinary / healthcare 0% — do not extract inclusive GST from the list price. */
export function isZeroRatedHealthcareHint(params: {
  catalogGstRate?: unknown;
  categoryName?: unknown;
  vsCategory?: unknown;
  serviceType?: unknown;
}): boolean {
  if (params.catalogGstRate !== undefined && params.catalogGstRate !== null && params.catalogGstRate !== '') {
    const n = parseFloat(String(params.catalogGstRate).replace(/,/g, ''));
    if (Number.isFinite(n) && n <= 0.009) return true;
  }
  const blob = [params.categoryName, params.vsCategory, params.serviceType]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');
  if (!blob.trim()) return false;
  const isNonVetService = /\b(groom|board|walk|train|nutrition|swim)/.test(blob);
  if (isNonVetService) return false;
  return (
    /\b(vet|veterinary|veterinarian|vet_clinic|vet_solo|healthcare)\b/.test(blob) ||
    blob.includes('veterinary')
  );
}
