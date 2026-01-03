import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

/**
 * S3 Client utility
 * Handles file uploads, downloads, and deletions
 */
class S3ClientUtil {
  private client: S3Client;
  private bucketName: string;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.AWS_REGION || 'ap-south-1';

    const config: any = {
      region,
    };

    // For local development (MinIO)
    if (endpoint && endpoint.includes('localhost')) {
      config.endpoint = endpoint;
      config.forcePathStyle = true;
      config.credentials = {
        accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
      };
    }

    this.client = new S3Client(config);
    this.bucketName = process.env.S3_BUCKET_STORAGE || 'warmpawz-storage-local';
  }

  /**
   * Upload file to S3
   */
  async uploadFile(key: string, body: Buffer | Uint8Array, contentType?: string): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      });

      await this.client.send(command);
      return key;
    } catch (error) {
      console.error('S3 upload failed:', error);
      throw error;
    }
  }

  /**
   * Get file from S3
   */
  async getFile(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);
      const chunks: Uint8Array[] = [];

      if (response.Body) {
        for await (const chunk of response.Body as any) {
          chunks.push(chunk);
        }
      }

      return Buffer.concat(chunks);
    } catch (error) {
      console.error('S3 get failed:', error);
      throw error;
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
    } catch (error) {
      console.error('S3 delete failed:', error);
      throw error;
    }
  }

  /**
   * Get presigned URL for file access
   */
  getFileUrl(key: string): string {
    const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
    return `${endpoint}/${this.bucketName}/${key}`;
  }
}

export const s3Client = new S3ClientUtil();

