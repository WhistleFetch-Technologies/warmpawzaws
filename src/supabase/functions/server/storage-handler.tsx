// ✅ S3 MIGRATION: Supabase Storage replaced with AWS S3
import { Hono } from "hono";
import { getS3Helper, uploadToS3 } from '../../../supabase/lib/storage/s3-helper';

export function registerStorageEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  
  // S3 bucket is configured via PlatformSettingsRepository

  // Upload document endpoint
  app.post(`${BASE_PATH}/storage/upload`, async (c) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      const vendorId = formData.get('vendorId') as string;
      const documentType = formData.get('documentType') as string;
      
      if (!file || !vendorId || !documentType) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      console.log(`📤 Uploading file: ${file.name} for vendor: ${vendorId}`);
      
      // ✅ S3: Generate unique filename
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop() || 'bin';
      const s3Key = `storage/vendors/${vendorId}/${documentType}_${timestamp}.${fileExt}`;

      // ✅ S3: Upload to S3
      const s3 = getS3Helper();
      const uploadResult = await uploadToS3(
        file,
        `storage/vendors/${vendorId}`,
        `${documentType}_${timestamp}.${fileExt}`,
        {
          contentType: file.type,
          acl: 'private', // Private files with signed URLs
        }
      );

      console.log('✅ File uploaded successfully:', s3Key);

      return c.json({
        success: true,
        fileName: s3Key.split('/').pop(),
        key: s3Key,
        url: uploadResult.signedUrl || uploadResult.url,
        publicUrl: uploadResult.signedUrl || uploadResult.url
      });

    } catch (error) {
      console.error('❌ Error uploading file:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Upload multiple documents endpoint
  app.post(`${BASE_PATH}/storage/upload-multiple`, async (c) => {
    try {
      const formData = await c.req.formData();
      const vendorId = formData.get('vendorId') as string;
      
      if (!vendorId) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }

      const s3 = getS3Helper();
      const uploadResults = [];
      const entries = Array.from(formData.entries());

      for (const [key, value] of entries) {
        if (value instanceof File && key !== 'vendorId') {
          const file = value;
          const documentType = key; // The field name is the document type
          
          console.log(`📤 Uploading: ${documentType} - ${file.name}`);
          
          // Generate unique filename
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(7);
          const fileExt = file.name.split('.').pop() || 'bin';
          const s3Key = `storage/vendors/${vendorId}/${documentType}_${timestamp}_${random}.${fileExt}`;

          try {
            // ✅ S3: Upload to S3
            const uploadResult = await uploadToS3(
              file,
              `storage/vendors/${vendorId}`,
              `${documentType}_${timestamp}_${random}.${fileExt}`,
              {
                contentType: file.type,
                acl: 'private',
              }
            );

            uploadResults.push({
              documentType,
              success: true,
              fileName: s3Key.split('/').pop(),
              key: s3Key,
              originalName: file.name,
              url: uploadResult.signedUrl || uploadResult.url,
              type: file.type.startsWith('image/') ? 'image' : 'document'
            });
            console.log(`✅ Uploaded: ${documentType}`);
          } catch (error: any) {
            console.error(`❌ Upload error for ${documentType}:`, error);
            uploadResults.push({
              documentType,
              success: false,
              error: error.message || String(error)
            });
          }
        }
      }

      return c.json({
        success: true,
        uploads: uploadResults,
        totalUploaded: uploadResults.filter(r => r.success).length,
        totalFailed: uploadResults.filter(r => !r.success).length
      });

    } catch (error) {
      console.error('❌ Error in multiple upload:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Get document URL (refresh signed URL)
  app.get(`${BASE_PATH}/storage/document/:vendorId/:fileName`, async (c) => {
    try {
      const { vendorId, fileName } = c.req.param();
      
      const s3 = getS3Helper();
      const s3Key = `storage/vendors/${vendorId}/${fileName}`;
      
      // ✅ S3: Check if file exists and generate signed URL
      const fileExists = await s3.fileExists(s3Key);
      if (!fileExists) {
        return c.json({ error: 'File not found' }, 404);
      }
      
      // Generate new signed URL (valid for 1 year)
      const signedUrl = await s3.getSignedUrl(s3Key, 31536000);

      return c.json({
        success: true,
        url: signedUrl
      });

    } catch (error) {
      console.error('❌ Error getting document URL:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Upload facility photos endpoint
  app.post(`${BASE_PATH}/storage/upload-facility-photos`, async (c) => {
    try {
      const formData = await c.req.formData();
      const vendorId = formData.get('vendorId') as string;
      
      if (!vendorId) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }

      const s3 = getS3Helper();
      const uploadResults = [];
      const entries = Array.from(formData.entries());
      let photoCount = 0;

      for (const [key, value] of entries) {
        if (value instanceof File && key === 'photos') {
          photoCount++;
          const file = value;
          
          console.log(`📸 Uploading facility photo ${photoCount}: ${file.name}`);
          
          // Generate unique filename for facility photos
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(7);
          const fileExt = file.name.split('.').pop() || 'jpg';
          const s3Key = `storage/vendors/${vendorId}/facility_photos/photo_${timestamp}_${random}.${fileExt}`;

          try {
            // ✅ S3: Upload to S3
            const uploadResult = await uploadToS3(
              file,
              `storage/vendors/${vendorId}/facility_photos`,
              `photo_${timestamp}_${random}.${fileExt}`,
              {
                contentType: file.type,
                acl: 'public-read', // Facility photos should be public
              }
            );

            uploadResults.push({
              success: true,
              fileName: s3Key.split('/').pop(),
              key: s3Key,
              originalName: file.name,
              url: uploadResult.signedUrl || uploadResult.url
            });
            console.log(`✅ Uploaded facility photo ${photoCount}`);
          } catch (error: any) {
            console.error(`❌ Upload error for photo ${photoCount}:`, error);
            uploadResults.push({
              success: false,
              error: error.message || String(error)
            });
          }
        }
      }

      if (uploadResults.length === 0) {
        return c.json({ error: 'No photos were uploaded' }, 400);
      }

      return c.json({
        success: true,
        uploads: uploadResults,
        totalUploaded: uploadResults.filter(r => r.success).length,
        totalFailed: uploadResults.filter(r => !r.success).length
      });

    } catch (error) {
      console.error('❌ Error uploading facility photos:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}