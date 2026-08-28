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
  convenienceFee: number;
  convenienceGstRate: number;
  platformGstRate: number;
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
