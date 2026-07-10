import { apiClient } from '@/lib/api-client';
import { compressProductImage } from '@/lib/compress-product-image';

export type ProductImageUploadResult = {
  s3_url: string;
  fileKey: string;
  displayUrl: string;
};

export async function uploadProductImage(
  vendorId: string,
  file: File,
): Promise<ProductImageUploadResult> {
  const compressed = await compressProductImage(file);
  const fd = new FormData();
  fd.append('image', compressed);

  const response = await apiClient.post<{
    s3_url?: string;
    image_url?: string;
    url?: string;
    fileKey?: string;
    imageKey?: string;
    asset?: { imageKey?: string };
    error?: string;
  }>(`/vendor/${vendorId}/products/images`, fd);

  if (response?.error) {
    throw new Error(response.error);
  }

  const fileKey =
    response.fileKey || response.imageKey || response.asset?.imageKey || '';
  const displayUrl = response.image_url || response.url || '';
  const s3_url = fileKey || response.s3_url || displayUrl;

  if (!s3_url && !displayUrl) {
    throw new Error('Upload succeeded but no image URL was returned');
  }

  return {
    s3_url: fileKey || s3_url,
    fileKey,
    displayUrl: displayUrl || s3_url,
  };
}

export async function deletePendingProductImage(
  vendorId: string,
  fileKey: string,
): Promise<void> {
  if (!fileKey?.trim()) return;
  await apiClient.delete(`/vendor/${vendorId}/products/images`, {
    fileKey: fileKey.trim(),
  });
}

/** Register URLs (stable + presigned display) for a pending session upload. */
export function registerPendingProductImageKey(
  pendingKeysByUrl: Map<string, string>,
  urls: string[],
  fileKey: string,
): void {
  if (!fileKey) return;
  for (const url of urls) {
    if (url) pendingKeysByUrl.set(url, fileKey);
  }
}

/** Remove one pending upload from S3 and drop all URL aliases for that fileKey. */
export async function removePendingProductImageByUrl(
  vendorId: string,
  pendingKeysByUrl: Map<string, string>,
  url: string,
): Promise<void> {
  const fileKey = pendingKeysByUrl.get(url);
  if (!fileKey) return;
  for (const [u, k] of [...pendingKeysByUrl.entries()]) {
    if (k === fileKey) pendingKeysByUrl.delete(u);
  }
  try {
    await deletePendingProductImage(vendorId, fileKey);
  } catch (error) {
    console.warn('Failed to delete pending product image from S3:', error);
  }
}

/** Discard every pending session upload (modal cancel / close without save). */
export async function discardAllPendingProductImages(
  vendorId: string,
  pendingKeysByUrl: Map<string, string>,
): Promise<void> {
  const keys = [...new Set(pendingKeysByUrl.values())];
  pendingKeysByUrl.clear();
  await Promise.all(
    keys.map((key) =>
      deletePendingProductImage(vendorId, key).catch((error) => {
        console.warn('Failed to discard pending product image from S3:', error);
      }),
    ),
  );
}
