import { apiClient } from '@/lib/api-client';
import { readStoredCustomerDiscoveryCoords } from '@/lib/customer-discovery-coords';
import type { VendorFeedbackPrompt, VendorFeedbackSourceType } from './types';

const BASE = '/customer/vendor-feedback';

export async function fetchVendorFeedbackPrompt(): Promise<VendorFeedbackPrompt | null> {
  const { latitude, longitude } = readStoredCustomerDiscoveryCoords();
  const qs =
    latitude && longitude
      ? `?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`
      : '';
  const res = await apiClient.get<{ success?: boolean; prompt?: VendorFeedbackPrompt | null }>(
    `${BASE}/prompt${qs}`,
    { maxRetries: 0 }
  );
  return res?.prompt ?? null;
}

export async function submitVendorFeedback(input: {
  sourceType: VendorFeedbackSourceType;
  sourceId: string;
  rating: number;
  comment: string;
}): Promise<void> {
  await apiClient.post(BASE, {
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    rating: input.rating,
    comment: input.comment.trim() || null,
  }, { maxRetries: 0 });
}

export async function dismissVendorFeedback(input: {
  sourceType: VendorFeedbackSourceType;
  sourceId: string;
}): Promise<void> {
  await apiClient.post(`${BASE}/dismiss`, input, { maxRetries: 0 });
}
