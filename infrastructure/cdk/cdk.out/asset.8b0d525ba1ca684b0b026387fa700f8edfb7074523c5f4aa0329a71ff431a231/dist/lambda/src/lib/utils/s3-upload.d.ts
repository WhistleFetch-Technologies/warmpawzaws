/**
 * ============================================================================
 * UNIVERSAL S3 UPLOAD UTILITY
 * ============================================================================
 *
 * Centralized S3 upload functionality for all media types
 * - Product images
 * - Profile photos
 * - Prescriptions
 * - Documents
 * - Banner images
 *
 * Date: 2025-01-28
 * ============================================================================
 */
import { S3Client } from '@aws-sdk/client-s3';
export interface S3UploadOptions {
    folder?: string;
    fileName?: string;
    contentType?: string;
    makePublic?: boolean;
    metadata?: Record<string, string>;
}
export interface S3ClientConfig {
    client: S3Client;
    bucket: string;
    region: string;
}
/**
 * Get S3 client configuration from platform settings
 */
export declare function getS3Config(): Promise<S3ClientConfig | null>;
/**
 * Upload file to S3
 */
export declare function uploadFileToS3(file: File | Buffer | Uint8Array, options?: S3UploadOptions): Promise<{
    url: string;
    key: string;
}>;
/**
 * Delete file from S3
 */
export declare function deleteFileFromS3(key: string): Promise<void>;
/**
 * Delete file from S3 by URL
 */
export declare function deleteFileFromS3ByUrl(url: string): Promise<void>;
//# sourceMappingURL=s3-upload.d.ts.map