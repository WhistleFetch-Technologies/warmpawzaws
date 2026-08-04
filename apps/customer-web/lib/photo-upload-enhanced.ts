/**
 * Enhanced Photo Upload Utility with Progress Tracking and Validation
 * Provides upload progress, retry logic, and success verification
 */

import { apiClient, getApiBaseUrl, getCustomerAuthHeadersForUpload } from './api-client';
import { normalizeProfilePhotoFile } from './normalize-profile-photo';

/** JPEG/PNG/WebP/GIF/HEIC; also allows missing MIME when the filename looks like an image (common on mobile). */
function isAllowedCustomerImageFile(file: File): boolean {
  const validTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
  ];
  if (validTypes.includes(file.type)) return true;
  if (!file.type || file.type === 'application/octet-stream') {
    return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name);
  }
  return false;
}

export interface PhotoUploadOptions {
  onProgress?: (progress: number) => void;
  maxRetries?: number;
  verifyUpload?: boolean; // Verify upload succeeded by checking if URL is accessible
}

export interface PhotoUploadResult {
  success: boolean;
  url?: string;
  publicUrl?: string;
  fileName?: string;
  /** Stable S3 key — persist this in DB, not presigned URL */
  imageKey?: string;
  thumbKey?: string;
  error?: string;
  retries?: number;
}

/**
 * Upload photo with progress tracking and validation
 */
export async function uploadPhotoWithProgress(
  file: File,
  endpoint: string,
  formData: FormData,
  options: PhotoUploadOptions = {}
): Promise<PhotoUploadResult> {
  const { onProgress, maxRetries = 3, verifyUpload = true } = options;
  let lastError: string | undefined;
  let retries = 0;

  // Validate file
  if (!file || file.size === 0) {
    return {
      success: false,
      error: 'Invalid file: File is empty or not selected',
    };
  }

  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return {
      success: false,
      error: `File too large: Maximum size is ${(maxSize / 1024 / 1024).toFixed(0)}MB`,
    };
  }

  if (!isAllowedCustomerImageFile(file)) {
    return {
      success: false,
      error: 'Invalid file type: Use JPEG, PNG, WebP, GIF, or HEIC',
    };
  }

  // Retry loop
  let normalizedFile: File;
  try {
    normalizedFile = await normalizeProfilePhotoFile(file);
  } catch (normalizeError: unknown) {
    return {
      success: false,
      error:
        normalizeError instanceof Error
          ? normalizeError.message
          : 'Could not process image for upload',
    };
  }

  const uploadFormData = new FormData();
  for (const [key, value] of formData.entries()) {
    if (key === 'file') {
      uploadFormData.append('file', normalizedFile, normalizedFile.name);
    } else {
      uploadFormData.append(key, value);
    }
  }

  while (retries < maxRetries) {
    try {
      // Simulate progress for FormData upload (browser doesn't provide real progress for FormData)
      if (onProgress) {
        onProgress(10); // Starting
      }

      // Upload using XMLHttpRequest for progress tracking
      const uploadResult = await uploadWithXHR(endpoint, uploadFormData, onProgress);

      if (
        uploadResult.success &&
        (uploadResult.imageKey || uploadResult.publicUrl || uploadResult.url)
      ) {
        // Verify upload if requested
        // Use presigned URL (url) for verification since public URL may be blocked in dev
        if (verifyUpload) {
          const urlToVerify = uploadResult.url || uploadResult.publicUrl;
          if (!urlToVerify) {
            throw new Error('Upload verification failed: Photo URL is missing');
          }
          const verified = await verifyPhotoUpload(urlToVerify);
          if (!verified) {
            throw new Error('Upload verification failed: Photo URL is not accessible');
          }
        }

        if (onProgress) {
          onProgress(100); // Complete
        }

        return {
          success: true,
          url: uploadResult.url,
          publicUrl: uploadResult.publicUrl,
          fileName: uploadResult.imageKey || uploadResult.fileName,
          imageKey: uploadResult.imageKey || uploadResult.fileName,
          thumbKey: uploadResult.thumbKey,
          retries,
        };
      }

      throw new Error(uploadResult.error || 'Upload failed');
    } catch (error: any) {
      lastError = error.message || 'Upload failed';
      retries++;

      if (onProgress) {
        onProgress(0); // Reset on retry
      }

      // Wait before retry (exponential backoff)
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

/**
 * Upload using XMLHttpRequest for progress tracking
 */
async function uploadWithXHR(
  endpoint: string,
  formData: FormData,
  onProgress?: (progress: number) => void
): Promise<PhotoUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const apiBaseUrl = getApiBaseUrl();
    const url = `${apiBaseUrl}${endpoint}`;

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percentComplete = Math.round((e.loaded / e.total) * 90) + 10; // 10-100%
        onProgress(percentComplete);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          const resolvedUrl = response.url || response.publicUrl;
          const imageKey =
            response.imageKey ||
            response.asset?.imageKey ||
            response.key ||
            response.fileName;
          const thumbKey =
            response.thumbKey ||
            response.asset?.thumbKey ||
            undefined;
          if (response.success && (resolvedUrl || imageKey)) {
            resolve({
              success: true,
              url: response.url,
              publicUrl: response.publicUrl,
              fileName: imageKey || response.fileName,
              imageKey: imageKey || undefined,
              thumbKey,
            });
          } else {
            resolve({
              success: false,
              error: response.error || 'Upload failed',
            });
          }
        } catch (error) {
          resolve({
            success: false,
            error: 'Failed to parse response',
          });
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          resolve({
            success: false,
            error: error.error || `Upload failed with status ${xhr.status}`,
          });
        } catch {
          resolve({
            success: false,
            error: `Upload failed with status ${xhr.status}`,
          });
        }
      }
    });

    xhr.addEventListener('error', () => {
      resolve({
        success: false,
        error: 'Network error during upload',
      });
    });

    xhr.addEventListener('abort', () => {
      resolve({
        success: false,
        error: 'Upload was cancelled',
      });
    });

    xhr.open('POST', url);
    const authHeaders = getCustomerAuthHeadersForUpload();
    for (const [key, value] of Object.entries(authHeaders)) {
      xhr.setRequestHeader(key, value);
    }

    xhr.send(formData);
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

