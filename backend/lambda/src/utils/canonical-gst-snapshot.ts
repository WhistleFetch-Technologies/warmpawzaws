/**
 * Authoritative customer GST snapshot.
 * Calculated once at transaction creation, then copied — never 50/50-reconstructed
 * when jurisdiction is unknown.
 */

import { isGstInterstateSupply, resolveGstStateKey } from '../lib/gst-place-of-supply';
import type { TaxCalculationResult } from '../lib/services/tax-calculation-service';

export type CanonicalGstSnapshot = {
  taxableAmount: number;
  gstRate: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  isInterState: boolean;
  splitAvailable: boolean;
};

export type GstLocation = {
  state?: string;
  city?: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function money(raw: unknown): number {
  const n = parseFloat(String(raw ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? round2(n) : 0;
}

/** Persist convention: split from rounded GST total so cgst+sgst+igst = gst. */
export function applyCanonicalGstSplit(
  gstAmount: number,
  isInterState: boolean,
): { cgstAmount: number; sgstAmount: number; igstAmount: number; gstAmount: number } {
  const gst = money(gstAmount);
  if (gst <= 0.009) {
    return { cgstAmount: 0, sgstAmount: 0, igstAmount: 0, gstAmount: 0 };
  }
  if (isInterState) {
    return { cgstAmount: 0, sgstAmount: 0, igstAmount: gst, gstAmount: gst };
  }
  const cgstAmount = round2(gst / 2);
  const sgstAmount = round2(gst - cgstAmount);
  return { cgstAmount, sgstAmount, igstAmount: 0, gstAmount: gst };
}

export function buildCanonicalGstSnapshot(params: {
  taxableAmount: number;
  gstRate: number;
  isInterState: boolean;
}): CanonicalGstSnapshot {
  const taxableAmount = money(params.taxableAmount);
  const gstRate = money(params.gstRate);
  const gstAmount = money((taxableAmount * gstRate) / 100);
  const split = applyCanonicalGstSplit(gstAmount, params.isInterState);
  return {
    taxableAmount,
    gstRate,
    gstAmount: split.gstAmount,
    cgstAmount: split.cgstAmount,
    sgstAmount: split.sgstAmount,
    igstAmount: split.igstAmount,
    isInterState: params.isInterState,
    splitAvailable: true,
  };
}

export function snapshotFromTaxResult(
  taxResult: TaxCalculationResult,
  taxableAmount?: number,
): CanonicalGstSnapshot {
  const taxable = money(taxableAmount ?? taxResult.subtotal);
  const gstAmount = money(taxResult.totalTax);
  const rate =
    taxable > 0.009 && gstAmount > 0.009
      ? round2((gstAmount / taxable) * 100)
      : money(taxResult.items?.[0]?.gstRate);
  const split = applyCanonicalGstSplit(gstAmount, Boolean(taxResult.isInterstate));
  return {
    taxableAmount: taxable,
    gstRate: rate,
    gstAmount: split.gstAmount,
    cgstAmount: split.cgstAmount,
    sgstAmount: split.sgstAmount,
    igstAmount: split.igstAmount,
    isInterState: Boolean(taxResult.isInterstate),
    splitAvailable: true,
  };
}

export function resolveCanonicalInterstate(
  customer: GstLocation | null | undefined,
  vendor: GstLocation | null | undefined,
): boolean {
  const customerKey = resolveGstStateKey(customer?.state, customer?.city);
  const vendorKey = resolveGstStateKey(vendor?.state, vendor?.city);
  return isGstInterstateSupply(customerKey, vendorKey);
}

export function hasCompleteGstSplit(params: {
  gstAmount?: unknown;
  cgstAmount?: unknown;
  sgstAmount?: unknown;
  igstAmount?: unknown;
}): boolean {
  const gst = money(params.gstAmount);
  const cgst = money(params.cgstAmount);
  const sgst = money(params.sgstAmount);
  const igst = money(params.igstAmount);
  const splitSum = round2(cgst + sgst + igst);
  if (gst <= 0.009 && splitSum <= 0.009) return true;
  if (splitSum <= 0.009) return false;
  if (Math.abs(splitSum - (gst > 0.009 ? gst : splitSum)) > 0.02) return false;
  const intra = cgst > 0.009 && sgst > 0.009 && igst <= 0.009;
  const inter = igst > 0.009 && cgst <= 0.009 && sgst <= 0.009;
  return intra || inter;
}

/**
 * Payment lock: a backend-authoritative snapshot (including GST = 0%) must lock.
 * Do not use gstAmount > 0 as proof the snapshot exists — 0% is a valid Admin rate.
 */
export function isBackendAuthoritativeGstLock(params: {
  gstAuthority?: string | null;
  lockedSnap: { splitAvailable?: boolean; gstAmount?: number } | null;
  gstAmount?: unknown;
  cgstAmount?: unknown;
  sgstAmount?: unknown;
  igstAmount?: unknown;
}): boolean {
  if (String(params.gstAuthority || '').trim().toLowerCase() !== 'backend') return false;
  if (!params.lockedSnap || params.lockedSnap.splitAvailable !== true) return false;
  return hasCompleteGstSplit({
    gstAmount: params.gstAmount,
    cgstAmount: params.cgstAmount,
    sgstAmount: params.sgstAmount,
    igstAmount: params.igstAmount,
  });
}

export function readAuthoritativeGst(row: {
  gstAmount?: unknown;
  gst_amount?: unknown;
  totalTax?: unknown;
  total_tax?: unknown;
  cgstAmount?: unknown;
  cgst_amount?: unknown;
  cgst?: unknown;
  sgstAmount?: unknown;
  sgst_amount?: unknown;
  sgst?: unknown;
  igstAmount?: unknown;
  igst_amount?: unknown;
  igst?: unknown;
  isInterState?: unknown;
  is_inter_state?: unknown;
  taxableAmount?: unknown;
  taxable_amount?: unknown;
  gstRate?: unknown;
  gst_rate?: unknown;
}): CanonicalGstSnapshot {
  const cgst = money(row.cgstAmount ?? row.cgst_amount ?? row.cgst);
  const sgst = money(row.sgstAmount ?? row.sgst_amount ?? row.sgst);
  const igst = money(row.igstAmount ?? row.igst_amount ?? row.igst);
  const splitSum = round2(cgst + sgst + igst);
  const gstAmount = splitSum > 0.009 ? splitSum : money(row.gstAmount ?? row.gst_amount ?? row.totalTax ?? row.total_tax);
  const interRaw = row.isInterState ?? row.is_inter_state;
  const interKnown =
    interRaw === true ||
    interRaw === false ||
    interRaw === 't' ||
    interRaw === 'f' ||
    interRaw === 'true' ||
    interRaw === 'false';
  const isInterState =
    interRaw === true || interRaw === 't' || interRaw === 'true';

  if (hasCompleteGstSplit({ gstAmount, cgstAmount: cgst, sgstAmount: sgst, igstAmount: igst })) {
    return {
      taxableAmount: money(row.taxableAmount ?? row.taxable_amount),
      gstRate: money(row.gstRate ?? row.gst_rate),
      gstAmount,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
      isInterState: igst > 0.009,
      splitAvailable: true,
    };
  }

  if (gstAmount > 0.009 && interKnown) {
    const split = applyCanonicalGstSplit(gstAmount, isInterState);
    return {
      taxableAmount: money(row.taxableAmount ?? row.taxable_amount),
      gstRate: money(row.gstRate ?? row.gst_rate),
      ...split,
      isInterState,
      splitAvailable: true,
    };
  }

  return {
    taxableAmount: money(row.taxableAmount ?? row.taxable_amount),
    gstRate: money(row.gstRate ?? row.gst_rate),
    gstAmount,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    isInterState: false,
    splitAvailable: false,
  };
}

export function snapshotToPaymentColumns(snap: CanonicalGstSnapshot): Record<string, unknown> {
  return {
    gst_amount: snap.gstAmount,
    cgst_amount: snap.cgstAmount,
    sgst_amount: snap.sgstAmount,
    igst_amount: snap.igstAmount,
    is_inter_state: snap.isInterState,
    taxable_amount: snap.taxableAmount,
    gst_rate: snap.gstRate,
  };
}

export function snapshotToFinancialMeta(snap: CanonicalGstSnapshot): {
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  isInterState: boolean;
  taxableAmount: number;
  gstRate: number;
  gstAuthority: 'backend';
} {
  return {
    cgst: snap.cgstAmount,
    sgst: snap.sgstAmount,
    igst: snap.igstAmount,
    totalTax: snap.gstAmount,
    isInterState: snap.isInterState,
    taxableAmount: snap.taxableAmount,
    gstRate: snap.gstRate,
    gstAuthority: 'backend',
  };
}
