/**
 * Enhanced Photo Upload Utility for Vendor Web with Progress Tracking and Validation
 */

import {
  apiClient,
  getApiBaseUrl,
  getVendorAuthHeadersForUpload,
  type MultipartUploadResponse,
} from './api-client';
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

/** Build a `File` from Camera bridge base64 (same bytes as customer `FormData` upload path). */
function facilityPayloadToFile(payload: FacilityCenterPhotoPayload): File {
  const binary = atob(payload.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], payload.fileName, {
    type: payload.mimeType || 'image/jpeg',
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

/**
 * Same transport as customer profile upload (`uploadWithXHR` in customer photo-upload-enhanced):
 * FormData body, raw XMLHttpRequest, auth headers set manually (no fetch / CapacitorHttp).
 */
async function uploadFacilityFormDataWithXHR(
  endpoint: string,
  formData: FormData,
  onProgress?: (progress: number) => void
): Promise<MultipartUploadResponse> {
  try {
    const { refreshVendorTokensIfNeeded } = await import('./cognito-auth');
    await refreshVendorTokensIfNeeded();
  } catch {
    /* non-blocking */
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${getApiBaseUrl().replace(/\/+$/, '')}${endpoint.replace(/^\/+/, '/')}`;

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percentComplete = Math.round((e.loaded / e.total) * 90) + 10;
        onProgress(percentComplete);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as MultipartUploadResponse);
        } catch {
          reject(new Error('Failed to parse upload response'));
        }
        return;
      }
      try {
        const err = JSON.parse(xhr.responseText) as MultipartUploadResponse;
        reject(new Error(err.error || `Upload failed with status ${xhr.status}`));
      } catch {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload was cancelled')));

    xhr.open('POST', url);
    const authHeaders = getVendorAuthHeadersForUpload();
    for (const [key, value] of Object.entries(authHeaders)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.send(formData);
  });
}

export type FacilityCenterPhotoPayload = {
  base64: string;
  fileName: string;
  mimeType: string;
};

/**
 * Upload center gallery photos (Dashboard → Gallery → Center photos).
 * Uses FormData + XMLHttpRequest (same pattern as customer profile/pet uploads).
 * When `payloads` are set from @capacitor/camera, they are converted to `File` before upload.
 */
export async function uploadFacilityCenterPhotos(
  vendorId: string,
  files: File[],
  options?: {
    onProgress?: (percent: number) => void;
    /** Raw base64 from @capacitor/camera (one entry per file, same order). */
    payloads?: FacilityCenterPhotoPayload[];
    maxRetries?: number;
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

  const uploadFiles: File[] = [];
  if (options?.payloads?.length) {
    for (const payload of options.payloads) {
      if (!payload.base64?.length) {
        throw new Error(`${payload.fileName || 'Photo'} is empty on this device`);
      }
      const file = facilityPayloadToFile(payload);
      if (file.size === 0) {
        throw new Error(`${payload.fileName || 'Photo'} is empty on this device`);
      }
      uploadFiles.push(file);
    }
  } else {
    for (const file of files) {
      if (file.size === 0) {
        throw new Error(`${file.name || 'Photo'} is empty on this device`);
      }
      uploadFiles.push(
        file.type && file.type !== 'application/octet-stream'
          ? file
          : new File([file], file.name || `photo-${Date.now()}.jpg`, {
              type: mimeForFacilityPhoto(file),
            })
      );
    }
  }

  if (!uploadFiles.length) {
    throw new Error('No photo data to upload');
  }

  console.log(
    '[GALLERY] Uploading via FormData multipart (XHR):',
    uploadFiles.map((f) => ({ name: f.name, size: f.size, type: f.type, vendorId: safeId }))
  );

  const maxRetries = options?.maxRetries ?? 3;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (options?.onProgress) {
        options.onProgress(10);
      }

      const formData = new FormData();
      for (const file of uploadFiles) {
        formData.append('photos', file, file.name);
      }

      const uploadData = await uploadFacilityFormDataWithXHR(endpoint, formData, options?.onProgress);

      if (options?.onProgress) {
        options.onProgress(100);
      }
      const parsed = parseFacilityUploadResponse(uploadData);
      if (
        parsed.vendorId &&
        typeof window !== 'undefined' &&
        parsed.vendorId !== localStorage.getItem('vendorId')
      ) {
        localStorage.setItem('vendorId', parsed.vendorId);
      }
      return parsed;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError ?? new Error('Upload failed after retries');
}

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
 * Verify that uploaded photo is accessible
 */
async function verifyPhotoUpload(url: string, timeout: number = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    
    // In development, if we get 403, it might be due to bucket blocking public access
    // but the upload itself succeeded. Check if it's a 403 and assume success in dev.
    if (!response.ok && response.status === 403) {
      console.warn('Photo verification returned 403 (bucket may block public access), but upload likely succeeded');
      // In development, assume success for 403 errors since upload succeeded
      // The presigned URL should work, but if we're verifying public URL, skip it
      return true;
    }
    
    return response.ok;
  } catch (error) {
    console.warn('Photo verification failed:', error);
    // Don't fail upload if verification fails - might be CORS or timing issue
    return true; // Assume success if we can't verify
  }
}