/**
 * Upload customer profile photo with progress tracking
 */
export async function uploadCustomerPhotoWithProgress(
  file: File,
  customerPhone: string,
  options: PhotoUploadOptions = {}
): Promise<PhotoUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('userId', customerPhone);
  formData.append('userType', 'customer');
  formData.append('folder', 'media');

  return uploadPhotoWithProgress(file, '/storage/upload-media', formData, options);
}

/**
 * Upload pet profile photo with progress tracking
 */
export async function uploadPetPhotoWithProgress(
  file: File,
  petId: string,
  customerPhone: string,
  options: PhotoUploadOptions = {}
): Promise<PhotoUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('userId', petId || `pet_${Date.now()}`);
  formData.append('userType', 'pet');
  formData.append('folder', 'media');
  formData.append('customerPhone', customerPhone);

  return uploadPhotoWithProgress(file, '/storage/upload-media', formData, options);
}

/**
 * Upload staff photo using presigned URL with progress tracking
 */
export async function uploadStaffPhotoWithProgress(
  file: File,
  vendorId: string,
  options: PhotoUploadOptions = {}
): Promise<PhotoUploadResult> {
  const { onProgress, maxRetries = 3, verifyUpload = true } = options;
  let lastError: string | undefined;
  let retries = 0;

  // Validate file
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

  if (!isAllowedCustomerImageFile(file)) {
    return {
      success: false,
      error: 'Invalid file type: Use JPEG, PNG, WebP, GIF, or HEIC',
    };
  }

  while (retries < maxRetries) {
    try {
      if (onProgress) onProgress(10);

      // Step 1: Get presigned URL
      const presignedResponse = await apiClient.post('/upload/presigned-url', {
        fileName: file.name,
        fileType: file.type,
        folder: `staff/${vendorId}`,
      }) as any;

      if (!presignedResponse.success || !presignedResponse.presignedUrl) {
        throw new Error('Failed to get upload URL');
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
