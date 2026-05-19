/**
 * ============================================================================
 * VENDOR DASHBOARD ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * 
 * Endpoints:
 * - GET /vendor/dashboard/:vendorId - Get comprehensive dashboard data
 * - GET /vendor/stats/:vendorId - Get statistics
 * - GET /vendor/bookings/:vendorId - Get vendor bookings
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../../../handler/base-handler';
import { query, select, insert } from '../../../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';
import { getEffectiveCapabilities } from '../../../utils/capability-filter';
import { computeEffectiveAllowedServiceStyles } from '../../../utils/effective-service-styles';
import {
  getTemporaryVendorSuppressionParams,
  sqlAndExcludeSuppressedBookingRows,
  filterBookingsTemporarySuppression,
} from '../../../utils/temporary-vendor-ui-suppression';

// ============================================================================
// VENDOR DASHBOARD HANDLERS
// ============================================================================

class VendorDashboardHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vendorId = context.event.pathParameters?.vendorId;
    const timeframe = context.event.queryStringParameters?.timeframe || 'today';

    if (!vendorId) {
      return this.error('Vendor ID is required', 400);
    }

    // ✅ CRITICAL FIX: Check both vendors table and vendor_identity table
    // If vendor only exists in vendor_identity (approved), auto-create the vendor record
    let vendors = await select('vendors', { id: vendorId });
    
    if (vendors.length === 0) {
      console.log(`[DASHBOARD] Vendor ${vendorId} not found in vendors table, checking vendor_identity...`);
      const identities = await select('vendor_identity', { id: vendorId });
      
      if (identities.length > 0) {
        const identity = identities[0];
        if (identity.onboarding_status === 'APPROVED' || identity.onboarding_status === 'ACTIVATED') {
          // Check if vendor exists by phone (there might be an existing vendor with different ID)
          const vendorByPhone = await select('vendors', { phone: identity.phone });
          if (vendorByPhone.length > 0) {
            vendors = vendorByPhone;
            console.log(`[DASHBOARD] Found existing vendor by phone: ${vendors[0].id}`);
          } else {
            // Get application data for vendor details
            const applications = await select('vendor_onboarding_applications', { vendor_identity_id: vendorId });
            const application = applications.length > 0 ? applications[0] : null;
            const payload = application?.application_payload || {};
            
            console.log(`[DASHBOARD] Auto-creating vendor record for approved vendor ${vendorId}`);
            const { resolveNewVendorOnboardingTier } = await import('../../../utils/onboarding-f100-tier');
            const tr = await resolveNewVendorOnboardingTier({
              email: payload.email,
              businessName: payload.businessName || payload.business_name,
            });
            const resolvedTierName = tr.tier;
            const resolvedCommission = tr.commission_percentage;
            const newVendor = await insert('vendors', {
              id: vendorId,
              phone: identity.phone,
              email: payload.email || `vendor-${identity.phone}@warmpawz.app`,
              business_name: payload.businessName || payload.business_name || `Vendor ${identity.phone}`,
              owner_name: payload.contactPersonName || payload.ownerName || 'Vendor Owner',
              role_id: identity.selected_role_id,
              category: 'general',
              address: payload.address || 'Not specified',
              city: payload.city || 'Not specified',
              state: payload.state || 'Not specified',
              pincode: payload.pin || payload.pincode || '', // Don't use default - require actual pincode
              status: 'active',
              is_active: true,
              is_deleted: false, // ✅ CRITICAL FIX: Always set to false for new vendors
              tier: resolvedTierName,
              commission_percentage: resolvedCommission,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            vendors = newVendor;
            console.log(`[DASHBOARD] Created vendor record for ${vendorId}`);
          }
        } else {
          return this.error('Vendor not approved or activated', 403);
        }
      } else {
        return this.error('Vendor not found', 404);
      }
    }
    
    if (vendors.length === 0) {
      return this.error('Vendor not found', 404);
    }
    const vendor = vendors[0];

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
          const roleIds = [vendor.role_id];
          const allPermissions = await query(
            `SELECT role_id, permission_name 
             FROM role_permissions 
             WHERE role_id = ANY($1::text[])`,
            [roleIds]
          ).catch(() => {
            // Fallback to individual query if array syntax fails
            return query(
              `SELECT role_id, permission_name 
               FROM role_permissions 
               WHERE role_id = $1`,
              [vendor.role_id]
            );
          });
          
          const baseCapabilities = allPermissions.rows.map((p: any) => p.permission_name);
          
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
        console.warn(`[Vendor Dashboard] Failed to load role ${vendor.role_id}:`, roleError.message);
        // Continue without role - dashboard still works with basic stats
      }
    }

    // ✅ SQL: Get bookings for vendor (exclude unpaid holds — same as enhanced dashboard)
    const bookingsRaw = await select('bookings', { vendor_id: vendorId });
    const bookings = filterBookingsTemporarySuppression(
      bookingsRaw.filter((b: any) => b.status !== 'pending_payment'),
    );

    // Calculate stats
    const today = new Date().toISOString().split('T')[0];
    const todayBookings = bookings.filter(b => 
      b.booking_date === today && b.status !== 'cancelled'
    );
    const completedBookings = bookings.filter(b => b.status === 'completed');
    const pendingBookings = bookings.filter(b => 
      ['pending', 'confirmed'].includes(b.status)
    );

    // Calculate earnings
    const totalEarnings = completedBookings.reduce((sum, b) => 
      sum + (parseFloat(b.total_amount) || 0), 0
    );
    const pendingEarnings = pendingBookings.reduce((sum, b) => 
      sum + (parseFloat(b.total_amount) || 0), 0
    );

    // ✅ SQL: Get reviews
    const reviews = await select('reviews', { vendor_id: vendorId });
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
      : 0;

    const effectiveAllowedServiceStyles = computeEffectiveAllowedServiceStyles(
      selectedServiceStyles,
      vendorConfiguration,
      roleConfig?.serviceStyles
    );

    return this.success({
      vendor: {
        id: vendor.id,
        businessName: vendor.business_name,
        ownerName: vendor.owner_name,
        status: vendor.status,
        tier: vendor.tier,
        role_id: vendor.role_id,
        vendor_type: vendor.vendor_type,
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
        allowedServiceStyles: effectiveAllowedServiceStyles,
      },
      stats: {
        appointments: todayBookings.length,
        consultations: bookings.filter(b => b.service_type === 'tele').length,
        earnings: totalEarnings,
        pendingEarnings: pendingEarnings,
        completedServices: completedBookings.length,
        rating: avgRating,
        totalReviews: reviews.length,
      },
      bookings: bookings.slice(0, 10), // Latest 10 bookings
      timeframe,
    });
  }
}

class VendorStatsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vendorId = context.event.pathParameters?.vendorId;
    const startDate = context.event.queryStringParameters?.startDate;
    const endDate = context.event.queryStringParameters?.endDate;

    if (!vendorId) {
      return this.error('Vendor ID is required', 400);
    }

    // ✅ SQL: Get bookings in date range
    const supStats = getTemporaryVendorSuppressionParams();
    let bookingsQuery = `SELECT * FROM bookings bk WHERE bk.vendor_id = $1`;
    const params: unknown[] = [vendorId];
    let nextP = 2;
    bookingsQuery += sqlAndExcludeSuppressedBookingRows(
      'bk',
      supStats ? nextP : undefined,
      supStats ? nextP + 1 : undefined,
    );
    if (supStats) {
      params.push(supStats.vendorIds, supStats.cutoffDateIst);
      nextP += 2;
    }

    if (startDate && endDate) {
      bookingsQuery += ` AND bk.booking_date BETWEEN $${nextP} AND $${nextP + 1}`;
      params.push(startDate, endDate);
    }

    const { rows: bookings } = await query(bookingsQuery, params);

    // Calculate statistics
    const stats = {
      totalBookings: bookings.length,
      completed: bookings.filter(b => b.status === 'completed').length,
      cancelled: bookings.filter(b => b.status === 'cancelled').length,
      totalRevenue: bookings
        .filter(b => b.status === 'completed')
        .reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0),
      averageBookingValue: bookings.length > 0
        ? bookings.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0) / bookings.length
        : 0,
    };

    return this.success(stats);
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerVendorDashboardEndpoints(app: Hono) {
  const dashboardHandler = new VendorDashboardHandler();
  const statsHandler = new VendorStatsHandler();
  
  // ============================================================================
  // CONVENIENCE ROUTES (auth-context based)
  // ============================================================================
  
  /**
   * GET /vendor/dashboard
   * Get dashboard for authenticated vendor (no ID required)
   */
  app.get('/vendor/dashboard', async (c) => {
    const vendorId = c.req.header('X-Vendor-Id') || (c as any).get('vendorId') || (c as any).get('userId');
    
    if (!vendorId) {
      return c.json({ error: 'Vendor authentication required' }, 401);
    }
    
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { vendorId };
    const context = createLambdaContext();
    const result = await dashboardHandler.execute(event, context);
    const body = (result as any).body ? JSON.parse((result as any).body) : result;
    const statusCode = (result as any).statusCode || 200;
    return c.json(body, statusCode as 200 | 400 | 500);
  });
  
  /**
   * GET /vendor/services
   * Get services for authenticated vendor
   */
  app.get('/vendor/services', async (c) => {
    const vendorId = c.req.header('X-Vendor-Id') || (c as any).get('vendorId') || (c as any).get('userId');
    
    if (!vendorId) {
      return c.json({ error: 'Vendor authentication required' }, 401);
    }
    
    try {
      const services = await select('services', { vendor_id: vendorId });
      return c.json({
        success: true,
        count: services.length,
        services: services,
      });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/services/:vendorId
   * Get services for a specific vendor by ID
   * ✅ FIX: Added to match frontend URL pattern /vendor/services/{vendorId}
   */
  app.get('/vendor/services/:vendorId', async (c) => {
    try {
      const { vendorId } = c.req.param();
      const customOnly = c.req.query('custom') === 'true';

      // Handle test IDs - return empty services
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({
          success: true,
          services: [],
          total: 0,
        });
      }

      // If custom=true, return only custom services
      if (customOnly) {
        const customServices = await query(
          `SELECT vs.*, s.name as base_service_name, s.description as base_description
           FROM vendor_services vs
           LEFT JOIN services s ON vs.service_id = s.id
           WHERE vs.vendor_id = $1
           AND vs.is_custom_service = true
           ORDER BY vs.created_at DESC`,
          [vendorId]
        );

        const formattedServices = customServices.rows.map((s: any) => ({
          id: s.id,
          serviceId: s.service_id,
          serviceName: s.service_name || s.base_service_name,
          name: s.service_name || s.base_service_name,
          description: s.custom_description || s.description || s.base_description,
          categoryName: s.category,
          subCategoryName: s.sub_category,
          price: parseFloat(s.price || s.custom_price || '0'),
          duration: s.duration_minutes || s.custom_duration || 30,
          serviceStyle: s.service_style,
          publishStatus: s.publish_status,
          isEnabled: s.is_enabled,
          isCustomService: true,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
        }));

        return c.json({
          success: true,
          services: formattedServices,
          total: formattedServices.length,
        });
      }

      // Get vendor with role info
      let vendors: any[] = [];
      try {
        vendors = await select('vendors', { id: vendorId });
      } catch (selectError: any) {
        console.error(`[Vendor Services] DB error looking up vendor ${vendorId}:`, selectError.message);
        return c.json({
          success: true,
          services: [],
          servicesByStyle: {
            at_home: { services: [], count: 0 },
            at_center: { services: [], count: 0 },
            tele: { services: [], count: 0 },
          },
          total: 0,
          role: null,
          capabilities: [],
          allowedServiceStyles: ['at_home', 'at_center', 'tele'],
        });
      }
      
      if (vendors.length === 0) {
        return c.json({
          success: true,
          services: [],
          servicesByStyle: {
            at_home: { services: [], count: 0 },
            at_center: { services: [], count: 0 },
            tele: { services: [], count: 0 },
          },
          total: 0,
          role: null,
          capabilities: [],
          allowedServiceStyles: ['at_home', 'at_center', 'tele'],
        });
      }
      
      const vendor = vendors[0];

      let role = null;
      let capabilities: string[] = [];
      let roleConfig: any = {};
      let allowedServiceStyles: string[] = ['at_home', 'at_center', 'tele'];

      if (vendor.role_id) {
        try {
          const roles = await select('roles', { id: vendor.role_id });
          if (roles.length > 0) {
            role = roles[0];
            roleConfig = role.config || {};
            const rawStyles = roleConfig?.serviceStyles || roleConfig?.service_styles || ['at_home', 'at_center', 'tele'];
            
            const styleMapping: Record<string, string> = {
              'at_clinic': 'at_center',
              'at_center': 'at_center',
              'video_consultation': 'tele',
              'tele': 'tele',
              'home_visit': 'at_home',
              'at_home': 'at_home',
            };
            allowedServiceStyles = rawStyles.map((s: string) => styleMapping[s] || s);
            
            // ✅ DYNAMIC SERVICE STYLES: Handle center-capable solo roles correctly
            const vendorConfiguration = roleConfig?.vendorConfiguration || roleConfig?.vendor_configuration;
            const roleName = (role.name || '').toLowerCase().replace(/\s+/g, '_');
            
            // Center-capable roles CAN have at_center even as solo (trainers, groomers, vets)
            const CENTER_CAPABLE_SOLO_ROLES = ['pet_trainer', 'trainer', 'pet_groomer', 'groomer', 'veterinarian', 'vet'];
            const SOLO_ONLY_ROLES = ['pet_sitter', 'sitter', 'pet_walker', 'walker', 'pet_taxi'];
            const isCenterCapableSolo = CENTER_CAPABLE_SOLO_ROLES.includes(roleName);
            const isSoloOnlyRole = SOLO_ONLY_ROLES.includes(roleName);
            
            if (vendorConfiguration === 'solo' && isSoloOnlyRole && !isCenterCapableSolo) {
              allowedServiceStyles = allowedServiceStyles.filter(style => style !== 'at_center');
              console.log(`[Vendor Dashboard] Solo-only role (${roleName}) - filtered at_center. Allowed: ${allowedServiceStyles.join(', ')}`);
            } else if (vendorConfiguration === 'solo' && isCenterCapableSolo) {
              console.log(`[Vendor Dashboard] Center-capable solo (${roleName}) - keeping all: ${allowedServiceStyles.join(', ')}`);
            }
            
            try {
              const allPermissions = await query(
                `SELECT role_id, permission_name 
                 FROM role_permissions 
                 WHERE role_id = ANY($1::text[])`,
                [[vendor.role_id]]
              );
              capabilities = allPermissions.rows.map((p: any) => p.permission_name);
            } catch {
              const permissions = await select('role_permissions', { role_id: vendor.role_id });
              capabilities = permissions.map(p => p.permission_name);
            }
          }
        } catch (roleError: any) {
          console.warn(`[Vendor Services] Failed to load role ${vendor.role_id}:`, roleError.message);
        }
      }
      
      // ✅ DYNAMIC SERVICE STYLES: Vendor table solo check (secondary source)
      const vendorRoleNameDash = role?.name?.toLowerCase().replace(/\s+/g, '_') || '';
      const vendorCenterCapableRolesDash = ['pet_trainer', 'trainer', 'pet_groomer', 'groomer', 'veterinarian', 'vet'];
      const isVendorCenterCapableDash = vendorCenterCapableRolesDash.includes(vendorRoleNameDash);
      
      if ((vendor.vendor_configuration === 'solo' || vendor.vendorConfiguration === 'solo' || vendor.vendor_type === 'solo') && !isVendorCenterCapableDash) {
        allowedServiceStyles = allowedServiceStyles.filter(style => style !== 'at_center');
        console.log(`[Vendor Dashboard] Solo vendor (${vendorRoleNameDash}) - not center-capable, filtered: ${allowedServiceStyles.join(', ')}`);
      } else if (vendor.vendor_configuration === 'solo' || vendor.vendorConfiguration === 'solo' || vendor.vendor_type === 'solo') {
        console.log(`[Vendor Dashboard] Solo vendor (${vendorRoleNameDash}) - center-capable, keeping all: ${allowedServiceStyles.join(', ')}`);
      }

      const serviceStyles = ['at_home', 'at_center', 'tele'];
      const servicesByStyle: Record<string, any> = {};

      for (const style of serviceStyles) {
        if (!allowedServiceStyles.includes(style)) {
          servicesByStyle[style] = { services: [], count: 0 };
          continue;
        }

        const services = await query(
          `SELECT vs.*, s.name as base_service_name, s.description as base_description
           FROM vendor_services vs
           LEFT JOIN services s ON vs.service_id = s.id
           WHERE vs.vendor_id = $1
           AND vs.service_style = $2
           ORDER BY vs.created_at DESC`,
          [vendorId, style]
        );

        servicesByStyle[style] = {
          services: services.rows.map((s: any) => ({
            id: s.id,
            serviceId: s.service_id,
            serviceName: s.service_name || s.base_service_name,
            name: s.service_name || s.base_service_name,
            description: s.description || s.base_description,
            category: s.category,
            subCategory: s.sub_category,
            price: parseFloat(s.price || s.custom_price || '0'),
            duration: s.duration_minutes || s.custom_duration || 30,
            serviceStyle: s.service_style,
            publishStatus: s.publish_status,
            isEnabled: s.is_enabled,
            isCustomService: s.is_custom_service,
            metadata: s.metadata || {},
          })),
          count: services.rows.length,
        };
      }

      const allServices = Object.values(servicesByStyle).flatMap((style: any) => style.services);

      return c.json({
        success: true,
        services: servicesByStyle,
        allServices,
        totalEnabled: allServices.length,
        vendor: {
          id: vendor.id,
          role_id: vendor.role_id,
          vendor_type: vendor.vendor_type,
        },
        role: role ? {
          id: role.id,
          name: role.name,
          display_name: role.display_name,
          config: roleConfig,
        } : null,
        capabilities,
        allowedServiceStyles,
        vendorTypes: roleConfig?.vendorTypes || [],
      });
    } catch (error: any) {
      console.error('Error fetching vendor services:', error);
      return c.json({ error: error.message }, 500);
    }
  });
  
  /**
   * GET /vendor/staff
   * Get staff for authenticated vendor
   */
  app.get('/vendor/staff', async (c) => {
    const vendorId = c.req.header('X-Vendor-Id') || (c as any).get('vendorId') || (c as any).get('userId');
    
    if (!vendorId) {
      return c.json({ error: 'Vendor authentication required' }, 401);
    }
    
    try {
      const staff = await select('staff', { vendor_id: vendorId, is_active: true });
      return c.json({
        success: true,
        count: staff.length,
        staff: staff,
      });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });
  
  // ============================================================================
  // ORIGINAL ROUTES (with explicit vendorId)
  // ============================================================================
  
  app.get('/vendor/dashboard/:vendorId', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { vendorId: c.req.param('vendorId') };
    const context = createLambdaContext();
    const result = await dashboardHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/vendor/stats/:vendorId', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { vendorId: c.req.param('vendorId') };
    const context = createLambdaContext();
    const result = await statsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

function createApiGatewayEvent(req: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    headers: req.headers,
    body: JSON.stringify(req.body || {}),
    pathParameters: req.param() || {},
    queryStringParameters: Object.fromEntries(new URL(req.url).searchParams),
    requestContext: {
      requestId: randomUUID(),
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: randomUUID(),
    functionName: 'vendor-dashboard-handler',
    functionVersion: '$LATEST',
  };
}

