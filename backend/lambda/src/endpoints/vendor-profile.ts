/**
 * ============================================================================
 * VENDOR PROFILE MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles vendor profile updates with intelligent re-approval logic:
 * - Update vendor profile
 * - Check edit permissions
 * - Re-approval workflow
 * 
 * Migrated from: supabase/functions/server/vendor-profile-update.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, update, insert, query } from '../database/rds-connection';
import { getSnsClient } from '../utils/sns-client';
import { PublishCommand } from '@aws-sdk/client-sns';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { getEffectiveCapabilities } from '../utils/capability-filter';

// Fields that require re-approval if changed
const CRITICAL_FIELDS = [
  'business_name',
  'owner_name',
  'gst_number',
  'pan_number',
  'registration_number',
  'address',
  'city',
  'state',
  'pincode',
  'latitude',
  'longitude',
];

/** Normalize phone to digits-only for consistent lookup (e.g. +919876543210 → 919876543210). */
function normalizePhoneForLookup(phone: string | undefined): string | undefined {
  if (phone == null || String(phone).trim() === '') return undefined;
  return String(phone).replace(/\D/g, '');
}

/** Resolve vendor by ID - checks vendors, then vendor_identity with auto-create. Returns vendor row or null. Exported for use by vendor-schedule. */
export async function resolveVendorById(vendorId: string): Promise<any | null> {
  const trimmedId = (vendorId || '').trim();
  if (!trimmedId) return null;

  let vendors = await select('vendors', { id: trimmedId });
  if (vendors.length > 0) return vendors[0];

  console.log(`[PROFILE] Vendor ${trimmedId} not in vendors table, checking vendor_identity...`);
  let identities = await select('vendor_identity', { id: trimmedId });
  if (identities.length === 0) {
    // Fallback: vendor_identity.vendor_id in case frontend has vendors.id
    const byVendorId = await query(
      `SELECT * FROM vendor_identity WHERE vendor_id = $1 LIMIT 1`,
      [trimmedId]
    ).catch(() => ({ rows: [] }));
    if (byVendorId.rows?.length > 0) {
      const identity = byVendorId.rows[0];
      const linked = await select('vendors', { id: identity.vendor_id });
      if (linked.length > 0) return linked[0];
    }
    // Fallback: text comparison in case of type/format mismatch (e.g. UUID vs text)
    const byText = await query(
      `SELECT * FROM vendor_identity WHERE id::text = $1 OR vendor_id::text = $1 LIMIT 1`,
      [trimmedId]
    ).catch(() => ({ rows: [] }));
    if (byText.rows?.length > 0) identities = byText.rows;
    if (identities.length === 0) {
      // Fallback: via vendor_onboarding_applications (frontend may send application id)
      const viaApp = await query(
        `SELECT vi.* FROM vendor_identity vi
         INNER JOIN vendor_onboarding_applications voa ON voa.vendor_identity_id = vi.id
         WHERE voa.id::text = $1 OR voa.vendor_identity_id::text = $1 OR vi.id::text = $1 LIMIT 1`,
        [trimmedId]
      ).catch(() => ({ rows: [] }));
      if (viaApp.rows?.length > 0) identities = viaApp.rows;
    }
    if (identities.length === 0) return null;
  }

  const identity = identities[0];
  if (identity.onboarding_status !== 'APPROVED' && identity.onboarding_status !== 'ACTIVATED') {
    return null;
  }

  const phoneNorm = normalizePhoneForLookup(identity.phone);
  if (phoneNorm) {
    const vendorByPhone = await query(
      `SELECT * FROM vendors WHERE REPLACE(REPLACE(phone, ' ', ''), '+', '') LIKE $1 OR phone = $2 LIMIT 1`,
      [`%${phoneNorm}%`, identity.phone]
    ).catch(() => ({ rows: [] }));
    if (vendorByPhone.rows?.length > 0) return vendorByPhone.rows[0];
  }
  const vendorByPhoneDirect = await select('vendors', { phone: identity.phone });
  if (vendorByPhoneDirect.length > 0) return vendorByPhoneDirect[0];

  const applications = await select('vendor_onboarding_applications', { vendor_identity_id: identity.id });
  const application = applications.length > 0 ? applications[0] : null;
  const payload = application?.application_payload || {};

  const newVendorId = identity.vendor_id || identity.id;
  console.log(`[PROFILE] Auto-creating vendor record for approved vendor ${identity.id}, using vendor id: ${newVendorId}`);
  const newVendor = await insert('vendors', {
    id: newVendorId,
    phone: identity.phone,
    email: payload.email || payload.businessEmail || `vendor-${identity.phone}@warmpawz.app`,
    business_name: payload.businessName || payload.business_name || `Vendor ${identity.phone}`,
    owner_name: payload.contactPersonName || payload.ownerName || 'Vendor Owner',
    role_id: identity.selected_role_id,
    vendor_type: (identity as any).vendor_type || payload.vendorType || payload.vendor_type || 'business',
    category: 'general',
    address: payload.address || 'Not specified',
    city: payload.city || 'Not specified',
    state: payload.state || 'Not specified',
    pincode: payload.pin || payload.pincode || '',
    status: 'active',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return newVendor[0];
}

// Helper to decode JWT and extract phone number
async function decodeJwtFromHeader(authHeader: string | undefined): Promise<{ phone?: string; userId?: string }> {
  if (!authHeader) return {};
  
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return {};
  
  try {
    // Decode JWT payload (base64)
    const parts = token.split('.');
    if (parts.length !== 3) return {};
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    // ✅ FIX: Support multiple JWT formats - our custom JWT uses 'phone', Cognito uses 'phone_number'
    const phone = payload.phone || payload.phone_number || payload['cognito:username'];
    const userId = payload.userId || payload.sub || payload.user_id;
    console.log(`🔐 [JWT-DECODE] Extracted phone: ${phone}, userId: ${userId}`);
    return {
      phone,
      userId,
    };
  } catch (e) {
    console.warn('Failed to decode JWT:', e);
    return {};
  }
}

export function registerVendorProfileEndpoints(app: Hono) {
  /**
   * GET /vendor/profile
   * Get current vendor profile based on authenticated user (via JWT)
   */
  app.get("/vendor/profile", async (c) => {
    try {
      // Decode JWT from Authorization header to get phone number
      const authHeader = c.req.header('Authorization');
      const { phone, userId: vendorIdFromAuth } = await decodeJwtFromHeader(authHeader);

      console.log(`📊 [PROFILE-GET] Getting profile for phone: ${phone}, vendorId: ${vendorIdFromAuth}`);

      let vendor = null;
      let identityData = null;

      // Try to find vendor by vendorId first (userId from JWT might be vendor ID)
      if (vendorIdFromAuth && !vendorIdFromAuth.startsWith('temp_')) {
        try {
          const vendors = await select('vendors', { id: vendorIdFromAuth });
          if (vendors.length > 0) {
            vendor = vendors[0];
          }
        } catch (e) {
          console.warn(`[PROFILE-GET] Error finding vendor by ID ${vendorIdFromAuth}:`, e);
        }
      }

      // If not found by vendorId, try by phone directly on vendors table
      if (!vendor && phone) {
        try {
          const vendorsByPhone = await select('vendors', { phone });
          if (vendorsByPhone.length > 0) {
            vendor = vendorsByPhone[0];
          }
        } catch (e) {
          console.warn(`[PROFILE-GET] Error finding vendor by phone:`, e);
        }
      }
      
      // Also fetch vendor_identity for onboarding status (handle missing vendor_id column gracefully)
      if (phone) {
        try {
          const identities = await select('vendor_identity', { phone });
          if (identities.length > 0) {
            identityData = identities[0];
            // Try to link vendor via vendor_id if column exists and vendor not found yet
            if (!vendor && identityData && typeof identityData.vendor_id === 'string') {
              try {
                const vendors = await select('vendors', { id: identityData.vendor_id });
                if (vendors.length > 0) {
                  vendor = vendors[0];
                }
              } catch (e) {
                console.warn(`[PROFILE-GET] Error finding vendor by identity.vendor_id:`, e);
              }
            }
          }
        } catch (e) {
          console.warn(`[PROFILE-GET] Error fetching vendor_identity:`, e);
        }
      }

      if (!vendor) {
        // No vendor record found - check if there's identity data for onboarding
        if (identityData) {
          // Vendor is in onboarding but not yet approved (no vendors table entry)
          const identityStatus = identityData.onboarding_status || 'INIT';
          console.log(`📝 [PROFILE-GET] Vendor in onboarding, status: ${identityStatus}`);
          return c.json({
            success: true,
            vendor: {
              id: identityData.id,
              phone: phone,
              status: identityStatus.toLowerCase(),
              isActive: false,
              onboardingStatus: identityStatus,
            },
            status: identityStatus === 'APPROVED' ? 'approved' : (identityStatus === 'INIT' ? 'new' : identityStatus.toLowerCase()),
            message: 'Vendor in onboarding'
          });
        }
        
        console.log(`⚠️ [PROFILE-GET] No vendor found for phone: ${phone}`);
        return c.json({
          success: true,
          vendor: null,
          status: 'new',
          message: 'No vendor profile found'
        });
      }

      // Get application data if exists (handle missing columns gracefully)
      let applicationData = null;
      try {
        // Try to find by vendor_id first
        const applications = await select('vendor_onboarding_applications', { vendor_id: vendor.id });
        if (applications.length > 0) {
          applicationData = applications[0];
        }
      } catch (e) {
        // vendor_id column might not exist, try by phone
        try {
          const appsByPhone = await query(
            'SELECT * FROM vendor_onboarding_applications WHERE application_payload->>\'phone\' = $1 ORDER BY created_at DESC LIMIT 1',
            [phone]
          );
          if (appsByPhone.rows?.length > 0) {
            applicationData = appsByPhone.rows[0];
          }
        } catch (e2) {
          console.warn('[PROFILE-GET] Error fetching applications:', e2);
        }
      }

      // Get role info
      let roleInfo = null;
      try {
        if (vendor.role_id) {
          const roles = await select('roles', { id: vendor.role_id });
          if (roles.length > 0) {
            roleInfo = roles[0];
          }
        }
      } catch (e) {
        console.warn('[PROFILE-GET] Error fetching role info:', e);
      }

      // Determine vendor status for UI
      let uiStatus = 'new';
      if (vendor.is_active) {
        uiStatus = 'active';
      } else if (vendor.status === 'approved') {
        uiStatus = vendor.setup_completed ? 'active' : 'approved';
      } else if (vendor.status === 'pending' || vendor.status === 'under_review') {
        uiStatus = 'pending';
      } else if (vendor.status === 'rejected') {
        uiStatus = 'rejected';
      } else if (applicationData?.status) {
        uiStatus = applicationData.status;
      }

      console.log(`✅ [PROFILE-GET] Found vendor: ${vendor.id}, status: ${uiStatus}`);

      return c.json({
        success: true,
        vendor: {
          id: vendor.id,
          businessName: vendor.business_name,
          ownerName: vendor.owner_name,
          phone: vendor.phone,
          email: vendor.email,
          status: uiStatus,
          isActive: vendor.is_active,
          setupCompleted: vendor.setup_completed,
          servicesSetupCompleted: vendor.services_setup_completed,
          availabilitySetupCompleted: vendor.availability_setup_completed,
          roleId: vendor.role_id,
          roleName: roleInfo?.name,
          vendorType: vendor.vendor_type,
          serviceStyle: vendor.service_style,
          applicationId: applicationData?.id,
          applicationStatus: applicationData?.status,
          createdAt: vendor.created_at
        }
      });
    } catch (error: any) {
      console.error('❌ [PROFILE-GET] Error:', error);
      return c.json({ error: 'Failed to get vendor profile', details: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/profile/photo
   * Upload vendor profile photo to S3
   */
  app.post("/vendor/:vendorId/profile/photo", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      console.log(`📸 [PROFILE-PHOTO] Uploading photo for vendor: ${vendorId}`);
      
      // Verify vendor exists (same resolver as GET profile - supports vendor_identity + auto-create)
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Parse the multipart form data
      const formData = await c.req.formData();
      const photo = formData.get('photo') as File;
      
      if (!photo) {
        return c.json({ error: 'No photo provided' }, 400);
      }

      // Upload to S3
      const { S3Client, PutObjectCommand, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      
      const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
      const BUCKET_NAME = process.env.S3_UPLOADS_BUCKET || 'warmpawz-dev-uploads';
      
      // Generate unique filename
      const timestamp = Date.now();
      const ext = photo.name.split('.').pop() || 'jpg';
      const actualVendorId = vendor.id; // Use resolved vendor id (may differ from URL if matched by phone)
      const fileName = `vendors/${actualVendorId}/profile/photo_${timestamp}.${ext}`;
      
      // Convert File to ArrayBuffer and upload
      const arrayBuffer = await photo.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: uint8Array,
        ContentType: photo.type || 'image/jpeg',
      }));
      
      // Generate presigned URL for access (valid for 1 year)
      const signedUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileName,
        }),
        { expiresIn: 604800 } // 7 days (max for presigned URLs)
      );
      
      // Update vendor with new photo URL (use resolved vendor.id, not URL param)
      await update('vendors', { id: actualVendorId }, {
        profile_photo_url: signedUrl,
        updated_at: new Date().toISOString(),
      });
      
      console.log(`✅ [PROFILE-PHOTO] Photo uploaded successfully for vendor ${actualVendorId}`);
      
      return c.json({
        success: true,
        photo_url: signedUrl,
        fileName: fileName,
      });
    } catch (error: any) {
      console.error('❌ [PROFILE-PHOTO] Error uploading photo:', error);
      return c.json({ error: error.message || 'Failed to upload photo' }, 500);
    }
  });

  /**
   * PUT/POST /vendor/:vendorId/profile
   * Update vendor profile - requires re-approval only if critical fields changed
   */
  const profileUpdateHandler = async (c: any) => {
    try {
      const { vendorId } = c.req.param();
      const rawUpdates = await c.req.json();

      console.log(`📝 [PROFILE-UPDATE] Vendor ${vendorId} updating profile`, rawUpdates);

      // Convert camelCase keys to snake_case for database compatibility
      const camelToSnakeMap: Record<string, string> = {
        businessName: 'business_name',
        ownerName: 'owner_name',
        profilePhotoUrl: 'profile_photo_url',
        isActive: 'is_active',
        setupCompleted: 'setup_completed',
        servicesSetupCompleted: 'services_setup_completed',
        availabilitySetupCompleted: 'availability_setup_completed',
        roleId: 'role_id',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      };

      const updates: any = {};
      for (const [key, value] of Object.entries(rawUpdates)) {
        const dbKey = camelToSnakeMap[key] || key;
        updates[dbKey] = value;
      }

      // Get existing vendor (same resolver - supports vendor_identity + auto-create)
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const wasApproved = vendor.status === 'approved';
      const previousStatus = vendor.status;

      // Check if any critical fields are being changed
      let criticalFieldsChanged = false;
      const changedFields: string[] = [];

      for (const field of CRITICAL_FIELDS) {
        if (updates[field] !== undefined && updates[field] !== vendor[field]) {
          criticalFieldsChanged = true;
          changedFields.push(field);
        }
      }

      console.log(`🔍 [PROFILE-UPDATE] Critical fields changed: ${criticalFieldsChanged}`);
      console.log(`📋 [PROFILE-UPDATE] Changed fields: ${changedFields.join(', ')}`);

      // Dynamically check which columns exist in the vendors table
      const schemaResult = await query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'vendors'
      `);
      const existingColumns = new Set(schemaResult.rows.map((r: any) => r.column_name));
      
      // Known safe columns that can be updated
      const safeColumns = [
        'business_name', 'owner_name', 'phone', 'email', 'address', 'city', 'state', 'pincode',
        'description', 'profile_photo_url', 'latitude', 'longitude', 'is_active', 'status',
        'setup_completed', 'services_setup_completed', 'availability_setup_completed', 'metadata',
        'experience_years', 'qualifications', 'service_area', 'specializations' // ✅ Added for solo provider profile
      ];

      const updateData: any = {};
      for (const [key, value] of Object.entries(updates)) {
        // Only include if it's a safe column AND exists in the database
        if (safeColumns.includes(key) && existingColumns.has(key)) {
          updateData[key] = value;
        }
      }
      
      // Log skipped fields for debugging
      const skippedFields = Object.keys(updates).filter(k => !existingColumns.has(k) && safeColumns.includes(k));
      if (skippedFields.length > 0) {
        console.log(`⚠️ [PROFILE-UPDATE] Skipped non-existent columns: ${skippedFields.join(', ')}`);
      }

      // If critical fields changed and vendor was approved, require re-approval
      if (criticalFieldsChanged && wasApproved) {
        console.log(`⚠️ [PROFILE-UPDATE] Critical fields changed - requiring re-approval`);

        updateData.status = 'pending';
        updateData.metadata = {
          ...(vendor.metadata || {}),
          previousStatus: previousStatus,
          wasApprovedBefore: true,
          reapprovalReason: `Critical profile fields updated: ${changedFields.join(', ')}`,
          reapprovalRequestedAt: new Date().toISOString(),
        };

        // Create notification for admin (use recipient_id/recipient_type)
        await insert('notifications', {
          recipient_id: null, // Admin notifications can have null recipient_id
          recipient_type: 'admin',
          title: 'Profile Update Review Required',
          message: `Approved vendor "${vendor.business_name}" updated their profile. Re-approval required.`,
          notification_type: 'admin_alert',
          channels: { email: true, sms: false, inApp: true, push: false },
          is_read: false,
        }).catch((error) => {
          console.warn('[VENDOR-PROFILE] Error creating notification:', error instanceof Error ? error.message : 'Unknown error');
        });

        // Send SNS notification
        const snsClient = getSnsClient();
        await snsClient.send(new PublishCommand({
          TopicArn: process.env.ADMIN_ALERT_TOPIC_ARN,
          Message: JSON.stringify({
            eventType: 'VendorProfileUpdate',
            vendorId: vendorId,
            vendorName: vendor.business_name,
            changedFields: changedFields,
            requiresReapproval: true,
          }),
        })).catch(err => console.error('SNS notification failed:', err));

        const updated = await update('vendors', { id: vendor.id }, updateData);

        return c.json({
          success: true,
          message: 'Profile updated. Re-approval required for critical changes.',
          requiresReapproval: true,
          changedFields: changedFields,
          status: 'pending',
          vendor: updated[0],
        });
      } else {
        // Non-critical fields only - no re-approval needed
        console.log(`✅ [PROFILE-UPDATE] Non-critical fields updated - no re-approval needed`);

        const updated = await update('vendors', { id: vendor.id }, updateData);

        return c.json({
          success: true,
          message: 'Profile updated successfully',
          requiresReapproval: false,
          status: vendor.status,
          vendor: updated[0],
        });
      }
    } catch (error: any) {
      console.error('❌ [PROFILE-UPDATE] Error updating profile:', error);
      return c.json({ error: error.message }, 500);
    }
  };

  app.put("/vendor/:vendorId/profile", profileUpdateHandler);
  app.post("/vendor/:vendorId/profile", profileUpdateHandler);

  /**
   * GET /vendor/:vendorId/profile/edit-check
   * Check if vendor can edit profile and what will happen
   */
  app.get("/vendor/:vendorId/profile/edit-check", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];
      const isApproved = vendor.status === 'approved';

      return c.json({
        canEdit: true, // Vendors can always edit
        currentStatus: vendor.status,
        warning: isApproved
          ? 'Editing critical profile fields will require admin re-approval'
          : null,
        criticalFields: CRITICAL_FIELDS,
      });
    } catch (error: any) {
      console.error('❌ [PROFILE-UPDATE] Error checking edit status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/profile
   * Get vendor profile with role and capabilities (DB query - no frontend dependency)
   */
  app.get("/vendor/:vendorId/profile", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Handle test IDs - return empty profile
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({
          success: true,
          vendor: {
            id: vendorId,
            business_name: 'Test Vendor',
            owner_name: 'Test Owner',
            role: null,
            capabilities: [],
            vendorTypes: [],
            serviceStyles: [],
          },
        });
      }

      // ✅ Use shared resolver: checks vendors, vendor_identity, auto-creates if approved
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        const identities = await select('vendor_identity', { id: vendorId });
        if (identities.length > 0 && identities[0].onboarding_status !== 'APPROVED' && identities[0].onboarding_status !== 'ACTIVATED') {
          return c.json({ error: 'Vendor not approved or activated' }, 403);
        }
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // ✅ CRITICAL: Query DB directly for role and capabilities (no frontend dependency)
      let role = null;
      let capabilities: string[] = [];
      let roleConfig: any = {};
      let vendorConfiguration: 'solo' | 'business' | null = null;
      let selectedServiceStyles: string[] = [];
      let customerService: string | null = null;
      
      if (vendor.role_id) {
        try {
          // Get role from DB
          const roles = await select('roles', { id: vendor.role_id });
          if (roles.length > 0) {
            role = roles[0];
            roleConfig = role.config || {};
            customerService = role.customer_service || roleConfig?.customer_service || null;
            // ✅ FORENSIC: Use vendor's actual type (from onboarding) for filtering so vendor gets exactly role permissions filtered by their type
            const vendorType = (vendor as any).vendor_type;
            vendorConfiguration = (vendorType === 'solo' || vendorType === 'business')
              ? vendorType
              : (roleConfig?.vendorConfiguration || null);
            selectedServiceStyles = roleConfig?.serviceStyles?.selected || [];
            
            // Get base capabilities from DB (single source of truth: role_permissions = admin role config)
            const permissions = await select('role_permissions', { role_id: vendor.role_id });
            const baseCapabilities = permissions.map(p => p.permission_name);
            
            // ✅ TWO-STAGE CAPABILITY FILTERING (solo/business + service styles from role config)
            if (vendorConfiguration) {
              const { stage2_service_styles: effectiveCapabilities } = getEffectiveCapabilities({
                vendorConfiguration,
                selectedServiceStyles,
                baseCapabilities,
                capabilityRules: roleConfig?.capabilityRules
              });
              capabilities = effectiveCapabilities;
            } else {
              // Fallback to base capabilities if vendorConfiguration not set
              capabilities = baseCapabilities;
            }
          }
        } catch (roleError: any) {
          console.warn(`[Vendor Profile] Failed to load role ${vendor.role_id}:`, roleError.message);
          // Continue without role - vendor profile still works
        }
      }

      return c.json({
        success: true,
        vendor: {
          ...vendor,
          // ✅ Explicitly include profile fields (even if null) for solo providers
          qualifications: vendor.qualifications || null,
          service_area: vendor.service_area || null,
          description: vendor.description || null,
          experience_years: vendor.experience_years ?? null,
          // Include role info directly in response
          role: role ? {
            id: role.id,
            name: role.name,
            display_name: role.display_name,
            description: role.description,
            config: roleConfig,
          } : null,
          customer_service: customerService,
          vendorConfiguration: vendorConfiguration,
          serviceStyles: selectedServiceStyles,
          capabilities, // ✅ Filtered capabilities (two-stage)
          vendorTypes: roleConfig?.vendorTypes || [],
          profileType: vendorConfiguration === 'solo' ? 'professional' : 'center',
          allowedServiceStyles: vendorConfiguration 
            ? (roleConfig?.serviceStyles?.[vendorConfiguration] || [])
            : [],
        },
      });
    } catch (error: any) {
      console.error('Error fetching vendor profile:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/complete
   * Get complete vendor data with role, capabilities, and onboarding form in one call
   * This endpoint ensures vendor functions work even if frontend role loading fails
   */
  app.get("/vendor/:vendorId/complete", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Handle test IDs - return empty complete data
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({
          success: true,
          vendor: {
            id: vendorId,
            business_name: 'Test Vendor',
            owner_name: 'Test Owner',
            role: null,
            capabilities: [],
            vendorTypes: [],
            serviceStyles: [],
          },
          onboardingForm: null,
          setupStatus: {
            profileCompleted: false,
            servicesConfigured: false,
            availabilitySet: false,
            paymentSetup: false,
            isComplete: false,
          },
        });
      }

      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];
      
      // ✅ Query DB directly for all related data (no frontend dependency)
      let role = null;
      let capabilities: string[] = [];
      let roleConfig: any = {};
      let onboardingForm: any = null;
      
      if (vendor.role_id) {
        try {
          // Get role from DB
          const roles = await select('roles', { id: vendor.role_id });
          if (roles.length > 0) {
            role = roles[0];
            roleConfig = role.config || {};
            
            // Get capabilities from DB (batch query)
            try {
              const allPermissions = await query(
                `SELECT role_id, permission_name 
                 FROM role_permissions 
                 WHERE role_id = ANY($1::text[])`,
                [[vendor.role_id]]
              );
              capabilities = allPermissions.rows.map((p: any) => p.permission_name);
            } catch {
              // Fallback to individual query
              const permissions = await select('role_permissions', { role_id: vendor.role_id });
              capabilities = permissions.map(p => p.permission_name);
            }
            
            // Get onboarding form for this role (if vendor is still onboarding)
            try {
              const forms = await select('onboarding_forms', { role_id: role.name });
              if (forms.length > 0) {
                const fields = typeof forms[0].fields === 'string' 
                  ? JSON.parse(forms[0].fields) 
                  : forms[0].fields || [];
                onboardingForm = {
                  fields: fields.filter((f: any) => f.isActive !== false),
                  version: forms[0].version || 1,
                };
              }
            } catch (formError: any) {
              console.warn(`[Vendor Complete] Failed to load onboarding form:`, formError.message);
              // Continue without form
            }
          }
        } catch (roleError: any) {
          console.warn(`[Vendor Complete] Failed to load role ${vendor.role_id}:`, roleError.message);
          // Continue without role - vendor data still works
        }
      }

      return c.json({
        success: true,
        vendor: {
          ...vendor,
          role: role ? {
            id: role.id,
            name: role.name,
            display_name: role.display_name,
            description: role.description,
            config: roleConfig,
          } : null,
          capabilities,
          vendorTypes: roleConfig?.vendorTypes || [],
          serviceStyles: roleConfig?.serviceStyles || [],
          onboardingForm, // Include form if available
        },
      });
    } catch (error: any) {
      console.error('Error fetching complete vendor data:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/bank-account
   * Get vendor bank account details
   * ✅ FIX: Check both vendor_bank_details and vendor_bank_accounts tables
   */
  app.get("/vendor/:vendorId/bank-account", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      if (!isValidUUID(vendorId)) {
        return c.json({ error: 'Invalid vendor ID' }, 400);
      }

      // Resolve identity id to vendors.id so we find rows stored by vendor-bank-accounts
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const resolvedVendorId = vendor.id;

      // ✅ FIX: Check which table exists and query both
      const schemaCheck = await query(`
        SELECT 
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_bank_accounts') as has_accounts_table,
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_bank_details') as has_details_table
      `);
      
      const schema = schemaCheck.rows[0] || {};
      let bankAccounts: any[] = [];
      
      // Try vendor_bank_accounts first (newer table)
      if (schema.has_accounts_table) {
        try {
          const accounts = await query(
            `SELECT * FROM vendor_bank_accounts WHERE vendor_id = $1 ORDER BY is_primary DESC, created_at DESC LIMIT 1`,
            [resolvedVendorId]
          );
          bankAccounts = accounts.rows;
        } catch (e) {
          console.warn('Error querying vendor_bank_accounts:', e);
        }
      }
      
      // Fallback to vendor_bank_details if no results
      if (bankAccounts.length === 0 && schema.has_details_table) {
        try {
          bankAccounts = await select('vendor_bank_details', { vendor_id: resolvedVendorId });
        } catch (e) {
          console.warn('Error querying vendor_bank_details:', e);
        }
      }
      
      if (bankAccounts.length === 0) {
        return c.json({ success: true, bankAccount: null });
      }

      const bankAccount = normalizeDbRow(bankAccounts[0]);
      return c.json({ success: true, bankAccount });
    } catch (error: any) {
      console.error('Error fetching bank account:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/bank-account
   * Create or update vendor bank account details
   */
  app.post("/vendor/:vendorId/bank-account", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      const { account_holder_name, account_number, ifsc_code, bank_name, branch_name } = body;

      if (!isValidUUID(vendorId)) {
        return c.json({ error: 'Invalid vendor ID' }, 400);
      }

      if (!account_holder_name || !account_number || !ifsc_code || !bank_name) {
        return c.json({ error: 'Missing required fields: account_holder_name, account_number, ifsc_code, bank_name' }, 400);
      }

      // Validate IFSC format
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc_code.toUpperCase())) {
        return c.json({ error: 'Invalid IFSC code format' }, 400);
      }

      // Resolve identity id to vendors.id for consistent storage with vendor-bank-accounts
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const resolvedVendorId = vendor.id;

      // Check if bank account already exists
      const existing = await select('vendor_bank_details', { vendor_id: resolvedVendorId });
      
      const bankData = {
        vendor_id: resolvedVendorId,
        account_holder_name: account_holder_name.trim(),
        account_number: account_number.replace(/\s/g, ''),
        ifsc_code: ifsc_code.toUpperCase().trim(),
        bank_name: bank_name.trim(),
        branch_name: branch_name?.trim() || null,
        is_verified: false, // Reset verification status on update
        verified_at: null,
        verified_by: null,
        updated_at: new Date().toISOString(),
      };

      if (existing.length > 0) {
        // Update existing
        await update('vendor_bank_details', { vendor_id: resolvedVendorId }, bankData);
      } else {
        // Create new
        await insert('vendor_bank_details', bankData);
      }

      // Update setup completion
      await query(
        `UPDATE vendor_setup_completion 
         SET bank_account_completed = true, 
             bank_account_completed_at = NOW(),
             updated_at = NOW()
         WHERE vendor_id = $1`,
        [resolvedVendorId]
      ).catch((error) => {
        // Expected: table may not exist in all environments
        if (error instanceof Error && !error.message.includes('does not exist')) {
          console.warn('[VENDOR-PROFILE] Unexpected error updating vendor onboarding:', error.message);
        }
      }); // Ignore if table doesn't exist

      return c.json({ success: true, message: 'Bank account saved successfully' });
    } catch (error: any) {
      console.error('Error saving bank account:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/bank-account/verify
   * Verify bank account using Razorpay (name, IFSC, account number).
   * Uses Razorpay IFSC API + format validation. Config from AWS Secrets Manager.
   * ✅ FIX: Check both vendor_bank_accounts and vendor_bank_details tables.
   */
  app.post("/vendor/:vendorId/bank-account/verify", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      if (!isValidUUID(vendorId)) {
        return c.json({ error: 'Invalid vendor ID' }, 400);
      }

      // Resolve identity id to vendors.id so we find rows stored by vendor-bank-accounts
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const resolvedVendorId = vendor.id;

      // Check both tables (same logic as GET /vendor/:vendorId/bank-account)
      const schemaCheck = await query(`
        SELECT 
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_bank_accounts') as has_accounts_table,
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_bank_details') as has_details_table
      `);
      const schema = schemaCheck.rows?.[0] || {};
      let bankAccounts: any[] = [];

      if (schema.has_accounts_table) {
        try {
          const accounts = await query(
            `SELECT *, 'vendor_bank_accounts' as _source FROM vendor_bank_accounts WHERE vendor_id = $1 ORDER BY is_primary DESC, created_at DESC LIMIT 1`,
            [resolvedVendorId]
          );
          bankAccounts = accounts.rows || [];
        } catch (e) {
          console.warn('Error querying vendor_bank_accounts for verify:', e);
        }
      }
      if (bankAccounts.length === 0 && schema.has_details_table) {
        try {
          bankAccounts = await select('vendor_bank_details', { vendor_id: resolvedVendorId });
          if (bankAccounts.length > 0) (bankAccounts[0] as any)._source = 'vendor_bank_details';
        } catch (e) {
          console.warn('Error querying vendor_bank_details for verify:', e);
        }
      }

      if (bankAccounts.length === 0) {
        return c.json({ error: 'Bank account not found. Please add bank account details first.' }, 404);
      }

      const bank = bankAccounts[0] as any;
      const accountHolderName = (bank.account_holder_name || '').trim();
      const accountNumber = (bank.account_number || '').replace(/\s/g, '');
      const ifscCode = (bank.ifsc_code || '').toUpperCase().trim();
      const sourceTable = bank._source || (schema.has_accounts_table ? 'vendor_bank_accounts' : 'vendor_bank_details');

      if (!accountHolderName || !accountNumber || !ifscCode) {
        return c.json({
          success: false,
          error: 'Bank account record missing name, account number, or IFSC. Please complete all fields.',
        }, 400);
      }

      const { validateBankAccountStrict } = await import('./razorpay');
      const result = await validateBankAccountStrict(accountNumber, ifscCode, accountHolderName);

      if (result.error) {
        return c.json({
          success: false,
          error: result.error,
          details: result.details,
        }, 400);
      }

      const verifyPayload = {
        is_verified: true,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (sourceTable === 'vendor_bank_accounts' && bank.id) {
        await update('vendor_bank_accounts', { id: bank.id, vendor_id: resolvedVendorId }, verifyPayload);
      } else {
        await update('vendor_bank_details', { vendor_id: resolvedVendorId }, verifyPayload);
      }

      return c.json({ 
        success: true, 
        message: 'Bank account verified successfully. Name, IFSC, and account number validated.',
        verified: true,
      });
    } catch (error: any) {
      console.error('Error verifying bank account:', error);
      return c.json({ error: error.message || 'Verification failed' }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/bank-account/document
   * Upload verification document for bank account
   */
  app.post("/vendor/:vendorId/bank-account/document", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      const { document_type, document_url } = body;

      if (!isValidUUID(vendorId)) {
        return c.json({ error: 'Invalid vendor ID' }, 400);
      }

      if (!document_type || !document_url) {
        return c.json({ error: 'document_type and document_url are required' }, 400);
      }

      // Store document reference (you might want a separate table for this)
      // For now, we'll just acknowledge the upload
      // In production, you'd store this in vendor_bank_documents table

      return c.json({ success: true, message: 'Document uploaded successfully' });
    } catch (error: any) {
      console.error('Error uploading document:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/settings
   * Get vendor general settings (service radius, emergency contact, etc.)
   */
  app.get("/vendor/:vendorId/settings", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      if (!isValidUUID(vendorId)) {
        return c.json({ error: 'Invalid vendor ID' }, 400);
      }

      // ✅ CRITICAL FIX: Check both vendors table and vendor_identity table
      // If vendor only exists in vendor_identity (approved), we need to find or create the vendor record
      let vendors = await select('vendors', { id: vendorId });
      
      if (vendors.length === 0) {
        console.log(`[SETTINGS] Vendor ${vendorId} not found in vendors table, checking vendor_identity...`);
        const identities = await select('vendor_identity', { id: vendorId });
        if (identities.length > 0) {
          const identity = identities[0];
          if (identity.onboarding_status === 'APPROVED' || identity.onboarding_status === 'ACTIVATED') {
            // Check if vendor exists by phone (there might be an existing vendor with different ID)
            const vendorByPhone = await select('vendors', { phone: identity.phone });
            if (vendorByPhone.length > 0) {
              vendors = vendorByPhone;
              console.log(`[SETTINGS] Found existing vendor by phone: ${vendors[0].id}`);
            } else {
              // Get application data for vendor details
              const applications = await select('vendor_onboarding_applications', { vendor_identity_id: vendorId });
              const application = applications.length > 0 ? applications[0] : null;
              const payload = application?.application_payload || {};
              
              // Create vendors record
              console.log(`[SETTINGS] Auto-creating vendor record for approved vendor ${vendorId}`);
              const newVendor = await insert('vendors', {
                id: vendorId,
                phone: identity.phone,
                email: payload.email || `vendor-${identity.phone}@warmpawz.app`,
                business_name: payload.businessName || payload.business_name || `Vendor ${identity.phone}`,
                owner_name: payload.contactPersonName || payload.ownerName || 'Vendor Owner',
                role_id: identity.selected_role_id,
                vendor_type: (identity as any).vendor_type || payload.vendorType || payload.vendor_type || 'business',
                category: 'general',
                address: payload.address || 'Not specified',
                city: payload.city || 'Not specified',
                state: payload.state || 'Not specified',
                pincode: payload.pin || payload.pincode || '', // Don't use default - require actual pincode
                status: 'active',
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              vendors = newVendor;
              console.log(`[SETTINGS] Created vendor record for ${vendorId}`);
            }
          } else {
            return c.json({ error: 'Vendor not approved or activated' }, 403);
          }
        } else {
          return c.json({ error: 'Vendor not found' }, 404);
        }
      }

      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];
      
      // Extract settings from vendor record or separate settings table
      const settings = {
        service_radius: vendor.service_radius || null,
        emergency_contact: vendor.emergency_contact || null,
        max_dogs_per_walk: vendor.max_dogs_per_walk || null,
        walk_durations: vendor.walk_durations || [],
        other_config: vendor.other_config || {},
      };

      return c.json({ success: true, settings });
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT/POST /vendor/:vendorId/settings
   * Update vendor general settings
   */
  const settingsHandler = async (c: any) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      const { service_radius, emergency_contact, max_dogs_per_walk, walk_durations, other_config } = body;

      if (!isValidUUID(vendorId)) {
        return c.json({ error: 'Invalid vendor ID' }, 400);
      }

      // Validate emergency contact if provided
      if (emergency_contact) {
        if (!emergency_contact.name || !emergency_contact.phone) {
          return c.json({ error: 'Emergency contact must have both name and phone' }, 400);
        }
        // Allow any 10-digit phone
        const phoneDigits = emergency_contact.phone.replace(/\D/g, '');
        if (phoneDigits.length < 10) {
          return c.json({ error: 'Invalid emergency contact phone number' }, 400);
        }
      }

      // ✅ CRITICAL FIX: Check both vendors table and vendor_identity table
      // If vendor only exists in vendor_identity (approved), we need to find or create the vendor record
      let vendors = await select('vendors', { id: vendorId });
      
      if (vendors.length === 0) {
        console.log(`[SETTINGS-UPDATE] Vendor ${vendorId} not found in vendors table, checking vendor_identity...`);
        const identities = await select('vendor_identity', { id: vendorId });
        if (identities.length > 0) {
          const identity = identities[0];
          if (identity.onboarding_status === 'APPROVED' || identity.onboarding_status === 'ACTIVATED') {
            // Check if vendor exists by phone (there might be an existing vendor with different ID)
            const vendorByPhone = await select('vendors', { phone: identity.phone });
            if (vendorByPhone.length > 0) {
              vendors = vendorByPhone;
              console.log(`[SETTINGS-UPDATE] Found existing vendor by phone: ${vendors[0].id}`);
            } else {
              // Get application data for vendor details
              const applications = await select('vendor_onboarding_applications', { vendor_identity_id: vendorId });
              const application = applications.length > 0 ? applications[0] : null;
              const payload = application?.application_payload || {};
              
              // Create vendors record
              console.log(`[SETTINGS-UPDATE] Auto-creating vendor record for approved vendor ${vendorId}`);
              const newVendor = await insert('vendors', {
                id: vendorId,
                phone: identity.phone,
                email: payload.email || `vendor-${identity.phone}@warmpawz.app`,
                business_name: payload.businessName || payload.business_name || `Vendor ${identity.phone}`,
                owner_name: payload.contactPersonName || payload.ownerName || 'Vendor Owner',
                role_id: identity.selected_role_id,
                vendor_type: (identity as any).vendor_type || payload.vendorType || payload.vendor_type || 'business',
                category: 'general',
                address: payload.address || 'Not specified',
                city: payload.city || 'Not specified',
                state: payload.state || 'Not specified',
                pincode: payload.pin || payload.pincode || '', // Don't use default - require actual pincode
                status: 'active',
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              vendors = newVendor;
              console.log(`[SETTINGS-UPDATE] Created vendor record for ${vendorId}`);
            }
          } else {
            return c.json({ error: 'Vendor not approved or activated' }, 403);
          }
        } else {
          return c.json({ error: 'Vendor not found' }, 404);
        }
      }

      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Check which columns exist in vendors table to avoid column errors
      const schemaCheck = await query(`
        SELECT 
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'service_radius') as has_service_radius,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'emergency_contact') as has_emergency_contact,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'max_dogs_per_walk') as has_max_dogs,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'walk_durations') as has_walk_durations,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'other_config') as has_other_config,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_settings') as has_vendor_settings_table
      `);
      
      const schema = schemaCheck.rows[0] || {};

      // Build update using raw SQL to handle type conversions properly
      const setClauses: string[] = ['updated_at = NOW()'];
      const params: any[] = [];
      let paramIdx = 1;

      if (service_radius !== undefined && schema.has_service_radius) {
        setClauses.push(`service_radius = $${paramIdx}`);
        params.push(service_radius);
        paramIdx++;
      }
      
      if (emergency_contact !== undefined && schema.has_emergency_contact) {
        setClauses.push(`emergency_contact = $${paramIdx}::jsonb`);
        params.push(JSON.stringify(emergency_contact));
        paramIdx++;
      }
      
      if (max_dogs_per_walk !== undefined && schema.has_max_dogs) {
        setClauses.push(`max_dogs_per_walk = $${paramIdx}`);
        params.push(max_dogs_per_walk);
        paramIdx++;
      }
      
      // Handle walk_durations - convert array to TEXT[] format
      if (walk_durations !== undefined && schema.has_walk_durations) {
        if (Array.isArray(walk_durations) && walk_durations.length > 0) {
          setClauses.push(`walk_durations = $${paramIdx}::text[]`);
          params.push(walk_durations);
          paramIdx++;
        } else {
          // Empty array or null - set to NULL without using a parameter
          setClauses.push(`walk_durations = NULL`);
        }
      }
      
      if (other_config !== undefined && schema.has_other_config) {
        setClauses.push(`other_config = $${paramIdx}::jsonb`);
        params.push(JSON.stringify(other_config || {}));
        paramIdx++;
      }

      // Use the actual vendor ID (might be different if found by phone)
      const actualVendorId = vendors[0].id;
      params.push(actualVendorId);
      
      await query(
        `UPDATE vendors SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
        params
      );

      return c.json({ success: true, message: 'Settings updated successfully' });
    } catch (error: any) {
      console.error('Error updating settings:', error);
      return c.json({ error: error.message }, 500);
    }
  };
  
  app.put("/vendor/:vendorId/settings", settingsHandler);
  app.post("/vendor/:vendorId/settings", settingsHandler);

  /**
   * GET /vendor/:vendorId
   * Get vendor details by ID
   * Returns vendor info and menu (for cafes)
   * This is a general endpoint that works for all vendor types
   * IMPORTANT: Must be registered AFTER all more specific routes like /vendor/:vendorId/profile
   */
  app.get("/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Handle test IDs
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({
          success: true,
          vendor: {
            id: vendorId,
            business_name: 'Test Vendor',
            owner_name: 'Test Owner',
            role: null,
            capabilities: [],
          },
          menu: [],
        });
      }

      // Get vendor
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];

      // Get role info
      let role = null;
      let capabilities: string[] = [];
      let roleConfig: any = {};
      let isCafe = false;

      if (vendor.role_id) {
        try {
          const roles = await select('roles', { id: vendor.role_id });
          if (roles.length > 0) {
            role = roles[0];
            roleConfig = role.config || {};
            
            const permissions = await select('role_permissions', { role_id: vendor.role_id });
            capabilities = permissions.map(p => p.permission_name);
            
            // Check if this is a cafe vendor
            const roleName = (role.name || '').toLowerCase();
            isCafe = roleName.includes('cafe') || roleName.includes('restaurant') || 
                     capabilities.includes('cafe') || capabilities.includes('cafe_menu');
          }
        } catch (roleError: any) {
          console.warn(`[Vendor Details] Failed to load role ${vendor.role_id}:`, roleError.message);
        }
      }

      // Build vendor response
      const vendorResponse: any = {
        id: vendor.id,
        business_name: vendor.business_name,
        owner_name: vendor.owner_name,
        role_id: vendor.role_id,
        role: role ? {
          id: role.id,
          name: role.name,
          display_name: role.display_name,
        } : null,
        capabilities,
        address: vendor.address,
        city: vendor.city,
        state: vendor.state,
        pincode: vendor.pincode,
        phone: vendor.phone,
        email: vendor.email,
        latitude: vendor.latitude,
        longitude: vendor.longitude,
        description: vendor.description || '',
        operating_hours: vendor.operating_hours ? (typeof vendor.operating_hours === 'string' ? JSON.parse(vendor.operating_hours) : vendor.operating_hours) : null,
        // Include other vendor fields
        ...vendor,
      };

      // For cafes, also fetch menu
      let menu: any[] = [];
      if (isCafe) {
        try {
          const menuItems = await query(
            `SELECT * FROM cafe_menu_items 
             WHERE vendor_id = $1 
             AND is_active = true
             ORDER BY category, name ASC`,
            [vendorId]
          ).catch(() => ({ rows: [] }));
          menu = menuItems.rows || [];
        } catch (menuError: any) {
          console.warn(`[Vendor Details] Failed to load menu for cafe ${vendorId}:`, menuError.message);
          // Continue without menu
        }
      }

      return c.json({
        success: true,
        vendor: vendorResponse,
        menu: menu, // Include menu for cafes
      });
    } catch (error: any) {
      console.error('Error fetching vendor details:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

