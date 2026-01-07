"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBannerEndpointsSQL = registerBannerEndpointsSQL;
const response_utils_1 = require("./response-utils");
const db_1 = require("../lib/db");
const client_s3_1 = require("@aws-sdk/client-s3");
function registerBannerEndpointsSQL(app) {
    // Helper: Get S3 client from platform settings
    async function getS3Client() {
        try {
            const pool = await (0, db_1.getDbClient)();
            const settingsResult = await pool.query("SELECT value FROM platform_settings WHERE key = 'aws_config' AND type = 'json' LIMIT 1");
            const awsSettings = settingsResult.rows[0]?.value || null;
            if (!awsSettings || !awsSettings.s3_config?.enabled || !awsSettings.s3_config?.bucket) {
                return null;
            }
            const s3Config = awsSettings.s3_config;
            const client = new client_s3_1.S3Client({
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
        }
        catch (error) {
            console.error('Error getting S3 client:', error);
            return null;
        }
    }
    // Helper: Upload file to S3
    async function uploadToS3(file, folder, fileName) {
        const s3Info = await getS3Client();
        if (!s3Info) {
            throw new Error('S3 not configured. Please configure S3 in Admin Portal → Platform Settings → Cloud & Maps → AWS S3');
        }
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        const key = `content/${folder}/${fileName}`;
        const command = new client_s3_1.PutObjectCommand({
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
    async function deleteFromS3(url) {
        const s3Info = await getS3Client();
        if (!s3Info) {
            return; // Silently fail if S3 not configured
        }
        // Extract key from URL
        const urlParts = url.split('.amazonaws.com/');
        if (urlParts.length < 2)
            return;
        const key = urlParts[1];
        await s3Info.client.send(new client_s3_1.DeleteObjectCommand({
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
            const pool = await (0, db_1.getDbClient)();
            const contentType = c.req.header('content-type') || '';
            let bannerData = {};
            let imageUrl = '';
            if (contentType.includes('multipart/form-data')) {
                const formData = await c.req.formData();
                const file = formData.get('image');
                const type = formData.get('type');
                const title = formData.get('title');
                if (!type || !title || !file) {
                    return (0, response_utils_1.sendError)(c, 'Missing required fields: type, title, image file', 400);
                }
                // Upload to S3
                const timestamp = Date.now();
                const fileExt = file.name.split('.').pop();
                const fileName = `banner_${type}_${timestamp}.${fileExt}`;
                imageUrl = await uploadToS3(file, 'banners', fileName);
                bannerData = {
                    type: type,
                    title,
                    subtitle: formData.get('subtitle') || undefined,
                    image_url: imageUrl,
                    cta_text: formData.get('ctaText') || undefined,
                    cta_link: formData.get('ctaLink') || undefined,
                    target_role_id: formData.get('targetRoleId') || undefined,
                    target_service_category: formData.get('targetServiceCategory') || undefined,
                    start_date: formData.get('startDate') || undefined,
                    end_date: formData.get('endDate') || undefined,
                    display_order: parseInt(formData.get('displayOrder') || '0'),
                    is_active: formData.get('isActive') !== 'false',
                    metadata: JSON.parse(formData.get('metadata') || '{}')
                };
            }
            else {
                const body = await c.req.json();
                const { type, title, subtitle, imageUrl: providedImageUrl, ctaText, ctaLink, targetRoleId, targetServiceCategory, startDate, endDate, displayOrder, isActive, metadata } = body;
                if (!type || !title) {
                    return (0, response_utils_1.sendError)(c, 'Missing required fields: type, title', 400);
                }
                imageUrl = providedImageUrl || '';
                bannerData = {
                    type: type,
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
                return (0, response_utils_1.sendError)(c, 'Image URL is required. Please upload an image file or provide imageUrl', 400);
            }
            const bannerId = `banner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const [banner] = await (0, db_1.insertQuery)('banners', {
                id: bannerId,
                ...bannerData,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            return (0, response_utils_1.sendSuccess)(c, { banner }, 'Banner created successfully');
        }
        catch (error) {
            console.error('Error creating banner:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /admin/content/banners
     * Get all banners with filters
     */
    app.get(`${BASE_PATH}/admin/content/banners`, async (c) => {
        try {
            const pool = await (0, db_1.getDbClient)();
            const type = c.req.query('type');
            const isActive = c.req.query('isActive');
            const targetRoleId = c.req.query('targetRoleId');
            const filters = {};
            if (type)
                filters.type = type;
            if (isActive === 'true')
                filters.is_active = true;
            if (isActive === 'false')
                filters.is_active = false;
            if (targetRoleId)
                filters.target_role_id = targetRoleId;
            const banners = await (0, db_1.selectQuery)('banners', filters);
            return (0, response_utils_1.sendSuccess)(c, { banners, count: banners.length });
        }
        catch (error) {
            console.error('Error fetching banners:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /customer/content/banners
     * Get active banners for customer app
     */
    app.get(`${BASE_PATH}/customer/content/banners`, async (c) => {
        try {
            const pool = await (0, db_1.getDbClient)();
            const type = c.req.query('type') || 'main';
            const roleId = c.req.query('roleId');
            const filters = { type, is_active: true };
            if (roleId)
                filters.target_role_id = roleId;
            const banners = await (0, db_1.selectQuery)('banners', filters, {
                orderBy: 'display_order',
                orderDirection: 'asc'
            });
            return (0, response_utils_1.sendSuccess)(c, { banners, count: banners.length });
        }
        catch (error) {
            console.error('Error fetching customer banners:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /admin/content/banners/:bannerId
     * Get a specific banner
     */
    app.get(`${BASE_PATH}/admin/content/banners/:bannerId`, async (c) => {
        try {
            const { bannerId } = c.req.param();
            const pool = await (0, db_1.getDbClient)();
            const [banner] = await (0, db_1.selectQuery)('banners', { id: bannerId }, { limit: 1 });
            if (!banner) {
                return (0, response_utils_1.sendError)(c, 'Banner not found', 404);
            }
            return (0, response_utils_1.sendSuccess)(c, { banner });
        }
        catch (error) {
            console.error('Error fetching banner:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
            const pool = await (0, db_1.getDbClient)();
            const [banner] = await (0, db_1.selectQuery)('banners', { id: bannerId }, { limit: 1 });
            if (!banner) {
                return (0, response_utils_1.sendError)(c, 'Banner not found', 404);
            }
            // Map frontend fields to repository fields
            const updateData = {};
            if (updates.type !== undefined)
                updateData.type = updates.type;
            if (updates.title !== undefined)
                updateData.title = updates.title;
            if (updates.subtitle !== undefined)
                updateData.subtitle = updates.subtitle;
            if (updates.imageUrl !== undefined)
                updateData.image_url = updates.imageUrl;
            if (updates.ctaText !== undefined)
                updateData.cta_text = updates.ctaText;
            if (updates.ctaLink !== undefined)
                updateData.cta_link = updates.ctaLink;
            if (updates.targetRoleId !== undefined)
                updateData.target_role_id = updates.targetRoleId;
            if (updates.targetServiceCategory !== undefined)
                updateData.target_service_category = updates.targetServiceCategory;
            if (updates.startDate !== undefined)
                updateData.start_date = updates.startDate;
            if (updates.endDate !== undefined)
                updateData.end_date = updates.endDate;
            if (updates.displayOrder !== undefined)
                updateData.display_order = updates.displayOrder;
            if (updates.isActive !== undefined)
                updateData.is_active = updates.isActive;
            if (updates.metadata !== undefined)
                updateData.metadata = updates.metadata;
            const [updatedBanner] = await (0, db_1.updateQuery)('banners', { id: bannerId }, {
                ...updateData,
                updated_at: new Date().toISOString()
            });
            return (0, response_utils_1.sendSuccess)(c, { banner: updatedBanner }, 'Banner updated successfully');
        }
        catch (error) {
            console.error('Error updating banner:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * DELETE /admin/content/banners/:bannerId
     * Delete a banner (soft delete)
     */
    app.delete(`${BASE_PATH}/admin/content/banners/:bannerId`, async (c) => {
        try {
            const { bannerId } = c.req.param();
            const pool = await (0, db_1.getDbClient)();
            const [banner] = await (0, db_1.selectQuery)('banners', { id: bannerId }, { limit: 1 });
            if (!banner) {
                return (0, response_utils_1.sendError)(c, 'Banner not found', 404);
            }
            // Delete banner image from S3 if it's an S3 URL
            if (banner.image_url && banner.image_url.includes('.amazonaws.com/')) {
                try {
                    await deleteFromS3(banner.image_url);
                }
                catch (error) {
                    console.error('Error deleting banner image from S3:', error);
                    // Continue with banner deletion even if S3 delete fails
                }
            }
            // Soft delete
            await (0, db_1.deleteQuery)('banners', { id: bannerId });
            return (0, response_utils_1.sendSuccess)(c, { message: 'Banner deleted successfully' });
        }
        catch (error) {
            console.error('Error deleting banner:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
                return (0, response_utils_1.sendError)(c, 'Invalid eventType. Must be "view" or "click"', 400);
            }
            const pool = await (0, db_1.getDbClient)();
            // Verify banner exists
            const [banner] = await (0, db_1.selectQuery)('banners', { id: bannerId }, { limit: 1 });
            if (!banner) {
                return (0, response_utils_1.sendError)(c, 'Banner not found', 404);
            }
            // Record analytics
            const metadata = {};
            const userAgent = c.req.header('user-agent');
            if (userAgent)
                metadata.user_agent = userAgent;
            // Note: IP address extraction may require middleware
            await pool.query(`INSERT INTO banner_analytics (banner_id, event_type, customer_id, metadata, created_at)
         VALUES ($1, $2, $3, $4::jsonb, NOW())`, [bannerId, eventType, customerId, JSON.stringify(metadata || {})]);
            return (0, response_utils_1.sendSuccess)(c, { message: 'Analytics recorded' });
        }
        catch (error) {
            console.error('Error recording banner analytics:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
}
//# sourceMappingURL=banner-endpoints-sql.js.map