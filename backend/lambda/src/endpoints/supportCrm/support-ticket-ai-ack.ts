/**
 * Async system AI acknowledgement after support ticket creation.
 */

import { select, insert, update, query } from '../../database/rds-connection';
import { invokeBedrock } from '../../utils/bedrock-client';
import { buildBookingSnapshot } from './support-ticket-helpers';
import {
  recordSupportTicketActivity,
  SUPPORT_TICKET_EVENT_TYPES,
} from './support-ticket-activity';
import { notifySupportTicketCustomerSms } from './support-ticket-notify';
import { assignSupportTicket, getSupportRoutingSettings } from './support-ticket-auto-assign';

const FALLBACK_ACK =
  "We've received your request and will assign it to the appropriate support specialist shortly.";

const AI_ACK_SYSTEM_PROMPT = `You write a brief support ticket acknowledgement for Warmpawz (pet services platform).
Output ONLY the acknowledgement message text. No JSON. No markdown headers.
Rules:
- Thank the customer by name if provided
- Mention the ticket subject briefly
- Include the ticket number exactly as given
- For booking-linked tickets, mention the service name and booking reference if provided
- State that the support team is reviewing and will assign a specialist
- NEVER promise refunds, outcomes, resolution times, or compensation
- Keep under 120 words
- Professional, warm tone`;

function buildFallbackAck(params: {
  customerName: string;
  subject: string;
  ticketNumber: string;
  serviceName?: string;
  bookingRef?: string;
}): string {
  const name = params.customerName || 'there';
  let body = `Hi ${name},\n\nWe've received your request regarding ${params.subject}.\n\nTicket #${params.ticketNumber} has been created successfully.\n\nOur support team is reviewing your request and will assign it to the appropriate specialist shortly.`;

  if (params.serviceName && params.bookingRef) {
    body += `\n\nWe've linked your booking for ${params.serviceName} (reference ${params.bookingRef}).`;
  }

  body += '\n\nThank you for your patience.';
  return body;
}

async function hasExistingAiAck(ticketId: string): Promise<boolean> {
  const r = await query(
    `SELECT id FROM support_ticket_responses
     WHERE ticket_id = $1::uuid AND responder_type = 'system_ai'
     LIMIT 1`,
    [ticketId]
  ).catch(() => ({ rows: [] }));
  return (r.rows?.length ?? 0) > 0;
}

async function generateAckMessage(ticket: Record<string, unknown>): Promise<string> {
  const customerName =
    (ticket.customer_name as string) ||
    (await loadCustomerName(ticket.customer_id as string | null)) ||
    'there';
  const subject = String(ticket.subject || 'your request');
  const ticketNumber = String(ticket.ticket_number || ticket.id || '');
  const bookingId = ticket.booking_id ? String(ticket.booking_id) : null;

  let serviceName: string | undefined;
  let bookingRef: string | undefined;

  if (bookingId) {
    bookingRef = bookingId.slice(0, 8);
    const snap = await buildBookingSnapshot(bookingId);
    serviceName = snap?.serviceName;
  }

  const fallback = buildFallbackAck({
    customerName,
    subject,
    ticketNumber,
    serviceName,
    bookingRef,
  });

  try {
    const userPrompt = `Customer name: ${customerName}
Subject: ${subject}
Ticket number: ${ticketNumber}
Booking linked: ${bookingId ? 'yes' : 'no'}
${serviceName ? `Service name: ${serviceName}` : ''}
${bookingRef ? `Booking reference: ${bookingRef}` : ''}

Write the acknowledgement message.`;

    const raw = await invokeBedrock(userPrompt, AI_ACK_SYSTEM_PROMPT, {
      maxTokens: 256,
      temperature: 0.2,
      topP: 0.9,
    });

    const text = raw?.trim();
    if (!text || text.length < 20) return fallback;

    const lower = text.toLowerCase();
    if (
      lower.includes('refund guaranteed') ||
      lower.includes('will refund') ||
      lower.includes('full refund') ||
      lower.includes('resolved within')
    ) {
      return fallback;
    }

    return text;
  } catch (err) {
    console.warn('[support-ai-ack] Bedrock failed, using fallback:', err);
    return fallback;
  }
}

async function loadCustomerName(customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  try {
    const rows = await select('customers', { id: customerId });
    return rows[0]?.full_name ? String(rows[0].full_name) : null;
  } catch {
    return null;
  }
}

function isUnassigned(ticket: Record<string, unknown>): boolean {
  const assigned = ticket.assigned_to;
  return assigned == null || assigned === '';
}

async function tryAutoAssignAfterAck(ticketId: string): Promise<void> {
  try {
    const settings = await getSupportRoutingSettings();
    if (!settings.assignAfterAiAck) return;

    const result = await assignSupportTicket(ticketId);
    if (!result.assigned) {
      console.warn('[support-ai-ack] auto-assign skipped:', ticketId, result.reason, result.poolKey);
      if (result.reason === 'no_eligible_agent') {
        const rows = await select('support_tickets', { id: ticketId });
        const meta =
          rows[0]?.metadata != null &&
          typeof rows[0].metadata === 'object' &&
          !Array.isArray(rows[0].metadata)
            ? { ...(rows[0].metadata as Record<string, unknown>) }
            : {};
        await update('support_tickets', { id: ticketId }, {
          last_updated_at: new Date().toISOString(),
          metadata: {
            ...meta,
            assignment_blocked_reason: 'no_eligible_agent',
            assignment_blocked_at: new Date().toISOString(),
            assignment_pool_key: result.poolKey ?? null,
          },
        }).catch(() => undefined);
      }
    }
  } catch (err) {
    console.error('[support-ai-ack] auto-assign failed:', ticketId, err);
  }
}

