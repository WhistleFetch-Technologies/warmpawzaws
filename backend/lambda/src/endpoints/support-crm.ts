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
              priority: body.priority || 'medium',
              subject: body.subject,
              message: body.message,
              customer_id: body.customer_id,
              vendor_id: body.vendor_id,
              phone: supportPhone,
              email: supportEmail,
            }, {
              messageType: 'Transactional',
              priority: body.priority || 'medium',
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
        ticketsQuery += ` AND assigned_agent_id = $${paramIndex}`;
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
          assigned_agent_id: agentId,
          assigned_agent_name: agentName || null,
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
}

