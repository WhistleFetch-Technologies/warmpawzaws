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
import { select, insert, update, query } from '../../../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { generateSupportTicketNumber } from '../../../utils/support-ticket-number';
import { isValidUUID } from '../../../types/entities';
import { invokeBedrock } from '../../../utils/bedrock-client';
import { buildSupportTicketsListQuery } from '../build-support-tickets-list-query';
import {
  validateBookingTicketLink,
  buildBookingSnapshot,
  buildPaymentSnapshot,
  enrichSupportTicket,
  resolveMealOrderIdFromTicket,
  buildMealOrderPaymentSnapshot,
  resolveCustomerProfile,
  resolveVendorProfile,
  mapTicketForCrmList,
} from '../support-ticket-helpers';
import {
  recordSupportTicketActivity,
  listSupportTicketActivity,
  resolveActorDisplayName,
  SUPPORT_TICKET_EVENT_TYPES,
} from '../support-ticket-activity';
import { scheduleSupportTicketAiAck, retryPostAckAssignment } from '../support-ticket-ai-ack';
import { enrichSupportTicketMetadataAttachments } from '../support-ticket-attachments';
import { notifySupportTicketCustomerSms } from '../support-ticket-notify';
import {
  scheduleSupportTicketNotification,
  shouldNotifyCustomerOnAgentReply,
} from '../support-ticket-notification-dispatch';
import {
  getSupportNotificationSettings,
  updateSupportNotificationSettings,
} from '../support-ticket-notification-settings';
import { processSupportTicketEscalationBatch } from '../support-ticket-escalation-processor';
import { resolveSupportTicketOrderLink } from '../resolve-support-ticket-order-link';
import { normalizeSupportTicketCategory, isExtendedSupportCategory } from '../normalize-support-ticket-category';
import {
  assignSupportTicket,
  assignSupportTicketBatch,
  getSupportRoutingSettings,
  updateSupportRoutingSettings,
} from '../support-ticket-auto-assign';

async function logTicketStatusActivity(
  ticketId: string,
  fromStatus: string | null | undefined,
  toStatus: string,
  actorType = 'system',
  actorId?: string | null
): Promise<void> {
  await recordSupportTicketActivity({
    ticketId,
    eventType: SUPPORT_TICKET_EVENT_TYPES.STATUS_CHANGED,
    eventActorType: actorType,
    eventActorId: actorId ?? null,
    eventTitle: `Status changed to ${toStatus.replace(/_/g, ' ')}`,
    eventMetadata: { from: fromStatus ?? null, to: toStatus },
  });
}

