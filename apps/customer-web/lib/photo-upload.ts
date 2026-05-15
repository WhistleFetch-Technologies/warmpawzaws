/**
 * Photo Upload Utility for Customer and Pet Photos
 * Uploads photos to S3 and returns the URL
 */

import { apiClient } from './api-client';

export interface PhotoUploadResult {
  success: boolean;
  url?: string;
  publicUrl?: string;
  fileName?: string;
  error?: string;
}

/**
 * Upload customer profile photo to S3
 */
export async function uploadCustomerPhoto(
  file: File,
  customerPhone: string
): Promise<PhotoUploadResult> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', customerPhone);
    formData.append('userType', 'customer');
    formData.append('folder', 'media');

    const response = await apiClient.post<{
      success: boolean;
      url: string;
      publicUrl: string;
      fileName: string;
      error?: string;
    }>('/storage/upload-media', formData);

    if (response.success && (response.publicUrl || response.url)) {
      return {
        success: true,
        url: response.url,
        publicUrl: response.publicUrl,
        fileName: response.fileName,
      };
    }

    return {
      success: false,
      error: response.error || 'Upload failed',
    };
  } catch (error: any) {
    console.error('Error uploading customer photo:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload photo',
    };
  }
}

/**
 * Upload pet profile photo to S3
 */
export async function uploadPetPhoto(
  file: File,
  petId: string,
  customerPhone: string
): Promise<PhotoUploadResult> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', petId || `pet_${Date.now()}`);
    formData.append('userType', 'pet');
    formData.append('folder', 'media');
    // Include customer phone for organization
    formData.append('customerPhone', customerPhone);

    const response = await apiClient.post<{
      success: boolean;
      url: string;
      publicUrl: string;
      fileName: string;
      error?: string;
    }>('/storage/upload-media', formData);

    if (response.success && (response.publicUrl || response.url)) {
      return {
        success: true,
        url: response.url,
        publicUrl: response.publicUrl,
        fileName: response.fileName,
      };
    }

    return {
      success: false,
      error: response.error || 'Upload failed',
    };
  } catch (error: any) {
    console.error('Error uploading pet photo:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload photo',
    };
  }
}

/**
 * Convert base64 to File object
 */
export function base64ToFile(base64: string, filename: string = 'photo.jpg'): File {
  // Remove data URL prefix if present
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'image/jpeg' });
  return new File([blob], filename, { type: 'image/jpeg' });
}
