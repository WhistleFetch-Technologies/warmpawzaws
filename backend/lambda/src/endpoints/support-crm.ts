/**
 * ============================================================================
 * SUPPORT & CRM ENDPOINTS - AGENT HANDOFF
 * ============================================================================
 * 
 * Handles support tickets and CRM integration:
 * - Create support tickets from AI chatbot
 * - Get customer support tickets
 * - Agent assignment and response
 * - Ticket status updates
 * - Integration with AI chatbot for handoff
 * 
 * Date: 2026-01-07
 * Phase 3: AI Chatbot Integration
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { getSnsClient } from '../utils/sns-client';
import { PublishCommand } from '@aws-sdk/client-sns';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

function generateSupportTicketNumber(prefix = 'TKT'): string {
  const ymd = new Date().toISOString().split('T')[0].replace(/-/g, '');
  return `${prefix}-${ymd}-${Date.now().toString().slice(-6)}`;
}

export function registerSupportCrmEndpoints(app: Hono) {
  /**
   * POST /support/tickets
   * Create a support ticket (from AI chatbot or directly)
   */
  app.post("/support/tickets", async (c) => {
    try {
      const {
        customerId,
        customerPhone,
        subject,
        message,
        source = 'customer',
        priority = 'medium',
        category,
        bookingId,
        orderId,
        attachments,
      } = await c.req.json();

      if (!subject || !message) {
        return c.json({ error: 'subject and message are required' }, 400);
      }

      // Create support ticket
      const ticket = await insert('support_tickets', {
        ticket_number: generateSupportTicketNumber(),
        customer_id: customerId || null,
        customer_phone: customerPhone || null,
        subject,
        message,
        source,
        priority,
        category: category || null,
        booking_id: bookingId || null,
        order_id: orderId || null,
        status: 'open',
        attachments: attachments || [],
        created_at: new Date().toISOString(),
      });

      // Notify support team (if configured)
      try {
        const { select } = require('../database/rds-connection');
        const { publishToSNS } = require('../utils/aws-clients');
        
        // Get support team contact from platform settings
        const settings = await select('platform_settings', {
          setting_key: 'support:team:contact',
        });
        
        if (settings.length > 0) {
          const supportContact = settings[0].setting_value as any;
          const supportPhone = supportContact?.phone;
          const supportEmail = supportContact?.email;
          
          // Send notification to support team
          if (supportPhone || supportEmail) {
            await publishToSNS('platform-notifications', {
              type: 'support_ticket',
              ticket_id: ticket[0].id,
              priority: priority || 'medium',
              subject: subject,
              message: message,
              customer_id: customerId,
              vendor_id: null,
              phone: supportPhone,
              email: supportEmail,
            }, {
              messageType: 'Transactional',
              priority: priority || 'medium',
            });
            
            console.log(`✅ Support ticket notification sent to support team`);
          }
        }
      } catch (e) {
        console.warn('Failed to send support notification', e);
        // Don't fail the request if notification fails
      }

      return c.json({
        success: true,
        ticket: ticket[0],
        message: 'Support ticket created successfully',
      });
    } catch (error: any) {
      console.error('Error creating support ticket:', error);
      return c.json({ error: error.message || 'Failed to create support ticket' }, 500);
    }
  });

  /**
   * GET /support/tickets
   * Get support tickets for customer or agent
   */
  app.get("/support/tickets", async (c) => {
    try {
      const customerId = c.req.query('customerId');
      const customerPhone = c.req.query('customerPhone');
      const agentId = c.req.query('agentId');
      const status = c.req.query('status');
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let ticketsQuery = `SELECT * FROM support_tickets WHERE 1=1`;
      const params: any[] = [];
      let paramIndex = 1;

      if (customerId) {
        ticketsQuery += ` AND customer_id = $${paramIndex}`;
        params.push(customerId);
        paramIndex++;
      } else if (customerPhone) {
        ticketsQuery += ` AND customer_phone = $${paramIndex}`;
        params.push(customerPhone);
        paramIndex++;
      }

      if (agentId) {
        ticketsQuery += ` AND assigned_to = $${paramIndex}`;
        params.push(agentId);
        paramIndex++;
      }

      if (status) {
        ticketsQuery += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      ticketsQuery += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const tickets = await query(ticketsQuery, params);

      return c.json({
        success: true,
        tickets: tickets.rows || [],
        count: tickets.rows?.length || 0,
      });
    } catch (error: any) {
      console.error('Error fetching support tickets:', error);
      return c.json({ error: error.message || 'Failed to fetch support tickets' }, 500);
    }
  });

  /**
   * GET /support/tickets/:ticketId
   * Get support ticket details with conversation
   */
  app.get("/support/tickets/:ticketId", async (c) => {
    try {
      const { ticketId } = c.req.param();

      const tickets = await select('support_tickets', { id: ticketId });
      if (tickets.length === 0) {
        return c.json({ error: 'Support ticket not found' }, 404);
      }

      const ticket = tickets[0];

      // Get ticket responses/conversation
      const responses = await query(
        `SELECT * FROM support_ticket_responses 
         WHERE ticket_id = $1 
         ORDER BY created_at ASC`,
        [ticketId]
      ).catch(() => ({ rows: [] }));

      // Get related AI chatbot conversation if exists
      let aiConversation = null;
      if (ticket.source === 'ai_chatbot' && ticket.escalation_ticket_id) {
        try {
          const conversations = await query(
            `SELECT * FROM ai_chatbot_conversations 
             WHERE escalation_ticket_id = $1 
             ORDER BY created_at ASC`,
            [ticketId]
          );
          if (conversations.rows && conversations.rows.length > 0) {
            aiConversation = conversations.rows;
          }
        } catch (e) {
          console.warn('Failed to fetch AI conversation', e);
        }
      }

      return c.json({
        success: true,
        ticket,
        responses: responses.rows || [],
        aiConversation,
      });
    } catch (error: any) {
      console.error('Error fetching support ticket:', error);
      return c.json({ error: error.message || 'Failed to fetch support ticket' }, 500);
    }
  });

  /**
   * POST /support/tickets/:ticketId/respond
   * Add response to support ticket (agent or customer)
   */
  app.post("/support/tickets/:ticketId/respond", async (c) => {
    try {
      const { ticketId } = c.req.param();
      const { message, responderId, responderType, isInternal = false } = await c.req.json();

      if (!message) {
        return c.json({ error: 'message is required' }, 400);
      }

      // Verify ticket exists
      const tickets = await select('support_tickets', { id: ticketId });
      if (tickets.length === 0) {
        return c.json({ error: 'Support ticket not found' }, 404);
      }

      const ticket = tickets[0];

      // Create response
      const response = await insert('support_ticket_responses', {
        ticket_id: ticketId,
        responder_id: responderId || null,
        responder_type: responderType || 'agent',
        message,
        is_internal: isInternal,
        created_at: new Date().toISOString(),
      });

      // Update ticket status
      if (ticket.status === 'open' && responderType === 'agent') {
        await update('support_tickets',
          { id: ticketId },
          {
            status: 'in_progress',
            last_updated_at: new Date().toISOString(),
          }
        );
      }

      // Notify customer if agent responded
      if (responderType === 'agent' && !isInternal && (ticket.customer_phone || ticket.customer_id)) {
        try {
          const snsClient = getSnsClient();
          const customerPhone = ticket.customer_phone || 
            (ticket.customer_id ? (await select('customers', { id: ticket.customer_id }))[0]?.phone : null);
          
          if (customerPhone) {
            await snsClient.send(new PublishCommand({
              PhoneNumber: customerPhone,
              Message: `Support Update: ${message.substring(0, 100)}...`,
              MessageAttributes: {
                'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
              },
            })).catch(err => console.error('SNS notification failed:', err));
          }
        } catch (e) {
          console.warn('Failed to send notification', e);
        }
      }

      return c.json({
        success: true,
        response: response[0],
        message: 'Response added successfully',
      });
    } catch (error: any) {
      console.error('Error adding response:', error);
      return c.json({ error: error.message || 'Failed to add response' }, 500);
    }
  });

  /**
   * PUT /support/tickets/:ticketId/assign
   * Assign ticket to agent (admin/agent only)
   */
  app.put("/support/tickets/:ticketId/assign", async (c) => {
    try {
      const { ticketId } = c.req.param();
      const { agentId, agentName } = await c.req.json();

      if (!agentId) {
        return c.json({ error: 'agentId is required' }, 400);
      }

      const updated = await update('support_tickets',
        { id: ticketId },
        {
          assigned_to: agentId,
          status: 'in_progress',
          assigned_at: new Date().toISOString(),
          last_updated_at: new Date().toISOString(),
        }
      );

      return c.json({
        success: true,
        ticket: updated[0],
        message: 'Ticket assigned successfully',
      });
    } catch (error: any) {
      console.error('Error assigning ticket:', error);
      return c.json({ error: error.message || 'Failed to assign ticket' }, 500);
    }
  });

  /**
   * PUT /support/tickets/:ticketId/status
   * Update ticket status
   */
  app.put("/support/tickets/:ticketId/status", async (c) => {
    try {
      const { ticketId } = c.req.param();
      const { status, resolution } = await c.req.json();

      if (!status || !['open', 'in_progress', 'resolved', 'closed', 'cancelled'].includes(status)) {
        return c.json({ error: 'Valid status is required' }, 400);
      }

      const updateData: any = {
        status,
        last_updated_at: new Date().toISOString(),
      };

      if (status === 'resolved' || status === 'closed') {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolution = resolution || null;
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
      return c.json({ error: error.message || 'Failed to update ticket status' }, 500);
    }
  });

  /**
   * GET /support/agents
   * Get available support agents (admin only)
   */
  app.get("/support/agents", async (c) => {
    try {
      // Get agents from staff table with support role
      const agents = await query(
        `SELECT s.*, v.business_name as vendor_name
         FROM staff s
         LEFT JOIN vendors v ON s.vendor_id = v.id
         WHERE s.role = 'support' OR s.can_handle_support = true
         AND s.is_active = true
         ORDER BY s.name ASC`
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        agents: agents.rows || [],
        count: agents.rows?.length || 0,
      });
    } catch (error: any) {
      console.error('Error fetching agents:', error);
      return c.json({ error: error.message || 'Failed to fetch agents' }, 500);
    }
  });

  // ============================================================================
  // CRM ENDPOINTS (Admin UI compatibility)
  // ============================================================================

  /**
   * GET /crm/tickets
   * Get all support tickets (CRM view)
   */
  app.get("/crm/tickets", async (c) => {
    try {
      const status = c.req.query('status');
      const priority = c.req.query('priority');
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let queryStr = `
        SELECT 
          t.*,
          c.full_name as customer_name,
          c.phone as customer_phone,
          c.email as customer_email,
          s.name as assigned_agent_name,
          t.assigned_to as assigned_agent_id
        FROM support_tickets t
        LEFT JOIN customers c ON t.customer_id = c.id
        LEFT JOIN staff s ON t.assigned_to = s.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      if (status && status !== 'all') {
        queryStr += ` AND t.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (priority) {
        queryStr += ` AND t.priority = $${paramIndex}`;
        params.push(priority);
        paramIndex++;
      }

      queryStr += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const tickets = await query(queryStr, params);

      const safeTickets = (tickets.rows || []).map((t: any) => ({
        id: String(t.id || ''),
        customerId: t.customer_id ? String(t.customer_id) : '',
        subject: String(t.subject || ''),
        // Use message as primary content, fallback to description
        description: String(t.message || t.description || ''),
        status: String(t.status || 'open'),
        priority: String(t.priority || 'medium'),
        source: String(t.source || 'customer'),
        createdAt: String(t.created_at || ''),
        assignedTo: t.assigned_agent_id ? String(t.assigned_agent_id) : undefined,
        assignedAgent: t.assigned_agent_name || undefined,
        category: t.category || undefined,
        customerName: t.customer_name || '',
        customerEmail: t.customer_email || '',
      }));

      return c.json({
        success: true,
        tickets: safeTickets,
        count: safeTickets.length,
      });
    } catch (error: any) {
      console.error('Error fetching CRM tickets:', error);
      return c.json({ success: true, tickets: [], count: 0 });
    }
  });

  /**
   * GET /crm/agents
   * Get CRM agents (alias for /support/agents)
   */
  app.get("/crm/agents", async (c) => {
    try {
      const agents = await query(
        `SELECT s.*, v.business_name as vendor_name
         FROM staff s
         LEFT JOIN vendors v ON s.vendor_id = v.id
         WHERE s.role = 'support' OR s.can_handle_support = true
         AND s.is_active = true
         ORDER BY s.name ASC`
      ).catch(() => ({ rows: [] }));

      const safeAgents = (agents.rows || []).map((a: any) => ({
        id: String(a.id || ''),
        name: String(a.name || ''),
        email: a.email || undefined,
        specialties: a.specialties || ['general'],
        workload: 0, // Could calculate from assigned tickets
      }));

      return c.json({
        success: true,
        agents: safeAgents,
        count: safeAgents.length,
      });
    } catch (error: any) {
      console.error('Error fetching CRM agents:', error);
      return c.json({ success: true, agents: [], count: 0 });
    }
  });

  /**
   * GET /crm/analytics/agents
   * Get agent performance metrics
   */
  app.get("/crm/analytics/agents", async (c) => {
    try {
      const metrics = await query(`
        SELECT 
          s.id as agent_id,
          s.name as agent_name,
          COUNT(t.id) as total_tickets,
          COUNT(t.id) FILTER (WHERE t.status = 'resolved' OR t.status = 'closed') as resolved,
          CASE 
            WHEN COUNT(t.id) > 0 
            THEN ROUND(COUNT(t.id) FILTER (WHERE t.status = 'resolved' OR t.status = 'closed')::numeric / COUNT(t.id) * 100, 2)
            ELSE 0
          END as resolution_rate,
          COALESCE(AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600), 0) as avg_resolution_time_hours
        FROM staff s
        LEFT JOIN support_tickets t ON s.id = t.assigned_to
        WHERE (s.role = 'support' OR s.can_handle_support = true)
        AND s.is_active = true
        GROUP BY s.id, s.name
        ORDER BY total_tickets DESC
      `).catch(() => ({ rows: [] }));

      const safeMetrics = metrics.rows.map((m: any) => ({
        agentId: String(m.agent_id || ''),
        agentName: String(m.agent_name || ''),
        totalTickets: parseInt(m.total_tickets || '0', 10),
        resolved: parseInt(m.resolved || '0', 10),
        resolutionRate: parseFloat(m.resolution_rate || '0'),
        avgResponseTime: 0, // Could calculate from ticket responses
        avgResolutionTime: parseFloat(m.avg_resolution_time_hours || '0'),
        satisfaction: 0, // Could calculate from ratings
      }));

      return c.json({
        success: true,
        metrics: safeMetrics,
      });
    } catch (error: any) {
      console.error('Error fetching agent analytics:', error);
      return c.json({ success: true, metrics: [] });
    }
  });

  /**
   * POST /crm/action
   * Perform CRM action (assign, escalate, etc.)
   */
  app.post("/crm/action", async (c) => {
    try {
      const body = await c.req.json();
      const { ticketId, action, ...actionData } = body;

      if (!ticketId || !action) {
        return c.json({ error: 'ticketId and action are required' }, 400);
      }

      const tickets = await select('support_tickets', { id: ticketId });
      if (tickets.length === 0) {
        return c.json({ error: 'Ticket not found' }, 404);
      }

      const updateData: any = {
        last_updated_at: new Date().toISOString(),
      };

      switch (action) {
        case 'assign':
          if (actionData.assignTo || actionData.agentId) {
            updateData.assigned_to = actionData.assignTo || actionData.agentId;
            updateData.assigned_at = new Date().toISOString();
            updateData.status = 'in_progress';
          }
          break;
        case 'escalate':
          updateData.priority = 'urgent';
          updateData.status = 'escalated';
          updateData.escalated_at = new Date().toISOString();
          updateData.escalation_reason = actionData.reason || 'Escalated by admin';
          break;
        case 'reopen':
          updateData.status = 'open';
          updateData.resolved_at = null;
          break;
        case 'close':
          updateData.status = 'closed';
          updateData.resolved_at = new Date().toISOString();
          updateData.resolution_notes = actionData.reason || null;
          break;
        case 'refund':
        case 'partial_refund':
          // Process actual refund through Razorpay if booking has payment
          const ticket = tickets[0];
          let refundResult = null;
          
          if (ticket.booking_id) {
            try {
              // Get payment for this booking
              const payments = await query(
                `SELECT * FROM payments WHERE booking_id = $1 AND status = 'captured' ORDER BY created_at DESC LIMIT 1`,
                [ticket.booking_id]
              );
              
              if (payments.rows.length > 0) {
                const payment = payments.rows[0];
                const refundAmount = actionData.amount || payment.amount;
                
                // Create refund record
                const refundRecord = await insert('refunds', {
                  payment_id: payment.id,
                  booking_id: ticket.booking_id,
                  customer_id: ticket.customer_id,
                  vendor_id: ticket.vendor_id,
                  refund_amount: refundAmount,
                  refund_reason: actionData.reason || 'Support ticket refund',
                  refund_status: 'pending',
                  support_ticket_id: ticketId,
                  requested_at: new Date().toISOString(),
                });
                
                // Update ticket with refund info
                updateData.refund_id = refundRecord[0]?.id;
                updateData.refund_amount = refundAmount;
                updateData.refund_status = 'pending';
                
                refundResult = {
                  refundId: refundRecord[0]?.id,
                  amount: refundAmount,
                  status: 'pending',
                  message: 'Refund request created. Will be processed within 5-7 business days.',
                };
                
                console.log(`✅ [CRM] Refund created for ticket ${ticketId}: ₹${refundAmount}`);
              } else {
                // No payment found - just log the request
                console.log(`⚠️ [CRM] No captured payment found for booking ${ticket.booking_id}`);
              }
            } catch (refundError: any) {
              console.error('Error processing refund:', refundError);
              // Continue with metadata logging even if refund creation fails
            }
          }
          
          // Always update metadata for audit trail
          updateData.metadata = {
            ...(ticket.metadata || {}),
            refund_requested: true,
            refund_amount: actionData.amount,
            refund_reason: actionData.reason,
            refund_type: action === 'partial_refund' ? 'partial' : 'full',
            refund_requested_at: new Date().toISOString(),
            refund_result: refundResult,
          };
          break;
        default:
          return c.json({ error: `Unknown action: ${action}` }, 400);
      }

      const updated = await update('support_tickets', { id: ticketId }, updateData);

      return c.json({
        success: true,
        ticket: updated[0],
        message: `Ticket ${action} completed`,
      });
    } catch (error: any) {
      console.error('Error performing CRM action:', error);
      return c.json({ error: error.message || 'Failed to perform action' }, 500);
    }
  });

  /**
   * POST /crm/reply
   * Add reply to ticket
   */
  app.post("/crm/reply", async (c) => {
    try {
      const body = await c.req.json();
      const { ticketId, message, responderId, responderType = 'agent' } = body;

      if (!ticketId || !message) {
        return c.json({ error: 'ticketId and message are required' }, 400);
      }

      const tickets = await select('support_tickets', { id: ticketId });
      if (tickets.length === 0) {
        return c.json({ error: 'Ticket not found' }, 404);
      }

      const response = await insert('support_ticket_responses', {
        ticket_id: ticketId,
        responder_id: responderId || null,
        responder_type: responderType,
        message,
        is_internal: false,
        created_at: new Date().toISOString(),
      });

      // Update ticket status if agent replied
      if (responderType === 'agent') {
        await update('support_tickets', { id: ticketId }, {
          status: 'in_progress',
          last_updated_at: new Date().toISOString(),
        });
      }

      return c.json({
        success: true,
        response: response[0],
        message: 'Reply added successfully',
      });
    } catch (error: any) {
      console.error('Error adding reply:', error);
      return c.json({ error: error.message || 'Failed to add reply' }, 500);
    }
  });

  /**
   * POST /crm/close
   * Close ticket
   */
  app.post("/crm/close", async (c) => {
    try {
      const body = await c.req.json();
      const { ticketId, resolution } = body;

      if (!ticketId) {
        return c.json({ error: 'ticketId is required' }, 400);
      }

      const updated = await update('support_tickets', { id: ticketId }, {
        status: 'closed',
        resolution: resolution || null,
        resolved_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        ticket: updated[0],
        message: 'Ticket closed successfully',
      });
    } catch (error: any) {
      console.error('Error closing ticket:', error);
      return c.json({ error: error.message || 'Failed to close ticket' }, 500);
    }
  });

  /**
   * POST /crm/tickets/auto-route
   * Auto-route tickets to available agents
   */
  app.post("/crm/tickets/auto-route", async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { ticketId } = body;

      // If a specific ticketId is provided, route only that ticket
      // Otherwise, route all unassigned open tickets
      const unassigned = await query(
        ticketId 
          ? `SELECT * FROM support_tickets WHERE id = $1 AND status = 'open' AND assigned_to IS NULL`
          : `SELECT * FROM support_tickets WHERE status = 'open' AND assigned_to IS NULL ORDER BY created_at ASC LIMIT 10`,
        ticketId ? [ticketId] : []
      ).catch(() => ({ rows: [] }));

      // Get available agents (sorted by current workload)
      const agents = await query(`
        SELECT s.id, s.name,
          COUNT(t.id) as current_workload
        FROM staff s
        LEFT JOIN support_tickets t ON s.id = t.assigned_to 
          AND t.status IN ('open', 'in_progress')
        WHERE (s.role = 'support' OR s.can_handle_support = true)
        AND s.is_active = true
        GROUP BY s.id, s.name
        ORDER BY current_workload ASC
      `).catch(() => ({ rows: [] }));

      if (agents.rows.length === 0) {
        return c.json({
          success: true,
          message: 'No available agents',
          routed: 0,
        });
      }

      let routed = 0;
      let assignedAgent = null;
      for (let i = 0; i < unassigned.rows.length; i++) {
        const ticket = unassigned.rows[i];
        const agent = agents.rows[i % agents.rows.length];

        await update('support_tickets', { id: ticket.id }, {
          assigned_to: agent.id,
          assigned_at: new Date().toISOString(),
          status: 'in_progress',
          last_updated_at: new Date().toISOString(),
        });
        routed++;
        assignedAgent = agent.name;
      }

      return c.json({
        success: true,
        message: `Routed ${routed} ticket(s)`,
        routed,
        assignedAgent: assignedAgent,
      });
    } catch (error: any) {
      console.error('Error auto-routing tickets:', error);
      return c.json({ error: error.message || 'Failed to auto-route tickets' }, 500);
    }
  });

  /**
   * POST /support/chat-handoff
   * Create a support ticket from P2P chat handoff with full booking context
   * Used when booking chat ends and customer needs further assistance
   */
  app.post("/support/chat-handoff", async (c) => {
    try {
      const {
        bookingId,
        customerId,
        customerPhone,
        vendorId,
        reason,
        chatHistory, // Last few messages for context
        userType = 'customer',
      } = await c.req.json();

      if (!bookingId) {
        return c.json({ error: 'bookingId is required for chat handoff' }, 400);
      }

      console.log(`📞 [SUPPORT-HANDOFF] Creating support ticket from chat for booking: ${bookingId}`);

      // Fetch comprehensive booking details for CRM
      const bookingResult = await select('bookings', { id: bookingId });
      if (bookingResult.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookingResult[0];

      // Fetch all related entities for full context
      const [customer, vendor, pet, service, reviews, prescriptions, chatMessages] = await Promise.all([
        // Customer details
        booking.customer_id 
          ? select('customers', { id: booking.customer_id }).catch(() => [])
          : Promise.resolve([]),
        // Vendor details
        booking.vendor_id
          ? select('vendors', { id: booking.vendor_id }).catch(() => [])
          : Promise.resolve([]),
        // Pet details
        booking.pet_id
          ? select('pets', { id: booking.pet_id }).catch(() => [])
          : Promise.resolve([]),
        // Service details
        booking.service_id
          ? select('services', { id: booking.service_id }).catch(() => [])
          : Promise.resolve([]),
        // Reviews for this booking
        query(
          `SELECT * FROM reviews WHERE booking_id = $1`,
          [bookingId]
        ).catch(() => ({ rows: [] })),
        // Prescriptions
        query(
          `SELECT * FROM prescriptions WHERE booking_id = $1 AND is_active = true`,
          [bookingId]
        ).catch(() => ({ rows: [] })),
        // Chat messages (last 20 for context)
        query(
          `SELECT * FROM chat_messages 
           WHERE booking_id = $1 
           ORDER BY created_at DESC 
           LIMIT 20`,
          [bookingId]
        ).catch(() => ({ rows: [] })),
      ]);

      // Build comprehensive context for CRM agent
      const crmContext = {
        booking: {
          id: booking.id,
          status: booking.status,
          bookingDate: booking.booking_date,
          bookingTime: booking.booking_time,
          serviceStyle: booking.service_style,
          totalAmount: booking.total_amount,
          paymentStatus: booking.payment_status,
          notes: booking.notes,
          specialInstructions: booking.special_instructions,
          completedAt: booking.completed_at,
          cancelledAt: booking.cancelled_at,
          cancellationReason: booking.cancellation_reason,
          createdAt: booking.created_at,
        },
        customer: customer[0] ? {
          id: customer[0].id,
          name: customer[0].full_name,
          phone: customer[0].phone,
          email: customer[0].email,
          address: customer[0].address,
        } : null,
        vendor: vendor[0] ? {
          id: vendor[0].id,
          businessName: vendor[0].business_name,
          fullName: vendor[0].full_name,
          phone: vendor[0].phone,
          email: vendor[0].email,
          vendorType: vendor[0].vendor_type,
        } : null,
        pet: pet[0] ? {
          id: pet[0].id,
          name: pet[0].name,
          species: pet[0].species,
          breed: pet[0].breed,
          age: pet[0].age,
          weight: pet[0].weight,
        } : null,
        service: service[0] ? {
          id: service[0].id,
          name: service[0].name,
          category: service[0].category,
          price: service[0].price,
        } : null,
        review: reviews.rows[0] ? {
          rating: reviews.rows[0].rating,
          comment: reviews.rows[0].comment,
          createdAt: reviews.rows[0].created_at,
        } : null,
        prescriptions: prescriptions.rows.map((p: any) => ({
          id: p.id,
          diagnosis: p.diagnosis,
          medications: p.medications,
          notes: p.notes,
        })),
        recentChatHistory: chatMessages.rows.reverse().map((m: any) => ({
          sender: m.sender_type,
          message: m.message,
          time: m.created_at,
        })),
      };

      // Create detailed support ticket
      const ticket = await insert('support_tickets', {
        ticket_number: generateSupportTicketNumber(),
        customer_id: booking.customer_id || customerId || null,
        customer_phone: customerPhone || customer[0]?.phone || null,
        vendor_id: booking.vendor_id || vendorId || null,
        booking_id: bookingId,
        subject: `Post-Booking Support: ${service[0]?.name || 'Service'} - ${customer[0]?.full_name || 'Customer'}`,
        message: reason || 'Customer requested support after booking chat ended',
        source: 'chat_handoff',
        priority: 'medium',
        category: 'service',
        status: 'open',
        metadata: crmContext,
        attachments: [],
        created_at: new Date().toISOString(),
      });

      console.log(`✅ [SUPPORT-HANDOFF] Support ticket created: ${ticket[0].id}`);

      // Notify support team
      try {
        const { publishToSNS } = require('../utils/aws-clients');
        await publishToSNS('platform-notifications', {
          type: 'chat_handoff',
          ticket_id: ticket[0].id,
          booking_id: bookingId,
          customer_name: customer[0]?.full_name || 'Customer',
          vendor_name: vendor[0]?.business_name || 'Vendor',
          priority: 'medium',
        }).catch(() => {});
      } catch (e) {
        // Silent fail for notifications
      }

      return c.json({
        success: true,
        ticket: {
          id: ticket[0].id,
          status: 'open',
          subject: ticket[0].subject,
        },
        message: 'Support ticket created successfully. Our team will assist you shortly.',
      });
    } catch (error: any) {
      console.error('Error creating chat handoff ticket:', error);
      return c.json({ error: error.message || 'Failed to create support ticket' }, 500);
    }
  });

  /**
   * GET /support/ticket/:ticketId/context
   * Get full CRM context for a support ticket (for agent view)
   */
  app.get("/support/ticket/:ticketId/context", async (c) => {
    try {
      const { ticketId } = c.req.param();

      const tickets = await select('support_tickets', { id: ticketId });
      if (tickets.length === 0) {
        return c.json({ error: 'Ticket not found' }, 404);
      }

      const ticket = tickets[0];

      // If metadata has full context (from chat handoff), return it
      if (ticket.metadata && Object.keys(ticket.metadata).length > 0) {
        return c.json({
          success: true,
          ticket: {
            id: ticket.id,
            status: ticket.status,
            subject: ticket.subject,
            message: ticket.message,
            source: ticket.source,
            priority: ticket.priority,
            createdAt: ticket.created_at,
            assignedAgentId: ticket.assigned_agent_id,
          },
          context: ticket.metadata,
        });
      }

      // Otherwise, build context from related entities
      const context: any = {};

      if (ticket.booking_id) {
        const bookings = await select('bookings', { id: ticket.booking_id });
        if (bookings.length > 0) {
          context.booking = bookings[0];
        }
      }

      if (ticket.customer_id) {
        const customers = await select('customers', { id: ticket.customer_id });
        if (customers.length > 0) {
          context.customer = {
            id: customers[0].id,
            name: customers[0].full_name,
            phone: customers[0].phone,
            email: customers[0].email,
          };
        }
      }

      if (ticket.vendor_id) {
        const vendors = await select('vendors', { id: ticket.vendor_id });
        if (vendors.length > 0) {
          context.vendor = {
            id: vendors[0].id,
            businessName: vendors[0].business_name,
            phone: vendors[0].phone,
          };
        }
      }

      // Get ticket responses/history
      const responses = await query(
        `SELECT * FROM support_ticket_responses 
         WHERE ticket_id = $1 
         ORDER BY created_at ASC`,
        [ticketId]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        ticket: {
          id: ticket.id,
          status: ticket.status,
          subject: ticket.subject,
          message: ticket.message,
          source: ticket.source,
          priority: ticket.priority,
          createdAt: ticket.created_at,
          assignedAgentId: ticket.assigned_agent_id,
        },
        context,
        responses: responses.rows,
      });
    } catch (error: any) {
      console.error('Error fetching ticket context:', error);
      return c.json({ error: error.message || 'Failed to fetch ticket context' }, 500);
    }
  });

  // ============================================================================
  // SUPPORT SETTINGS ENDPOINTS
  // ============================================================================

  /**
   * GET /support/settings/agents
   * Get all support agents with their details
   */
  app.get("/support/settings/agents", async (c) => {
    try {
      const result = await query(`
        SELECT 
          sa.*,
          s.name,
          s.email,
          s.phone,
          s.role as staff_role,
          (SELECT COUNT(*) FROM support_tickets WHERE assigned_to = sa.staff_id AND status NOT IN ('closed', 'resolved')) as active_tickets
        FROM support_agents sa
        JOIN staff s ON sa.staff_id = s.id
        WHERE sa.is_active = true
        ORDER BY s.name
      `);

      return c.json({
        success: true,
        agents: result.rows.map(a => ({
          id: a.id,
          staffId: a.staff_id,
          name: a.name,
          email: a.email,
          phone: a.phone,
          role: a.role,
          staffRole: a.staff_role,
          maxConcurrentTickets: a.max_concurrent_tickets,
          specialties: a.specialties || [],
          availabilityStatus: a.availability_status,
          lastActiveAt: a.last_active_at,
          activeTickets: parseInt(a.active_tickets) || 0,
          isActive: a.is_active,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching support agents:', error);
      return c.json({ error: error.message || 'Failed to fetch agents' }, 500);
    }
  });

  /**
   * POST /support/settings/agents
   * Create or update a support agent
   */
  app.post("/support/settings/agents", async (c) => {
    try {
      const body = await c.req.json();
      const { staffId, role, maxConcurrentTickets, specialties } = body;

      if (!staffId) {
        return c.json({ error: 'staffId is required' }, 400);
      }

      // Check if agent already exists
      const existing = await query('SELECT id FROM support_agents WHERE staff_id = $1', [staffId]);
      
      if (existing.rows.length > 0) {
        // Update existing
        const updated = await query(`
          UPDATE support_agents 
          SET role = COALESCE($2, role),
              max_concurrent_tickets = COALESCE($3, max_concurrent_tickets),
              specialties = COALESCE($4, specialties),
              is_active = true
          WHERE staff_id = $1
          RETURNING *
        `, [staffId, role, maxConcurrentTickets, specialties]);
        
        // Also update staff can_handle_support flag
        await query('UPDATE staff SET can_handle_support = true WHERE id = $1', [staffId]);
        
        return c.json({ success: true, agent: updated.rows[0], message: 'Agent updated' });
      } else {
        // Create new
        const created = await query(`
          INSERT INTO support_agents (staff_id, role, max_concurrent_tickets, specialties, is_active)
          VALUES ($1, $2, $3, $4, true)
          RETURNING *
        `, [staffId, role || 'agent', maxConcurrentTickets || 10, specialties || ['general']]);
        
        // Update staff can_handle_support flag
        await query('UPDATE staff SET can_handle_support = true WHERE id = $1', [staffId]);
        
        return c.json({ success: true, agent: created.rows[0], message: 'Agent created' });
      }
    } catch (error: any) {
      console.error('Error saving support agent:', error);
      return c.json({ error: error.message || 'Failed to save agent' }, 500);
    }
  });

  /**
   * DELETE /support/settings/agents/:agentId
   * Deactivate a support agent
   */
  app.delete("/support/settings/agents/:agentId", async (c) => {
    try {
      const { agentId } = c.req.param();

      const result = await query(`
        UPDATE support_agents SET is_active = false WHERE id = $1 OR staff_id = $1 RETURNING staff_id
      `, [agentId]);

      if (result.rows.length > 0) {
        await query('UPDATE staff SET can_handle_support = false WHERE id = $1', [result.rows[0].staff_id]);
      }

      return c.json({ success: true, message: 'Agent deactivated' });
    } catch (error: any) {
      console.error('Error deactivating agent:', error);
      return c.json({ error: error.message || 'Failed to deactivate agent' }, 500);
    }
  });

  /**
   * GET /support/settings/sla
   * Get all SLA configurations
   */
  app.get("/support/settings/sla", async (c) => {
    try {
      const result = await query(`
        SELECT * FROM support_sla_config 
        WHERE is_active = true 
        ORDER BY first_response_minutes
      `);

      return c.json({
        success: true,
        slaConfigs: result.rows.map(s => ({
          id: s.id,
          name: s.name,
          priority: s.priority,
          firstResponseMinutes: s.first_response_minutes,
          resolutionMinutes: s.resolution_minutes,
          escalationAfterMinutes: s.escalation_after_minutes,
          isActive: s.is_active,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching SLA configs:', error);
      return c.json({ error: error.message || 'Failed to fetch SLA configs' }, 500);
    }
  });

  /**
   * POST /support/settings/sla
   * Create or update SLA configuration
   */
  app.post("/support/settings/sla", async (c) => {
    try {
      const body = await c.req.json();
      const { id, name, priority, firstResponseMinutes, resolutionMinutes, escalationAfterMinutes } = body;

      if (!priority || !firstResponseMinutes || !resolutionMinutes) {
        return c.json({ error: 'priority, firstResponseMinutes, and resolutionMinutes are required' }, 400);
      }

      if (id) {
        // Update existing
        const updated = await query(`
          UPDATE support_sla_config 
          SET name = $2, priority = $3, first_response_minutes = $4, 
              resolution_minutes = $5, escalation_after_minutes = $6, updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `, [id, name, priority, firstResponseMinutes, resolutionMinutes, escalationAfterMinutes]);
        
        return c.json({ success: true, slaConfig: updated.rows[0], message: 'SLA updated' });
      } else {
        // Create new
        const created = await query(`
          INSERT INTO support_sla_config (name, priority, first_response_minutes, resolution_minutes, escalation_after_minutes)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `, [name || `${priority} SLA`, priority, firstResponseMinutes, resolutionMinutes, escalationAfterMinutes]);
        
        return c.json({ success: true, slaConfig: created.rows[0], message: 'SLA created' });
      }
    } catch (error: any) {
      console.error('Error saving SLA config:', error);
      return c.json({ error: error.message || 'Failed to save SLA config' }, 500);
    }
  });

  /**
   * GET /support/settings/categories
   * Get all support categories
   */
  app.get("/support/settings/categories", async (c) => {
    try {
      const result = await query(`
        SELECT sc.*, s.name as auto_assign_name
        FROM support_categories sc
        LEFT JOIN staff s ON sc.auto_assign_to = s.id
        WHERE sc.is_active = true 
        ORDER BY sc.display_order
      `);

      return c.json({
        success: true,
        categories: result.rows.map(cat => ({
          id: cat.id,
          name: cat.name,
          description: cat.description,
          defaultPriority: cat.default_priority,
          autoAssignTo: cat.auto_assign_to,
          autoAssignName: cat.auto_assign_name,
          displayOrder: cat.display_order,
          isActive: cat.is_active,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      return c.json({ error: error.message || 'Failed to fetch categories' }, 500);
    }
  });

  /**
   * POST /support/settings/categories
   * Create or update support category
   */
  app.post("/support/settings/categories", async (c) => {
    try {
      const body = await c.req.json();
      const { id, name, description, defaultPriority, autoAssignTo, displayOrder } = body;

      if (!name) {
        return c.json({ error: 'name is required' }, 400);
      }

      if (id) {
        const updated = await query(`
          UPDATE support_categories 
          SET name = $2, description = $3, default_priority = $4, 
              auto_assign_to = $5, display_order = $6
          WHERE id = $1
          RETURNING *
        `, [id, name, description, defaultPriority || 'medium', autoAssignTo, displayOrder || 0]);
        
        return c.json({ success: true, category: updated.rows[0], message: 'Category updated' });
      } else {
        const created = await query(`
          INSERT INTO support_categories (name, description, default_priority, auto_assign_to, display_order)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `, [name, description, defaultPriority || 'medium', autoAssignTo, displayOrder || 0]);
        
        return c.json({ success: true, category: created.rows[0], message: 'Category created' });
      }
    } catch (error: any) {
      console.error('Error saving category:', error);
      return c.json({ error: error.message || 'Failed to save category' }, 500);
    }
  });

  /**
   * GET /support/settings/escalation-rules
   * Get all escalation rules
   */
  app.get("/support/settings/escalation-rules", async (c) => {
    try {
      const result = await query(`
        SELECT er.*, s.name as escalate_to_name
        FROM support_escalation_rules er
        LEFT JOIN staff s ON er.escalate_to = s.id
        WHERE er.is_active = true 
        ORDER BY er.trigger_value
      `);

      return c.json({
        success: true,
        rules: result.rows.map(rule => ({
          id: rule.id,
          name: rule.name,
          triggerType: rule.trigger_type,
          triggerValue: rule.trigger_value,
          priorityFilter: rule.priority_filter,
          categoryFilter: rule.category_filter,
          escalateTo: rule.escalate_to,
          escalateToName: rule.escalate_to_name,
          newPriority: rule.new_priority,
          notifyEmail: rule.notify_email,
          isActive: rule.is_active,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching escalation rules:', error);
      return c.json({ error: error.message || 'Failed to fetch escalation rules' }, 500);
    }
  });

  /**
   * POST /support/settings/escalation-rules
   * Create or update escalation rule
   */
  app.post("/support/settings/escalation-rules", async (c) => {
    try {
      const body = await c.req.json();
      const { id, name, triggerType, triggerValue, priorityFilter, categoryFilter, escalateTo, newPriority, notifyEmail } = body;

      if (!name || !triggerType || triggerValue === undefined) {
        return c.json({ error: 'name, triggerType, and triggerValue are required' }, 400);
      }

      if (id) {
        const updated = await query(`
          UPDATE support_escalation_rules 
          SET name = $2, trigger_type = $3, trigger_value = $4, priority_filter = $5,
              category_filter = $6, escalate_to = $7, new_priority = $8, notify_email = $9
          WHERE id = $1
          RETURNING *
        `, [id, name, triggerType, triggerValue, priorityFilter, categoryFilter, escalateTo, newPriority, notifyEmail]);
        
        return c.json({ success: true, rule: updated.rows[0], message: 'Rule updated' });
      } else {
        const created = await query(`
          INSERT INTO support_escalation_rules (name, trigger_type, trigger_value, priority_filter, category_filter, escalate_to, new_priority, notify_email)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `, [name, triggerType, triggerValue, priorityFilter, categoryFilter, escalateTo, newPriority, notifyEmail]);
        
        return c.json({ success: true, rule: created.rows[0], message: 'Rule created' });
      }
    } catch (error: any) {
      console.error('Error saving escalation rule:', error);
      return c.json({ error: error.message || 'Failed to save escalation rule' }, 500);
    }
  });

  /**
   * DELETE /support/settings/escalation-rules/:ruleId
   * Delete an escalation rule
   */
  app.delete("/support/settings/escalation-rules/:ruleId", async (c) => {
    try {
      const { ruleId } = c.req.param();

      await query('UPDATE support_escalation_rules SET is_active = false WHERE id = $1', [ruleId]);

      return c.json({ success: true, message: 'Rule deleted' });
    } catch (error: any) {
      console.error('Error deleting escalation rule:', error);
      return c.json({ error: error.message || 'Failed to delete rule' }, 500);
    }
  });

  /**
   * GET /support/settings/staff-list
   * Get list of all staff for agent selection
   */
  app.get("/support/settings/staff-list", async (c) => {
    try {
      const result = await query(`
        SELECT id, name, email, phone, role, can_handle_support
        FROM staff 
        WHERE is_active = true
        ORDER BY name
      `);

      return c.json({
        success: true,
        staff: result.rows.map(s => ({
          id: s.id,
          name: s.name,
          email: s.email,
          phone: s.phone,
          role: s.role,
          canHandleSupport: s.can_handle_support,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching staff list:', error);
      return c.json({ error: error.message || 'Failed to fetch staff list' }, 500);
    }
  });
}

