/**
 * ============================================================================
 * BANNER ENDPOINTS (SQL-ONLY)
 * ============================================================================
 * 
 * Complete banner management with SQL persistence.
 * Replaces: content-management-endpoints.tsx KV-based banner operations
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ S3 integration for media files
 * ✅ Full lifecycle: create, read, update, delete, analytics
 * 
 * Date: 2025-01-22
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { getBannersRepository } from '../../lib/repositories/banners.ts';
import { getPlatformSettingsRepository } from '../../lib/repositories/platform-settings.ts';
import { sendSuccess, sendError } from "./response-utils.ts";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "npm:@aws-sdk/client-s3";

export function registerBannerEndpointsSQL(app: Hono) {
  
  // Helper: Get S3 client from platform settings
  async function getS3Client(): Promise<{ client: S3Client; bucket: string; region: string } | null> {
    try {
      const settingsRepo = getPlatformSettingsRepository();
      const awsSettings = await settingsRepo.getAWSSettings();
      
      if (!awsSettings || !awsSettings.s3_config?.enabled || !awsSettings.s3_config?.bucket) {
        return null;
      }
      
      const s3Config = awsSettings.s3_config;
      const client = new S3Client({
        region: s3Config.region || awsSettings.credentials?.region || 'ap-south-1',
        credentials: {
          accessKeyId: s3Config.accessKeyId || awsSettings.credentials?.accessKeyId || '',
          secretAccessKey: s3Config.secretAccessKey || awsSettings.credentials?.secretAccessKey || ''
        }
      });
      
      return {
        client,
        bucket: s3Config.bucket,
        region: s3Config.region || awsSettings.credentials?.region || 'ap-south-1'
      };
    } catch (error) {
      console.error('Error getting S3 client:', error);
      return null;
    }
  }

  // Helper: Upload file to S3
  async function uploadToS3(file: File, folder: string, fileName: string): Promise<string> {
    const s3Info = await getS3Client();
    if (!s3Info) {
      throw new Error('S3 not configured. Please configure S3 in Admin Portal → Platform Settings → Cloud & Maps → AWS S3');
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const key = `content/${folder}/${fileName}`;
    const command = new PutObjectCommand({
      Bucket: s3Info.bucket,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      ACL: 'public-read'
    });

    await s3Info.client.send(command);

    const url = `https://${s3Info.bucket}.s3.${s3Info.region}.amazonaws.com/${key}`;
    console.log(`✅ [S3] Uploaded banner: ${key}`);
    return url;
  }

  // Helper: Delete file from S3
  async function deleteFromS3(url: string): Promise<void> {
    const s3Info = await getS3Client();
    if (!s3Info) {
      return; // Silently fail if S3 not configured
    }

    // Extract key from URL
    const urlParts = url.split('.amazonaws.com/');
    if (urlParts.length < 2) return;

    const key = urlParts[1];
    await s3Info.client.send(new DeleteObjectCommand({
      Bucket: s3Info.bucket,
      Key: key
    }));

    console.log(`✅ [S3] Deleted banner: ${key}`);
  }

  const BASE_PATH = "/make-server-3dd53475";

  /**
   * POST /admin/content/banners
   * Create a new banner
   * Supports both direct imageUrl or file upload to S3
   */
  app.post(`${BASE_PATH}/admin/content/banners`, async (c) => {
    try {
      const bannersRepo = getBannersRepository();
      const contentType = c.req.header('content-type') || '';
      let bannerData: any = {};
      let imageUrl = '';

      if (contentType.includes('multipart/form-data')) {
        const formData = await c.req.formData();
        const file = formData.get('image') as File;
        const type = formData.get('type') as string;
        const title = formData.get('title') as string;

        if (!type || !title || !file) {
          return sendError(c, 'Missing required fields: type, title, image file', 400);
        }

        // Upload to S3
        const timestamp = Date.now();
        const fileExt = file.name.split('.').pop();
        const fileName = `banner_${type}_${timestamp}.${fileExt}`;
        imageUrl = await uploadToS3(file, 'banners', fileName);

        bannerData = {
          type: type as 'main' | 'spotlight' | 'category' | 'service',
          title,
          subtitle: formData.get('subtitle') as string || undefined,
          image_url: imageUrl,
          cta_text: formData.get('ctaText') as string || undefined,
          cta_link: formData.get('ctaLink') as string || undefined,
          target_role_id: formData.get('targetRoleId') as string || undefined,
          target_service_category: formData.get('targetServiceCategory') as string || undefined,
          start_date: formData.get('startDate') as string || undefined,
          end_date: formData.get('endDate') as string || undefined,
          display_order: parseInt(formData.get('displayOrder') as string || '0'),
          is_active: formData.get('isActive') !== 'false',
          metadata: JSON.parse(formData.get('metadata') as string || '{}')
        };
      } else {
        const body = await c.req.json();
        const {
          type,
          title,
          subtitle,
          imageUrl: providedImageUrl,
          ctaText,
          ctaLink,
          targetRoleId,
          targetServiceCategory,
          startDate,
          endDate,
          displayOrder,
          isActive,
          metadata
        } = body;

        if (!type || !title) {
          return sendError(c, 'Missing required fields: type, title', 400);
        }

        imageUrl = providedImageUrl || '';

        bannerData = {
          type: type as 'main' | 'spotlight' | 'category' | 'service',
          title,
          subtitle,
          image_url: imageUrl || undefined,
          cta_text: ctaText,
          cta_link: ctaLink,
          target_role_id: targetRoleId,
          target_service_category: targetServiceCategory,
          start_date: startDate,
          end_date: endDate,
          display_order: displayOrder || 0,
          is_active: isActive !== false,
          metadata: metadata || {}
        };
      }

      if (!imageUrl && !bannerData.image_url) {
        return sendError(c, 'Image URL is required. Please upload an image file or provide imageUrl', 400);
      }

      const banner = await bannersRepo.create(bannerData);

      return sendSuccess(c, { banner }, 'Banner created successfully');
    } catch (error) {
      console.error('Error creating banner:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/content/banners
   * Get all banners with filters
   */
  app.get(`${BASE_PATH}/admin/content/banners`, async (c) => {
    try {
      const bannersRepo = getBannersRepository();
      const type = c.req.query('type');
      const isActive = c.req.query('isActive');
      const targetRoleId = c.req.query('targetRoleId');

      const banners = await bannersRepo.findAll({
        type: type || undefined,
        is_active: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        target_role_id: targetRoleId || undefined
      });

      return sendSuccess(c, { banners, count: banners.length });
    } catch (error) {
      console.error('Error fetching banners:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /customer/content/banners
   * Get active banners for customer app
   */
  app.get(`${BASE_PATH}/customer/content/banners`, async (c) => {
    try {
      const bannersRepo = getBannersRepository();
      const type = c.req.query('type') || 'main';
      const roleId = c.req.query('roleId');

      const banners = await bannersRepo.findActiveByType(type, roleId || undefined);

      return sendSuccess(c, { banners, count: banners.length });
    } catch (error) {
      console.error('Error fetching customer banners:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/content/banners/:bannerId
   * Get a specific banner
   */
  app.get(`${BASE_PATH}/admin/content/banners/:bannerId`, async (c) => {
    try {
      const { bannerId } = c.req.param();
      const bannersRepo = getBannersRepository();
      
      const banner = await bannersRepo.findById(bannerId);
      if (!banner) {
        return sendError(c, 'Banner not found', 404);
      }

      return sendSuccess(c, { banner });
    } catch (error) {
      console.error('Error fetching banner:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /admin/content/banners/:bannerId
   * Update a banner
   */
  app.put(`${BASE_PATH}/admin/content/banners/:bannerId`, async (c) => {
    try {
      const { bannerId } = c.req.param();
      const updates = await c.req.json();
      const bannersRepo = getBannersRepository();

      const banner = await bannersRepo.findById(bannerId);
      if (!banner) {
        return sendError(c, 'Banner not found', 404);
      }

      // Map frontend fields to repository fields
      const updateData: any = {};
      if (updates.type !== undefined) updateData.type = updates.type;
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.subtitle !== undefined) updateData.subtitle = updates.subtitle;
      if (updates.imageUrl !== undefined) updateData.image_url = updates.imageUrl;
      if (updates.ctaText !== undefined) updateData.cta_text = updates.ctaText;
      if (updates.ctaLink !== undefined) updateData.cta_link = updates.ctaLink;
      if (updates.targetRoleId !== undefined) updateData.target_role_id = updates.targetRoleId;
      if (updates.targetServiceCategory !== undefined) updateData.target_service_category = updates.targetServiceCategory;
      if (updates.startDate !== undefined) updateData.start_date = updates.startDate;
      if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
      if (updates.displayOrder !== undefined) updateData.display_order = updates.displayOrder;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

      const updatedBanner = await bannersRepo.update(bannerId, updateData);

      return sendSuccess(c, { banner: updatedBanner }, 'Banner updated successfully');
    } catch (error) {
      console.error('Error updating banner:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /admin/content/banners/:bannerId
   * Delete a banner (soft delete)
   */
  app.delete(`${BASE_PATH}/admin/content/banners/:bannerId`, async (c) => {
    try {
      const { bannerId } = c.req.param();
      const bannersRepo = getBannersRepository();

      const banner = await bannersRepo.findById(bannerId);
      if (!banner) {
        return sendError(c, 'Banner not found', 404);
      }

      // Delete banner image from S3 if it's an S3 URL
      if (banner.image_url && banner.image_url.includes('.amazonaws.com/')) {
        try {
          await deleteFromS3(banner.image_url);
        } catch (error) {
          console.error('Error deleting banner image from S3:', error);
          // Continue with banner deletion even if S3 delete fails
        }
      }

      // Soft delete
      await bannersRepo.delete(bannerId);

      return sendSuccess(c, { message: 'Banner deleted successfully' });
    } catch (error) {
      console.error('Error deleting banner:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /customer/content/banners/:bannerId/track
   * Track banner view or click (analytics)
   */
  app.post(`${BASE_PATH}/customer/content/banners/:bannerId/track`, async (c) => {
    try {
      const { bannerId } = c.req.param();
      const body = await c.req.json();
      const { eventType, customerId } = body; // eventType: 'view' | 'click'

      if (!eventType || !['view', 'click'].includes(eventType)) {
        return sendError(c, 'Invalid eventType. Must be "view" or "click"', 400);
      }

      const bannersRepo = getBannersRepository();
      
      // Verify banner exists
      const banner = await bannersRepo.findById(bannerId);
      if (!banner) {
        return sendError(c, 'Banner not found', 404);
      }

      // Record analytics
      const metadata: any = {};
      const userAgent = c.req.header('user-agent');
      if (userAgent) metadata.user_agent = userAgent;
      // Note: IP address extraction may require middleware

      await bannersRepo.recordAnalytics(
        bannerId,
        eventType as 'view' | 'click',
        customerId,
        metadata
      );

      return sendSuccess(c, { message: 'Analytics recorded' });
    } catch (error) {
      console.error('Error recording banner analytics:', error);
      return sendError(c, error, 500);
    }
  });
}

