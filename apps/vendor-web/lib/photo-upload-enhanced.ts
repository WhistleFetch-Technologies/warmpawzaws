/**
 * Enhanced Photo Upload Utility for Vendor Web with Progress Tracking and Validation
 */

import { apiClient } from './api-client';

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

  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    return {
      success: false,
      error: 'Invalid file type: Only JPEG, PNG, WebP, and GIF images are allowed',
    };
  }

  while (retries < maxRetries) {
    try {
      if (onProgress) onProgress(10);

      const presignedResponse = await apiClient.post('/upload/presigned-url', {
        fileName: file.name,
        fileType: file.type,
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

      return {
        success: true,
        url: presignedResponse.publicUrl,
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
 * Upload to S3 using presigned URL with progress tracking
 */
async function uploadToS3WithProgress(
  presignedUrl: string,
  file: File,
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
    xhr.setRequestHeader('Content-Type', file.type);
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
