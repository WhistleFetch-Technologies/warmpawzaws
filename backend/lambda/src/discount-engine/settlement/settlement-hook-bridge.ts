import type { DiscountSettlementPreview } from '../models/discount-result';
import { isSettlementAuthoritative } from './settlement-mode';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseJsonObject(raw: unknown): Record<string, unknown> | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      return typeof o === 'object' && o != null && !Array.isArray(o) ? (o as Record<string, unknown>) : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Parse `wp_financial_meta:{...}` from booking notes / metadata. */
export function parseBookingFinancialMeta(
  booking: Record<string, unknown>
): Record<string, unknown> | undefined {
  const direct = parseJsonObject(booking.financial_meta ?? booking.financialMeta);
  if (direct) return direct;

  const notes = String(booking.notes ?? booking.internal_notes ?? '');
  const marker = 'wp_financial_meta:';
  const idx = notes.indexOf(marker);
  if (idx === -1) return undefined;
  try {
    return JSON.parse(notes.slice(idx + marker.length)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export function extractSettlementPreviewFromBooking(
  booking: Record<string, unknown>
): DiscountSettlementPreview | undefined {
  const financial = parseBookingFinancialMeta(booking);
  if (financial) {
    const fromMeta = readSettlementPreviewFromMetadata(financial);
    if (fromMeta) return fromMeta;
  }
  return readSettlementPreviewFromMetadata(booking.metadata ?? booking.settlement_metadata);
}

/**
 * When settlement mode is AUTHORITATIVE, reduce commissionable gross by vendor + shared-vendor discount shares.
 * Legacy hooks call this before tier commission math — no duplicate payout logic.
 */
export function applySettlementPreviewToCommissionableGross(
  legacyGross: number,
  preview?: DiscountSettlementPreview | null
): number {
  if (!isSettlementAuthoritative() || !preview) {
    return legacyGross;
  }

  const vendorShare =
    (preview.vendorDiscountShare ?? preview.vendorCost ?? 0) +
    (preview.sharedDiscountShare?.vendor ?? 0);

  if (vendorShare <= 0) {
    return legacyGross;
  }

  return roundMoney(Math.max(0, legacyGross - vendorShare));
}

/** Serialize preview for vendor_earnings / delivery_settlements metadata columns. */
export function buildSettlementMetadataForLedger(
  preview?: DiscountSettlementPreview | null
): Record<string, unknown> | undefined {
  if (!preview || !isSettlementAuthoritative()) return undefined;

  return {
    settlement_preview: {
      vendorReceivable: preview.vendorReceivable,
      vendorDiscountShare: preview.vendorDiscountShare ?? preview.vendorCost,
      platformDiscountShare: preview.platformDiscountShare ?? preview.platformCost,
      sharedDiscountShare: preview.sharedDiscountShare,
      netSettlement: preview.netSettlement,
      policyFingerprint: preview.policyFingerprint,
      settlementVersion: preview.settlementVersion,
      appliedFunding: preview.appliedFunding,
    },
    funding_breakdown: preview.appliedFunding,
    audit_reference: preview.policyFingerprint,
  };
}

export function readSettlementPreviewFromMetadata(
  metadata: unknown
): DiscountSettlementPreview | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const raw = (metadata as Record<string, unknown>).settlement_preview;
  if (!raw || typeof raw !== 'object') return undefined;
  return raw as DiscountSettlementPreview;
}
