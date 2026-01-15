/**
 * ============================================================================
 * VENDOR SUPPORT ENDPOINTS
 * ============================================================================
 * 
 * Complete vendor support ticket lifecycle management:
 * - POST /vendor/support/tickets - Create vendor support ticket
 * - GET /vendor/support/tickets - Get vendor's tickets
 * - GET /vendor/support/tickets/:ticketId - Get ticket details
 * - POST /vendor/support/tickets/:ticketId/messages - Add message
 * - PUT /vendor/support/tickets/:ticketId/status - Update status
 * - GET /vendor/support/categories - Get ticket categories
 * 
 * Date: 2026-01-14
 * Related: Vendor Support Dashboard
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select, insert, update } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

export function registerVendorSupportEndpoints(app: Hono) {
  /**
   * POST /vendor/support/tickets
   * Create a new support ticket
   */
  app.post('/vendor/support/tickets', async (c) => {
    try {
      const {
        vendorId,
        subject,
        description,
        category,
        priority,
        bookingId,
        orderId,
        metadata,
      } = await c.req.json();

      // Validation
      if (!vendorId || !subject || !description) {
        return c.json({
          success: false,
          error: 'vendorId, subject, and description are required',
        }, 400);
      }

      // Get vendor details
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({
          success: false,
          error: 'Vendor not found',
        }, 404);
      }

      const vendor = vendors[0];

      // Generate ticket number
      const ticketNumber = `VT-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Date.now().toString().slice(-6)}`;

      // Create ticket
      const ticket = await insert('support_tickets', {
        ticket_number: ticketNumber,
        subject,
        message: description,
        description,
        category: category || 'general',
        priority: priority || 'medium',
        status: 'open',
        vendor_id: vendorId,
        booking_id: bookingId || null,
        order_id: orderId || null,
        customer_name: vendor.business_name || vendor.owner_name,
        customer_phone: vendor.phone,
        customer_email: vendor.email,
        metadata: JSON.stringify({
          ...metadata,
          vendor_type: vendor.vendor_type,
          source: 'vendor_dashboard',
        }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        ticket: ticket[0],
        ticketNumber,
        message: 'Support ticket created successfully',
      });
    } catch (error: any) {
      console.error('Error creating vendor support ticket:', error);
      return c.json({
        success: false,
        error: error.message || 'Failed to create support ticket',
      }, 500);
    }
  });

  /**
   * GET /vendor/support/tickets
   * Get all tickets for a vendor
   */
  app.get('/vendor/support/tickets', async (c) => {
    try {
      const vendorId = c.req.query('vendorId');
      const status = c.req.query('status');
      const category = c.req.query('category');
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      if (!vendorId) {
        return c.json({
          success: false,
          error: 'vendorId is required',
        }, 400);
      }

      // Build query
      let queryStr = `
        SELECT 
          st.*,
          COUNT(DISTINCT str.id) as message_count,
          MAX(str.created_at) as last_message_at
        FROM support_tickets st
        LEFT JOIN support_ticket_responses str ON str.ticket_id = st.id
        WHERE st.vendor_id = $1
      `;
      const params: any[] = [vendorId];
      let paramIndex = 2;

      if (status) {
        queryStr += ` AND st.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (category) {
        queryStr += ` AND st.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      queryStr += `
        GROUP BY st.id
        ORDER BY st.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      params.push(limit, offset);

      const result = await query(queryStr, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM support_tickets WHERE vendor_id = $1';
      const countParams: any[] = [vendorId];
      let countParamIndex = 2;

      if (status) {
        countQuery += ` AND status = $${countParamIndex}`;
        countParams.push(status);
        countParamIndex++;
      }

      if (category) {
        countQuery += ` AND category = $${countParamIndex}`;
        countParams.push(category);
        countParamIndex++;
      }

      const countResult = await query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.count || '0', 10);

      return c.json({
        success: true,
        tickets: result.rows || [],
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (error: any) {
      console.error('Error fetching vendor tickets:', error);
      return c.json({
        success: false,
        error: error.message || 'Failed to fetch tickets',
      }, 500);
    }
  });

  /**
   * GET /vendor/support/tickets/:ticketId
   * Get ticket details with messages
   */
  app.get('/vendor/support/tickets/:ticketId', async (c) => {
    try {
      const { ticketId } = c.req.param();
      const vendorId = c.req.query('vendorId');

      if (!vendorId) {
        return c.json({
          success: false,
          error: 'vendorId is required',
        }, 400);
      }

      // Get ticket
      const tickets = await select('support_tickets', {
        id: ticketId,
        vendor_id: vendorId,
      });

      if (tickets.length === 0) {
        return c.json({
          success: false,
          error: 'Ticket not found',
        }, 404);
      }

      const ticket = tickets[0];

      // Get messages/responses
      const messages = await query(
        `SELECT * FROM support_ticket_responses 
         WHERE ticket_id = $1 
         ORDER BY created_at ASC`,
        [ticketId]
      );

      return c.json({
        success: true,
        ticket: {
          ...ticket,
          messages: messages.rows || [],
        },
      });
    } catch (error: any) {
      console.error('Error fetching ticket details:', error);
      return c.json({
        success: false,
        error: error.message || 'Failed to fetch ticket details',
      }, 500);
    }
  });

  /**
   * POST /vendor/support/tickets/:ticketId/messages
   * Add a message to the ticket
   */
  app.post('/vendor/support/tickets/:ticketId/messages', async (c) => {
    try {
      const { ticketId } = c.req.param();
      const { vendorId, message, attachments } = await c.req.json();

      if (!vendorId || !message) {
        return c.json({
          success: false,
          error: 'vendorId and message are required',
        }, 400);
      }

      // Verify ticket belongs to vendor
      const tickets = await select('support_tickets', {
        id: ticketId,
        vendor_id: vendorId,
      });

      if (tickets.length === 0) {
        return c.json({
          success: false,
          error: 'Ticket not found',
        }, 404);
      }

      // Create message - use only columns that exist in the table
      // Note: responder_type must be 'agent', 'customer', or 'system' per DB constraint
      // Vendors use 'customer' type as they are customers of the support system
      const messageData: any = {
        ticket_id: ticketId,
        responder_id: vendorId,
        responder_type: 'customer', // vendors are treated as customers in support context
        message,
        is_internal: false,
        created_at: new Date().toISOString(),
      };

      const response = await insert('support_ticket_responses', messageData);

      // Update ticket timestamp
      await update('support_tickets',
        { id: ticketId },
        {
          updated_at: new Date().toISOString(),
        }
      );

      return c.json({
        success: true,
        message: response[0],
      });
    } catch (error: any) {
      console.error('Error adding ticket message:', error);
      return c.json({
        success: false,
        error: error.message || 'Failed to add message',
      }, 500);
    }
  });

  /**
   * PUT /vendor/support/tickets/:ticketId/status
   * Update ticket status (vendor can only close their own tickets)
   */
  app.put('/vendor/support/tickets/:ticketId/status', async (c) => {
    try {
      const { ticketId } = c.req.param();
      const { vendorId, status, resolution } = await c.req.json();

      if (!vendorId || !status) {
        return c.json({
          success: false,
          error: 'vendorId and status are required',
        }, 400);
      }

      // Verify ticket belongs to vendor
      const tickets = await select('support_tickets', {
        id: ticketId,
        vendor_id: vendorId,
      });

      if (tickets.length === 0) {
        return c.json({
          success: false,
          error: 'Ticket not found',
        }, 404);
      }

      // Vendors can only close tickets, not reopen or change other statuses
      const allowedStatuses = ['closed'];
      if (!allowedStatuses.includes(status)) {
        return c.json({
          success: false,
          error: 'Vendors can only close tickets',
        }, 403);
      }

      // Update ticket
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'closed') {
        updateData.resolved_at = new Date().toISOString();
        if (resolution) {
          updateData.resolution_notes = resolution;
        }
      }

      const updated = await update('support_tickets',
        { id: ticketId },
        updateData
      );

      return c.json({
        success: true,
        ticket: updated[0],
        message: 'Ticket status updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating ticket status:', error);
      return c.json({
        success: false,
        error: error.message || 'Failed to update status',
      }, 500);
    }
  });

  /**
   * GET /vendor/support/categories
   * Get ticket categories
   */
  app.get('/vendor/support/categories', async (c) => {
    try {
      const categories = [
        { id: 'general', label: 'General Inquiry', description: 'General questions or information' },
        { id: 'technical', label: 'Technical Issue', description: 'App issues, bugs, or technical problems' },
        { id: 'billing', label: 'Billing & Payments', description: 'Payment issues, invoices, or billing questions' },
        { id: 'account', label: 'Account', description: 'Account settings, profile, or verification' },
        { id: 'service', label: 'Service', description: 'Service quality, bookings, or availability' },
        { id: 'booking', label: 'Booking', description: 'Booking-related issues or modifications' },
        { id: 'payout', label: 'Payout', description: 'Payout delays or issues' },
        { id: 'verification', label: 'Verification', description: 'Document or identity verification' },
        { id: 'compliance', label: 'Compliance', description: 'Regulatory or compliance issues' },
        { id: 'other', label: 'Other', description: 'Other issues not covered above' },
      ];

      return c.json({
        success: true,
        categories,
      });
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      return c.json({
        success: false,
        error: error.message || 'Failed to fetch categories',
      }, 500);
    }
  });

  /**
   * GET /vendor/support/stats
   * Get ticket statistics for vendor
   */
  app.get('/vendor/support/stats', async (c) => {
    try {
      const vendorId = c.req.query('vendorId');

      if (!vendorId) {
        return c.json({
          success: false,
          error: 'vendorId is required',
        }, 400);
      }

      const stats = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'open') as open,
          COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
          COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
          COUNT(*) FILTER (WHERE status = 'closed') as closed,
          COUNT(*) FILTER (WHERE priority = 'high' OR priority = 'urgent') as high_priority
        FROM support_tickets
        WHERE vendor_id = $1
      `, [vendorId]);

      return c.json({
        success: true,
        stats: stats.rows[0] || {},
      });
    } catch (error: any) {
      console.error('Error fetching vendor ticket stats:', error);
      return c.json({
        success: false,
        error: error.message || 'Failed to fetch stats',
      }, 500);
    }
  });
}
