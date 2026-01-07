"use strict";
/**
 * ============================================================================
 * UNIVERSAL MEDIA UPLOAD ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 *
 * Centralized media upload endpoint for all file types
 * - Product images
 * - Profile photos (vendor, customer, staff, pet)
 * - Prescriptions
 * - Documents
 * - Banner images
 *
 * ✅ SQL-ONLY: All operations use SQL
 * ✅ S3 Integration: All files stored in S3
 *
 * Date: 2025-01-28
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMediaUploadEndpoints = registerMediaUploadEndpoints;
const response_utils_1 = require("./response-utils");
const s3_upload_1 = require("../lib/utils/s3-upload");
const BASE_PATH = '/make-server-3dd53475';
function registerMediaUploadEndpoints(app) {
    /**
     * POST /media/upload
     * Universal media upload endpoint
     */
    app.post(`${BASE_PATH}/media/upload`, async (c) => {
        try {
            const formData = await c.req.formData();
            const file = formData.get('file');
            const folder = formData.get('folder') || 'general';
            const fileName = formData.get('fileName') || file.name;
            const userId = formData.get('userId');
            const userType = formData.get('userType') || 'customer';
            const makePublic = formData.get('makePublic') !== 'false';
            if (!file) {
                return (0, response_utils_1.sendError)(c, 'No file provided', 400);
            }
            // Validate file size (e.g., 10MB max)
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                return (0, response_utils_1.sendError)(c, 'File size exceeds 10MB limit', 400);
            }
            // Validate file type (images, PDFs, etc.)
            const allowedTypes = [
                'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ];
            if (!allowedTypes.includes(file.type)) {
                return (0, response_utils_1.sendError)(c, `File type ${file.type} not allowed. Allowed types: ${allowedTypes.join(', ')}`, 400);
            }
            // Upload to S3
            const options = {
                folder,
                fileName,
                contentType: file.type,
                makePublic,
                metadata: {
                    userId: userId || '',
                    userType,
                    originalName: file.name,
                    uploadedAt: new Date().toISOString(),
                },
            };
            const { url, key } = await (0, s3_upload_1.uploadFileToS3)(file, options);
            console.log(`✅ [MEDIA-UPLOAD] Uploaded ${folder}/${fileName} → ${url}`);
            return (0, response_utils_1.sendSuccess)(c, {
                url,
                key,
                folder,
                fileName,
                size: file.size,
                type: file.type,
                uploadedAt: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error('[MEDIA-UPLOAD] Upload error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * DELETE /media/delete
     * Delete media file from S3
     */
    app.delete(`${BASE_PATH}/media/delete`, async (c) => {
        try {
            const { url } = await c.req.json();
            if (!url) {
                return (0, response_utils_1.sendError)(c, 'Missing required field: url', 400);
            }
            await (0, s3_upload_1.deleteFileFromS3ByUrl)(url);
            return (0, response_utils_1.sendSuccess)(c, {
                message: 'File deleted successfully',
                deletedUrl: url,
            });
        }
        catch (error) {
            console.error('[MEDIA-UPLOAD] Delete error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * POST /media/upload-batch
     * Upload multiple files at once
     */
    app.post(`${BASE_PATH}/media/upload-batch`, async (c) => {
        try {
            const formData = await c.req.formData();
            const files = formData.getAll('files');
            const folder = formData.get('folder') || 'general';
            const userId = formData.get('userId');
            const userType = formData.get('userType') || 'customer';
            if (!files || files.length === 0) {
                return (0, response_utils_1.sendError)(c, 'No files provided', 400);
            }
            const uploads = [];
            for (const file of files) {
                try {
                    const options = {
                        folder,
                        fileName: file.name,
                        contentType: file.type,
                        makePublic: true,
                        metadata: {
                            userId: userId || '',
                            userType,
                            originalName: file.name,
                            uploadedAt: new Date().toISOString(),
                        },
                    };
                    const { url, key } = await (0, s3_upload_1.uploadFileToS3)(file, options);
                    uploads.push({
                        url,
                        key,
                        fileName: file.name,
                        size: file.size,
                        type: file.type,
                        success: true,
                    });
                }
                catch (error) {
                    uploads.push({
                        fileName: file.name,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
            return (0, response_utils_1.sendSuccess)(c, {
                uploads,
                total: files.length,
                successful: uploads.filter((u) => u.success).length,
                failed: uploads.filter((u) => !u.success).length,
            });
        }
        catch (error) {
            console.error('[MEDIA-UPLOAD] Batch upload error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    console.log('✅ Media upload endpoints registered');
}
//# sourceMappingURL=media-upload-endpoints-sql.js.map