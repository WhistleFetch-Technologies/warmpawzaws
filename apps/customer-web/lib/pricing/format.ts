import { hasEffectivePriceReduction } from '@warmpawz/shared-types';

export function formatInr(amount: number, options?: { decimals?: number }): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '₹0';
  const decimals = options?.decimals ?? (Math.abs(n - Math.round(n)) < 0.01 ? 0 : 2);
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function computeDiscountPercent(original: number, current: number): number | undefined {
  if (!hasEffectivePriceReduction(original, current) || original <= 0) return undefined;
  return Math.round(((original - current) / original) * 100);
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
