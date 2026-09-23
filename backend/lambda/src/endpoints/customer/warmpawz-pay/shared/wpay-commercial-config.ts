import type { WpayVendorListDbRow } from '../repos/wpay-vendors-list.repo';

export type WpayCommercialModel = 'tier_commission' | 'withhold';

export type WpayVendorCommercialConfig = {
  commercialModel: WpayCommercialModel;
  tierId: string | null;
  tierName: string | null;
  commissionPercent: number;
  platformWithholdPercent: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function readPercent(raw: string | number | null | undefined): number {
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? round2(n) : 0;
}

/** Resolve published vendor commercial config for Pay Bill (tier commission vs historical withhold). */
export function resolveWpayVendorCommercialConfig(row: WpayVendorListDbRow): WpayVendorCommercialConfig {
  const tierId = row.pricing_tier_id ? String(row.pricing_tier_id) : null;
  const commissionPercent = readPercent(row.pricing_commission_rate);
  const platformWithholdPercent = readPercent(row.pricing_platform_withhold_percent);

  if (tierId && commissionPercent > 0) {
    return {
      commercialModel: 'tier_commission',
      tierId,
      tierName: row.pricing_tier_name ? String(row.pricing_tier_name) : null,
      commissionPercent,
      platformWithholdPercent: 0,
    };
  }

  return {
    commercialModel: 'withhold',
    tierId: null,
    tierName: null,
    commissionPercent: 0,
    platformWithholdPercent,
  };
}
