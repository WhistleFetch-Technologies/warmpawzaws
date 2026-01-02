/**
 * ============================================================================
 * AWS S3 STORAGE HELPER
 * ============================================================================
 * 
 * Centralized S3 storage operations for replacing Supabase Storage
 * 
 * RULES:
 * ❌ NO Supabase Storage imports allowed
 * ✅ All storage operations use AWS S3
 * ✅ Uses PlatformSettingsRepository for AWS credentials
 * 
 * Date: 2025-01-28
 * ============================================================================
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getPlatformSettingsRepository } from "../repositories/index";

export interface S3UploadOptions {
  contentType?: string;
  acl?: 'private' | 'public-read' | 'public-read-write';
  metadata?: Record<string, string>;
}

export interface S3UploadResult {
  key: string;
  bucket: string;
  url: string;
  signedUrl?: string;
  expiresIn?: number;
}

class S3Helper {
  private client: S3Client | null = null;
  private region: string = 'ap-south-1';
  private bucket: string = '';

  private async getClient(): Promise<S3Client> {
    if (this.client) {
      return this.client;
    }

    // Get AWS settings from PlatformSettingsRepository
    const platformSettingsRepo = getPlatformSettingsRepository();
    const awsSettings = await platformSettingsRepo.getAWSSettings();
    
    const s3Config = awsSettings?.s3 || {};
    this.region = s3Config.region || process.env.AWS_REGION || 'ap-south-1';
    this.bucket = s3Config.bucket || process.env.S3_BUCKET_NAME || '';

    if (!s3Config.enabled) {
      throw new Error('S3 is not configured. Please configure AWS settings in platform_settings table.');
    }

    if (!this.bucket) {
      throw new Error('S3 bucket name is not configured');
    }

    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: s3Config.accessKeyId || awsSettings?.credentials?.accessKeyId || process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: s3Config.secretAccessKey || awsSettings?.credentials?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    return this.client;
  }

  /**
   * Upload file to S3
   */
  async uploadFile(
    key: string,
    body: Buffer | Uint8Array | string,
    options: S3UploadOptions = {}
  ): Promise<S3UploadResult> {
    const client = await this.getClient();

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: options.contentType || 'application/octet-stream',
      ACL: options.acl || 'private',
      Metadata: options.metadata,
    });

    await client.send(command);

    // Generate public URL if ACL is public
    const url = options.acl?.includes('public')
      ? `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`
      : `s3://${this.bucket}/${key}`;

    // Generate signed URL for private files (valid for 1 year)
    let signedUrl: string | undefined;
    if (!options.acl?.includes('public')) {
      const getCommand = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      signedUrl = await getSignedUrl(client, getCommand, { expiresIn: 31536000 }); // 1 year
    }

    return {
      key,
      bucket: this.bucket,
      url,
      signedUrl,
      expiresIn: signedUrl ? 31536000 : undefined,
    };
  }

  /**
   * Get signed URL for accessing private file
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const client = await this.getClient();

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return await getSignedUrl(client, command, { expiresIn });
  }

  /**
   * Get public URL (if file is public)
   */
  getPublicUrl(key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Delete file from S3
   */
  async deleteFile(key: string): Promise<void> {
    const client = await this.getClient();

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await client.send(command);
  }

  /**
   * Check if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    const client = await this.getClient();

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(
    files: Array<{ key: string; body: Buffer | Uint8Array | string; options?: S3UploadOptions }>
  ): Promise<S3UploadResult[]> {
    const results = await Promise.all(
      files.map(file => this.uploadFile(file.key, file.body, file.options))
    );
    return results;
  }

  /**
   * Delete multiple files
   */
  async deleteFiles(keys: string[]): Promise<void> {
    await Promise.all(keys.map(key => this.deleteFile(key)));
  }

  /**
   * Get bucket name
   */
  getBucket(): string {
    return this.bucket;
  }

  /**
   * Get region
   */
  getRegion(): string {
    return this.region;
  }
}

let s3HelperInstance: S3Helper | null = null;

export function getS3Helper(): S3Helper {
  if (!s3HelperInstance) {
    s3HelperInstance = new S3Helper();
  }
  return s3HelperInstance;
}

/**
 * Helper function to upload file with automatic key generation
 */
export async function uploadToS3(
  file: File | Buffer | Uint8Array,
  folder: string,
  fileName?: string,
  options?: S3UploadOptions
): Promise<S3UploadResult> {
  const s3 = getS3Helper();
  
  // Generate filename if not provided
  let key: string;
  if (fileName) {
    key = `${folder}/${fileName}`;
  } else {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const ext = file instanceof File ? file.name.split('.').pop() || 'bin' : 'bin';
    key = `${folder}/${timestamp}_${random}.${ext}`;
  }

  // Convert File to Buffer if needed
  let body: Buffer | Uint8Array;
  if (file instanceof File) {
    const arrayBuffer = await file.arrayBuffer();
    body = new Uint8Array(arrayBuffer);
    options = {
      ...options,
      contentType: options?.contentType || file.type || 'application/octet-stream',
    };
  } else {
    body = file;
  }

  return await s3.uploadFile(key, body, options);
}

