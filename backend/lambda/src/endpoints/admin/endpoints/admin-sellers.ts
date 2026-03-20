/**
 * ============================================================================
 * ADMIN SELLER APPROVAL ENDPOINTS
 * ============================================================================
 * 
 * Handles seller (e-commerce product seller) approval workflow:
 * - List sellers pending approval
 * - Approve seller
 * - Reject seller
 * 
 * Date: 2026-01-XX
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, update, query } from '../../../database/rds-connection';
import { BaseHandler, HandlerContext, HandlerResponse } from '../../../handler/base-handler';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';

// ============================================================================
// GET /admin/vendors/sellers - List sellers pending approval
// ============================================================================

class GetSellersHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const status = context.event.queryStringParameters?.status || 'pending';
      const limit = parseInt(context.event.queryStringParameters?.limit || '50', 10);
      const offset = parseInt(context.event.queryStringParameters?.offset || '0', 10);

      // Get vendors with product_seller role or seller_status = pending/approved
      const sellersQuery = `
        SELECT 
          v.*,
          r.name as role_name,
          r.id as role_id
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE (
          r.name = 'product_seller' OR 
          r.name = 'pet_product_seller' OR
          v.seller_status IS NOT NULL
        )
        ${status !== 'all' ? `AND v.seller_status = $1` : ''}
        ORDER BY v.created_at DESC
        LIMIT $${status !== 'all' ? 2 : 1} OFFSET $${status !== 'all' ? 3 : 2}
      `;

      const params: any[] = [];
      if (status !== 'all') {
        params.push(status);
      }
      params.push(limit, offset);

      const sellers = await query(sellersQuery, params);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE (
          r.name = 'product_seller' OR 
          r.name = 'pet_product_seller' OR
          v.seller_status IS NOT NULL
        )
        ${status !== 'all' ? `AND v.seller_status = $1` : ''}
      `;

      const countParams = status !== 'all' ? [status] : [];
      const countResult = await query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.total || '0', 10);

      return this.success({
        sellers: sellers.rows,
        total,
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('Error fetching sellers:', error);
      return this.error(error.message || 'Failed to fetch sellers', 500);
    }
  }
}

// ============================================================================
// POST /admin/vendors/:vendorId/approve-seller - Approve seller
// ============================================================================

class ApproveSellerHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.vendorId;
      const body = this.parseBody(context.event);
      const adminId = context.userId || body.adminId;

      if (!vendorId) {
        return this.error('Vendor ID is required', 400);
      }

      // Get vendor
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return this.error('Vendor not found', 404);
      }

      const vendor = vendors[0];

      // Update seller status
      await update('vendors', { id: vendorId }, {
        seller_status: 'approved',
        seller_approved_at: new Date().toISOString(),
        seller_approved_by: adminId,
        seller_rejection_reason: null,
      });

      // Create notification
      await query(
        `INSERT INTO notifications (recipient_id, recipient_type, notification_type, title, message, channels, is_read)
         VALUES ($1, 'vendor', 'seller_approved', $2, $3, $4, false)`,
        [
          vendorId,
          'Seller Application Approved',
          'Your seller application has been approved! You can now manage products and receive orders.',
          JSON.stringify({ email: true, sms: true, inApp: true, push: false }),
        ]
      ).catch(err => console.error('Failed to create notification:', err));

      return this.success({
        message: 'Seller approved successfully',
        vendorId,
      });
    } catch (error: any) {
      console.error('Error approving seller:', error);
      return this.error(error.message || 'Failed to approve seller', 500);
    }
  }
}

// ============================================================================
// POST /admin/vendors/:vendorId/reject-seller - Reject seller
// ============================================================================

class RejectSellerHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.vendorId;
      const body = this.parseBody(context.event);
      const adminId = context.userId || body.adminId;
      const reason = body.reason || 'Application rejected';

      if (!vendorId) {
        return this.error('Vendor ID is required', 400);
      }

      // Get vendor
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return this.error('Vendor not found', 404);
      }

      // Update seller status
      await update('vendors', { id: vendorId }, {
        seller_status: 'rejected',
        seller_approved_at: null,
        seller_approved_by: null,
        seller_rejection_reason: reason,
      });

      // Create notification
      await query(
        `INSERT INTO notifications (recipient_id, recipient_type, notification_type, title, message, channels, is_read)
         VALUES ($1, 'vendor', 'seller_rejected', $2, $3, $4, false)`,
        [
          vendorId,
          'Seller Application Rejected',
          `Your seller application has been rejected. Reason: ${reason}`,
          JSON.stringify({ email: true, sms: true, inApp: true, push: false }),
        ]
      ).catch(err => console.error('Failed to create notification:', err));

      return this.success({
        message: 'Seller rejected successfully',
        vendorId,
      });
    } catch (error: any) {
      console.error('Error rejecting seller:', error);
      return this.error(error.message || 'Failed to reject seller', 500);
    }
  }
}

// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================

export function registerAdminSellersEndpoints(app: Hono) {
  const getSellersHandler = new GetSellersHandler();
  const approveSellerHandler = new ApproveSellerHandler();
  const rejectSellerHandler = new RejectSellerHandler();

  app.get('/admin/vendors/sellers', async (c) => {
    const queryParams: Record<string, string> = {};
    const url = new URL(c.req.url, 'http://localhost');
    url.searchParams.forEach((value, key) => { queryParams[key] = value; });
    
    const response = await getSellersHandler.handle({
      event: {
        queryStringParameters: queryParams,
      } as any,
    } as HandlerContext);
    return c.json(response.body as any, response.statusCode as 200 | 400 | 500);
  });

  app.post('/admin/vendors/:vendorId/approve-seller', async (c) => {
    const response = await approveSellerHandler.handle({
      event: {
        pathParameters: c.req.param(),
        body: await c.req.json().catch(() => ({})),
      } as any,
    } as HandlerContext);
    return c.json(response.body as any, response.statusCode as 200 | 400 | 500);
  });

  app.post('/admin/vendors/:vendorId/reject-seller', async (c) => {
    const response = await rejectSellerHandler.handle({
      event: {
        pathParameters: c.req.param(),
        body: await c.req.json().catch(() => ({})),
      } as any,
    } as HandlerContext);
    return c.json(response.body as any, response.statusCode as 200 | 400 | 500);
  });
}

