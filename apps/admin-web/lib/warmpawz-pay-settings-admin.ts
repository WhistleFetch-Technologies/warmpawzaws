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

export interface WpayConvenienceSettings {
  platformFee: number;
  platformFeeGstRate: number;
  convenienceFee: number;
  convenienceGstRate: number;
  /** Inclusive GST extract from platform revenue (C − D). */
  platformGstRate: number;
  /** Burn/test: vendor paid full Q; platform funds discount. */
  burnMode: boolean;
}

export async function fetchWpayConvenienceSettings(): Promise<WpayConvenienceSettings> {
  const data = await apiClient.get<
    WpayConvenienceSettings | { data?: WpayConvenienceSettings; success?: boolean }
  >('/admin/warmpawz-pay/settings/convenience');
  if (data && typeof data === 'object' && 'data' in data && data.data) {
    return data.data;
  }
  return data as WpayConvenienceSettings;
}

export async function updateWpayConvenienceSettings(
  payload: WpayConvenienceSettings,
): Promise<WpayConvenienceSettings> {
  const data = await apiClient.put<
    WpayConvenienceSettings | { data?: WpayConvenienceSettings }
  >('/admin/warmpawz-pay/settings/convenience', payload);
  if (data && typeof data === 'object' && 'data' in data && data.data) {
    return data.data;
  }
  return data as WpayConvenienceSettings;
}
