export function roundWpayMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function clampWpayWithholdPercent(raw: unknown): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return roundWpayMoney(Math.min(100, n));
}

export type WpayVendorSettlementBreakdown = {
  platformWithholdPercent: number;
  platformWithholdAmount: number;
  vendorSettlementAmount: number;
};

export function computeWpayVendorSettlement(
  payableAmount: number,
  withholdPercent: number,
): WpayVendorSettlementBreakdown {
  const payable = roundWpayMoney(Number(payableAmount) || 0);
  const percent = clampWpayWithholdPercent(withholdPercent);
  const platformWithholdAmount = roundWpayMoney((payable * percent) / 100);
  const vendorSettlementAmount = roundWpayMoney(Math.max(0, payable - platformWithholdAmount));
  return {
    platformWithholdPercent: percent,
    platformWithholdAmount,
    vendorSettlementAmount,
  };
}
