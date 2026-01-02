// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { 
  getPlatformSettingsRepository,
  getVendorsRepository,
  getBookingsRepository,
  getDbClient
} from '../../../supabase/lib/repositories/index';

/**
 * S3 AUTO-UPLOADER SERVICE
 * 
 * Automatically uploads all media to S3 using admin-configured credentials
 * - Product catalog photos
 * - Vendor center/profile photos
 * - KYC documents (Aadhaar, Business Registration)
 * - Prescription PDFs
 * - Chat media
 */

export function registerS3AutoUploader(app: Hono) {
  const BASE = '/make-server-3dd53475';

  /**
   * POST /media/upload
   * Universal media upload endpoint
   */
  app.post(`${BASE}/media/upload`, async (c) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      const folder = formData.get('folder') as string || 'general';
      const fileName = formData.get('fileName') as string || file.name;
      const userId = formData.get('userId') as string;
      const userType = formData.get('userType') as string || 'customer';

      if (!file) {
        return c.json({ error: 'No file provided' }, 400);
      }

      // ✅ SQL: Get S3 settings from platform_settings table
      const platformSettingsRepo = getPlatformSettingsRepository();
      const awsSettings = await platformSettingsRepo.getAWSSettings();
      const s3Config = awsSettings?.s3_config || {};

      if (!s3Config.enabled || !s3Config.bucket) {
        return c.json({ error: 'S3 not configured' }, 500);
      }

      // Upload to S3
      const s3Url = await uploadFileToS3(
        file,
        folder,
        fileName,
        s3Config,
        awsSettings.credentials
      );

      // Log upload
      console.log(`✅ [S3] Uploaded ${folder}/${fileName} → ${s3Url}`);

      // Track uploaded file
      await trackUpload(userId, userType, folder, fileName, s3Url, file.size);

      return c.json({
        success: true,
        url: s3Url,
        folder,
        fileName,
        size: file.size
      });

    } catch (error) {
      console.error('[S3] Upload error:', error);
      return c.json({ 
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  /**
   * POST /media/upload-product-photo
   * Upload product catalog photo
   */
  app.post(`${BASE}/media/upload-product-photo`, async (c) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      const productId = formData.get('productId') as string;
      const vendorId = formData.get('vendorId') as string;

      const fileName = `product_${productId}_${Date.now()}.${file.name.split('.').pop()}`;
      
      const s3Url = await uploadMedia(file, 'products', fileName);

      return c.json({
        success: true,
        url: s3Url,
        productId
      });

    } catch (error) {
      console.error('[S3] Product photo upload error:', error);
      return c.json({ error: 'Failed to upload product photo' }, 500);
    }
  });

  /**
   * POST /media/upload-vendor-photo
   * Upload vendor center/profile photo
   */
  app.post(`${BASE}/media/upload-vendor-photo`, async (c) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      const vendorId = formData.get('vendorId') as string;
      const photoType = formData.get('photoType') as string; // 'profile' | 'gallery'

      const fileName = `vendor_${vendorId}_${photoType}_${Date.now()}.${file.name.split('.').pop()}`;
      
      const s3Url = await uploadMedia(file, 'vendors', fileName);

      return c.json({
        success: true,
        url: s3Url,
        vendorId,
        photoType
      });

    } catch (error) {
      console.error('[S3] Vendor photo upload error:', error);
      return c.json({ error: 'Failed to upload vendor photo' }, 500);
    }
  });

  /**
   * POST /media/upload-kyc-document
   * Upload KYC documents (Aadhaar, Business Registration)
   */
  app.post(`${BASE}/media/upload-kyc-document`, async (c) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      const vendorId = formData.get('vendorId') as string;
      const docType = formData.get('docType') as string; // 'aadhaar_front' | 'aadhaar_back' | 'business_reg' | 'gst'

      const fileName = `kyc_${vendorId}_${docType}_${Date.now()}.${file.name.split('.').pop()}`;
      
      const s3Url = await uploadMedia(file, 'kyc-documents', fileName);

      // ✅ SQL: Update vendor KYC record in vendors table
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      if (vendor) {
        const currentKycDocs = vendor.kyc_documents || {};
        currentKycDocs[docType] = {
          url: s3Url,
          uploadedAt: new Date().toISOString(),
          status: 'pending_verification'
        };
        await vendorsRepo.update(vendorId, { kyc_documents: currentKycDocs });
      }

      return c.json({
        success: true,
        url: s3Url,
        vendorId,
        docType
      });

    } catch (error) {
      console.error('[S3] KYC document upload error:', error);
      return c.json({ error: 'Failed to upload KYC document' }, 500);
    }
  });

  /**
   * POST /media/upload-prescription
   * Upload prescription PDF
   */
  app.post(`${BASE}/media/upload-prescription`, async (c) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      const bookingId = formData.get('bookingId') as string;
      const customerId = formData.get('customerId') as string;

      const fileName = `prescription_${bookingId}_${Date.now()}.pdf`;
      
      const s3Url = await uploadMedia(file, 'prescriptions', fileName);

      // ✅ SQL: Update booking with prescription URL in bookings table
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (booking) {
        const currentPrescriptions = booking.prescriptions || [];
        currentPrescriptions.push({
          url: s3Url,
          uploadedAt: new Date().toISOString(),
          uploadedBy: 'vendor'
        });
        await bookingsRepo.update(bookingId, { prescriptions: currentPrescriptions });
      }

      return c.json({
        success: true,
        url: s3Url,
        bookingId
      });

    } catch (error) {
      console.error('[S3] Prescription upload error:', error);
      return c.json({ error: 'Failed to upload prescription' }, 500);
    }
  });

  /**
   * DELETE /media/delete
   * Delete file from S3
   */
  app.delete(`${BASE}/media/delete`, async (c) => {
    try {
      const { url } = await c.req.json();

      // ✅ SQL: Get AWS settings from platform_settings table
      const platformSettingsRepo = getPlatformSettingsRepository();
      const awsSettings = await platformSettingsRepo.getAWSSettings();
      const s3Config = awsSettings?.s3_config || {};

      if (!s3Config.enabled) {
        return c.json({ error: 'S3 not configured' }, 500);
      }

      // Extract key from URL
      const key = url.split('/').slice(3).join('/');

      await deleteFromS3(key, s3Config, awsSettings.credentials);

      return c.json({ success: true });

    } catch (error) {
      console.error('[S3] Delete error:', error);
      return c.json({ error: 'Failed to delete file' }, 500);
    }
  });

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================

  async function uploadMedia(file: File, folder: string, fileName: string): Promise<string> {
    // ✅ SQL: Get AWS settings from platform_settings table
    const platformSettingsRepo = getPlatformSettingsRepository();
    const awsSettings = await platformSettingsRepo.getAWSSettings();
    const s3Config = awsSettings?.s3_config || {};

    if (!s3Config.enabled || !s3Config.bucket) {
      throw new Error('S3 not configured');
    }

    return await uploadFileToS3(
      file,
      folder,
      fileName,
      s3Config,
      awsSettings.credentials
    );
  }

  async function uploadFileToS3(
    file: File,
    folder: string,
    fileName: string,
    s3Config: any,
    credentials: any
  ): Promise<string> {
    try {
      // Create S3 client
      const s3Client = new S3Client({
        region: s3Config.region || credentials.region || 'ap-south-1',
        credentials: {
          accessKeyId: s3Config.accessKeyId || credentials.accessKeyId,
          secretAccessKey: s3Config.secretAccessKey || credentials.secretAccessKey
        }
      });

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      // Upload to S3
      const key = `${folder}/${fileName}`;
      const command = new PutObjectCommand({
        Bucket: s3Config.bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        ACL: 'public-read' // Make publicly readable
      });

      await s3Client.send(command);

      // Return public URL
      const url = `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com/${key}`;
      
      console.log(`✅ [S3] Uploaded ${key}`);
      
      return url;

    } catch (error) {
      console.error('[S3] Upload error:', error);
      throw error;
    }
  }

  async function deleteFromS3(key: string, s3Config: any, credentials: any) {
    const s3Client = new S3Client({
      region: s3Config.region || credentials.region,
      credentials: {
        accessKeyId: s3Config.accessKeyId || credentials.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey || credentials.secretAccessKey
      }
    });

    await s3Client.send(new DeleteObjectCommand({
      Bucket: s3Config.bucket,
      Key: key
    }));
  }

  async function trackUpload(
    userId: string,
    userType: string,
    folder: string,
    fileName: string,
    url: string,
    size: number
  ) {
    try {
      // ✅ SQL: Track upload in user_uploads table (or file_uploads table)
      const db = getDbClient();
      await db
        .from('file_uploads')
        .insert({
          user_id: userId,
          user_type: userType,
          folder,
          file_name: fileName,
          file_url: url,
          file_size: size,
          uploaded_at: new Date().toISOString()
        });

      // Keep only last 100 uploads per user (cleanup old ones)
      const { data: uploads } = await db
        .from('file_uploads')
        .select('id')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false })
        .limit(101);

      if (uploads && uploads.length > 100) {
        const idsToDelete = uploads.slice(100).map(u => u.id);
        await db
          .from('file_uploads')
          .delete()
          .in('id', idsToDelete);
      }
    } catch (error) {
      console.error('[S3] Upload tracking error:', error);
    }
  }
}

// Additional helper for importing
async function DeleteObjectCommand(...args: any[]) {
  const { DeleteObjectCommand: Cmd } = await import("npm:@aws-sdk/client-s3@3");
  return new Cmd(...args);
}
