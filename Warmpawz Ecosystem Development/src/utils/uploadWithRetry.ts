import { projectId, publicAnonKey } from './supabase/info';

/**
 * 📤 FILE UPLOAD WITH RETRY
 * 
 * Uploads files with exponential backoff retry logic
 * Tracks progress and handles errors gracefully
 * 
 * Features:
 * - Exponential backoff (1s, 2s, 4s delays)
 * - Progress tracking
 * - Retry callbacks
 * - Don't retry validation errors
 */

interface UploadOptions {
  maxRetries?: number;
  onProgress?: (progress: number) => void;
  onRetry?: (attempt: number) => void;
}

export async function uploadFileWithRetry(
  file: File,
  path: string,
  options: UploadOptions = {}
): Promise<string> {
  const {
    maxRetries = 3,
    onProgress,
    onRetry
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`📤 [UPLOAD] Attempt ${attempt + 1}/${maxRetries} for ${file.name}`);

      if (attempt > 0 && onRetry) {
        onRetry(attempt);
      }

      // Exponential backoff: 1s, 2s, 4s
      if (attempt > 0) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`⏳ [UPLOAD] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Call upload function
      const url = await uploadFile(file, path, onProgress);
      
      console.log(`✅ [UPLOAD] Success on attempt ${attempt + 1}: ${url}`);
      return url;

    } catch (error: any) {
      lastError = error;
      console.error(`❌ [UPLOAD] Attempt ${attempt + 1} failed:`, error.message);

      // Don't retry on certain errors
      if (error.message.includes('Invalid file type') || 
          error.message.includes('File too large') ||
          error.message.includes('Unsupported format')) {
        throw error; // Don't retry validation errors
      }
    }
  }

  throw new Error(
    `Upload failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Upload file with progress tracking
 */
async function uploadFile(
  file: File,
  path: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('path', path);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          onProgress(progress);
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.success && response.url) {
            resolve(response.url);
          } else {
            reject(new Error(response.error || 'Upload failed'));
          }
        } catch (error) {
          reject(new Error('Invalid response from server'));
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'));
    });

    xhr.addEventListener('timeout', () => {
      reject(new Error('Upload timed out'));
    });

    // Set timeout to 60 seconds
    xhr.timeout = 60000;

    xhr.open('POST', `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${publicAnonKey}`);
    xhr.send(formData);
  });
}

/**
 * Validate file before upload
 */
export function validateFile(file: File, options?: {
  maxSizeMB?: number;
  allowedTypes?: string[];
}): { valid: boolean; error?: string } {
  const maxSizeMB = options?.maxSizeMB || 10;
  const allowedTypes = options?.allowedTypes || [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/pdf'
  ];

  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${maxSizeMB}MB`
    };
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
    };
  }

  return { valid: true };
}
