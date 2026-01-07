"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getS3Config = getS3Config;
exports.uploadFileToS3 = uploadFileToS3;
exports.deleteFileFromS3 = deleteFileFromS3;
exports.deleteFileFromS3ByUrl = deleteFileFromS3ByUrl;
const client_s3_1 = require("@aws-sdk/client-s3");
const db_1 = require("../db");
/**
 * Get S3 client configuration from platform settings
 */
async function getS3Config() {
    try {
        const pool = await (0, db_1.getDbClient)();
        const settingsResult = await pool.query("SELECT setting_value FROM platform_settings WHERE setting_key = 'aws_config' LIMIT 1");
        const awsSettings = settingsResult.rows[0]?.setting_value || null;
        if (!awsSettings || !awsSettings.s3_config?.enabled || !awsSettings.s3_config?.bucket) {
            return null;
        }
        const s3Config = awsSettings.s3_config;
        const credentials = awsSettings.credentials || {};
        const client = new client_s3_1.S3Client({
            region: s3Config.region || credentials.region || 'ap-south-1',
            credentials: {
                accessKeyId: s3Config.accessKeyId || credentials.accessKeyId || '',
                secretAccessKey: s3Config.secretAccessKey || credentials.secretAccessKey || ''
            }
        });
        return {
            client,
            bucket: s3Config.bucket,
            region: s3Config.region || credentials.region || 'ap-south-1'
        };
    }
    catch (error) {
        console.error('Error getting S3 config:', error);
        return null;
    }
}
/**
 * Upload file to S3
 */
async function uploadFileToS3(file, options = {}) {
    const s3Config = await getS3Config();
    if (!s3Config) {
        throw new Error('S3 not configured. Please configure S3 in Admin Portal → Platform Settings → AWS S3');
    }
    // Determine file buffer and content type
    let buffer;
    let contentType;
    if (file instanceof File) {
        const arrayBuffer = await file.arrayBuffer();
        buffer = new Uint8Array(arrayBuffer);
        contentType = options.contentType || file.type || 'application/octet-stream';
    }
    else {
        buffer = file;
        contentType = options.contentType || 'application/octet-stream';
    }
    // Generate file name and key
    const folder = options.folder || 'general';
    const fileName = options.fileName || (file instanceof File ? file.name : `file_${Date.now()}`);
    const key = `${folder}/${fileName}`;
    // Upload to S3
    const command = new client_s3_1.PutObjectCommand({
        Bucket: s3Config.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: options.makePublic !== false ? 'public-read' : 'private',
        Metadata: options.metadata,
    });
    await s3Config.client.send(command);
    const url = `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com/${key}`;
    console.log(`✅ [S3] Uploaded: ${key} → ${url}`);
    return { url, key };
}
/**
 * Delete file from S3
 */
async function deleteFileFromS3(key) {
    const s3Config = await getS3Config();
    if (!s3Config) {
        console.warn('⚠️ [S3] Cannot delete - S3 not configured');
        return;
    }
    try {
        await s3Config.client.send(new client_s3_1.DeleteObjectCommand({
            Bucket: s3Config.bucket,
            Key: key,
        }));
        console.log(`✅ [S3] Deleted: ${key}`);
    }
    catch (error) {
        console.error(`❌ [S3] Error deleting ${key}:`, error);
        throw error;
    }
}
/**
 * Delete file from S3 by URL
 */
async function deleteFileFromS3ByUrl(url) {
    // Extract key from URL
    const urlParts = url.split('.amazonaws.com/');
    if (urlParts.length < 2) {
        throw new Error('Invalid S3 URL');
    }
    const key = urlParts[1];
    await deleteFileFromS3(key);
}
//# sourceMappingURL=s3-upload.js.map