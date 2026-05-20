/**
 * Enhanced Photo Upload Utility for Vendor Web with Progress Tracking and Validation
 */

import { apiClient, postJsonWithXhr } from './api-client';
import { fileMatchesAccept } from '@/lib/capacitor-file-pick';

export interface PhotoUploadOptions {
  onProgress?: (progress: number) => void;
  maxRetries?: number;
  verifyUpload?: boolean;
}

export interface PhotoUploadResult {
  success: boolean;
  url?: string;
  publicUrl?: string;
  fileName?: string;
  error?: string;
  retries?: number;
}

/**
 * Upload a single image to S3 via presigned PUT (same flow as staff photos).
 * @param folder S3 key prefix, e.g. `staff/{vendorId}` or `meal-products/{vendorId}`
 */
export async function uploadImageWithProgress(
  file: File,
  folder: string,
  options: PhotoUploadOptions = {}
): Promise<PhotoUploadResult> {
  const { onProgress, maxRetries = 3, verifyUpload = true } = options;
  let lastError: string | undefined;
  let retries = 0;

  if (!file || file.size === 0) {
    return {
      success: false,
      error: 'Invalid file: File is empty or not selected',
    };
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return {
      success: false,
      error: `File too large: Maximum size is ${(maxSize / 1024 / 1024).toFixed(0)}MB`,
    };
  }

  if (!fileMatchesAccept(file, 'image/*')) {
    return {
      success: false,
      error: 'Invalid file type: Only JPEG, PNG, WebP, GIF, and HEIC images are allowed',
    };
  }

  while (retries < maxRetries) {
    try {
      if (onProgress) onProgress(10);

      const fileType =
        file.type && file.type !== 'application/octet-stream' ? file.type : 'image/jpeg';

      const presignedResponse = await apiClient.post('/upload/presigned-url', {
        fileName: file.name || `photo-${Date.now()}.jpg`,
        fileType,
        folder,
      }) as any;

      if (presignedResponse?.error) {
        throw new Error(presignedResponse.error);
      }

      if (!presignedResponse?.presignedUrl) {
        throw new Error('Invalid response from server: missing upload URL');
      }

      if (onProgress) onProgress(30);

      // Step 2: Upload to S3 using presigned URL with progress
      const uploadResult = await uploadToS3WithProgress(
        presignedResponse.presignedUrl,
        file,
        fileType,
        (progress) => {
          if (onProgress) {
            // Map 0-100% to 30-90%
            onProgress(30 + (progress * 0.6));
          }
        }
      );

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'S3 upload failed');
      }

      if (onProgress) onProgress(95);

      // Step 3: Verify upload
      // Note: publicUrl may return 403 in dev due to bucket blocking public access
      // The upload itself succeeded, so we handle 403 gracefully
      if (verifyUpload && presignedResponse.publicUrl) {
        const verified = await verifyPhotoUpload(presignedResponse.publicUrl);
        if (!verified) {
          throw new Error('Upload verification failed');
        }
      }

      if (onProgress) onProgress(100);

      const displayUrl =
        (typeof presignedResponse.displayUrl === 'string' && presignedResponse.displayUrl) ||
        presignedResponse.publicUrl;
      return {
        success: true,
        url: displayUrl,
        publicUrl: presignedResponse.publicUrl,
        fileName: presignedResponse.fileKey,
        retries,
      };
    } catch (error: any) {
      lastError = error.message || 'Upload failed';
      retries++;

      if (onProgress) {
        onProgress(0);
      }

      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }
  }

  return {
    success: false,
    error: lastError || 'Upload failed after retries',
    retries,
  };
}

/** Staff directory under vendor (existing callers). */
export async function uploadStaffPhotoWithProgress(
  file: File,
  vendorId: string,
  options: PhotoUploadOptions = {}
): Promise<PhotoUploadResult> {
  return uploadImageWithProgress(file, `staff/${vendorId}`, options);
}

/**
 * Center / facility gallery photo (Dashboard → Gallery).
 * Uses presigned PUT + XHR so Capacitor Android WebView sends real bytes (multipart `fetch` often drops file bodies).
 * Returns `fileName` = S3 key under `vendors/{vendorId}/facility/…` for `PUT /vendor/facility/:id` { photos }.
 */
export async function uploadFacilityCenterPhotoWithProgress(
  file: File,
  vendorId: string,
  options: PhotoUploadOptions = {}
): Promise<PhotoUploadResult> {
  const safeId = String(vendorId || '').trim();
  if (!safeId) {
    return { success: false, error: 'Vendor ID is required' };
  }
  return uploadImageWithProgress(file, `vendors/${safeId}/facility`, {
    verifyUpload: false,
    ...options,
  });
}

export type FacilityCenterPhotosUploadResult = {
  uploadedCount: number;
  displayUrls?: string[];
  vendorId?: string;
};

/** Prefer vendors.id from localStorage (set after profile load) over route/identity id. */
export function resolveFacilityGalleryVendorId(propVendorId: string): string {
  if (typeof window === 'undefined') {
    return String(propVendorId || '').trim();
  }
  const stored = localStorage.getItem('vendorId')?.trim();
  return stored || String(propVendorId || '').trim();
}

function mimeForFacilityPhoto(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') {
    return file.type;
  }
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    heic: 'image/heic',
    heif: 'image/heif',
  };
  return map[ext] || 'image/jpeg';
}

