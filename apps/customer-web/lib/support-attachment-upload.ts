import { apiClient } from './api-client';

export type SupportAttachment = {
  name: string;
  url: string;
  displayUrl?: string;
  fileKey?: string;
  type?: string;
  size?: number;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 3;

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

function isAllowedSupportFile(file: File): boolean {
  if (ALLOWED_TYPES.has(file.type)) return true;
  if (!file.type || file.type === 'application/octet-stream') {
    return /\.(jpe?g|png|gif|webp|heic|heif|pdf)$/i.test(file.name);
  }
  return false;
}

function uploadToS3(presignedUrl: string, file: File): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: `Upload failed (${xhr.status})` });
      }
    });
    xhr.addEventListener('error', () => resolve({ success: false, error: 'Network error during upload' }));
    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
}

export function validateSupportAttachmentFile(file: File, currentCount: number): string | null {
  if (currentCount >= MAX_FILES) return `Maximum ${MAX_FILES} attachments allowed`;
  if (!file || file.size === 0) return 'Invalid file';
  if (file.size > MAX_FILE_SIZE) return 'File must be under 10MB';
  if (!isAllowedSupportFile(file)) return 'Use JPEG, PNG, WebP, GIF, HEIC, or PDF';
  return null;
}

export async function uploadSupportAttachment(
  file: File,
  customerId?: string
): Promise<{ success: boolean; attachment?: SupportAttachment; error?: string }> {
  const validationError = validateSupportAttachmentFile(file, 0);
  if (validationError) return { success: false, error: validationError };

  try {
    const folder = customerId ? `support/${customerId}` : 'support/attachments';
    const presignedResponse = (await apiClient.post('/upload/presigned-url', {
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      folder,
    })) as {
      success?: boolean;
      presignedUrl?: string;
      publicUrl?: string;
      displayUrl?: string;
      fileKey?: string;
      error?: string;
    };

    if (!presignedResponse.success || !presignedResponse.presignedUrl) {
      return { success: false, error: presignedResponse.error || 'Failed to get upload URL' };
    }

    const uploadResult = await uploadToS3(presignedResponse.presignedUrl, file);
    if (!uploadResult.success) {
      return { success: false, error: uploadResult.error || 'Upload failed' };
    }

    return {
      success: true,
      attachment: {
        name: file.name,
        url: presignedResponse.publicUrl || presignedResponse.displayUrl || presignedResponse.presignedUrl,
        displayUrl: presignedResponse.displayUrl || presignedResponse.publicUrl,
        fileKey: presignedResponse.fileKey,
        type: file.type || undefined,
        size: file.size,
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Upload failed';
    return { success: false, error: msg };
  }
}

export const SUPPORT_ATTACHMENT_LIMITS = { maxFiles: MAX_FILES, maxFileSizeMb: 10 };
