import { apiClient } from '@/lib/api-client';

export type WapptPolicyTier = {
  id?: string;
  name: string;
  cancelledBy?: string;
  refundPercentage?: number;
  hoursBeforeService?: number;
  cancellationFee?: number;
  serviceLocation?: string;
  cancellationWindow?: string;
  vendorCancellationReason?: string;
};

export async function fetchWapptPlatformPolicyTiers() {
  const res = await apiClient.get<{ success?: boolean; data?: { tiers?: WapptPolicyTier[] } }>(
    '/admin/warmpawz-appointments/policies/platform-default',
  );
  return res?.data?.tiers ?? [];
}

export async function saveWapptPlatformPolicyTiers(tiers: WapptPolicyTier[]) {
  return apiClient.put('/admin/warmpawz-appointments/policies/platform-default', { tiers });
}

export async function fetchWapptCategoryPolicyTiers(category: string) {
  const res = await apiClient.get<{ success?: boolean; data?: { tiers?: WapptPolicyTier[] } }>(
    `/admin/warmpawz-appointments/policies/categories/${encodeURIComponent(category)}`,
  );
  return res?.data?.tiers ?? [];
}

export async function saveWapptCategoryPolicyTiers(category: string, tiers: WapptPolicyTier[]) {
  return apiClient.put(
    `/admin/warmpawz-appointments/policies/categories/${encodeURIComponent(category)}`,
    { tiers },
  );
}

export const WAPPT_POLICY_CATEGORIES = [
  'vet',
  'grooming',
  'training',
  'behaviorist',
  'walker',
  'boarding',
  'sitting',
  'nutrition',
] as const;
