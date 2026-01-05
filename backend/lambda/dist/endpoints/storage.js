"use strict";
/**
 * ============================================================================
 * STORAGE HANDLER ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles file uploads and storage:
 * - Upload single file
 * - Upload multiple files
 * - Generate presigned URLs
 * - Delete files
 *
 * Migrated from: supabase/functions/server/storage-handler.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda (S3)
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerStorageEndpoints = registerStorageEndpoints;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const s3Client = new client_s3_1.S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'warmpawz-storage';
function registerStorageEndpoints(app) {
    /**
     * POST /storage/upload
     * Upload a single file
     */
    app.post("/storage/upload", async (c) => {
        try {
            const formData = await c.req.formData();
            const file = formData.get('file');
            const vendorId = formData.get('vendorId');
            const documentType = formData.get('documentType');
            if (!file || !vendorId || !documentType) {
                return c.json({ error: 'Missing required fields: file, vendorId, documentType' }, 400);
            }
            console.log(`📤 Uploading file: ${file.name} for vendor: ${vendorId}`);
            // Generate unique filename
            const timestamp = Date.now();
            const fileExt = file.name.split('.').pop();
            const fileName = `${vendorId}/${documentType}_${timestamp}.${fileExt}`;
            // Convert File to ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            // Upload to S3
            await s3Client.send(new client_s3_1.PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileName,
                Body: uint8Array,
                ContentType: file.type,
            }));
            console.log('✅ File uploaded successfully:', fileName);
            // Generate presigned URL (valid for 1 year)
            const signedUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, new client_s3_1.GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileName,
            }), { expiresIn: 31536000 } // 1 year in seconds
            );
            return c.json({
                success: true,
                fileName: fileName,
                url: signedUrl,
                publicUrl: signedUrl,
            });
        }
        catch (error) {
            console.error('❌ Error uploading file:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /storage/upload-multiple
     * Upload multiple files
     */
    app.post("/storage/upload-multiple", async (c) => {
        try {
            const formData = await c.req.formData();
            const vendorId = formData.get('vendorId');
            if (!vendorId) {
                return c.json({ error: 'Vendor ID is required' }, 400);
            }
            const uploadResults = [];
            const entries = Array.from(formData.entries());
            for (const [key, value] of entries) {
                if (value instanceof File && key !== 'vendorId') {
                    const file = value;
                    const documentType = key; // The field name is the document type
                    console.log(`📤 Uploading: ${documentType} - ${file.name}`);
                    try {
                        // Generate unique filename
                        const timestamp = Date.now();
                        const random = Math.random().toString(36).substring(2, 11);
                        const fileExt = file.name.split('.').pop();
                        const fileName = `${vendorId}/${documentType}_${timestamp}_${random}.${fileExt}`;
                        // Convert File to ArrayBuffer
                        const arrayBuffer = await file.arrayBuffer();
                        const uint8Array = new Uint8Array(arrayBuffer);
                        // Upload to S3
                        await s3Client.send(new client_s3_1.PutObjectCommand({
                            Bucket: BUCKET_NAME,
                            Key: fileName,
                            Body: uint8Array,
                            ContentType: file.type,
                        }));
                        // Generate presigned URL
                        const signedUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, new client_s3_1.GetObjectCommand({
                            Bucket: BUCKET_NAME,
                            Key: fileName,
                        }), { expiresIn: 31536000 });
                        uploadResults.push({
                            documentType,
                            success: true,
                            fileName: fileName,
                            originalName: file.name,
                            url: signedUrl,
                            type: file.type.startsWith('image/') ? 'image' : 'document',
                        });
                        console.log(`✅ Uploaded: ${documentType}`);
                    }
                    catch (error) {
                        console.error(`❌ Upload error for ${documentType}:`, error);
                        uploadResults.push({
                            documentType,
                            success: false,
                            error: error.message,
                        });
                    }
                }
            }
            return c.json({
                success: true,
                uploads: uploadResults,
                total: uploadResults.length,
                successful: uploadResults.filter((r) => r.success).length,
            });
        }
        catch (error) {
            console.error('❌ Error uploading multiple files:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * DELETE /storage/file/:fileKey
     * Delete a file
     */
    app.delete("/storage/file/:fileKey", async (c) => {
        try {
            const { fileKey } = c.req.param();
            const decodedKey = decodeURIComponent(fileKey);
            await s3Client.send(new client_s3_1.DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: decodedKey,
            }));
            return c.json({
                success: true,
                message: 'File deleted successfully',
            });
        }
        catch (error) {
            console.error('❌ Error deleting file:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /storage/presigned-url
     * Generate presigned URL for file access
     */
    app.get("/storage/presigned-url", async (c) => {
        try {
            const fileKey = c.req.query('fileKey');
            const expiresIn = parseInt(c.req.query('expiresIn') || '3600', 10); // Default 1 hour
            if (!fileKey) {
                return c.json({ error: 'fileKey is required' }, 400);
            }
            const signedUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, new client_s3_1.GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileKey,
            }), { expiresIn });
            return c.json({
                success: true,
                url: signedUrl,
                expiresIn,
            });
        }
        catch (error) {
            console.error('❌ Error generating presigned URL:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
//# sourceMappingURL=storage.js.map