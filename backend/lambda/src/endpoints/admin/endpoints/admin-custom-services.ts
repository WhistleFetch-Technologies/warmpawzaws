/**
 * ============================================================================
 * ADMIN CUSTOM SERVICES APPROVAL ENDPOINTS
 * ============================================================================
 * 
 * Handles admin approval workflow for vendor custom services:
 * - Get pending services for approval
 * - Approve custom service (makes it live)
 * - Reject custom service with reason
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, update, query } from '../../../database/rds-connection';

export function registerAdminCustomServicesEndpoints(app: Hono) {
  /**
   * GET /admin/custom-services/pending
   * Get all custom services pending admin approval
   */
  app.get("/admin/custom-services/pending", async (c) => {
    try {
      // Get all pending custom services with vendor info
      const result = await query(
        `SELECT 
          vs.id,
          vs.vendor_id,
          vs.service_id,
          vs.service_name,
          vs.category,
          vs.sub_category,
          vs.service_style,
          vs.price,
          vs.duration_minutes,
          vs.custom_description,
          vs.publish_status,
          vs.is_custom_service,
          vs.submitted_for_approval_at,
          vs.created_at,
          vs.metadata,
          v.business_name as vendor_name,
          v.phone as vendor_phone,
          v.email as vendor_email,
          r.display_name as role_name
        FROM vendor_services vs
        INNER JOIN vendors v ON vs.vendor_id = v.id
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE vs.publish_status = 'pending_approval'
          AND vs.is_custom_service = true
        ORDER BY vs.submitted_for_approval_at ASC`
      );

      const services = result.rows.map((s: any) => ({
        id: s.id,
        serviceId: s.service_id,
        vendorId: s.vendor_id,
        vendorName: s.vendor_name || 'Unknown Vendor',
        vendorPhone: s.vendor_phone,
        vendorEmail: s.vendor_email,
        roleName: s.role_name,
        serviceName: s.service_name,
        description: s.custom_description,
        categoryName: s.category,
        subCategoryName: s.sub_category,
        serviceStyle: s.service_style,
        price: parseFloat(s.price || '0'),
        duration: s.duration_minutes,
        publishStatus: s.publish_status,
        isPackage: s.metadata?.isPackage || false,
        packageDetails: s.metadata?.packageDetails,
        submittedForApprovalAt: s.submitted_for_approval_at,
        createdAt: s.created_at,
      }));

      return c.json({
        success: true,
        services,
        total: services.length,
      });
    } catch (error: any) {
      console.error('Error fetching pending custom services:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/custom-services/all
   * Get all custom services (for admin overview)
   */
  app.get("/admin/custom-services/all", async (c) => {
    try {
      const status = c.req.query('status'); // Optional filter
      
      let whereClause = 'WHERE vs.is_custom_service = true';
      const params: any[] = [];
      
      if (status) {
        whereClause += ` AND vs.publish_status = $1`;
        params.push(status);
      }

      const result = await query(
        `SELECT 
          vs.id,
          vs.vendor_id,
          vs.service_id,
          vs.service_name,
          vs.category,
          vs.sub_category,
          vs.service_style,
          vs.price,
          vs.duration_minutes,
          vs.custom_description,
          vs.publish_status,
          vs.is_enabled,
          vs.is_custom_service,
          vs.submitted_for_approval_at,
          vs.approved_at,
          vs.approved_by,
          vs.rejected_at,
          vs.rejection_reason,
          vs.created_at,
          v.business_name as vendor_name,
          r.display_name as role_name
        FROM vendor_services vs
        INNER JOIN vendors v ON vs.vendor_id = v.id
        LEFT JOIN roles r ON v.role_id = r.id
        ${whereClause}
        ORDER BY vs.created_at DESC`,
        params
      );

      return c.json({
        success: true,
        services: result.rows,
        total: result.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching custom services:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /admin/custom-services/:serviceId/approve
   * Approve a custom service - makes it live for customers
   */
  app.post("/admin/custom-services/:serviceId/approve", async (c) => {
    try {
      const { serviceId } = c.req.param();
      const body = await c.req.json().catch(() => ({}));
      const { adminId, adminNote } = body;

      // Find the service
      const services = await select('vendor_services', { service_id: serviceId });
      
      if (services.length === 0) {
        return c.json({ error: 'Service not found' }, 404);
      }

      const service = services[0];

      // Only pending_approval services can be approved
      if (service.publish_status !== 'pending_approval') {
        return c.json({ 
          error: `Cannot approve service with status '${service.publish_status}'. Only pending_approval services can be approved.` 
        }, 400);
      }

      // Approve the service
      await update(
        'vendor_services',
        { service_id: serviceId },
        {
          publish_status: 'published',
          is_enabled: true,
          approved_at: new Date().toISOString(),
          approved_by: adminId || 'admin',
          admin_note: adminNote || null,
        }
      );

      // Also update the base service to active
      await update(
        'services',
        { id: serviceId },
        { is_active: true }
      ).catch(() => {}); // Ignore if update fails (service might not exist)

      return c.json({
        success: true,
        message: 'Custom service approved and published',
        serviceId,
        publishStatus: 'published',
      });
    } catch (error: any) {
      console.error('Error approving custom service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /admin/custom-services/:serviceId/reject
   * Reject a custom service with reason
   */
  app.post("/admin/custom-services/:serviceId/reject", async (c) => {
    try {
      const { serviceId } = c.req.param();
      const body = await c.req.json().catch(() => ({}));
      const { adminId, rejectionReason } = body;

      if (!rejectionReason) {
        return c.json({ error: 'Rejection reason is required' }, 400);
      }

      // Find the service
      const services = await select('vendor_services', { service_id: serviceId });
      
      if (services.length === 0) {
        return c.json({ error: 'Service not found' }, 404);
      }

      const service = services[0];

      // Only pending_approval services can be rejected
      if (service.publish_status !== 'pending_approval') {
        return c.json({ 
          error: `Cannot reject service with status '${service.publish_status}'. Only pending_approval services can be rejected.` 
        }, 400);
      }

      // Reject the service
      await update(
        'vendor_services',
        { service_id: serviceId },
        {
          publish_status: 'rejected',
          is_enabled: false,
          rejected_at: new Date().toISOString(),
          rejected_by: adminId || 'admin',
          rejection_reason: rejectionReason,
        }
      );

      return c.json({
        success: true,
        message: 'Custom service rejected',
        serviceId,
        publishStatus: 'rejected',
        rejectionReason,
      });
    } catch (error: any) {
      console.error('Error rejecting custom service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /admin/custom-services/:serviceId/request-changes
   * Request changes to a custom service (sends back to vendor for edits)
   */
  app.post("/admin/custom-services/:serviceId/request-changes", async (c) => {
    try {
      const { serviceId } = c.req.param();
      const body = await c.req.json().catch(() => ({}));
      const { adminId, changeRequest } = body;

      if (!changeRequest) {
        return c.json({ error: 'Change request details are required' }, 400);
      }

      // Find the service
      const services = await select('vendor_services', { service_id: serviceId });
      
      if (services.length === 0) {
        return c.json({ error: 'Service not found' }, 404);
      }

      const service = services[0];

      // Update to draft with change request
      await update(
        'vendor_services',
        { service_id: serviceId },
        {
          publish_status: 'draft',
          is_enabled: false,
          change_requested_at: new Date().toISOString(),
          change_requested_by: adminId || 'admin',
          change_request_reason: changeRequest,
        }
      );

      return c.json({
        success: true,
        message: 'Change request sent to vendor',
        serviceId,
        publishStatus: 'draft',
      });
    } catch (error: any) {
      console.error('Error requesting changes:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/custom-services/stats
   * Get statistics for custom service approvals
   */
  app.get("/admin/custom-services/stats", async (c) => {
    try {
      const result = await query(`
        SELECT 
          publish_status,
          COUNT(*) as count
        FROM vendor_services
        WHERE is_custom_service = true
        GROUP BY publish_status
      `);

      const stats: Record<string, number> = {
        draft: 0,
        pending_approval: 0,
        published: 0,
        rejected: 0,
      };

      result.rows.forEach((row: any) => {
        stats[row.publish_status] = parseInt(row.count, 10);
      });

      return c.json({
        success: true,
        stats,
        total: Object.values(stats).reduce((a, b) => a + b, 0),
      });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
