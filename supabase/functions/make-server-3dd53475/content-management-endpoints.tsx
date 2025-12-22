import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "npm:@aws-sdk/client-s3@3";

/**
 * CONTENT MANAGEMENT SYSTEM
 * Manages banners (spotlight, main), content library, and approved content for social media
 * All media content stored in S3
 */

export function registerContentManagementEndpoints(app: Hono) {

  // Helper: Upload file to S3
  async function uploadToS3(file: File, folder: string, fileName: string): Promise<string> {
    const awsSettings = await kv.get('admin:settings:aws') || {};
    const s3Config = awsSettings.s3 || {};

    if (!s3Config.enabled || !s3Config.bucket) {
      throw new Error('S3 not configured. Please configure S3 in Admin Portal → Platform Settings → Cloud & Maps → AWS S3');
    }

    const s3Client = new S3Client({
      region: s3Config.region || 'ap-south-1',
      credentials: {
        accessKeyId: s3Config.accessKeyId || awsSettings.credentials?.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey || awsSettings.credentials?.secretAccessKey
      }
    });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const key = `content/${folder}/${fileName}`;
    const command = new PutObjectCommand({
      Bucket: s3Config.bucket,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      ACL: 'public-read'
    });

    await s3Client.send(command);

    const url = `https://${s3Config.bucket}.s3.${s3Config.region || 'ap-south-1'}.amazonaws.com/${key}`;
    console.log(`✅ [S3] Uploaded content: ${key}`);
    return url;
  }

  // Helper: Delete file from S3
  async function deleteFromS3(url: string): Promise<void> {
    const awsSettings = await kv.get('admin:settings:aws') || {};
    const s3Config = awsSettings.s3 || {};

    if (!s3Config.enabled || !s3Config.bucket) {
      throw new Error('S3 not configured');
    }

    // Extract key from URL
    const urlParts = url.split('.amazonaws.com/');
    if (urlParts.length < 2) return;

    const key = urlParts[1];
    const s3Client = new S3Client({
      region: s3Config.region || 'ap-south-1',
      credentials: {
        accessKeyId: s3Config.accessKeyId || awsSettings.credentials?.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey || awsSettings.credentials?.secretAccessKey
      }
    });

    await s3Client.send(new DeleteObjectCommand({
      Bucket: s3Config.bucket,
      Key: key
    }));

    console.log(`✅ [S3] Deleted content: ${key}`);
  }

  // ============================================
  // BANNER MANAGEMENT
  // ============================================

  /**
   * POST /make-server-3dd53475/admin/content/banners
   * Create a new banner (spotlight or main)
   * Supports both direct imageUrl or file upload to S3
   */
  app.post("/make-server-3dd53475/admin/content/banners", async (c) => {
    try {
      // Check if this is a multipart form (file upload) or JSON
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
          type,
          title,
          subtitle: formData.get('subtitle') as string || '',
          imageUrl,
          ctaText: formData.get('ctaText') as string || '',
          ctaLink: formData.get('ctaLink') as string || '',
          targetAudience: formData.get('targetAudience') as string || 'all',
          applicableServices: JSON.parse(formData.get('applicableServices') as string || '[]'),
          startDate: formData.get('startDate') as string || new Date().toISOString(),
          endDate: formData.get('endDate') as string || null,
          priority: parseInt(formData.get('priority') as string || '0'),
          isActive: formData.get('isActive') === 'true',
          metadata: JSON.parse(formData.get('metadata') as string || '{}')
        };
      } else {
        const body = await c.req.json();
        const {
          type, // 'spotlight' | 'main'
          title,
          subtitle,
          imageUrl: providedImageUrl,
          ctaText,
          ctaLink,
          targetAudience, // 'all' | 'customer' | 'vendor' | 'specific_service'
          applicableServices, // Array of service IDs
          startDate,
          endDate,
          priority,
          isActive,
          metadata // Additional data (colors, gradients, etc.)
        } = body;

        if (!type || !title) {
          return sendError(c, 'Missing required fields: type, title', 400);
        }

        // If imageUrl is provided and it's not an S3 URL, we should upload it
        // For now, accept provided imageUrl (could be from previous upload)
        imageUrl = providedImageUrl || '';

        bannerData = {
          type,
          title,
          subtitle: subtitle || '',
          imageUrl,
          ctaText: ctaText || '',
          ctaLink: ctaLink || '',
          targetAudience: targetAudience || 'all',
          applicableServices: applicableServices || [],
          startDate: startDate || new Date().toISOString(),
          endDate: endDate || null,
          priority: priority || 0,
          isActive: isActive !== false,
          metadata: metadata || {}
        };
      }

      if (!imageUrl) {
        return sendError(c, 'Image URL is required. Please upload an image file or provide imageUrl', 400);
      }

      const bannerId = `banner_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const banner = {
        id: bannerId,
        ...bannerData,
        approvalStatus: 'pending', // pending, approved, rejected
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`content:banner:${bannerId}`, banner);

      // Index by type
      const typeIndexKey = `content:banners:${type}`;
      const typeBanners = await kv.get(typeIndexKey) || [];
      typeBanners.push(bannerId);
      await kv.set(typeIndexKey, typeBanners);

      // Global index
      const allBannersKey = 'content:banners:all';
      const allBanners = await kv.get(allBannersKey) || [];
      allBanners.push(bannerId);
      await kv.set(allBannersKey, allBanners);

      return sendSuccess(c, { banner }, 'Banner created successfully');
    } catch (error) {
      console.error('Error creating banner:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/admin/content/banners
   * Get all banners with filters
   */
  app.get("/make-server-3dd53475/admin/content/banners", async (c) => {
    try {
      const type = c.req.query('type'); // 'spotlight' | 'main'
      const status = c.req.query('status'); // 'active' | 'pending' | 'approved'
      const targetAudience = c.req.query('targetAudience');

      const indexKey = type ? `content:banners:${type}` : 'content:banners:all';
      const bannerIds = await kv.get(indexKey) || [];

      const banners = [];

      for (const bannerId of bannerIds) {
        const banner = await kv.get(`content:banner:${bannerId}`);
        if (banner) {
          // Apply filters
          if (status && banner.approvalStatus !== status) continue;
          if (targetAudience && banner.targetAudience !== targetAudience) continue;
          
          // Check if banner is currently active (date range)
          if (banner.isActive && banner.endDate) {
            const now = new Date();
            const endDate = new Date(banner.endDate);
            if (now > endDate) continue;
          }

          banners.push(banner);
        }
      }

      // Sort by priority (highest first), then by creation date
      banners.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      return sendSuccess(c, { banners, count: banners.length });
    } catch (error) {
      console.error('Error fetching banners:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/customer/content/banners
   * Get active approved banners for customer app
   */
  app.get("/make-server-3dd53475/customer/content/banners", async (c) => {
    try {
      const type = c.req.query('type'); // 'spotlight' | 'main'
      const serviceId = c.req.query('serviceId'); // Optional: filter by service

      const indexKey = type ? `content:banners:${type}` : 'content:banners:all';
      const bannerIds = await kv.get(indexKey) || [];

      const now = new Date();
      const activeBanners = [];

      for (const bannerId of bannerIds) {
        const banner = await kv.get(`content:banner:${bannerId}`);
        if (!banner) continue;

        // Only return approved and active banners
        if (banner.approvalStatus !== 'approved' || !banner.isActive) continue;

        // Check date range
        const startDate = new Date(banner.startDate);
        if (now < startDate) continue;

        if (banner.endDate) {
          const endDate = new Date(banner.endDate);
          if (now > endDate) continue;
        }

        // Check target audience
        if (banner.targetAudience !== 'all' && banner.targetAudience !== 'customer') continue;

        // Check service applicability
        if (serviceId && banner.applicableServices.length > 0) {
          if (!banner.applicableServices.includes(serviceId)) continue;
        }

        activeBanners.push(banner);
      }

      // Sort by priority
      activeBanners.sort((a, b) => b.priority - a.priority);

      return sendSuccess(c, { banners: activeBanners, count: activeBanners.length });
    } catch (error) {
      console.error('Error fetching customer banners:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /make-server-3dd53475/admin/content/banners/:bannerId
   * Update a banner
   */
  app.put("/make-server-3dd53475/admin/content/banners/:bannerId", async (c) => {
    try {
      const { bannerId } = c.req.param();
      const updates = await c.req.json();

      const banner = await kv.get(`content:banner:${bannerId}`);
      if (!banner) {
        return sendError(c, 'Banner not found', 404);
      }

      const updatedBanner = {
        ...banner,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`content:banner:${bannerId}`, updatedBanner);

      return sendSuccess(c, { banner: updatedBanner }, 'Banner updated successfully');
    } catch (error) {
      console.error('Error updating banner:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/admin/content/banners/:bannerId/approve
   * Approve a banner
   */
  app.post("/make-server-3dd53475/admin/content/banners/:bannerId/approve", async (c) => {
    try {
      const { bannerId } = c.req.param();
      const { approvedBy } = await c.req.json();

      const banner = await kv.get(`content:banner:${bannerId}`);
      if (!banner) {
        return sendError(c, 'Banner not found', 404);
      }

      banner.approvalStatus = 'approved';
      banner.approvedBy = approvedBy;
      banner.approvedAt = new Date().toISOString();
      banner.updatedAt = new Date().toISOString();

      await kv.set(`content:banner:${bannerId}`, banner);

      return sendSuccess(c, { banner }, 'Banner approved successfully');
    } catch (error) {
      console.error('Error approving banner:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /make-server-3dd53475/admin/content/banners/:bannerId
   * Delete a banner
   */
  app.delete("/make-server-3dd53475/admin/content/banners/:bannerId", async (c) => {
    try {
      const { bannerId } = c.req.param();

      const banner = await kv.get(`content:banner:${bannerId}`);
      if (!banner) {
        return sendError(c, 'Banner not found', 404);
      }

      // Remove from indexes
      const typeIndexKey = `content:banners:${banner.type}`;
      const typeBanners = await kv.get(typeIndexKey) || [];
      const filteredTypeBanners = typeBanners.filter((id: string) => id !== bannerId);
      await kv.set(typeIndexKey, filteredTypeBanners);

      const allBannersKey = 'content:banners:all';
      const allBanners = await kv.get(allBannersKey) || [];
      const filteredAllBanners = allBanners.filter((id: string) => id !== bannerId);
      await kv.set(allBannersKey, filteredAllBanners);

      // Delete banner image from S3 if it's an S3 URL
      if (banner.imageUrl && banner.imageUrl.includes('.amazonaws.com/')) {
        try {
          await deleteFromS3(banner.imageUrl);
        } catch (error) {
          console.error('Error deleting banner image from S3:', error);
          // Continue with banner deletion even if S3 delete fails
        }
      }

      // Delete banner
      await kv.delete(`content:banner:${bannerId}`);

      return sendSuccess(c, { message: 'Banner deleted successfully' });
    } catch (error) {
      console.error('Error deleting banner:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // CONTENT LIBRARY MANAGEMENT
  // ============================================

  /**
   * POST /make-server-3dd53475/admin/content/assets
   * Upload/create a content asset
   * Supports both direct URL or file upload to S3
   */
  app.post("/make-server-3dd53475/admin/content/assets", async (c) => {
    try {
      const contentType = c.req.header('content-type') || '';
      let assetData: any = {};
      let url = '';
      let thumbnail = '';

      if (contentType.includes('multipart/form-data')) {
        const formData = await c.req.formData();
        const file = formData.get('file') as File;
        const name = formData.get('name') as string;
        const type = formData.get('type') as string;

        if (!name || !type || !file) {
          return sendError(c, 'Missing required fields: name, type, file', 400);
        }

        // Upload to S3
        const timestamp = Date.now();
        const fileExt = file.name.split('.').pop();
        const fileName = `${type}_${timestamp}.${fileExt}`;
        url = await uploadToS3(file, 'assets', fileName);

        // For images, use the same URL as thumbnail
        if (type === 'image') {
          thumbnail = url;
        } else {
          thumbnail = formData.get('thumbnail') as string || url;
        }

        assetData = {
          name,
          type,
          url,
          thumbnail,
          size: file.size.toString(),
          tags: JSON.parse(formData.get('tags') as string || '[]'),
          category: formData.get('category') as string || 'general',
          description: formData.get('description') as string || '',
          usageContext: formData.get('usageContext') as string || 'internal'
        };
      } else {
        const body = await c.req.json();
        const {
          name,
          type, // 'image' | 'video' | 'document'
          url: providedUrl,
          thumbnail: providedThumbnail,
          size,
          tags,
          category,
          description,
          usageContext // 'social_media' | 'internal' | 'banner' | 'promotion'
        } = body;

        if (!name || !type) {
          return sendError(c, 'Missing required fields: name, type', 400);
        }

        url = providedUrl || '';
        thumbnail = providedThumbnail || url;

        assetData = {
          name,
          type,
          url,
          thumbnail,
          size: size || '0',
          tags: tags || [],
          category: category || 'general',
          description: description || '',
          usageContext: usageContext || 'internal'
        };
      }

      if (!url) {
        return sendError(c, 'URL is required. Please upload a file or provide url', 400);
      }

      const assetId = `asset_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const asset = {
        id: assetId,
        ...assetData,
        usageCount: 0,
        approvalStatus: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`content:asset:${assetId}`, asset);

      // Index by type
      const typeIndexKey = `content:assets:${type}`;
      const typeAssets = await kv.get(typeIndexKey) || [];
      typeAssets.push(assetId);
      await kv.set(typeIndexKey, typeAssets);

      // Index by category
      const categoryIndexKey = `content:assets:category:${category || 'general'}`;
      const categoryAssets = await kv.get(categoryIndexKey) || [];
      categoryAssets.push(assetId);
      await kv.set(categoryIndexKey, categoryAssets);

      // Global index
      const allAssetsKey = 'content:assets:all';
      const allAssets = await kv.get(allAssetsKey) || [];
      allAssets.push(assetId);
      await kv.set(allAssetsKey, allAssets);

      return sendSuccess(c, { asset }, 'Asset created successfully');
    } catch (error) {
      console.error('Error creating asset:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/admin/content/assets
   * Get all assets with filters
   */
  app.get("/make-server-3dd53475/admin/content/assets", async (c) => {
    try {
      const type = c.req.query('type');
      const category = c.req.query('category');
      const status = c.req.query('status'); // 'approved' | 'pending'
      const usageContext = c.req.query('usageContext');

      const indexKey = type ? `content:assets:${type}` : 'content:assets:all';
      const assetIds = await kv.get(indexKey) || [];

      const assets = [];

      for (const assetId of assetIds) {
        const asset = await kv.get(`content:asset:${assetId}`);
        if (!asset) continue;

        // Apply filters
        if (category && asset.category !== category) continue;
        if (status && asset.approvalStatus !== status) continue;
        if (usageContext && asset.usageContext !== usageContext) continue;

        assets.push(asset);
      }

      // Sort by creation date (newest first)
      assets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return sendSuccess(c, { assets, count: assets.length });
    } catch (error) {
      console.error('Error fetching assets:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/admin/content/assets/:assetId
   * Get a specific asset
   */
  app.get("/make-server-3dd53475/admin/content/assets/:assetId", async (c) => {
    try {
      const { assetId } = c.req.param();

      const asset = await kv.get(`content:asset:${assetId}`);
      if (!asset) {
        return sendError(c, 'Asset not found', 404);
      }

      return sendSuccess(c, { asset });
    } catch (error) {
      console.error('Error fetching asset:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /make-server-3dd53475/admin/content/assets/:assetId
   * Update an asset
   */
  app.put("/make-server-3dd53475/admin/content/assets/:assetId", async (c) => {
    try {
      const { assetId } = c.req.param();
      const updates = await c.req.json();

      const asset = await kv.get(`content:asset:${assetId}`);
      if (!asset) {
        return sendError(c, 'Asset not found', 404);
      }

      const updatedAsset = {
        ...asset,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`content:asset:${assetId}`, updatedAsset);

      return sendSuccess(c, { asset: updatedAsset }, 'Asset updated successfully');
    } catch (error) {
      console.error('Error updating asset:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/admin/content/assets/:assetId/approve
   * Approve an asset for use
   */
  app.post("/make-server-3dd53475/admin/content/assets/:assetId/approve", async (c) => {
    try {
      const { assetId } = c.req.param();
      const { approvedBy } = await c.req.json();

      const asset = await kv.get(`content:asset:${assetId}`);
      if (!asset) {
        return sendError(c, 'Asset not found', 404);
      }

      asset.approvalStatus = 'approved';
      asset.approvedBy = approvedBy;
      asset.approvedAt = new Date().toISOString();
      asset.updatedAt = new Date().toISOString();

      await kv.set(`content:asset:${assetId}`, asset);

      return sendSuccess(c, { asset }, 'Asset approved successfully');
    } catch (error) {
      console.error('Error approving asset:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /make-server-3dd53475/admin/content/assets/:assetId
   * Delete an asset
   */
  app.delete("/make-server-3dd53475/admin/content/assets/:assetId", async (c) => {
    try {
      const { assetId } = c.req.param();

      const asset = await kv.get(`content:asset:${assetId}`);
      if (!asset) {
        return sendError(c, 'Asset not found', 404);
      }

      // Remove from indexes
      const typeIndexKey = `content:assets:${asset.type}`;
      const typeAssets = await kv.get(typeIndexKey) || [];
      const filteredTypeAssets = typeAssets.filter((id: string) => id !== assetId);
      await kv.set(typeIndexKey, filteredTypeAssets);

      const categoryIndexKey = `content:assets:category:${asset.category}`;
      const categoryAssets = await kv.get(categoryIndexKey) || [];
      const filteredCategoryAssets = categoryAssets.filter((id: string) => id !== assetId);
      await kv.set(categoryIndexKey, filteredCategoryAssets);

      const allAssetsKey = 'content:assets:all';
      const allAssets = await kv.get(allAssetsKey) || [];
      const filteredAllAssets = allAssets.filter((id: string) => id !== assetId);
      await kv.set(allAssetsKey, filteredAllAssets);

      // Delete asset files from S3 if they're S3 URLs
      if (asset.url && asset.url.includes('.amazonaws.com/')) {
        try {
          await deleteFromS3(asset.url);
        } catch (error) {
          console.error('Error deleting asset from S3:', error);
        }
      }
      if (asset.thumbnail && asset.thumbnail.includes('.amazonaws.com/') && asset.thumbnail !== asset.url) {
        try {
          await deleteFromS3(asset.thumbnail);
        } catch (error) {
          console.error('Error deleting thumbnail from S3:', error);
        }
      }

      // Delete asset
      await kv.delete(`content:asset:${assetId}`);

      return sendSuccess(c, { message: 'Asset deleted successfully' });
    } catch (error) {
      console.error('Error deleting asset:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // CONTENT STATISTICS
  // ============================================

  /**
   * GET /make-server-3dd53475/admin/content/stats
   * Get content management statistics
   */
  app.get("/make-server-3dd53475/admin/content/stats", async (c) => {
    try {
      const allBanners = await kv.get('content:banners:all') || [];
      const allAssets = await kv.get('content:assets:all') || [];

      let scheduledPosts = 0;
      let totalAssets = 0;
      let approvedAssets = 0;
      let pendingBanners = 0;

      for (const assetId of allAssets) {
        const asset = await kv.get(`content:asset:${assetId}`);
        if (asset) {
          totalAssets++;
          if (asset.approvalStatus === 'approved') approvedAssets++;
        }
      }

      for (const bannerId of allBanners) {
        const banner = await kv.get(`content:banner:${bannerId}`);
        if (banner && banner.approvalStatus === 'pending') pendingBanners++;
      }

      const stats = {
        scheduledPosts: {
          count: scheduledPosts,
          status: 'Ready to Publish'
        },
        totalAssets: {
          count: totalAssets.toString(),
          type: 'Images & Videos'
        },
        engagementRate: {
          rate: '89%',
          period: "this month's avg"
        },
        ugcSubmissions: {
          count: 156,
          status: 'Pending Review'
        },
        banners: {
          total: allBanners.length,
          pending: pendingBanners,
          approved: allBanners.length - pendingBanners
        },
        assets: {
          total: totalAssets,
          approved: approvedAssets,
          pending: totalAssets - approvedAssets
        }
      };

      return sendSuccess(c, { stats });
    } catch (error) {
      console.error('Error fetching content stats:', error);
      return sendError(c, error, 500);
    }
  });
}

