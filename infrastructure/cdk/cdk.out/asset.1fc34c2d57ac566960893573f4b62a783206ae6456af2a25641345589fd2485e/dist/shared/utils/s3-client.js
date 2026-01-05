"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.s3Client = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
/**
 * S3 Client utility
 * Handles file uploads, downloads, and deletions
 */
class S3ClientUtil {
    client;
    bucketName;
    constructor() {
        const endpoint = process.env.S3_ENDPOINT;
        const region = process.env.AWS_REGION || 'ap-south-1';
        const config = {
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
        this.client = new client_s3_1.S3Client(config);
        this.bucketName = process.env.S3_BUCKET_STORAGE || 'warmpawz-storage-local';
    }
    /**
     * Upload file to S3
     */
    async uploadFile(key, body, contentType) {
        try {
            const command = new client_s3_1.PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: body,
                ContentType: contentType,
            });
            await this.client.send(command);
            return key;
        }
        catch (error) {
            console.error('S3 upload failed:', error);
            throw error;
        }
    }
    /**
     * Get file from S3
     */
    async getFile(key) {
        try {
            const command = new client_s3_1.GetObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });
            const response = await this.client.send(command);
            const chunks = [];
            if (response.Body) {
                for await (const chunk of response.Body) {
                    chunks.push(chunk);
                }
            }
            return Buffer.concat(chunks);
        }
        catch (error) {
            console.error('S3 get failed:', error);
            throw error;
        }
    }
    /**
     * Delete file from S3
     */
    async deleteFile(key) {
        try {
            const command = new client_s3_1.DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });
            await this.client.send(command);
        }
        catch (error) {
            console.error('S3 delete failed:', error);
            throw error;
        }
    }
    /**
     * Get presigned URL for file access
     */
    getFileUrl(key) {
        const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
        return `${endpoint}/${this.bucketName}/${key}`;
    }
}
exports.s3Client = new S3ClientUtil();
//# sourceMappingURL=s3-client.js.map