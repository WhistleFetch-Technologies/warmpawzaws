/** Shared types/helpers for GET /vendor/:id/commission-analytics (Seller Hub). */

export type VendorCommissionTier = {
  name: string;
  level: number;
  commissionRate: number;
  minMonthlyRevenue: number;
  maxMonthlyRevenue: number | null;
  isCurrent: boolean;
};

export type VendorCommissionAnalytics = {
  commissionRate: number | null;
  commissionRateSource: string | null;
  commissionConfigured: boolean;
  commissionMissing: string[];
  gstRate: number;
  totalRevenue: number;
  totalCommission: number;
  netEarnings: number;
  pendingPayout: number;
  settledPayout?: number;
  monthlyRevenue?: number;
  currentTier?: { name: string; level: number; commissionRate: number } | null;
  tiers: VendorCommissionTier[];
};

const COMMISSION_SOURCE_LABELS: Record<string, string> = {
  product_override: 'Product-specific rate',
  vendor_category: 'Category rate',
  vendor_own_brand: 'Own brand rate',
  vendor_third_party: 'Third-party rate',
  vendor_default: 'Your default shop rate',
  category_default: 'Category default',
  platform_default: 'Platform default',
};

function safeNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeRate(v: unknown): number | null {
  const n = safeNum(v, NaN);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

export function parseVendorCommissionAnalytics(data: unknown): VendorCommissionAnalytics | null {
  if (!data || typeof data !== 'object') return null;
  const body = data as Record<string, unknown>;

  const configured = body.commissionConfigured === true;
  const rawRate = body.commissionRate;
  const commissionRate =
    rawRate === null || rawRate === undefined ? null : safeRate(rawRate);

  const tiersRaw = body.tiers;
  const tiers: VendorCommissionTier[] = Array.isArray(tiersRaw)
    ? tiersRaw
        .map((row) => {
          if (!row || typeof row !== 'object') return null;
          const t = row as Record<string, unknown>;
          return {
            name: String(t.name ?? ''),
            level: safeNum(t.level, 0),
            commissionRate: safeNum(t.commissionRate, 0),
            minMonthlyRevenue: safeNum(t.minMonthlyRevenue, 0),
            maxMonthlyRevenue:
              t.maxMonthlyRevenue == null || t.maxMonthlyRevenue === ''
                ? null
                : safeNum(t.maxMonthlyRevenue, 0),
            isCurrent: Boolean(t.isCurrent),
          };
        })
        .filter((t): t is VendorCommissionTier => t != null)
    : [];

  const currentTierRaw = body.currentTier;
  const currentTier =
    currentTierRaw && typeof currentTierRaw === 'object'
      ? {
          name: String((currentTierRaw as Record<string, unknown>).name ?? ''),
          level: safeNum((currentTierRaw as Record<string, unknown>).level, 0),
          commissionRate: safeNum((currentTierRaw as Record<string, unknown>).commissionRate, 0),
        }
      : null;

  return {
    commissionRate: configured ? commissionRate : null,
    commissionRateSource:
      configured && body.commissionRateSource != null
        ? String(body.commissionRateSource)
        : null,
    commissionConfigured: configured,
    commissionMissing: Array.isArray(body.commissionMissing)
      ? body.commissionMissing.map(String)
      : [],
    gstRate: safeNum(body.gstRate, 0),
    totalRevenue: safeNum(body.totalRevenue, 0),
    totalCommission: safeNum(body.totalCommission, 0),
    netEarnings: safeNum(body.netEarnings, 0),
    pendingPayout: safeNum(body.pendingPayout, 0),
    settledPayout: safeNum(body.settledPayout, 0),
    monthlyRevenue: safeNum(body.monthlyRevenue, 0),
    currentTier,
    tiers,
  };
}

export function formatCommissionRateDisplay(
  rate: number | null,
  configured: boolean
): string {
  if (!configured || rate == null) return '—';
  const rounded = Math.round(rate * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

export function formatCommissionRateSource(source: string | null): string | null {
  if (!source) return null;
  return COMMISSION_SOURCE_LABELS[source] ?? source.replace(/_/g, ' ');
}
