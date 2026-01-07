"use strict";
/**
 * ============================================================================
 * FILE UPLOAD ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles file uploads to S3:
 * - Generate presigned URLs for upload
 * - Get file URLs
 * - Delete files
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFileUploadEndpoints = registerFileUploadEndpoints;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
});
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'warmpawz-uploads';
function registerFileUploadEndpoints(app) {
    /**
     * POST /upload/presigned-url
     * Generate presigned URL for file upload
     */
    app.post("/upload/presigned-url", async (c) => {
        try {
            const { fileName, fileType, folder } = await c.req.json();
            if (!fileName || !fileType) {
                return c.json({ error: 'fileName and fileType are required' }, 400);
            }
            // Generate unique file key
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(2, 15);
            const fileExtension = fileName.split('.').pop();
            const fileKey = folder
                ? `${folder}/${timestamp}_${randomStr}.${fileExtension}`
                : `uploads/${timestamp}_${randomStr}.${fileExtension}`;
            // Generate presigned URL for PUT
            const command = new client_s3_1.PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileKey,
                ContentType: fileType,
            });
            const presignedUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn: 3600 }); // 1 hour
            // Public URL (after upload)
            const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${fileKey}`;
            return c.json({
                success: true,
                presignedUrl,
                fileKey,
                publicUrl,
                expiresIn: 3600,
            });
        }
        catch (error) {
            console.error('Error generating presigned URL:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /upload/file/:fileKey
     * Get presigned URL for file download
     */
    app.get("/upload/file/:fileKey", async (c) => {
        try {
            const { fileKey } = c.req.param();
            const expiresIn = parseInt(c.req.query('expiresIn') || '3600', 10);
            const command = new client_s3_1.GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileKey,
            });
            const presignedUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn });
            return c.json({
                success: true,
                downloadUrl: presignedUrl,
                expiresIn,
            });
        }
        catch (error) {
            console.error('Error generating download URL:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * DELETE /upload/file/:fileKey
     * Delete file from S3
     */
    app.delete("/upload/file/:fileKey", async (c) => {
        try {
            const { fileKey } = c.req.param();
            const command = new client_s3_1.DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileKey,
            });
            await s3Client.send(command);
            return c.json({
                success: true,
                message: 'File deleted successfully',
            });
        }
        catch (error) {
            console.error('Error deleting file:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
//# sourceMappingURL=file-upload.js.map