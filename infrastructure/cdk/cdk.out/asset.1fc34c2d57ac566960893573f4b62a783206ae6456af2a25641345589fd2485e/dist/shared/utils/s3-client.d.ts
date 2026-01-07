/**
 * S3 Client utility
 * Handles file uploads, downloads, and deletions
 */
declare class S3ClientUtil {
    private client;
    private bucketName;
    constructor();
    /**
     * Upload file to S3
     */
    uploadFile(key: string, body: Buffer | Uint8Array, contentType?: string): Promise<string>;
    /**
     * Get file from S3
     */
    getFile(key: string): Promise<Buffer>;
    /**
     * Delete file from S3
     */
    deleteFile(key: string): Promise<void>;
    /**
     * Get presigned URL for file access
     */
    getFileUrl(key: string): string;
}
export declare const s3Client: S3ClientUtil;
export {};
//# sourceMappingURL=s3-client.d.ts.map