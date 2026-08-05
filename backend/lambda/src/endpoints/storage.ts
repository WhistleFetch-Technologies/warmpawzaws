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
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda (S3)
 * ============================================================================
 */

import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { createPresignedCategoryStyleUploadUrls } from '../utils/s3-presign-upload';
import {
  uploadDisplayImage,
  toUploadJsonResponse,
  ImageProcessingError,
} from '../services/image';
import { abandonPetUploadKeys } from '../services/image/abandon-pet-upload.service';
import { presignedImageUploadRejected } from '../utils/reject-presigned-image-upload';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
// Use consistent S3_UPLOADS_BUCKET env var (set by CDK lambda-stack)
const BUCKET_NAME = process.env.S3_UPLOADS_BUCKET || process.env.S3_BUCKET_NAME || 'warmpawz-dev-uploads';

export function registerStorageEndpoints(app: Hono) {
  /**
   * POST /storage/upload
   * Upload a single file
   */
  app.post("/storage/upload", async (c) => {
    try {
      console.log('📤 [STORAGE] Upload request received');
      console.log('📤 [STORAGE] Content-Type:', c.req.header('content-type'));
      console.log('📤 [STORAGE] Bucket:', BUCKET_NAME);
      console.log('📤 [STORAGE] Region:', process.env.AWS_REGION || 'ap-south-1');

      // Check if bucket is configured
      if (!BUCKET_NAME || BUCKET_NAME === 'warmpawz-dev-uploads') {
        console.warn('⚠️ [STORAGE] Using default bucket name - ensure S3_UPLOADS_BUCKET env var is set');
      }

      let formData: FormData;
      try {
        formData = await c.req.formData();
        console.log('✅ [STORAGE] FormData parsed successfully');
      } catch (formDataError: any) {
        console.error('❌ [STORAGE] FormData parsing error:', formDataError);
        return c.json({ 
          error: 'Failed to parse form data',
          details: formDataError.message || 'Invalid form data format',
          hint: 'Ensure Content-Type is multipart/form-data'
        }, 400);
      }

      const file = formData.get('file') as File;
      const vendorId = formData.get('vendorId') as string;
      const documentType = formData.get('documentType') as string;

      console.log('📤 [STORAGE] Extracted fields:', {
        hasFile: !!file,
        fileName: file?.name,
        fileSize: file?.size,
        fileType: file?.type,
        vendorId,
        documentType
      });

      if (!file) {
        return c.json({ error: 'Missing required field: file' }, 400);
      }
      if (!vendorId) {
        return c.json({ error: 'Missing required field: vendorId' }, 400);
      }
      if (!documentType) {
        return c.json({ error: 'Missing required field: documentType' }, 400);
      }

      console.log(`📤 [STORAGE] Uploading file: ${file.name} (${file.size} bytes) for vendor: ${vendorId}, type: ${documentType}`);

      // Generate unique filename
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 11);
      const fileExt = file.name.split('.').pop() || 'bin';
      const fileName = `${vendorId}/${documentType}_${timestamp}_${random}.${fileExt}`;

      console.log('📤 [STORAGE] Generated filename:', fileName);

      // Convert File to ArrayBuffer
      let arrayBuffer: ArrayBuffer;
      let uint8Array: Uint8Array;
      try {
        arrayBuffer = await file.arrayBuffer();
        uint8Array = new Uint8Array(arrayBuffer);
        console.log('✅ [STORAGE] File converted to buffer, size:', uint8Array.length);
      } catch (bufferError: any) {
        console.error('❌ [STORAGE] Buffer conversion error:', bufferError);
        return c.json({ 
          error: 'Failed to process file',
          details: bufferError.message || 'Could not read file data'
        }, 400);
      }

      // Upload to S3
      try {
        console.log('📤 [STORAGE] Uploading to S3...');
        await s3Client.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileName,
          Body: uint8Array,
          ContentType: file.type || 'application/octet-stream',
        }));
        console.log('✅ [STORAGE] File uploaded successfully to S3:', fileName);
      } catch (s3Error: any) {
        console.error('❌ [STORAGE] S3 upload error:', {
          message: s3Error.message,
          code: s3Error.Code || s3Error.name,
          bucket: BUCKET_NAME,
          key: fileName,
          stack: s3Error.stack?.substring(0, 500)
        });
        
        // Provide helpful error messages
        if (s3Error.Code === 'NoSuchBucket' || s3Error.name === 'NoSuchBucket') {
          return c.json({ 
            error: 'S3 bucket not found',
            details: `Bucket "${BUCKET_NAME}" does not exist. Please check S3_UPLOADS_BUCKET environment variable.`,
            bucket: BUCKET_NAME
          }, 500);
        }
        if (s3Error.Code === 'AccessDenied' || s3Error.name === 'AccessDenied') {
          return c.json({ 
            error: 'S3 access denied',
            details: 'Lambda function does not have permission to upload to S3. Check IAM permissions.',
            bucket: BUCKET_NAME
          }, 500);
        }
        
        return c.json({ 
          error: 'S3 upload failed',
          details: s3Error.message || 'Unknown S3 error',
          code: s3Error.Code || s3Error.name
        }, 500);
      }

      // Generate presigned URL
      try {
        const signedUrl = await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileName,
          }),
          { expiresIn: 604800 } // 7 days (max for presigned URLs)
        );

        console.log('✅ [STORAGE] Presigned URL generated');

        return c.json({
          success: true,
          fileName: fileName,
          url: signedUrl,
          publicUrl: signedUrl,
        });
      } catch (urlError: any) {
        console.error('❌ [STORAGE] Presigned URL generation error:', urlError);
        // File is uploaded, but URL generation failed - return partial success
        return c.json({
          success: true,
          fileName: fileName,
          url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${fileName}`,
          publicUrl: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${fileName}`,
          warning: 'Presigned URL generation failed, using direct URL'
        });
      }
    } catch (error: any) {
      console.error('❌ [STORAGE] Unexpected error uploading file:', {
        message: error.message,
        name: error.name,
        stack: error.stack?.substring(0, 500)
      });
      return c.json({ 
        error: 'Internal Server Error',
        details: error.message || 'Unknown error occurred',
        type: error.name || 'Error'
      }, 500);
    }
  });

  /**
   * POST /storage/upload-multiple
   * Upload multiple files
   */
  app.post("/storage/upload-multiple", async (c) => {
    try {
      const formData = await c.req.formData();
      const vendorId = formData.get('vendorId') as string;

      if (!vendorId) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }

      const uploadResults: any[] = [];
      const entries = Array.from(formData.entries());

      // Check if File constructor exists (browser) or use Blob check (Node.js)
      const FileConstructor = typeof File !== 'undefined' ? File : null;
      const BlobConstructor = typeof Blob !== 'undefined' ? Blob : null;

      for (const [key, value] of entries) {
        // Check if value is a file/blob object
        const isFile = FileConstructor && value instanceof FileConstructor;
        const isBlob = BlobConstructor && value instanceof BlobConstructor;
        const isFileLike = value && typeof value === 'object' && 
                           ('name' in value || 'size' in value || 'type' in value || 'stream' in value);
        
        if ((isFile || isBlob || isFileLike) && key !== 'vendorId') {
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
            await s3Client.send(new PutObjectCommand({
              Bucket: BUCKET_NAME,
              Key: fileName,
              Body: uint8Array,
              ContentType: file.type,
            }));

            // Generate presigned URL
            const signedUrl = await getSignedUrl(
              s3Client,
              new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileName,
              }),
              { expiresIn: 604800 } // 7 days (max for presigned URLs)
            );

            uploadResults.push({
              documentType,
              success: true,
              fileName: fileName,
              originalName: file.name,
              url: signedUrl,
              type: file.type.startsWith('image/') ? 'image' : 'document',
            });

            console.log(`✅ Uploaded: ${documentType}`);
          } catch (error: any) {
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
        successful: uploadResults.filter((r: any) => r.success).length,
      });
    } catch (error: any) {
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

      await s3Client.send(new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: decodedKey,
      }));

      return c.json({
        success: true,
        message: 'File deleted successfully',
      });
    } catch (error: any) {
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

      const signedUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileKey,
        }),
        { expiresIn }
      );

      return c.json({
        success: true,
        url: signedUrl,
        expiresIn,
      });
    } catch (error: any) {
      console.error('❌ Error generating presigned URL:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /storage/media/*
   * Serve media files via presigned URLs
   * 
   * This endpoint handles direct S3 URLs that are stored in the database
   * and generates fresh presigned URLs for access.
   * 
   * Usage: /storage/media/path/to/file.jpg
   * OR: /storage/media?url=https://bucket.s3.amazonaws.com/path/to/file.jpg
   */
  app.get("/storage/media/*", async (c) => {
    try {
      // Extract file path from URL
      const fullPath = c.req.path;
      let fileKey = fullPath.replace('/storage/media/', '');
      
      // Check if URL query param is provided (for direct S3 URLs)
      const urlParam = c.req.query('url');
      if (urlParam) {
        // Extract key from full S3 URL
        // Format: https://bucket.s3.region.amazonaws.com/key
        try {
          const parsedUrl = new URL(urlParam);
          fileKey = parsedUrl.pathname.substring(1); // Remove leading /
        } catch {
          fileKey = urlParam;
        }
      }
      
      if (!fileKey) {
        return c.json({ error: 'File path is required' }, 400);
      }

      // Decode the file key
      fileKey = decodeURIComponent(fileKey);

      // Generate a fresh presigned URL (1 hour validity)
      const signedUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileKey,
        }),
        { expiresIn: 3600 }
      );

      // Redirect to the presigned URL
      return c.redirect(signedUrl, 302);
    } catch (error: any) {
      console.error('❌ Error serving media:', error);
      
      // Return a 404 with helpful message
      if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
        return c.json({ error: 'File not found' }, 404);
      }
      
      return c.json({ error: error.message || 'Failed to serve media' }, 500);
    }
  });

  /**
   * GET /storage/refresh-url
   * Convert a direct S3 URL to a fresh presigned URL
   * 
   * This is useful when the frontend has stored direct S3 URLs that have expired
   * or are returning 403 errors.
   */
  app.get("/storage/refresh-url", async (c) => {
    try {
      const url = c.req.query('url');
      
      if (!url) {
        return c.json({ error: 'url parameter is required' }, 400);
      }

      let fileKey = url;
      
      // Parse the URL to extract the key
      if (url.includes('amazonaws.com')) {
        try {
          const parsedUrl = new URL(url);
          fileKey = parsedUrl.pathname.substring(1); // Remove leading /
        } catch {
          // If URL parsing fails, assume it's already a key
        }
      }

      // Decode the file key
      fileKey = decodeURIComponent(fileKey);

      // Generate a fresh presigned URL (1 hour validity)
      const signedUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileKey,
        }),
        { expiresIn: 3600 }
      );

      return c.json({
        success: true,
        originalUrl: url,
        signedUrl,
        expiresIn: 3600,
      });
    } catch (error: any) {
      console.error('❌ Error refreshing URL:', error);
      return c.json({ 
        success: false,
        error: error.message || 'Failed to refresh URL' 
      }, 500);
    }
  });

  /**
   * POST /storage/upload-media
   * Upload media for customers or pets (photos)
   */
  app.post("/storage/upload-media", async (c) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      const userId = formData.get('userId') as string; // customer phone or pet ID
      const userType = formData.get('userType') as string; // 'customer' or 'pet'

      if (!file || !userId || !userType) {
        return c.json({ error: 'Missing required fields: file, userId, userType' }, 400);
      }

      if (userType !== 'customer' && userType !== 'pet') {
        return c.json({ error: 'userType must be customer or pet' }, 400);
      }

      console.log(`📤 Uploading ${userType} photo: ${file.name} for ${userId}`);

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const assetType = userType === 'pet' ? 'pet' : 'profile';

      const asset = await uploadDisplayImage({
        buffer,
        declaredContentType: file.type || undefined,
        assetType,
        ownerId: userId,
      });

      return c.json(toUploadJsonResponse(asset));
    } catch (error: any) {
      if (error instanceof ImageProcessingError) {
        return c.json({ error: error.message }, error.statusCode as ContentfulStatusCode);
      }
      console.error('❌ Error uploading media:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /storage/abandon-pet-upload
   * Delete uncommitted pet wizard uploads (temp pet_* folder only).
   */
  app.post('/storage/abandon-pet-upload', async (c) => {
    try {
      const body = await c.req.json();
      const tempPetId = body?.tempPetId as string | undefined;
      const imageKeys = body?.imageKeys as string[] | undefined;

      if (!tempPetId || !Array.isArray(imageKeys)) {
        return c.json({ error: 'tempPetId and imageKeys are required' }, 400);
      }

      const result = await abandonPetUploadKeys({ tempPetId, imageKeys });

      if (!result.success && result.error) {
        return c.json({ success: false, error: result.error, deleted: 0, failed: 0 }, 400);
      }

      return c.json({
        success: result.success,
        deleted: result.deleted,
        failed: result.failed,
      });
    } catch (error: any) {
      console.error('Error abandoning pet upload:', error);
      return c.json({ error: error.message || 'Failed to abandon pet upload' }, 500);
    }
  });

  /**
   * POST /storage/presigned-upload-url
   * Generate presigned URL for direct S3 upload (client-side upload)
   * Used for pharmacy invoices and other file uploads
   */
  app.post("/storage/presigned-upload-url", async (c) => {
    try {
      const body = await c.req.json();
      const { fileName, fileType, folder } = body;

      if (!fileName || !fileType) {
        return c.json({ error: 'fileName and fileType are required' }, 400);
      }

      const imageReject = presignedImageUploadRejected(fileType);
      if (imageReject) {
        return c.json({ error: imageReject }, 400);
      }

      // Generate unique filename
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 11);
      const fileExt = fileName.split('.').pop() || 'bin';
      const folderPath = folder ? `${folder}/` : '';
      const fileKey = `${folderPath}${timestamp}_${random}.${fileExt}`;

      const urls = await createPresignedCategoryStyleUploadUrls({
        bucket: BUCKET_NAME,
        key: fileKey,
        contentType: fileType,
      });

      return c.json({
        success: true,
        uploadUrl: urls.uploadUrl,
        fileUrl: urls.fileUrl,
        publicUrl: urls.publicUrl,
        fileKey: urls.fileKey,
      });
    } catch (error: any) {
      console.error('❌ Error generating presigned upload URL:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /admin/upload/presigned-url
   * Alias for /storage/presigned-upload-url (for backward compatibility)
   */
  app.post("/admin/upload/presigned-url", async (c) => {
    try {
      const body = await c.req.json();
      const { fileName, fileType, folder } = body;

      if (!fileName || !fileType) {
        return c.json({ error: 'fileName and fileType are required' }, 400);
      }

      const imageReject = presignedImageUploadRejected(fileType);
      if (imageReject) {
        return c.json({ error: imageReject }, 400);
      }

      // Generate unique filename
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 11);
      const fileExt = fileName.split('.').pop() || 'bin';
      const folderPath = folder ? `${folder}/` : '';
      const fileKey = `${folderPath}${timestamp}_${random}.${fileExt}`;

      const urls = await createPresignedCategoryStyleUploadUrls({
        bucket: BUCKET_NAME,
        key: fileKey,
        contentType: fileType,
      });

      return c.json({
        success: true,
        uploadUrl: urls.uploadUrl,
        fileUrl: urls.fileUrl,
        publicUrl: urls.publicUrl,
        fileKey: urls.fileKey,
      });
    } catch (error: any) {
      console.error('❌ Error generating presigned upload URL:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