/** Read image bytes as raw base64 (no data: prefix) for JSON upload on native WebViews. */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read photo data'));
        return;
      }
      const comma = result.indexOf(',');
      const base64 = comma >= 0 ? result.slice(comma + 1) : result;
      if (!base64) {
        reject(new Error('Photo data was empty'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Could not read photo from device'));
    reader.readAsDataURL(file);
  });
}

function parseFacilityUploadResponse(uploadData: {
  success?: boolean;
  error?: string;
  uploadedCount?: number;
  photoUrls?: string[];
  displayUrls?: string[];
  vendorId?: string;
  skipped?: string[];
}): FacilityCenterPhotosUploadResult {
  const uploadedCount =
    uploadData.uploadedCount ??
    (Array.isArray(uploadData.photoUrls) ? uploadData.photoUrls.length : 0);

  if (!uploadData.success && uploadedCount === 0) {
    const detail =
      uploadData.skipped?.length && uploadData.skipped[0]
        ? `${uploadData.error || 'Upload failed'} (${uploadData.skipped[0]})`
        : uploadData.error || 'Upload failed';
    throw new Error(detail);
  }
  if (uploadedCount === 0) {
    throw new Error(
      uploadData.error ||
        'No photos were saved. The file may be empty on this device — try another photo.'
    );
  }

  return {
    uploadedCount,
    displayUrls: Array.isArray(uploadData.displayUrls) ? uploadData.displayUrls.filter(Boolean) : undefined,
    vendorId: uploadData.vendorId,
  };
}

const facilityUploadPath = (vendorId: string) =>
  `/vendor/facility/${encodeURIComponent(vendorId)}/upload-photos`;

export type FacilityCenterPhotoPayload = {
  base64: string;
  fileName: string;
  mimeType: string;
};

/**
 * Upload center gallery photos (Dashboard → Gallery → Center photos).
 * Always JSON base64 — multipart FormData is unreliable on Capacitor Android WebView.
 * Pass `payloads` from Camera.getPhoto base64 to skip File round-trips.
 */
export async function uploadFacilityCenterPhotos(
  vendorId: string,
  files: File[],
  options?: {
    onProgress?: (percent: number) => void;
    /** Raw base64 from @capacitor/camera (one entry per file, same order). */
    payloads?: FacilityCenterPhotoPayload[];
  }
): Promise<FacilityCenterPhotosUploadResult> {
  const safeId = resolveFacilityGalleryVendorId(vendorId);
  if (!safeId) {
    throw new Error('Vendor ID is required');
  }
  if (!options?.payloads?.length && !files.length) {
    throw new Error('No photos selected');
  }

  const endpoint = facilityUploadPath(safeId);

  const photos: FacilityCenterPhotoPayload[] = [];
  if (options?.payloads?.length) {
    photos.push(...options.payloads);
  } else if (files.length) {
    for (const file of files) {
      if (file.size === 0) {
        throw new Error(`${file.name || 'Photo'} is empty on this device`);
      }
      photos.push({
        base64: await readFileAsBase64(file),
        fileName: file.name || `photo-${Date.now()}.jpg`,
        mimeType: mimeForFacilityPhoto(file),
      });
    }
  }
  if (!photos.length) {
    throw new Error('No photo data to upload');
  }

  console.log(
    '[GALLERY] Uploading via JSON base64:',
    photos.map((p) => ({ name: p.fileName, b64Len: p.base64.length, mime: p.mimeType, vendorId: safeId }))
  );

  const uploadData = await postJsonWithXhr(endpoint, { photos }, options);
  const parsed = parseFacilityUploadResponse(uploadData);
  if (parsed.vendorId && typeof window !== 'undefined' && parsed.vendorId !== localStorage.getItem('vendorId')) {
    localStorage.setItem('vendorId', parsed.vendorId);
  }
  return parsed;
}

/** @deprecated Use uploadFacilityCenterPhotos */
export const uploadFacilityCenterPhotosViaMultipartXhr = uploadFacilityCenterPhotos;

/**
 * Upload to S3 using presigned URL with progress tracking
 */
async function uploadToS3WithProgress(
  presignedUrl: string,
  file: File,
  contentType: string,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percentComplete = Math.round((e.loaded / e.total) * 100);
        onProgress(percentComplete);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ success: true });
      } else {
        resolve({
          success: false,
          error: `S3 upload failed with status ${xhr.status}`,
        });
      }
    });

    xhr.addEventListener('error', () => {
      resolve({
        success: false,
        error: 'Network error during S3 upload',
      });
    });

    xhr.addEventListener('abort', () => {
      resolve({
        success: false,
        error: 'S3 upload was cancelled',
      });
    });

    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.send(file);
  });
}

/**
 * Verify that uploaded photo is accessible.
 * Uses GET (not HEAD): S3 SigV4 presigned URLs from GetObject are valid for GET only;
 * HEAD uses a different canonical request and returns 403 even when the object exists.
 */
async function verifyPhotoUpload(url: string, timeout: number = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.body) {
      await response.body.cancel().catch(() => {});
    }

    if (!response.ok && response.status === 403) {
      console.warn(
        'Photo verification returned 403 (often unsigned URL on a private bucket); treating as ok if upload succeeded'
      );
      return true;
    }

    return response.ok;
  } catch (error) {
    console.warn('Photo verification failed:', error);
    // Don't fail upload if verification fails - might be CORS or timing issue
    return true; // Assume success if we can't verify
  }
}
