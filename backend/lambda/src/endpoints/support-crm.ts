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
          c.name as customer_name,
          c.phone as customer_phone,
          c.email as customer_email,
          s.name as assigned_agent_name
        FROM support_tickets t
        LEFT JOIN customers c ON t.customer_id = c.id
        LEFT JOIN staff s ON t.assigned_agent_id = s.id
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
        description: String(t.description || ''),
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
        LEFT JOIN support_tickets t ON s.id = t.assigned_agent_id
        WHERE s.role = 'support' OR s.can_handle_support = true
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
          if (actionData.agentId) {
            updateData.assigned_agent_id = actionData.agentId;
            updateData.status = 'in_progress';
          }
          break;
        case 'escalate':
          updateData.priority = 'high';
          updateData.status = 'escalated';
          break;
        case 'close':
          updateData.status = 'closed';
          updateData.resolved_at = new Date().toISOString();
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
      // Get unassigned open tickets
      const unassigned = await query(`
        SELECT * FROM support_tickets
        WHERE status = 'open' AND assigned_agent_id IS NULL
        ORDER BY created_at ASC
        LIMIT 10
      `).catch(() => ({ rows: [] }));

      // Get available agents (sorted by current workload)
      const agents = await query(`
        SELECT s.id, s.name,
          COUNT(t.id) as current_workload
        FROM staff s
        LEFT JOIN support_tickets t ON s.id = t.assigned_agent_id 
          AND t.status IN ('open', 'in_progress')
        WHERE s.role = 'support' OR s.can_handle_support = true
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
      for (let i = 0; i < unassigned.rows.length && i < agents.rows.length; i++) {
        const ticket = unassigned.rows[i];
        const agent = agents.rows[i % agents.rows.length];

        await update('support_tickets', { id: ticket.id }, {
          assigned_agent_id: agent.id,
          status: 'in_progress',
          last_updated_at: new Date().toISOString(),
        });
        routed++;
      }

      return c.json({
        success: true,
        message: `Routed ${routed} ticket(s)`,
        routed,
      });
    } catch (error: any) {
      console.error('Error auto-routing tickets:', error);
      return c.json({ error: error.message || 'Failed to auto-route tickets' }, 500);
    }
  });
}

