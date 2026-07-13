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

import { Hono } from 'hono';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { presignedImageUploadRejected } from '../utils/reject-presigned-image-upload';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
});

// Use consistent S3_UPLOADS_BUCKET env var (set by CDK lambda-stack)
const BUCKET_NAME = process.env.S3_UPLOADS_BUCKET || process.env.S3_BUCKET_NAME || 'warmpawz-dev-uploads';

export function registerFileUploadEndpoints(app: Hono) {
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

      const imageReject = presignedImageUploadRejected(fileType);
      if (imageReject) {
        return c.json({ error: imageReject }, 400);
      }

      // Generate unique file key
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const fileExtension = fileName.split('.').pop();
      const fileKey = folder
        ? `${folder}/${timestamp}_${randomStr}.${fileExtension}`
        : `uploads/${timestamp}_${randomStr}.${fileExtension}`;

      // Generate presigned URL for PUT
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
        ContentType: fileType,
      });

      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour

      // Public URL (after upload) — often 403 if bucket blocks public read
      const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${fileKey}`;

      // Presigned GET so UIs (e.g. meal product image preview) work with private buckets
      const getCmd = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
      });
      const displayUrl = await getSignedUrl(s3Client, getCmd, { expiresIn: 604800 });

      return c.json({
        success: true,
        presignedUrl,
        fileKey,
        publicUrl,
        displayUrl,
        expiresIn: 3600,
      });
    } catch (error: any) {
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

      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
      });

      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });

      return c.json({
        success: true,
        downloadUrl: presignedUrl,
        expiresIn,
      });
    } catch (error: any) {
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

      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
      });

      await s3Client.send(command);

      return c.json({
        success: true,
        message: 'File deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting file:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

