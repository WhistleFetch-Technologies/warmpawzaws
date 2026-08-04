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
  hoursOperator?: string;
  hoursThreshold?: number;
};

/** Normalize tiers before PUT so hours edits are not overwritten by legacy cancellation_window. */
export function normalizeWapptPolicyTiersForSave(tiers: WapptPolicyTier[]): WapptPolicyTier[] {
  const customerGteHours = tiers
    .filter((t) => (t.cancelledBy ?? 'pet_parent') === 'pet_parent' && (t.refundPercentage ?? 0) > 0)
    .map((t) => t.hoursBeforeService ?? 24);

  return tiers.map((tier) => {
    if ((tier.cancelledBy ?? 'pet_parent') !== 'pet_parent') return tier;

    const refund = tier.refundPercentage ?? 0;
    if (refund <= 0) {
      const threshold =
        customerGteHours.length > 0 ? Math.max(...customerGteHours) : tier.hoursBeforeService ?? 1;
      return {
        ...tier,
        cancellationWindow: undefined,
        hoursBeforeService: 0,
        hoursOperator: 'lt',
        hoursThreshold: threshold,
      };
    }

    const hours = tier.hoursBeforeService ?? 24;
    return {
      ...tier,
      cancellationWindow: undefined,
      hoursOperator: 'gte',
      hoursThreshold: hours,
    };
  });
}

export async function fetchWapptPlatformPolicyTiers() {
  const res = await apiClient.get<{ success?: boolean; data?: { tiers?: WapptPolicyTier[] } }>(
    '/admin/warmpawz-appointments/policies/platform-default',
  );
  return res?.data?.tiers ?? [];
}

export async function saveWapptPlatformPolicyTiers(tiers: WapptPolicyTier[]) {
  const normalized = normalizeWapptPolicyTiersForSave(tiers);
  return apiClient.put('/admin/warmpawz-appointments/policies/platform-default', { tiers: normalized });
}

export async function fetchWapptCategoryPolicyTiers(category: string) {
  const res = await apiClient.get<{ success?: boolean; data?: { tiers?: WapptPolicyTier[] } }>(
    `/admin/warmpawz-appointments/policies/categories/${encodeURIComponent(category)}`,
  );
  return res?.data?.tiers ?? [];
}

export async function saveWapptCategoryPolicyTiers(category: string, tiers: WapptPolicyTier[]) {
  const normalized = normalizeWapptPolicyTiersForSave(tiers);
  return apiClient.put(
    `/admin/warmpawz-appointments/policies/categories/${encodeURIComponent(category)}`,
    { tiers: normalized },
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
