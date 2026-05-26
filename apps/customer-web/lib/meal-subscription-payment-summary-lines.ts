import type { MealSubscriptionSummaryLine } from '@/components/customer/payment/MealSubscriptionPaymentSummary';

export function parsePricingSnapshot(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      return typeof o === 'object' && o != null && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function n(v: unknown): number {
  const x = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(x) ? x : 0;
}

/**
 * Builds human-readable lines for {@link UniversalPaymentPage} when paying for a canonical meal subscription.
 */
export function buildMealSubscriptionSummaryLinesFromRow(
  sub: Record<string, unknown>,
): MealSubscriptionSummaryLine[] {
  const snap = parsePricingSnapshot(sub.pricing_snapshot);
  const purchaseType = String(sub.purchase_type || '').toUpperCase();
  const planLabel =
    purchaseType === 'MONTHLY_PLAN' ? 'Monthly' : purchaseType === 'WEEKLY_PLAN' ? 'Weekly' : purchaseType || '—';
  const lines: MealSubscriptionSummaryLine[] = [{ label: 'Billing cadence', valueText: planLabel }];

  const totalSessions = n(sub.total_sessions);
  if (totalSessions > 0) {
    lines.push({ label: 'Sessions (this signup)', valueText: String(Math.round(totalSessions)) });
  }

  const tsu = snap ? n(snap.totalSessionsUsed) : 0;
  const perFood = snap ? n(snap.perSessionFoodSubtotal) : 0;
  if (snap && tsu > 0 && perFood > 0) {
    const food = Math.round(perFood * tsu * 100) / 100;
    lines.push({ label: `Food estimate (× ${tsu} sessions)`, amountInr: food });
  }

  if (snap && snap.totalDeliveryFeeUpfront != null) {
    const d = n(snap.totalDeliveryFeeUpfront);
    if (d > 0) {
      lines.push({ label: 'Delivery (upfront)', amountInr: d });
    } else {
      lines.push({ label: 'Delivery (upfront)', valueText: '—', muted: true });
    }
  }

  const upfront = snap ? n(snap.upfrontTotalAmount) : 0;
  if (lines.length >= 2 && upfront > 0) {
    const known = lines
      .filter((l) => l.amountInr != null && Number.isFinite(l.amountInr))
      .reduce((s, l) => s + (l.amountInr as number), 0);
    const other = Math.max(0, Math.round((upfront - known) * 100) / 100);
    if (other > 0.009) {
      lines.push({ label: 'Platform & convenience (signup)', amountInr: other });
    }
  }

  return lines;
}

export function upfrontTotalInrFromSubscriptionRow(sub: Record<string, unknown>): number {
  const snap = parsePricingSnapshot(sub.pricing_snapshot);
  const fromSnap = snap ? n(snap.upfrontTotalAmount) : 0;
  if (fromSnap > 0) return Math.round(fromSnap * 100) / 100;
  return 0;
}

/** Canonical subscription row: pricing JSON lives in `pricing_snapshot` only. */
export function pricingSnapshotFromSubscriptionRow(sub: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!sub) return null;
  return parsePricingSnapshot(sub.pricing_snapshot);
}

/** Platform/convenience upfront: newer snapshots set `*Upfront`; older rows derive from per-cycle × billing cycles. */
export function subscriptionPlatformConvenienceUpfrontFromSnap(snap: Record<string, unknown> | null): {
  platformFee: number;
  convenienceFee: number;
} {
  if (!snap) return { platformFee: 0, convenienceFee: 0 };
  const bc = Math.max(1, n(snap.billingCycles));
  const platformFee =
    n(snap.platformFeeUpfront) > 0.009
      ? n(snap.platformFeeUpfront)
      : Math.round(n(snap.platformFeePerCycle) * bc * 100) / 100;
  const convenienceFee =
    n(snap.convenienceFeeUpfront) > 0.009
      ? n(snap.convenienceFeeUpfront)
      : Math.round(n(snap.convenienceFeePerCycle) * bc * 100) / 100;
  return { platformFee, convenienceFee };
}
