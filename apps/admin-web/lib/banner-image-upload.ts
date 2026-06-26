import { apiClient, isUatMode } from '@/lib/api-client';
import {
  BANNER_S3_KEY_PREFIX,
  isManagedBannerStorageKey,
} from '@/lib/compress-banner-image';

export type BannerImageUploadResult = {
  fileKey: string;
  imageUrl: string;
};

export async function fetchBannerImagePreviewUrl(storedValue: string): Promise<string> {
  const trimmed = String(storedValue ?? '').trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  if (isManagedBannerStorageKey(trimmed) || trimmed.includes('/')) {
    const response = await apiClient.get<{ url?: string; signedUrl?: string }>(
      `/storage/presigned-url?fileKey=${encodeURIComponent(trimmed)}`
    );
    return response?.url || response?.signedUrl || trimmed;
  }

  return trimmed;
}

export async function uploadBannerImage(
  bannerId: string,
  file: File
): Promise<BannerImageUploadResult> {
  if (!bannerId?.trim()) {
    throw new Error('Banner ID is required before uploading an image');
  }

  const formData = new FormData();
  formData.append('file', file);

  const baseUrl = apiClient.getBaseUrl();
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminAuthToken') : null;

  const response = await fetch(`${baseUrl}/admin/banners/${encodeURIComponent(bannerId)}/image`, {
    method: 'POST',
    body: formData,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(isUatMode() ? { 'X-UAT-Mode': 'true' } : {}),
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(errorData.error || 'Failed to upload banner image');
  }

  const payload = (await response.json()) as BannerImageUploadResult & { success?: boolean };
  const fileKey = String(payload.fileKey || payload.imageUrl || '').trim();
  if (!fileKey.startsWith(BANNER_S3_KEY_PREFIX)) {
    throw new Error('Upload succeeded but no banner image key was returned');
  }

  return { fileKey, imageUrl: fileKey };
}

export function bannerImageKeyForId(bannerId: string): string {
  return `${BANNER_S3_KEY_PREFIX}${bannerId}.webp`;
}
