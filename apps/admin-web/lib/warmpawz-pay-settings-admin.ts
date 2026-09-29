import { apiClient } from '@/lib/api-client';

export interface WpayEligibleTier {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly commissionRate: number;
  readonly warmpawzPayEnabled: boolean;
  readonly isActive: boolean;
}

export async function fetchWpayEligibleTiers(): Promise<WpayEligibleTier[]> {
  const data = await apiClient.get<{ tiers?: WpayEligibleTier[]; data?: { tiers?: WpayEligibleTier[] } }>(
    '/admin/payments/tiers?warmpawzPayEnabled=true&isActive=true',
  );
  const raw = (data as { data?: { tiers?: WpayEligibleTier[] } })?.data?.tiers ?? (data as { tiers?: WpayEligibleTier[] }).tiers;
  return Array.isArray(raw) ? raw : [];
}

export type WpayFeeMode = 'fixed' | 'percent';

/** Pay Bill charges platform fee + GST only (convenience fee retired). */
export interface WpayConvenienceSettings {
  platformFee: number;
  /** fixed = ₹; percent = % of post-discount customer amount. */
  platformFeeMode: WpayFeeMode;
  platformFeeGstRate: number;
  /** Inclusive GST extract from platform revenue (C − D). */
  platformGstRate: number;
  /** Burn/test: vendor paid full Q; platform funds discount. */
  burnMode: boolean;
}

function pickSettings(raw: Partial<WpayConvenienceSettings> | null | undefined): WpayConvenienceSettings {
  return {
    platformFee: Number(raw?.platformFee) || 0,
    platformFeeMode: raw?.platformFeeMode === 'percent' ? 'percent' : 'fixed',
    platformFeeGstRate: Number(raw?.platformFeeGstRate ?? 18) || 0,
    platformGstRate: Number(raw?.platformGstRate ?? 18) || 0,
    burnMode: raw?.burnMode === true,
  };
}

function unwrap(
  data: WpayConvenienceSettings | { data?: WpayConvenienceSettings } | null | undefined,
): Partial<WpayConvenienceSettings> | undefined {
  if (data && typeof data === 'object' && 'data' in data && data.data) {
    return data.data;
  }
  return (data as WpayConvenienceSettings | undefined) ?? undefined;
}

export async function fetchWpayConvenienceSettings(): Promise<WpayConvenienceSettings> {
  const data = await apiClient.get<
    WpayConvenienceSettings | { data?: WpayConvenienceSettings; success?: boolean }
  >('/admin/warmpawz-pay/settings/convenience');
  return pickSettings(unwrap(data));
}

export async function updateWpayConvenienceSettings(
  payload: WpayConvenienceSettings,
): Promise<WpayConvenienceSettings> {
  const data = await apiClient.put<
    WpayConvenienceSettings | { data?: WpayConvenienceSettings }
  >('/admin/warmpawz-pay/settings/convenience', pickSettings(payload));
  return pickSettings(unwrap(data));
}