/**
 * Repair tickets stuck after partial AI ack (response posted but never assigned).
 */
async function repairStuckUnassignedAck(ticket: Record<string, unknown>): Promise<boolean> {
  const ticketId = String(ticket.id || '');
  if (!ticketId || !isUnassigned(ticket)) return false;

  const status = String(ticket.status || '').toLowerCase();
  if (status !== 'ai_acknowledged' && status !== 'awaiting_assignment') return false;

  const hasAck = await hasExistingAiAck(ticketId);
  if (!hasAck) return false;

  const now = new Date().toISOString();
  if (status === 'ai_acknowledged') {
    await update('support_tickets', { id: ticketId }, {
      status: 'awaiting_assignment',
      last_updated_at: now,
    });
  }

  await tryAutoAssignAfterAck(ticketId);
  return true;
}

/**
 * Process AI acknowledgement (idempotent). Safe to call multiple times.
 */
export async function processSupportTicketAiAck(ticketId: string): Promise<void> {
  const started = Date.now();

  try {
    const tickets = await select('support_tickets', { id: ticketId });
    if (tickets.length === 0) return;

    const ticket = tickets[0] as Record<string, unknown>;

    if (ticket.ai_ack_success === true) {
      await repairStuckUnassignedAck(ticket);
      return;
    }

    if (await hasExistingAiAck(ticketId)) {
      if (isUnassigned(ticket)) {
        await repairStuckUnassignedAck(ticket);
      }
      return;
    }

    const status = String(ticket.status || 'open');
    if (status !== 'open') {
      return;
    }

    let message = FALLBACK_ACK;
    let usedFallback = true;

    try {
      const generated = await generateAckMessage(ticket);
      const fb = buildFallbackAck({
        customerName:
          (ticket.customer_name as string) ||
          (await loadCustomerName(ticket.customer_id as string | null)) ||
          'there',
        subject: String(ticket.subject || 'your request'),
        ticketNumber: String(ticket.ticket_number || ticketId),
        serviceName: ticket.booking_id
          ? (await buildBookingSnapshot(String(ticket.booking_id)))?.serviceName
          : undefined,
        bookingRef: ticket.booking_id ? String(ticket.booking_id).slice(0, 8) : undefined,
      });
      message = generated;
      usedFallback = generated.trim() === fb.trim();
    } catch {
      message = FALLBACK_ACK;
      usedFallback = true;
    }

    const latencyMs = Date.now() - started;

    await insert('support_ticket_responses', {
      ticket_id: ticketId,
      responder_id: null,
      responder_type: 'system_ai',
      responder_name: 'Warmpawz Support',
      message,
      is_internal: false,
      created_at: new Date().toISOString(),
    });

    const now = new Date().toISOString();
    const nextStatus = isUnassigned(ticket) ? 'awaiting_assignment' : 'ai_acknowledged';
    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      ai_ack_generated_at: now,
      ai_ack_latency_ms: latencyMs,
      ai_ack_success: true,
      ai_ack_failed: usedFallback,
      last_updated_at: now,
    };

    await update('support_tickets', { id: ticketId }, updatePayload);

    await recordSupportTicketActivity({
      ticketId,
      eventType: SUPPORT_TICKET_EVENT_TYPES.AI_ACKNOWLEDGED,
      eventActorType: 'system',
      eventTitle: 'AI acknowledgement posted',
      eventMetadata: {
        latencyMs,
        usedFallback,
        ticketNumber: ticket.ticket_number,
      },
    });

    if (isUnassigned(ticket)) {
      await recordSupportTicketActivity({
        ticketId,
        eventType: SUPPORT_TICKET_EVENT_TYPES.STATUS_CHANGED,
        eventActorType: 'system',
        eventTitle: 'Status changed to Awaiting Assignment',
        eventMetadata: {
          from: status,
          to: 'awaiting_assignment',
        },
      });
    }

    await notifySupportTicketCustomerSms(
      {
        id: ticketId,
        customer_id: ticket.customer_id as string | null,
        customer_phone: ticket.customer_phone as string | null,
      },
      message
    );

    if (isUnassigned(ticket)) {
      await tryAutoAssignAfterAck(ticketId);
    }
  } catch (err) {
    console.error('[support-ai-ack] failed for ticket', ticketId, err);
    try {
      await update('support_tickets', { id: ticketId }, {
        ai_ack_failed: true,
        ai_ack_success: false,
        ai_ack_latency_ms: Date.now() - started,
        last_updated_at: new Date().toISOString(),
      });
    } catch {
      /* ignore */
    }
  }
}

/**
 * Fire-and-forget scheduling — does not block ticket creation response.
 */
export function scheduleSupportTicketAiAck(ticketId: string): void {
  if (!ticketId) return;
  void processSupportTicketAiAck(ticketId).catch((err) => {
    console.error('[support-ai-ack] background task failed:', ticketId, err);
  });
}

/** Retry post-AI-ack assignment for tickets stuck without an agent (e.g. agents at capacity). */
export async function retryPostAckAssignment(ticketId: string): Promise<void> {
  if (!ticketId) return;
  const tickets = await select('support_tickets', { id: ticketId });
  if (!tickets.length) return;
  const ticket = tickets[0] as Record<string, unknown>;
  if (!isUnassigned(ticket)) return;

  const status = String(ticket.status || '').toLowerCase();
  if (status === 'ai_acknowledged' || status === 'awaiting_assignment') {
    await repairStuckUnassignedAck(ticket);
    return;
  }
  if (status === 'open' && !(await hasExistingAiAck(ticketId))) {
    await processSupportTicketAiAck(ticketId);
  }
}