async function resolveAssigneeName(assigneeId: string | null | undefined): Promise<string | null> {
  if (!assigneeId) return null;
  return resolveActorDisplayName('agent', assigneeId);
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
        metadata: metadataInput,
      } = await c.req.json();

      if (!subject || !message) {
        return c.json({ error: 'subject and message are required' }, 400);
      }

      // Attachments live in metadata JSONB so inserts work before/without DB column support_tickets.attachments (prod).
      const metaBase =
        metadataInput != null && typeof metadataInput === 'object' && !Array.isArray(metadataInput)
          ? { ...(metadataInput as Record<string, unknown>) }
          : {};
      const { attachments: metaAttachments, ...metaRest } = metaBase as {
        attachments?: unknown;
        [k: string]: unknown;
      };
      const attachmentList = Array.isArray(attachments)
        ? attachments
        : Array.isArray(metaAttachments)
          ? metaAttachments
          : [];

      let resolvedBookingId: string | null = bookingId || null;
      let resolvedCustomerId: string | null = customerId || null;
      let resolvedVendorId: string | null = null;
      let resolvedCategory = normalizeSupportTicketCategory(category);
      let resolvedOrdersTableId: string | null = null;
      let resolvedMealOrderId: string | null = null;
      const metaTicketType =
        typeof metaRest.ticket_type === 'string' ? metaRest.ticket_type : undefined;
      let ticketType: 'general' | 'booking' | 'meal_order' = 'general';
      let bookingSnapshot = null;
      let paymentSnapshot = null;

      if (orderId) {
        const orderLink = await resolveSupportTicketOrderLink(String(orderId), metaTicketType);
        if (orderLink.kind === 'error') {
          return c.json({ error: orderLink.error }, 400);
        }
        if (orderLink.kind === 'orders') {
          resolvedOrdersTableId = orderLink.orderId;
          ticketType = metaTicketType === 'meal_order' ? 'meal_order' : 'general';
        } else if (orderLink.kind === 'meal_orders') {
          resolvedMealOrderId = orderLink.mealOrderId;
          ticketType = 'meal_order';
        }
      }

      if (resolvedBookingId) {
        try {
          const linked = await validateBookingTicketLink(resolvedBookingId, resolvedCustomerId);
          resolvedCustomerId = linked.resolvedCustomerId;
          resolvedVendorId = linked.vendorId;
        } catch (linkErr: any) {
          return c.json({ error: linkErr.message || 'Invalid booking link' }, 400);
        }
        ticketType = 'booking';
        if (!resolvedCategory || resolvedCategory === 'general') {
          resolvedCategory = 'billing';
        }
        try {
          bookingSnapshot = await buildBookingSnapshot(resolvedBookingId);
          paymentSnapshot = await buildPaymentSnapshot(resolvedBookingId);
        } catch (snapErr) {
          console.warn('[support/tickets] booking snapshot failed (ticket will still be created):', snapErr);
        }
      } else if (ticketType === 'meal_order') {
        if (!resolvedCategory || resolvedCategory === 'general') {
          resolvedCategory = 'billing';
        }
      } else {
        ticketType = 'general';
        if (!resolvedCategory) resolvedCategory = 'general';
      }

      // Create support ticket
      let customerProfile: Awaited<ReturnType<typeof resolveCustomerProfile>> | null = null;
      if (resolvedCustomerId || customerPhone) {
        customerProfile = await resolveCustomerProfile({
          customer_id: resolvedCustomerId,
          customer_phone: customerPhone || null,
          booking_id: resolvedBookingId,
        });
      }

      const ticketPayload: Record<string, unknown> = {
        ticket_number: generateSupportTicketNumber(),
        customer_id: resolvedCustomerId || null,
        customer_name: customerProfile?.customerName || null,
        customer_email: customerProfile?.customerEmail || null,
        customer_phone: customerProfile?.customerPhone || customerPhone || null,
        vendor_id: resolvedVendorId || null,
        subject,
        message,
        source,
        priority,
        category: resolvedCategory,
        booking_id: resolvedBookingId,
        order_id: resolvedOrdersTableId,
        status: 'open',
        metadata: {
          ...metaRest,
          attachments: attachmentList,
          ticket_type: ticketType,
          issue_category: category || resolvedCategory,
          ...(resolvedMealOrderId ? { linked_meal_order_id: resolvedMealOrderId } : {}),
          ...(bookingSnapshot ? { booking_snapshot: bookingSnapshot } : {}),
          ...(paymentSnapshot ? { payment_snapshot: paymentSnapshot } : {}),
        },
        created_at: new Date().toISOString(),
      };

      if (resolvedMealOrderId) {
        ticketPayload.meal_order_id = resolvedMealOrderId;
      }

      let ticket: Awaited<ReturnType<typeof insert>>;
      try {
        ticket = await insert('support_tickets', ticketPayload);
      } catch (insertErr: unknown) {
        const msg = String((insertErr as Error)?.message || insertErr || '');
        const retryPayload = { ...ticketPayload };
        let shouldRetry = false;

        if (resolvedMealOrderId && msg.includes('meal_order_id')) {
          delete retryPayload.meal_order_id;
          shouldRetry = true;
        }
        if (isExtendedSupportCategory(resolvedCategory) && msg.includes('support_tickets_category_check')) {
          retryPayload.category =
            { cancellation: 'service', delivery: 'service', wrong_items: 'other', quality: 'service' }[
              resolvedCategory
            ] || 'other';
          shouldRetry = true;
        }

        if (!shouldRetry) throw insertErr;
        ticket = await insert('support_tickets', retryPayload);
      }

      const createdTicket = ticket[0];
      const createdId = String(createdTicket.id);

      void recordSupportTicketActivity({
        ticketId: createdId,
        eventType: SUPPORT_TICKET_EVENT_TYPES.TICKET_CREATED,
        eventActorType: source === 'customer' ? 'customer' : 'system',
        eventActorId: resolvedCustomerId || null,
        eventTitle: 'Ticket created',
        eventMetadata: {
          ticketNumber: createdTicket.ticket_number,
          source,
          ticketType,
        },
      });

      scheduleSupportTicketNotification({
        event: 'ticket_created',
        ticket: createdTicket as Record<string, unknown>,
        messagePreview: message,
      });

      scheduleSupportTicketAiAck(createdId);

      return c.json({
        success: true,
        ticket: createdTicket,
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
      const customerId = c.req.query("customerId")?.trim() || undefined;
      const customerPhone = c.req.query("customerPhone")?.trim() || undefined;
      const agentId = c.req.query("agentId");
      const status = c.req.query("status");
      const limit = parseInt(c.req.query("limit") || "50", 10);
      const offset = parseInt(c.req.query("offset") || "0", 10);

      const { sql: ticketsQuery, params } = buildSupportTicketsListQuery({
        customerId,
        customerPhone,
        agentId: agentId?.trim() || undefined,
        status: status?.trim() || undefined,
        limit,
        offset,
      });

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

      const ticketRows = await query(
        `SELECT t.*,
                COALESCE(NULLIF(TRIM(c.full_name), ''), NULLIF(TRIM(t.customer_name), '')) AS customer_name,
                COALESCE(NULLIF(TRIM(c.email), ''), NULLIF(TRIM(t.customer_email), '')) AS customer_email,
                COALESCE(NULLIF(TRIM(c.phone), ''), NULLIF(TRIM(t.customer_phone), '')) AS customer_phone
         FROM support_tickets t
         LEFT JOIN customers c ON t.customer_id = c.id
         WHERE t.id = $1::uuid
         LIMIT 1`,
        [ticketId]
      );
      if (!ticketRows.rows?.length) {
        return c.json({ error: 'Support ticket not found' }, 404);
      }

      const ticket: any = { ...ticketRows.rows[0] };
      const customerProfile = await resolveCustomerProfile(ticket);
      if (customerProfile.customerName) ticket.customer_name = customerProfile.customerName;
      if (customerProfile.customerEmail) ticket.customer_email = customerProfile.customerEmail;
      if (customerProfile.customerPhone) ticket.customer_phone = customerProfile.customerPhone;
      const assigneeId = ticket.assigned_to;
      if (assigneeId) {
        try {
          const ar = await query(
            `SELECT COALESCE(
               (SELECT name FROM staff WHERE id = $1::uuid LIMIT 1),
               (SELECT COALESCE(NULLIF(TRIM(name), ''), email) FROM admins WHERE id = $1::uuid LIMIT 1)
             ) AS assigned_agent_name`,
            [assigneeId]
          );
          const nm = ar.rows?.[0]?.assigned_agent_name;
          if (nm) ticket.assigned_agent_name = nm;
        } catch {
          /* ignore */
        }
      }

      // Get ticket responses/conversation
      const responses = await query(
        `SELECT * FROM support_ticket_responses 
         WHERE ticket_id = $1 
         ORDER BY created_at ASC`,
        [ticketId]
      ).catch(() => ({ rows: [] }));

      // Bot transcript: link is on ai_chatbot_conversations.escalation_ticket_id (not support_tickets)
      let aiConversation: unknown[] | null = null;
      const meta = ticket.metadata as Record<string, unknown> | undefined;
      const metaConvId =
        meta && typeof meta.ai_conversation_id === 'string'
          ? meta.ai_conversation_id
          : meta && typeof meta.aiConversationId === 'string'
            ? meta.aiConversationId
            : null;
      const shouldLoadAi =
        ticket.source === 'ai_chatbot' || !!metaConvId;
      if (shouldLoadAi) {
        try {
          const byTicket = await query(
            `SELECT * FROM ai_chatbot_conversations
             WHERE escalation_ticket_id::text = $1
             ORDER BY created_at ASC`,
            [ticketId]
          );
          if (byTicket.rows?.length) {
            aiConversation = byTicket.rows;
          } else if (metaConvId) {
            const byConv = await query(
              `SELECT * FROM ai_chatbot_conversations
               WHERE conversation_id = $1
               ORDER BY created_at ASC`,
              [metaConvId]
            );
            if (byConv.rows?.length) {
              aiConversation = byConv.rows;
            }
          }
        } catch (e) {
          console.warn('Failed to fetch AI conversation', e);
        }
      }

      const enrichment = await enrichSupportTicket(ticket);
      const vendorProfile = await resolveVendorProfile(
        ticket.vendor_id ? String(ticket.vendor_id) : null,
        enrichment.bookingContext,
        enrichment.mealOrderContext,
      );

      const enrichedMetadata = await enrichSupportTicketMetadataAttachments(ticket.metadata);
      if (enrichedMetadata) {
        ticket.metadata = enrichedMetadata;
      }

      void retryPostAckAssignment(ticketId).catch((err) => {
        console.warn('[CRM] post-ack assignment retry failed:', ticketId, err);
      });

      return c.json({
        success: true,
        customerName: ticket.customer_name || null,
        customerEmail: ticket.customer_email || null,
        customerPhone: ticket.customer_phone || null,
        vendorPhone: vendorProfile.vendorPhone || null,
        ticket: {
          ...ticket,
          ticket_type: enrichment.ticketType,
          ticketType: enrichment.ticketType,
        },
        ticketType: enrichment.ticketType,
        bookingContext: enrichment.bookingContext,
        mealOrderContext: enrichment.mealOrderContext,
        paymentContext: enrichment.paymentContext,
        isRefundable: enrichment.isRefundable,
        refundBlockReason: enrichment.refundBlockReason,
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
      const { message, responderId, responderType, isInternal = false, attachments } = await c.req.json();

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

      const attachmentList = Array.isArray(attachments) ? attachments : [];
      if (attachmentList.length > 0) {
        const meta =
          ticket.metadata != null && typeof ticket.metadata === 'object' && !Array.isArray(ticket.metadata)
            ? { ...(ticket.metadata as Record<string, unknown>) }
            : {};
        const existing = Array.isArray(meta.attachments) ? [...meta.attachments] : [];
        const responseAttachments =
          meta.response_attachments != null && typeof meta.response_attachments === 'object' && !Array.isArray(meta.response_attachments)
            ? { ...(meta.response_attachments as Record<string, unknown>) }
            : {};
        const responseId = String(response[0]?.id || '');
        responseAttachments[responseId] = attachmentList;
        await update(
          'support_tickets',
          { id: ticketId },
          {
            metadata: {
              ...meta,
              attachments: [...existing, ...attachmentList],
              response_attachments: responseAttachments,
            },
            last_updated_at: new Date().toISOString(),
          }
        );
      }

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

      if (isInternal) {
        await recordSupportTicketActivity({
          ticketId,
          eventType: SUPPORT_TICKET_EVENT_TYPES.INTERNAL_NOTE_ADDED,
          eventActorType: responderType === 'agent' ? 'agent' : 'system',
          eventActorId: responderId || null,
          eventTitle: 'Internal note added',
        });
      } else if (responderType === 'agent') {
        await recordSupportTicketActivity({
          ticketId,
          eventType: SUPPORT_TICKET_EVENT_TYPES.AGENT_REPLIED,
          eventActorType: 'agent',
          eventActorId: responderId || null,
          eventTitle: 'Agent replied',
        });
        if (await shouldNotifyCustomerOnAgentReply(ticket as Record<string, unknown>)) {
          await notifySupportTicketCustomerSms(ticket, message);
        }
      } else if (responderType === 'customer') {
        await recordSupportTicketActivity({
          ticketId,
          eventType: SUPPORT_TICKET_EVENT_TYPES.CUSTOMER_REPLIED,
          eventActorType: 'customer',
          eventActorId: responderId || ticket.customer_id || null,
          eventTitle: 'Customer replied',
        });
        scheduleSupportTicketNotification({
          event: 'customer_replied',
          ticket: ticket as Record<string, unknown>,
          messagePreview: message?.substring(0, 200),
        });
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

      scheduleSupportTicketNotification({
        event: 'assigned',
        ticket: updated[0] as Record<string, unknown>,
        assigneeId: agentId,
        assigneeName: agentName,
      });

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

      const allowedStatuses = [
        'open', 'ai_acknowledged', 'awaiting_assignment', 'assigned', 'in_progress',
        'waiting_for_customer', 'resolved', 'closed', 'escalated', 'cancelled',
      ];
      if (!status || !allowedStatuses.includes(status)) {
        return c.json({ error: 'Valid status is required' }, 400);
      }

      const existing = await select('support_tickets', { id: ticketId });
      const prevStatus = existing[0]?.status;

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

      if (prevStatus !== status) {
        await logTicketStatusActivity(ticketId, prevStatus, status, 'admin');
        if (status === 'resolved') {
          await recordSupportTicketActivity({
            ticketId,
            eventType: SUPPORT_TICKET_EVENT_TYPES.TICKET_RESOLVED,
            eventActorType: 'admin',
            eventTitle: 'Ticket resolved',
          });
          scheduleSupportTicketNotification({
            event: 'resolved',
            ticket: updated[0] as Record<string, unknown>,
          });
        }
        if (status === 'closed') {
          await recordSupportTicketActivity({
            ticketId,
            eventType: SUPPORT_TICKET_EVENT_TYPES.TICKET_CLOSED,
            eventActorType: 'admin',
            eventTitle: 'Ticket closed',
          });
          scheduleSupportTicketNotification({
            event: 'closed',
            ticket: updated[0] as Record<string, unknown>,
          });
        }
      }

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
      const ticketType = c.req.query('ticketType');
      const limit = parseInt(c.req.query('limit') || '100', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let queryStr = `
        SELECT 
          t.*,
          COALESCE(NULLIF(TRIM(c.full_name), ''), NULLIF(TRIM(t.customer_name), '')) as customer_name,
          COALESCE(NULLIF(TRIM(c.email), ''), NULLIF(TRIM(t.customer_email), '')) as customer_email,
          COALESCE(NULLIF(TRIM(c.phone), ''), NULLIF(TRIM(t.customer_phone), '')) as customer_phone,
          vnd.phone as vendor_phone,
          COALESCE(s.name, adm.name, adm.email) as assigned_agent_name,
          t.assigned_to as assigned_agent_id
        FROM support_tickets t
        LEFT JOIN customers c ON t.customer_id = c.id
        LEFT JOIN vendors vnd ON t.vendor_id = vnd.id
        LEFT JOIN staff s ON t.assigned_to = s.id
        LEFT JOIN admins adm ON t.assigned_to = adm.id
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

      if (ticketType === 'booking') {
        queryStr += ` AND t.booking_id IS NOT NULL`;
      } else if (ticketType === 'general') {
        queryStr += ` AND t.booking_id IS NULL`;
      }

      queryStr += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const tickets = await query(queryStr, params);

      const safeTickets = await Promise.all(
        (tickets.rows || []).map(async (t: any) => {
          try {
            const enrichedMetadata = await enrichSupportTicketMetadataAttachments(t.metadata);
            if (enrichedMetadata) {
              t.metadata = enrichedMetadata;
            }
            const enrichment = await enrichSupportTicket(t);
            return mapTicketForCrmList(t, enrichment);
          } catch (err) {
            console.warn('[CRM] ticket enrichment failed:', t?.id, err);
            return mapTicketForCrmList(t);
          }
        })
      );

      return c.json({
        success: true,
        tickets: safeTickets,
        count: safeTickets.length,
      });
    } catch (error: any) {
      console.error('Error fetching CRM tickets:', error);
      return c.json({ success: false, error: error.message || 'Failed to fetch tickets', tickets: [], count: 0 }, 500);
    }
  });

  /**
   * GET /crm/agents
   * Active support agents for ticket assignment — same source as GET /support/settings/agents.
   * `id` is the assignee UUID (user_id or staff_id) so POST /crm/action assign writes support_tickets.assigned_to correctly.
   */
  app.get("/crm/agents", async (c) => {
    try {
      const result = await query(`
        SELECT 
          COALESCE(sa.user_id, sa.staff_id) as assignee_id,
          COALESCE(a.name, s.name) as name,
          COALESCE(a.email, s.email) as email,
          sa.specialties,
          (SELECT COUNT(*)::int FROM support_tickets t
           WHERE t.assigned_to = COALESCE(sa.user_id, sa.staff_id)
           AND t.status NOT IN ('closed', 'resolved')) as workload
        FROM support_agents sa
        LEFT JOIN admins a ON sa.user_id = a.id OR (sa.user_id IS NULL AND sa.staff_id = a.id)
        LEFT JOIN staff s ON sa.staff_id = s.id AND sa.user_id IS NULL
        WHERE sa.is_active = true
        ORDER BY COALESCE(a.name, s.name)
      `).catch(() => ({ rows: [] }));

      const safeAgents = (result.rows || [])
        .filter((row: any) => row.assignee_id)
        .map((a: any) => ({
          id: String(a.assignee_id),
          name: String(a.name || 'Agent'),
          email: a.email || undefined,
          specialties: Array.isArray(a.specialties)
            ? a.specialties
            : a.specialties
              ? [a.specialties]
              : ['general'],
          workload: Number(a.workload) || 0,
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

      const ticketBefore = tickets[0];
      const prevStatus = ticketBefore.status;
      const prevAssignee = ticketBefore.assigned_to;

      const updateData: any = {
        last_updated_at: new Date().toISOString(),
      };

      switch (action) {
        case 'assign':
          if (actionData.assignTo || actionData.agentId) {
            const assigneeId = actionData.assignTo || actionData.agentId;
            updateData.assigned_to = assigneeId;
            updateData.assigned_at = new Date().toISOString();
            updateData.status = 'assigned';
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
          {
          const ticket = tickets[0];
          let refundResult: Record<string, unknown> | null = null;
          let refundProcessed = false;
          const mealOrderId = resolveMealOrderIdFromTicket(ticket);
          const bookingId = ticket.booking_id ? String(ticket.booking_id) : null;

          if (!bookingId && !mealOrderId) {
            refundResult = {
              status: 'failed',
              message:
                'This ticket is not linked to a booking or meal order. Link an order before processing a refund.',
            };
          } else if (!ticket.customer_id) {
            refundResult = {
              status: 'failed',
              message: 'Ticket is missing customer_id required for refunds.',
            };
          } else {
            try {
              if (mealOrderId && !bookingId) {
                const paymentSnapshot = await buildMealOrderPaymentSnapshot(mealOrderId);
                const refundAmount =
                  actionData.amount != null
                    ? parseFloat(String(actionData.amount))
                    : paymentSnapshot?.refundableBalance ?? 0;

                if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
                  throw new Error('Invalid refund amount');
                }

                if (paymentSnapshot && refundAmount > paymentSnapshot.refundableBalance + 0.01) {
                  throw new Error(
                    `Refund amount exceeds refundable balance (₹${paymentSnapshot.refundableBalance.toFixed(2)})`,
                  );
                }

                const { processMealOrderAdminOriginalRefund } = await import(
                  '../../../utils/payments/meal-order-original-refund'
                );
                const processed = await processMealOrderAdminOriginalRefund(
                  mealOrderId,
                  refundAmount,
                  actionData.reason || `Support ticket refund (${action})`,
                  { initiatedBy: 'support' },
                );

                const ticketRefundStatus =
                  processed.status === 'failed' ? 'failed' : 'processing';
                updateData.refund_id = processed.refundId;
                updateData.refund_amount = processed.totalAmount;
                updateData.refund_status = ticketRefundStatus;

                refundResult = {
                  refundId: processed.refundId,
                  amount: processed.totalAmount,
                  status: processed.status,
                  razorpayRefundId: processed.razorpayRefundId,
                  walletCredited: processed.walletCredited,
                  message: processed.message,
                };
                refundProcessed = processed.status !== 'failed';
                console.log(
                  `✅ [CRM] Meal order refund processed for ticket ${ticketId}: ₹${processed.totalAmount}`,
                );
              } else if (bookingId) {
              const payments = await query(
                `SELECT id, amount::text, payment_status FROM payments
                 WHERE booking_id = $1::uuid
                   AND payment_status IN ('completed', 'partially_refunded')
                 ORDER BY created_at DESC LIMIT 1`,
                [ticket.booking_id]
              );
              
              if (payments.rows.length > 0) {
                const payment = payments.rows[0];
                const paymentAmount = parseFloat(String(payment.amount ?? '0')) || 0;
                const refundAmount = actionData.amount != null
                  ? parseFloat(String(actionData.amount))
                  : paymentAmount;

                if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
                  throw new Error('Invalid refund amount');
                }

                const paymentSnapshot = await buildPaymentSnapshot(String(ticket.booking_id));
                if (paymentSnapshot && refundAmount > paymentSnapshot.refundableBalance + 0.01) {
                  throw new Error(
                    `Refund amount exceeds refundable balance (₹${paymentSnapshot.refundableBalance.toFixed(2)})`
                  );
                }

                const { processBookingOriginalPaymentRefund } = await import(
                  '../../../utils/payments/booking-original-refund'
                );
                const processed = await processBookingOriginalPaymentRefund({
                  bookingId: String(ticket.booking_id),
                  customerId: String(ticket.customer_id),
                  vendorId: ticket.vendor_id ? String(ticket.vendor_id) : null,
                  refundAmount,
                  reason: actionData.reason || `Support ticket refund (${action})`,
                  initiatedBy: 'support',
                  supportTicketId: ticketId,
                });

                const ticketRefundStatus =
                  processed.status === 'failed' ? 'failed' : 'processing';
                updateData.refund_id = processed.refundId;
                updateData.refund_amount = processed.totalAmount;
                updateData.refund_status = ticketRefundStatus;

                refundResult = {
                  refundId: processed.refundId,
                  amount: processed.totalAmount,
                  status: processed.status,
                  razorpayRefundId: processed.razorpayRefundId,
                  walletCredited: processed.walletCredited,
                  message: processed.message,
                };
                refundProcessed = processed.status !== 'failed';
                
                console.log(`✅ [CRM] Refund processed for ticket ${ticketId}: ₹${processed.totalAmount}`);
              } else {
                console.log(`⚠️ [CRM] No completed payment found for booking ${ticket.booking_id}`);
                refundResult = {
                  status: 'failed',
                  message: 'No completed payment found for this booking',
                };
              }
              }
            } catch (refundError: any) {
              console.error('Error processing refund:', refundError);
              refundResult = {
                status: 'failed',
                message: refundError.message || 'Refund processing failed',
              };
            }
          }

          updateData.metadata = {
            ...(ticket.metadata || {}),
            ticket_type:
              mealOrderId && !bookingId
                ? 'meal_order'
                : bookingId
                  ? 'booking'
                  : ((ticket.metadata as Record<string, unknown> | undefined)?.ticket_type ?? 'general'),
            refund_requested: true,
            refund_amount: actionData.amount ?? refundResult?.amount,
            refund_reason: actionData.reason,
            refund_type: action === 'partial_refund' ? 'partial' : 'full',
            refund_requested_at: new Date().toISOString(),
            refund_id: refundResult?.refundId ?? updateData.refund_id ?? null,
            refund_status: updateData.refund_status ?? refundResult?.status ?? null,
            refund_result: refundResult,
          };

          const updatedRefund = await update('support_tickets', { id: ticketId }, updateData);

          if (refundProcessed) {
            await recordSupportTicketActivity({
              ticketId,
              eventType: SUPPORT_TICKET_EVENT_TYPES.REFUND_INITIATED,
              eventActorType: 'agent',
              eventTitle: `${action === 'partial_refund' ? 'Partial refund' : 'Full refund'} initiated`,
              eventMetadata: {
                amount: refundResult?.amount,
                refundId: refundResult?.refundId,
                status: refundResult?.status,
              },
            });
            if (refundResult?.status === 'completed') {
              await recordSupportTicketActivity({
                ticketId,
                eventType: SUPPORT_TICKET_EVENT_TYPES.REFUND_COMPLETED,
                eventActorType: 'system',
                eventTitle: 'Refund completed',
                eventMetadata: { refundId: refundResult?.refundId },
              });
            }
          }

          return c.json({
            success: refundProcessed,
            refundProcessed,
            ticket: updatedRefund[0],
            refundResult,
            message: refundProcessed
              ? `Refund initiated for ticket ${action}`
              : (refundResult?.message as string) || 'Refund could not be processed',
          });
          }
        case 'attach_booking':
          {
          const ticket = tickets[0];
          const attachBookingId = actionData.bookingId || actionData.booking_id;
          if (!attachBookingId) {
            return c.json({ error: 'bookingId is required to attach a booking' }, 400);
          }
          const linked = await validateBookingTicketLink(
            String(attachBookingId),
            ticket.customer_id ? String(ticket.customer_id) : actionData.customerId
          );
          const bookingSnapshot = await buildBookingSnapshot(String(attachBookingId));
          const paymentSnapshot = await buildPaymentSnapshot(String(attachBookingId));
          updateData.booking_id = attachBookingId;
          updateData.customer_id = linked.resolvedCustomerId;
          updateData.vendor_id = linked.vendorId;
          updateData.metadata = {
            ...(ticket.metadata || {}),
            ticket_type: 'booking',
            booking_snapshot: bookingSnapshot,
            payment_snapshot: paymentSnapshot,
            attached_at: new Date().toISOString(),
            attached_by: 'admin',
          };
          if (!ticket.category || ticket.category === 'general') {
            updateData.category = 'billing';
          }
          }
          break;
        default:
          return c.json({ error: `Unknown action: ${action}` }, 400);
      }

      const updated = await update('support_tickets', { id: ticketId }, updateData);
      const newStatus = updated[0]?.status;

      if (action === 'assign' && updateData.assigned_to) {
        const assigneeName = await resolveAssigneeName(String(updateData.assigned_to));
        const isReassign = prevAssignee && String(prevAssignee) !== String(updateData.assigned_to);
        await recordSupportTicketActivity({
          ticketId,
          eventType: isReassign
            ? SUPPORT_TICKET_EVENT_TYPES.REASSIGNED
            : SUPPORT_TICKET_EVENT_TYPES.ASSIGNED,
          eventActorType: 'admin',
          eventTitle: isReassign
            ? `Reassigned to ${assigneeName || 'agent'}`
            : `Assigned to ${assigneeName || 'agent'}`,
          eventMetadata: {
            assigneeId: updateData.assigned_to,
            assigneeName,
            previousAssigneeId: prevAssignee ?? null,
          },
        });
        if (prevStatus !== newStatus) {
          await logTicketStatusActivity(ticketId, prevStatus, String(newStatus), 'admin');
        }
        scheduleSupportTicketNotification({
          event: isReassign ? 'reassigned' : 'assigned',
          ticket: updated[0] as Record<string, unknown>,
          assigneeId: String(updateData.assigned_to),
          assigneeName: assigneeName || undefined,
          previousAssigneeId: prevAssignee ? String(prevAssignee) : null,
        });
      } else if (action === 'escalate') {
        await recordSupportTicketActivity({
          ticketId,
          eventType: SUPPORT_TICKET_EVENT_TYPES.ESCALATED,
          eventActorType: 'admin',
          eventTitle: 'Ticket escalated',
          eventMetadata: { reason: updateData.escalation_reason },
        });
        if (prevStatus !== newStatus) {
          await logTicketStatusActivity(ticketId, prevStatus, String(newStatus), 'admin');
        }
        scheduleSupportTicketNotification({
          event: 'escalated',
          ticket: updated[0] as Record<string, unknown>,
          reason: String(updateData.escalation_reason || 'Escalated by admin'),
        });
      } else if (action === 'reopen') {
        await recordSupportTicketActivity({
          ticketId,
          eventType: SUPPORT_TICKET_EVENT_TYPES.TICKET_REOPENED,
          eventActorType: 'admin',
          eventTitle: 'Ticket reopened',
        });
        if (prevStatus !== newStatus) {
          await logTicketStatusActivity(ticketId, prevStatus, String(newStatus), 'admin');
        }
      } else if (action === 'close') {
        await recordSupportTicketActivity({
          ticketId,
          eventType: SUPPORT_TICKET_EVENT_TYPES.TICKET_CLOSED,
          eventActorType: 'admin',
          eventTitle: 'Ticket closed',
        });
        if (prevStatus !== newStatus) {
          await logTicketStatusActivity(ticketId, prevStatus, String(newStatus), 'admin');
        }
        scheduleSupportTicketNotification({
          event: 'closed',
          ticket: updated[0] as Record<string, unknown>,
        });
      }

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

      const ticket = tickets[0];

      if (responderType === 'agent') {
        const prevStatus = ticket.status;
        await update('support_tickets', { id: ticketId }, {
          status: prevStatus === 'assigned' ? 'in_progress' : (prevStatus || 'in_progress'),
          last_updated_at: new Date().toISOString(),
        });
        await recordSupportTicketActivity({
          ticketId,
          eventType: SUPPORT_TICKET_EVENT_TYPES.AGENT_REPLIED,
          eventActorType: 'agent',
          eventActorId: responderId || null,
          eventTitle: 'Agent replied',
        });
        if (await shouldNotifyCustomerOnAgentReply(ticket as Record<string, unknown>)) {
          await notifySupportTicketCustomerSms(ticket, message);
        }
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

      const existing = await select('support_tickets', { id: ticketId });
      const prevStatus = existing[0]?.status;

      const updated = await update('support_tickets', { id: ticketId }, {
        status: 'closed',
        resolution: resolution || null,
        resolved_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
      });

      await recordSupportTicketActivity({
        ticketId,
        eventType: SUPPORT_TICKET_EVENT_TYPES.TICKET_CLOSED,
        eventActorType: 'admin',
        eventTitle: 'Ticket closed',
      });
      if (prevStatus !== 'closed') {
        await logTicketStatusActivity(ticketId, prevStatus, 'closed', 'admin');
      }

      scheduleSupportTicketNotification({
        event: 'closed',
        ticket: updated[0] as Record<string, unknown>,
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
   * Auto-route ticket(s) via round-robin (manual trigger; bypasses auto_assign_enabled).
   */
  app.post("/crm/tickets/auto-route", async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const { ticketId } = body;

      if (ticketId) {
        const result = await assignSupportTicket(String(ticketId), { force: true });
        if (result.assigned) {
          return c.json({
            success: true,
            message: `Ticket assigned to ${result.assigneeName || 'agent'}`,
            routed: 1,
            assignedAgent: result.assigneeName,
            assigneeId: result.assigneeId,
            poolKey: result.poolKey,
          });
        }
        return c.json({
          success: true,
          message:
            result.reason === 'no_eligible_agent'
              ? 'No eligible agent available'
              : result.reason === 'already_assigned'
                ? 'Ticket is already assigned'
                : 'Ticket could not be auto-routed',
          routed: 0,
          reason: result.reason,
          poolKey: result.poolKey,
        });
      }

      const batch = await assignSupportTicketBatch({ force: true });
      const lastAssigned = batch.results.filter((r) => r.assigned).pop();
      return c.json({
        success: true,
        message: batch.timedOut
          ? `Routed ${batch.routed} ticket(s) (time limit reached — run again for more)`
          : `Routed ${batch.routed} ticket(s)`,
        routed: batch.routed,
        skipped: batch.skipped,
        timedOut: batch.timedOut,
        assignedAgent: lastAssigned?.assigneeName,
      });
    } catch (error: any) {
      console.error('Error auto-routing tickets:', error);
      return c.json({ error: error.message || 'Failed to auto-route tickets' }, 500);
    }
  });

  /**
   * POST /crm/tickets/auto-assign-batch
   * Sweeper / cron: assign oldest unassigned tickets (respects auto_assign_enabled unless force).
   * Auth: INTERNAL_CRON_SECRET header when env is set.
   */
  app.post("/crm/tickets/auto-assign-batch", async (c) => {
    const cronSecret = process.env.INTERNAL_CRON_SECRET?.trim();
    const hdr = c.req.header('x-internal-cron-secret')?.trim();
    const body = await c.req.json().catch(() => ({}));
    const force = body?.force === true;

    if (cronSecret && hdr !== cronSecret && !force) {
      return c.json({ success: false, error: 'Unauthorized', code: 'INVALID_CRON_SECRET' }, 401);
    }

    try {
      const settings = await getSupportRoutingSettings();
      let limit = settings.sweeperBatchSize;
      if (body?.limit != null) {
        const n = parseInt(String(body.limit), 10);
        if (Number.isFinite(n)) limit = Math.min(100, Math.max(1, n));
      } else if (force) {
        // Manual admin sweeper: smaller default batch to stay within API Gateway timeout
        limit = Math.min(limit, 10);
      }

      const batch = await assignSupportTicketBatch({
        limit,
        force: force || !cronSecret,
        updateSweeperStats: Boolean(cronSecret && hdr === cronSecret),
      });

      console.log(
        JSON.stringify({
          metric: 'support.auto_assign.batch',
          routed: batch.routed,
          skipped: batch.skipped,
          timedOut: batch.timedOut,
          processed: batch.processed,
        })
      );

      return c.json({
        success: true,
        routed: batch.routed,
        skipped: batch.skipped,
        processed: batch.processed,
        timedOut: batch.timedOut,
        message: batch.timedOut
          ? `Assigned ${batch.routed} ticket(s) before time limit — run again for more`
          : `Assigned ${batch.routed} ticket(s)`,
      });
    } catch (error: any) {
      console.error('Error in auto-assign batch:', error);
      return c.json({ error: error.message || 'Failed to auto-assign batch' }, 500);
    }
  });

  /**
   * POST /crm/tickets/escalation-batch
   * Sweeper / cron: evaluate escalation rules and send escalation emails.
   * Auth: INTERNAL_CRON_SECRET header when env is set.
   */
  app.post("/crm/tickets/escalation-batch", async (c) => {
    const cronSecret = process.env.INTERNAL_CRON_SECRET?.trim();
    const hdr = c.req.header('x-internal-cron-secret')?.trim();
    const body = await c.req.json().catch(() => ({}));
    const force = body?.force === true;

    if (cronSecret && hdr !== cronSecret && !force) {
      return c.json({ success: false, error: 'Unauthorized', code: 'INVALID_CRON_SECRET' }, 401);
    }

    try {
      let limit = 50;
      if (body?.limit != null) {
        const n = parseInt(String(body.limit), 10);
        if (Number.isFinite(n)) limit = Math.min(100, Math.max(1, n));
      }

      const batch = await processSupportTicketEscalationBatch({ limit });

      return c.json({
        success: true,
        evaluated: batch.evaluated,
        fired: batch.fired,
        skipped: batch.skipped,
        timedOut: batch.timedOut,
        message: batch.timedOut
          ? `Fired ${batch.fired} escalation(s) before time limit — run again for more`
          : `Fired ${batch.fired} escalation(s)`,
      });
    } catch (error: any) {
      console.error('Error in escalation batch:', error);
      return c.json({ error: error.message || 'Failed to process escalation batch' }, 500);
    }
  });

  /**
   * GET /support/settings/notifications
   * Global ops inbox, escalation defaults, and channel toggles.
   */
  app.get("/support/settings/notifications", async (c) => {
    try {
      const settings = await getSupportNotificationSettings();
      return c.json({ success: true, notifications: settings });
    } catch (error: any) {
      console.error('Error fetching notification settings:', error);
      return c.json({ error: error.message || 'Failed to fetch notification settings' }, 500);
    }
  });

  /**
   * PUT /support/settings/notifications
   */
  app.put("/support/settings/notifications", async (c) => {
    try {
      const body = await c.req.json();
      const settings = await updateSupportNotificationSettings(body);
      return c.json({ success: true, notifications: settings });
    } catch (error: any) {
      console.error('Error updating notification settings:', error);
      return c.json({ error: error.message || 'Failed to update notification settings' }, 500);
    }
  });

  /**
   * GET /support/settings/routing
   * Round-robin auto-assignment configuration.
   */
  app.get("/support/settings/routing", async (c) => {
    try {
      const settings = await getSupportRoutingSettings();
      return c.json({ success: true, routing: settings });
    } catch (error: any) {
      console.error('Error fetching routing settings:', error);
      return c.json({ error: error.message || 'Failed to fetch routing settings' }, 500);
    }
  });

  /**
   * PUT /support/settings/routing
   * Update round-robin auto-assignment configuration.
   */
  app.put("/support/settings/routing", async (c) => {
    try {
      const body = await c.req.json();
      const routing = await updateSupportRoutingSettings({
        autoAssignEnabled: body.autoAssignEnabled,
        assignAfterAiAck: body.assignAfterAiAck,
        sweeperBatchSize: body.sweeperBatchSize,
        fallbackToGeneralSpecialty: body.fallbackToGeneralSpecialty,
      });
      return c.json({ success: true, routing, message: 'Routing settings updated' });
    } catch (error: any) {
      console.error('Error updating routing settings:', error);
      return c.json({ error: error.message || 'Failed to update routing settings' }, 500);
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
        metadata: { ...crmContext, attachments: [], ticket_type: 'booking' },
        created_at: new Date().toISOString(),
      });

      console.log(`✅ [SUPPORT-HANDOFF] Support ticket created: ${ticket[0].id}`);

      const handoffId = String(ticket[0].id);
      void recordSupportTicketActivity({
        ticketId: handoffId,
        eventType: SUPPORT_TICKET_EVENT_TYPES.TICKET_CREATED,
        eventActorType: 'customer',
        eventActorId: booking.customer_id || customerId || null,
        eventTitle: 'Ticket created (chat handoff)',
        eventMetadata: { bookingId, source: 'chat_handoff' },
      });
      scheduleSupportTicketAiAck(handoffId);

      scheduleSupportTicketNotification({
        event: 'ticket_created',
        ticket: ticket[0] as Record<string, unknown>,
        messagePreview: reason || ticket[0].message,
      });

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
   * Get all support agents with their details (linked to admins with RBAC roles)
   */
  app.get("/support/settings/agents", async (c) => {
    try {
      // Try to join with admins first (new approach with RBAC)
      // Fallback to staff if admin join fails (backward compatibility)
      const result = await query(`
        SELECT 
          sa.*,
          COALESCE(a.name, s.name) as name,
          COALESCE(a.email, s.email) as email,
          COALESCE(a.phone, s.phone) as phone,
          COALESCE(a.role, s.role) as admin_staff_role,
          COALESCE(
            (SELECT STRING_AGG(DISTINCT r.display_name, ', ' ORDER BY r.display_name)
             FROM user_roles ur
             JOIN roles r ON ur.role_id = r.id
             WHERE ur.user_id = COALESCE(sa.user_id, sa.staff_id) AND ur.is_active = true AND r.is_active = true),
            COALESCE(a.role, s.role)
          ) as role_display_names,
          (SELECT COUNT(*) FROM support_tickets 
           WHERE assigned_to = COALESCE(sa.user_id, sa.staff_id) 
           AND status NOT IN ('closed', 'resolved')) as active_tickets
        FROM support_agents sa
        LEFT JOIN admins a ON sa.user_id = a.id OR (sa.user_id IS NULL AND sa.staff_id = a.id)
        LEFT JOIN staff s ON sa.staff_id = s.id AND sa.user_id IS NULL
        WHERE sa.is_active = true
        ORDER BY COALESCE(a.name, s.name)
      `);

      return c.json({
        success: true,
        agents: result.rows.map(a => ({
          id: a.id,
          staffId: a.user_id || a.staff_id, // Use user_id if available, fallback to staff_id
          userId: a.user_id,
          name: a.name,
          email: a.email,
          phone: a.phone,
          role: a.role,
          staffRole: a.admin_staff_role,
          roleDisplayNames: a.role_display_names,
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
   * Create or update a support agent (linked to admin/user with RBAC roles)
   */
  app.post("/support/settings/agents", async (c) => {
    try {
      const body = await c.req.json();
      const { staffId, role, maxConcurrentTickets, specialties, availabilityStatus } = body;

      if (!staffId) {
        return c.json({ error: 'staffId (user/admin id) is required' }, 400);
      }

      // Verify that the staffId is a valid admin with support-related RBAC role
      const adminCheck = await query(`
        SELECT a.id, a.name, a.email
        FROM admins a
        LEFT JOIN user_roles ur ON a.id = ur.user_id AND ur.is_active = true
        LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
        WHERE a.id = $1 AND a.is_active = true
          AND (
            r.name IN (
              'admin',
              'support_agent',
              'support',
              'support_admin',
              'support_mngr',
              'super-admin',
              'super_admin'
            )
            OR a.role IN ('admin', 'support', 'super-admin', 'super_admin')
            OR ur.id IS NULL
          )
        LIMIT 1
      `, [staffId]);

      if (adminCheck.rows.length === 0) {
        return c.json({ 
          error: 'User not found or does not have required RBAC role. Please assign a support-related role in RBAC management first.' 
        }, 400);
      }

      // Check if agent already exists (by user_id or staff_id for backward compatibility)
      const existing = await query(`
        SELECT id FROM support_agents 
        WHERE user_id = $1 OR (user_id IS NULL AND staff_id = $1)
      `, [staffId]);
      
      if (existing.rows.length > 0) {
        // Admin agents: user_id = admins.id, staff_id must be NULL (not a staff FK duplicate of admin id).
        const updated = await query(`
          UPDATE support_agents 
          SET user_id = COALESCE(user_id, $1),
              staff_id = NULL,
              role = COALESCE($2, role),
              max_concurrent_tickets = COALESCE($3, max_concurrent_tickets),
              specialties = COALESCE($4, specialties),
              availability_status = COALESCE($5, availability_status),
              is_active = true
          WHERE user_id = $1 OR (user_id IS NULL AND staff_id = $1)
          RETURNING *
        `, [staffId, role, maxConcurrentTickets, specialties, availabilityStatus ?? 'available']);
        
        return c.json({ success: true, agent: updated.rows[0], message: 'Agent updated' });
      } else {
        // Create new admin-backed agent: user_id only — staff_id NULL (avoids staff_id FK to staff(id)).
        const created = await query(`
          INSERT INTO support_agents (user_id, staff_id, role, max_concurrent_tickets, specialties, availability_status, is_active)
          VALUES ($1, NULL, $2, $3, $4, $5, true)
          RETURNING *
        `, [staffId, role || 'agent', maxConcurrentTickets || 10, specialties || ['general'], availabilityStatus ?? 'available']);
        
        return c.json({ success: true, agent: created.rows[0], message: 'Agent created' });
      }
    } catch (error: any) {
      console.error('Error saving support agent:', error);
      // If user_id column doesn't exist, try with staff_id only
      if (error.message?.includes('user_id') || error.message?.includes('column')) {
        try {
          const body = await c.req.json();
          const { staffId, role, maxConcurrentTickets, specialties, availabilityStatus } = body;
          
          const existing = await query('SELECT id FROM support_agents WHERE staff_id = $1', [staffId]);
          
          if (existing.rows.length > 0) {
            const updated = await query(`
              UPDATE support_agents 
              SET role = COALESCE($2, role),
                  max_concurrent_tickets = COALESCE($3, max_concurrent_tickets),
                  specialties = COALESCE($4, specialties),
                  availability_status = COALESCE($5, availability_status),
                  is_active = true
              WHERE staff_id = $1
              RETURNING *
            `, [staffId, role, maxConcurrentTickets, specialties, availabilityStatus ?? 'available']);
            return c.json({ success: true, agent: updated.rows[0], message: 'Agent updated' });
          } else {
            const created = await query(`
              INSERT INTO support_agents (staff_id, role, max_concurrent_tickets, specialties, availability_status, is_active)
              VALUES ($1, $2, $3, $4, $5, true)
              RETURNING *
            `, [staffId, role || 'agent', maxConcurrentTickets || 10, specialties || ['general'], availabilityStatus ?? 'available']);
            return c.json({ success: true, agent: created.rows[0], message: 'Agent created' });
          }
        } catch (fallbackError: any) {
          return c.json({ error: fallbackError.message || 'Failed to save agent' }, 500);
        }
      }
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
        UPDATE support_agents SET is_active = false WHERE id = $1 OR staff_id = $1 OR user_id = $1 RETURNING staff_id
      `, [agentId]);

      const deactivatedStaffId = result.rows[0]?.staff_id;
      if (deactivatedStaffId) {
        await query('UPDATE staff SET can_handle_support = false WHERE id = $1', [deactivatedStaffId]);
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
   * GET /crm/tickets/:ticketId/activity
   * Admin operational timeline (not customer-facing).
   */
  app.get("/crm/tickets/:ticketId/activity", async (c) => {
    try {
      const { ticketId } = c.req.param();
      const tickets = await select('support_tickets', { id: ticketId });
      if (tickets.length === 0) {
        return c.json({ error: 'Ticket not found' }, 404);
      }

      const activities = await listSupportTicketActivity(ticketId);

      return c.json({
        success: true,
        activities,
        count: activities.length,
      });
    } catch (error: any) {
      console.error('Error fetching ticket activity:', error);
      return c.json({ error: error.message || 'Failed to fetch activity' }, 500);
    }
  });

  /**
   * POST /support/tickets/:ticketId/suggest-reply
   * Bedrock-assisted draft replies for agents (does not post to customer).
   */
  app.post("/support/tickets/:ticketId/suggest-reply", async (c) => {
    try {
      const { ticketId } = c.req.param();
      const tickets = await select('support_tickets', { id: ticketId });
      if (tickets.length === 0) {
        return c.json({ error: 'Support ticket not found' }, 404);
      }
      const ticket = tickets[0] as Record<string, unknown>;
      const responses = await query(
        `SELECT responder_type, message, created_at
         FROM support_ticket_responses
         WHERE ticket_id = $1
         ORDER BY created_at ASC`,
        [ticketId]
      ).catch(() => ({ rows: [] as { responder_type?: string; message?: string }[] }));

      const aiRows = await query(
        `SELECT user_message, bot_response, intent, created_at
         FROM ai_chatbot_conversations
         WHERE escalation_ticket_id::text = $1
         ORDER BY created_at ASC
         LIMIT 40`,
        [ticketId]
      ).catch(() => ({ rows: [] as { user_message?: string; bot_response?: string }[] }));

      const thread = (responses.rows || [])
        .map((r) => `${r.responder_type || 'user'}: ${r.message || ''}`)
        .join('\n');
      const aiBit = (aiRows.rows || [])
        .map((r) => `User: ${r.user_message || ''}\nBot: ${r.bot_response || ''}`)
        .join('\n---\n');

      const systemPrompt = `You help Warmpawz support agents draft replies. Output ONLY valid JSON: {"suggestions":["...","..."]} with 2-4 short, professional strings the agent can copy or edit. No medical diagnosis, no legal promises, no fabricated refunds.`;

      const userPrompt = `Ticket subject: ${ticket.subject || ''}
Initial message:
${ticket.message || ''}

Bot transcript (if any):
${aiBit || '(none)'}

Ticket thread:
${thread || '(no replies yet)'}`;

      const raw = await invokeBedrock(userPrompt, systemPrompt, {
        maxTokens: 512,
        temperature: 0.35,
        topP: 0.9,
      });

      let suggestions: string[] = [];
      try {
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) {
          const p = JSON.parse(m[0]) as { suggestions?: unknown };
          if (Array.isArray(p.suggestions)) {
            suggestions = p.suggestions
              .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
              .map((s) => s.trim())
              .slice(0, 5);
          }
        }
      } catch {
        /* fall through */
      }
      if (suggestions.length === 0) {
        suggestions = raw
          .split(/\n+/)
          .map((s) => s.replace(/^[-*]\s*/, '').trim())
          .filter((s) => s.length > 8)
          .slice(0, 4);
      }

      return c.json({ success: true, suggestions });
    } catch (error: any) {
      console.error('Error suggesting reply:', error);
      return c.json(
        { error: error.message || 'Failed to suggest reply', suggestions: [] as string[] },
        500
      );
    }
  });

  const mapReplyTemplateRow = (row: Record<string, unknown>) => ({
    id: String(row.id || ''),
    name: String(row.name || ''),
    category: String(row.category || 'General'),
    content: String(row.content || ''),
    isActive: row.is_active !== false,
    isSystem: row.is_system === true,
    createdBy: row.created_by ? String(row.created_by) : undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  });

  /**
   * GET /crm/reply-templates
   * Active saved replies for support agents (optional search)
   */
  app.get('/crm/reply-templates', async (c) => {
    try {
      const search = (c.req.query('search') || '').trim().toLowerCase();
      const result = await query(
        `SELECT id, name, category, content
         FROM support_reply_templates
         WHERE is_active = true
         ORDER BY category, name`
      );

      let templates = result.rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        category: String(row.category || 'General'),
        content: String(row.content),
      }));

      if (search) {
        templates = templates.filter(
          (t) =>
            t.name.toLowerCase().includes(search) ||
            t.category.toLowerCase().includes(search) ||
            t.content.toLowerCase().includes(search)
        );
      }

      return c.json({ success: true, templates });
    } catch (error: any) {
      console.error('Error fetching reply templates:', error);
      return c.json({ error: error.message || 'Failed to fetch reply templates' }, 500);
    }
  });

  /**
   * GET /support/settings/reply-templates
   * All saved replies for admin settings (includes inactive)
   */
  app.get('/support/settings/reply-templates', async (c) => {
    try {
      const result = await query(
        `SELECT * FROM support_reply_templates ORDER BY is_active DESC, category, name`
      );
      return c.json({
        success: true,
        templates: result.rows.map((row) => mapReplyTemplateRow(row as Record<string, unknown>)),
      });
    } catch (error: any) {
      console.error('Error fetching reply templates (settings):', error);
      return c.json({ error: error.message || 'Failed to fetch reply templates' }, 500);
    }
  });

  /**
   * POST /support/settings/reply-templates
   * Create or update a saved reply template
   */
  app.post('/support/settings/reply-templates', async (c) => {
    try {
      const body = await c.req.json();
      const { id, name, category, content, isActive, createdBy } = body;

      if (!name || !String(name).trim()) {
        return c.json({ error: 'name is required' }, 400);
      }
      if (!content || !String(content).trim()) {
        return c.json({ error: 'content is required' }, 400);
      }

      const cat = category || 'General';
      const active = isActive !== false;

      if (id) {
        const updated = await query(
          `UPDATE support_reply_templates
           SET name = $2, category = $3, content = $4, is_active = $5, updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [id, String(name).trim(), cat, String(content).trim(), active]
        );
        if (!updated.rows.length) {
          return c.json({ error: 'Template not found' }, 404);
        }
        return c.json({
          success: true,
          template: mapReplyTemplateRow(updated.rows[0] as Record<string, unknown>),
          message: 'Template updated',
        });
      }

      const created = await query(
        `INSERT INTO support_reply_templates (name, category, content, is_active, is_system, created_by)
         VALUES ($1, $2, $3, $4, false, $5)
         RETURNING *`,
        [String(name).trim(), cat, String(content).trim(), active, createdBy || null]
      );

      return c.json({
        success: true,
        template: mapReplyTemplateRow(created.rows[0] as Record<string, unknown>),
        message: 'Template created',
      });
    } catch (error: any) {
      if (error?.code === '23505') {
        return c.json({ error: 'A template with this name already exists' }, 409);
      }
      console.error('Error saving reply template:', error);
      return c.json({ error: error.message || 'Failed to save reply template' }, 500);
    }
  });

  /**
   * DELETE /support/settings/reply-templates/:templateId
   * Delete a custom saved reply (system templates cannot be deleted)
   */
  app.delete('/support/settings/reply-templates/:templateId', async (c) => {
    try {
      const { templateId } = c.req.param();
      const existing = await query(
        'SELECT id, is_system FROM support_reply_templates WHERE id = $1',
        [templateId]
      );
      if (!existing.rows.length) {
        return c.json({ error: 'Template not found' }, 404);
      }
      if (existing.rows[0].is_system === true) {
        return c.json({ error: 'System templates cannot be deleted. Disable them instead.' }, 400);
      }

      await query('DELETE FROM support_reply_templates WHERE id = $1', [templateId]);
      return c.json({ success: true, message: 'Template deleted' });
    } catch (error: any) {
      console.error('Error deleting reply template:', error);
      return c.json({ error: error.message || 'Failed to delete reply template' }, 500);
    }
  });

  /**
   * GET /support/settings/staff-list
   * Get list of users (admins) with RBAC roles that can be support agents
   * Fetches admins who have been assigned support-related roles in RBAC management
   */
  app.get("/support/settings/staff-list", async (c) => {
    try {
      // Fetch admins with RBAC roles that are support-related
      // Support-related roles: 'admin', 'support_agent', 'support', 'super-admin'
      const result = await query(`
        SELECT DISTINCT
          a.id,
          a.name,
          a.email,
          a.phone,
          a.role as admin_role,
          COALESCE(
            STRING_AGG(DISTINCT r.name, ', ' ORDER BY r.name),
            a.role
          ) as roles,
          COALESCE(
            STRING_AGG(DISTINCT r.display_name, ', ' ORDER BY r.display_name),
            a.role
          ) as role_display_names,
          EXISTS(
            SELECT 1 FROM support_agents sa 
            WHERE sa.user_id = a.id AND sa.is_active = true
          ) as is_support_agent
        FROM admins a
        LEFT JOIN user_roles ur ON a.id = ur.user_id AND ur.is_active = true
        LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
        WHERE a.is_active = true
          AND (
            -- Include admins with support-related RBAC roles
            (r.name IN (
              'admin',
              'support_agent',
              'support',
              'support_admin',
              'support_mngr',
              'super-admin',
              'super_admin'
            ))
            OR
            -- Include admins with support-related admin role
            (a.role IN ('admin', 'support', 'super-admin', 'super_admin'))
            OR
            -- Include all admins if no RBAC roles are assigned yet (for initial setup)
            (ur.id IS NULL AND a.role IS NOT NULL)
          )
        GROUP BY a.id, a.name, a.email, a.phone, a.role
        ORDER BY a.name
      `);

      return c.json({
        success: true,
        staff: result.rows.map(s => ({
          id: s.id,
          name: s.name,
          email: s.email,
          phone: s.phone,
          role: s.roles || s.admin_role, // Show RBAC roles or fallback to admin role
          roleDisplayNames: s.role_display_names || s.admin_role,
          canHandleSupport: s.is_support_agent || false,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching staff list:', error);
      return c.json({ error: error.message || 'Failed to fetch staff list' }, 500);
    }
  });
}

