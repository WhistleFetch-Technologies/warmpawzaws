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
   * PUT /vendor/:vendorId/profile
   * Update vendor profile - requires re-approval only if critical fields changed
   */
  app.put("/vendor/:vendorId/profile", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const updates = await c.req.json();

      console.log(`📝 [PROFILE-UPDATE] Vendor ${vendorId} updating profile`);

      // Get existing vendor
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];
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

      // Prepare update data
      const updateData: any = {
        ...updates,
      };

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
          // Note: notifications table doesn't have metadata column
        }).catch(() => {});

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

        const updated = await update('vendors', { id: vendorId }, updateData);

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

        const updated = await update('vendors', { id: vendorId }, updateData);

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
  });

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

      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];
      
      // ✅ CRITICAL: Query DB directly for role and capabilities (no frontend dependency)
      let role = null;
      let capabilities: string[] = [];
      let roleConfig: any = {};
      
      if (vendor.role_id) {
        try {
          // Get role from DB
          const roles = await select('roles', { id: vendor.role_id });
          if (roles.length > 0) {
            role = roles[0];
            roleConfig = role.config || {};
            
            // Get capabilities from DB
            const permissions = await select('role_permissions', { role_id: vendor.role_id });
            capabilities = permissions.map(p => p.permission_name);
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
          // Include role info directly in response
          role: role ? {
            id: role.id,
            name: role.name,
            display_name: role.display_name,
            description: role.description,
            config: roleConfig,
          } : null,
          capabilities, // Include capabilities directly
          vendorTypes: roleConfig?.vendorTypes || [],
          serviceStyles: roleConfig?.serviceStyles || [],
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
}

