function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Overlay promo-engine discount on a Pay Bill quote that was built without engine D.
 * Prefer resolveWpayPayQuote({ engineDiscount }) so fees use the same D.
 * Kept for unit coverage / legacy callers.
 */
export function applyEngineDiscountToWpayPayable(params: {
  quotedAmount: number;
  cataloguePayable: number;
  engineDiscount: number;
  metadata: Record<string, unknown>;
}): {
  payableAmount: number;
  discountAmount: number;
  metadata: Record<string, unknown>;
} {
  const engine = Math.max(0, round2(Number(params.engineDiscount) || 0));
  const cataloguePayable = round2(Number(params.cataloguePayable) || 0);
  const minPayable = cataloguePayable > 0 ? Math.min(cataloguePayable, 1) : 0;
  const maxDiscount = Math.max(0, round2(cataloguePayable - minPayable));
  const discountAmount = Math.min(engine, maxDiscount);
  const payableAmount = round2(Math.max(minPayable, cataloguePayable - discountAmount));
  const quotedAmount = Number(params.quotedAmount) || 0;
  const discountPercent = quotedAmount > 0 ? round2((discountAmount / quotedAmount) * 100) : 0;

  const metadata: Record<string, unknown> = {
    ...params.metadata,
    quotedDiscountAmount: discountAmount,
    quotedDiscountPercent: discountPercent,
    engineDiscountAmount: discountAmount,
  };
  if (metadata.payNowAmount != null || metadata.commercialModel === 'tier_commission') {
    metadata.payNowAmount = payableAmount;
  }
  const gross = Number(metadata.grossCommissionAmount);
  if (Number.isFinite(gross)) {
    metadata.wpayRevenueAmount = round2(Math.max(0, gross - discountAmount));
  }

  return { payableAmount, discountAmount, metadata };
}
