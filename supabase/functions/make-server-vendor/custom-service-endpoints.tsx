/**
 * ============================================================================
 * CUSTOM SERVICE ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Custom service endpoints for center-based vendors:
 * - Get custom services for vendor
 * - Create custom service
 * - Publish custom service (submit for approval)
 * - Delete custom service
 * - Admin: Get pending custom services
 * - Admin: Approve/reject custom services
 * - Get published custom services (customer view)
 * 
 * RESTRICTION: Only available for serviceStyle = 'at_center' or 'both'
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.del()`, `kv.getByPrefix()` with repository calls
 * - All custom services stored in vendor_services table with is_custom_service flag
 * 
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "../_shared/response-utils.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getDbClient } from "../../lib/db.ts";

export function customServiceEndpoints(app: Hono) {

  // ============================================
  // GET CUSTOM SERVICES FOR VENDOR
  // ============================================

  /**
   * GET /vendor/:vendorId/custom-services
   * Load all custom services created by a vendor
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/vendor/:vendorId/custom-services", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      console.log(`📋 Loading custom services for vendor: ${vendorId}`);
      
      // ✅ SQL: Load vendor to verify service style
      const vendor = await getVendorsRepository().findById(vendorId);
      
      if (!vendor) {
        console.log(`❌ Vendor not found: ${vendorId}`);
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // ✅ CRITICAL: Check service style restriction
      if (vendor.service_style !== 'at_center' && vendor.service_style !== 'both') {
        console.log(`❌ Custom services NOT allowed for service style: ${vendor.service_style}`);
        
        let errorMessage = 'Custom services are only available for center-based vendors';
        if (vendor.service_style === 'at_home') {
          errorMessage = 'Custom services are only available for center-based vendors, not home service providers';
        } else if (vendor.service_style === 'tele') {
          errorMessage = 'Custom services are only available for physical locations, not tele consultation services';
        }
        
        return c.json({ 
          error: errorMessage,
          serviceStyle: vendor.service_style,
          allowed: false,
          allowedStyles: ['at_center', 'both'],
          blockedStyles: ['at_home', 'tele']
        }, 403);
      }
      
      console.log(`✅ Vendor ${vendorId} is eligible for custom services (serviceStyle: ${vendor.service_style})`);
      
      // ✅ SQL: Load all custom services for this vendor
      const client = getDbClient();
      const { data: customServices } = await client
        .from('vendor_services')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_custom_service', true)
        .order('created_at', { ascending: false });
      
      console.log(`📦 Found ${customServices?.length || 0} custom services`);
      
      return c.json({
        success: true,
        services: customServices || [],
        vendorServiceStyle: vendor.service_style
      });
      
    } catch (error) {
      console.error('❌ Error loading custom services:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // CREATE CUSTOM SERVICE
  // ============================================

  /**
   * POST /vendor/:vendorId/custom-services
   * Create a new custom service (vendors with at_center or both only)
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/vendor/:vendorId/custom-services", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const serviceData = await c.req.json();
      
      console.log(`💾 Creating custom service for vendor: ${vendorId}`);
      console.log(`   Service Name: ${serviceData.serviceName}`);
      
      // ✅ SQL: Load vendor to verify eligibility
      const vendor = await getVendorsRepository().findById(vendorId);
      
      if (!vendor) {
        console.log(`❌ Vendor not found: ${vendorId}`);
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // ✅ CRITICAL: Enforce service style restriction
      if (vendor.service_style !== 'at_center' && vendor.service_style !== 'both') {
        console.log(`❌ REJECTED: Custom services NOT allowed for serviceStyle: ${vendor.service_style}`);
        
        let errorMessage = 'Custom services are only available for center-based vendors';
        if (vendor.service_style === 'at_home') {
          errorMessage = 'Custom services are only available for center-based vendors, not home service providers';
        } else if (vendor.service_style === 'tele') {
          errorMessage = 'Custom services are only available for physical locations, not tele consultation services';
        }
        
        return c.json({ 
          error: errorMessage,
          serviceStyle: vendor.service_style,
          allowed: false,
          allowedStyles: ['at_center', 'both'],
          blockedStyles: ['at_home', 'tele']
        }, 403);
      }
      
      console.log(`✅ Service style check passed: ${vendor.service_style}`);
      
      // Validate required fields
      if (!serviceData.serviceName || !serviceData.description || !serviceData.categoryName) {
        return c.json({ 
          error: 'Missing required fields: serviceName, description, categoryName' 
        }, 400);
      }
      
      if (serviceData.isPackage) {
        if (!serviceData.packageDetails || 
            !serviceData.packageDetails.pricingBySize ||
            serviceData.packageDetails.pricingBySize.small <= 0) {
          return c.json({ 
            error: 'Package services must have valid pricing for all pet sizes' 
          }, 400);
        }
      } else {
        if (!serviceData.price || serviceData.price <= 0) {
          return c.json({ error: 'Price must be greater than 0' }, 400);
        }
      }
      
      if (!serviceData.duration || serviceData.duration <= 0) {
        return c.json({ error: 'Duration must be greater than 0' }, 400);
      }
      
      // Generate unique service ID
      const serviceId = `CS${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      // ✅ SQL: Create custom service in vendor_services table
      const client = getDbClient();
      const { data: customService } = await client
        .from('vendor_services')
        .insert({
          vendor_id: vendorId,
          service_style: 'at_center',
          service_id: serviceId,
          service_name: serviceData.serviceName.trim(),
          description: serviceData.description.trim(),
          duration: serviceData.duration,
          price: serviceData.price || 0,
          category_name: serviceData.categoryName.trim(),
          sub_category_name: serviceData.subCategoryName?.trim() || null,
          is_custom_service: true,
          is_package: serviceData.isPackage || false,
          package_details: serviceData.isPackage ? serviceData.packageDetails : null,
          publish_status: 'draft',
          is_enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      console.log(`✅ Custom service created: ${serviceId}`);
      
      return c.json({
        success: true,
        service: customService,
        message: 'Custom service created successfully. Submit for approval to make it live.'
      });
      
    } catch (error) {
      console.error('❌ Error creating custom service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // PUBLISH CUSTOM SERVICE (Submit for Approval)
  // ============================================

  /**
   * POST /vendor/:vendorId/custom-services/:serviceId/publish
   * Submit custom service for admin approval
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/vendor/:vendorId/custom-services/:serviceId/publish", async (c) => {
    try {
      const { vendorId, serviceId } = c.req.param();
      
      console.log(`📤 Publishing custom service: ${serviceId} for vendor: ${vendorId}`);
      
      // ✅ SQL: Load custom service
      const client = getDbClient();
      const { data: service } = await client
        .from('vendor_services')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('service_id', serviceId)
        .eq('is_custom_service', true)
        .maybeSingle();
      
      if (!service) {
        console.log(`❌ Custom service not found: ${serviceId}`);
        return c.json({ error: 'Custom service not found' }, 404);
      }
      
      // Check if already published or pending
      if (service.publish_status === 'published') {
        return c.json({ error: 'Service is already published' }, 400);
      }
      
      if (service.publish_status === 'pending_approval') {
        return c.json({ error: 'Service is already pending approval' }, 400);
      }
      
      // ✅ SQL: Update status to pending approval
      await client
        .from('vendor_services')
        .update({
          publish_status: 'pending_approval',
          submitted_for_approval_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', service.id);
      
      console.log(`✅ Custom service submitted for approval: ${serviceId}`);
      
      return c.json({
        success: true,
        message: 'Service submitted for admin approval'
      });
      
    } catch (error) {
      console.error('❌ Error publishing custom service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // DELETE CUSTOM SERVICE
  // ============================================

  /**
   * DELETE /vendor/:vendorId/custom-services/:serviceId
   * Delete a custom service (only if draft or rejected)
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.delete("/make-server-3dd53475/vendor/:vendorId/custom-services/:serviceId", async (c) => {
    try {
      const { vendorId, serviceId } = c.req.param();
      
      console.log(`🗑️ Deleting custom service: ${serviceId} for vendor: ${vendorId}`);
      
      // ✅ SQL: Load custom service
      const client = getDbClient();
      const { data: service } = await client
        .from('vendor_services')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('service_id', serviceId)
        .eq('is_custom_service', true)
        .maybeSingle();
      
      if (!service) {
        console.log(`❌ Custom service not found: ${serviceId}`);
        return c.json({ error: 'Custom service not found' }, 404);
      }
      
      // Only allow deletion of draft or rejected services
      if (service.publish_status === 'published') {
        return c.json({ 
          error: 'Cannot delete published services. Please contact admin.' 
        }, 400);
      }
      
      if (service.publish_status === 'pending_approval') {
        return c.json({ 
          error: 'Cannot delete services pending approval. Wait for admin review or contact support.' 
        }, 400);
      }
      
      // ✅ SQL: Delete the service
      await client
        .from('vendor_services')
        .delete()
        .eq('id', service.id);
      
      console.log(`✅ Custom service deleted: ${serviceId}`);
      
      return c.json({
        success: true,
        message: 'Custom service deleted successfully'
      });
      
    } catch (error) {
      console.error('❌ Error deleting custom service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // ADMIN - GET ALL PENDING CUSTOM SERVICES
  // ============================================

  /**
   * GET /admin/custom-services/pending
   * Get all custom services pending approval
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/admin/custom-services/pending", async (c) => {
    try {
      console.log('📋 Admin: Loading pending custom services...');
      
      // ✅ SQL: Get all custom services with pending status
      const client = getDbClient();
      const { data: pendingServices } = await client
        .from('vendor_services')
        .select('*')
        .eq('is_custom_service', true)
        .eq('publish_status', 'pending_approval')
        .order('submitted_for_approval_at', { ascending: true });
      
      console.log(`📦 Found ${pendingServices?.length || 0} custom services pending approval`);
      
      return c.json({
        success: true,
        services: pendingServices || [],
        count: pendingServices?.length || 0
      });
      
    } catch (error) {
      console.error('❌ Error loading pending custom services:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // ADMIN - APPROVE CUSTOM SERVICE
  // ============================================

  /**
   * POST /admin/custom-services/:serviceId/approve
   * Approve a custom service for publishing
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/admin/custom-services/:serviceId/approve", async (c) => {
    try {
      const { serviceId } = c.req.param();
      const { adminId, adminName } = await c.req.json();
      
      console.log(`✅ Admin approving custom service: ${serviceId}`);
      console.log(`   Admin: ${adminName} (${adminId})`);
      
      // ✅ SQL: Find the service
      const client = getDbClient();
      const { data: service } = await client
        .from('vendor_services')
        .select('*')
        .eq('service_id', serviceId)
        .eq('is_custom_service', true)
        .maybeSingle();
      
      if (!service) {
        console.log(`❌ Custom service not found: ${serviceId}`);
        return c.json({ error: 'Custom service not found' }, 404);
      }
      
      if (service.publish_status !== 'pending_approval') {
        return c.json({ 
          error: `Cannot approve service with status: ${service.publish_status}` 
        }, 400);
      }
      
      // ✅ SQL: Update service status
      await client
        .from('vendor_services')
        .update({
          publish_status: 'published',
          approved_at: new Date().toISOString(),
          approved_by: adminId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', service.id);
      
      console.log(`✅ Custom service approved and published: ${serviceId}`);
      
      return c.json({
        success: true,
        message: 'Custom service approved and published successfully'
      });
      
    } catch (error) {
      console.error('❌ Error approving custom service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // ADMIN - REJECT CUSTOM SERVICE
  // ============================================

  /**
   * POST /admin/custom-services/:serviceId/reject
   * Reject a custom service with reason
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/admin/custom-services/:serviceId/reject", async (c) => {
    try {
      const { serviceId } = c.req.param();
      const { adminId, adminName, rejectionReason } = await c.req.json();
      
      console.log(`❌ Admin rejecting custom service: ${serviceId}`);
      console.log(`   Admin: ${adminName} (${adminId})`);
      console.log(`   Reason: ${rejectionReason}`);
      
      if (!rejectionReason || rejectionReason.trim() === '') {
        return c.json({ error: 'Rejection reason is required' }, 400);
      }
      
      // ✅ SQL: Find the service
      const client = getDbClient();
      const { data: service } = await client
        .from('vendor_services')
        .select('*')
        .eq('service_id', serviceId)
        .eq('is_custom_service', true)
        .maybeSingle();
      
      if (!service) {
        console.log(`❌ Custom service not found: ${serviceId}`);
        return c.json({ error: 'Custom service not found' }, 404);
      }
      
      if (service.publish_status !== 'pending_approval') {
        return c.json({ 
          error: `Cannot reject service with status: ${service.publish_status}` 
        }, 400);
      }
      
      // ✅ SQL: Update service status
      await client
        .from('vendor_services')
        .update({
          publish_status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejected_by: adminId,
          rejection_reason: rejectionReason.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', service.id);
      
      console.log(`✅ Custom service rejected: ${serviceId}`);
      
      return c.json({
        success: true,
        message: 'Custom service rejected'
      });
      
    } catch (error) {
      console.error('❌ Error rejecting custom service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // GET PUBLISHED CUSTOM SERVICES (Customer View)
  // ============================================

  /**
   * GET /custom-services/published
   * Get all published custom services for customer browsing
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/custom-services/published", async (c) => {
    try {
      const { categoryName, vendorId, petType, city } = c.req.query();
      
      console.log(`🔍 Loading published custom services...`);
      
      // ✅ SQL: Get all published custom services
      const client = getDbClient();
      let query = client
        .from('vendor_services')
        .select('*, vendors!inner(*)')
        .eq('is_custom_service', true)
        .eq('publish_status', 'published');
      
      // Apply filters
      if (categoryName) {
        query = query.eq('category_name', categoryName);
      }
      
      if (vendorId) {
        query = query.eq('vendor_id', vendorId);
      }
      
      if (city) {
        query = query.eq('vendors.city', city);
      }
      
      const { data: services } = await query;
      
      // Filter by petType if provided (stored in package_details or service metadata)
      let filteredServices = services || [];
      if (petType) {
        filteredServices = filteredServices.filter((s: any) => {
          const petTypes = s.package_details?.petTypes || [];
          return petTypes.includes(petType.toLowerCase());
        });
      }
      
      console.log(`📦 Found ${filteredServices.length} published custom services`);
      
      return c.json({
        success: true,
        services: filteredServices,
        count: filteredServices.length
      });
      
    } catch (error) {
      console.error('❌ Error loading published custom services:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Custom service endpoints registered (SQL-only)');
}

