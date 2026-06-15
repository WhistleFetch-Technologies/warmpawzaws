/**
 * Background processor: evaluate support_escalation_rules and fire notifications.
 */

import { query, update } from '../../database/rds-connection';
import {
  recordSupportTicketActivity,
  SUPPORT_TICKET_EVENT_TYPES,
} from './support-ticket-activity';
import { scheduleSupportTicketNotification } from './support-ticket-notification-dispatch';

export type EscalationRuleRow = {
  id: string;
  name: string;
  trigger_type: string;
  trigger_value: string;
  priority_filter: string | null;
  category_filter: string | null;
  escalate_to: string | null;
  new_priority: string | null;
  notify_email: string | null;
};

export type EscalationBatchResult = {
  evaluated: number;
  fired: number;
  skipped: number;
  timedOut: boolean;
};

const OPEN_STATUSES = [
  'open',
  'ai_acknowledged',
  'awaiting_assignment',
  'assigned',
  'in_progress',
  'waiting_for_customer',
  'escalated',
];

function ruleAlreadyFired(metadata: unknown, ruleId: string): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  const fired = (metadata as Record<string, unknown>).escalation_rules_fired;
  return Array.isArray(fired) && fired.includes(ruleId);
}

function appendRuleFired(metadata: unknown, ruleId: string): Record<string, unknown> {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  const fired = Array.isArray(base.escalation_rules_fired)
    ? [...(base.escalation_rules_fired as string[])]
    : [];
  if (!fired.includes(ruleId)) fired.push(ruleId);
  base.escalation_rules_fired = fired;
  return base;
}

function matchesFilters(
  ticket: Record<string, unknown>,
  rule: EscalationRuleRow
): boolean {
  if (rule.priority_filter && String(ticket.priority || '') !== rule.priority_filter) {
    return false;
  }
  if (rule.category_filter && String(ticket.category || '') !== rule.category_filter) {
    return false;
  }
  return true;
}

async function ticketMatchesRule(
  ticket: Record<string, unknown>,
  rule: EscalationRuleRow
): Promise<boolean> {
  if (!matchesFilters(ticket, rule)) return false;
  if (ruleAlreadyFired(ticket.metadata, rule.id)) return false;

  const triggerMinutes = parseInt(String(rule.trigger_value || '0'), 10);
  if (!Number.isFinite(triggerMinutes) || triggerMinutes <= 0) return false;

  const ticketId = String(ticket.id);
  const now = Date.now();
  const thresholdMs = triggerMinutes * 60 * 1000;

  switch (rule.trigger_type) {
    case 'minutes_unassigned': {
      if (ticket.assigned_to) return false;
      const ref = ticket.created_at ? new Date(String(ticket.created_at)).getTime() : 0;
      return ref > 0 && now - ref >= thresholdMs;
    }

    case 'minutes_no_response': {
      if (!ticket.assigned_to) return false;
      const lastAgent = await query(
        `SELECT MAX(created_at) AS ts
         FROM support_ticket_responses
         WHERE ticket_id = $1 AND responder_type = 'agent' AND is_internal = false`,
        [ticketId]
      );
      const lastAgentTs = lastAgent.rows?.[0]?.ts
        ? new Date(String(lastAgent.rows[0].ts)).getTime()
        : ticket.assigned_at
          ? new Date(String(ticket.assigned_at)).getTime()
          : ticket.created_at
            ? new Date(String(ticket.created_at)).getTime()
            : 0;
      if (!lastAgentTs) return false;

      const lastCustomer = await query(
        `SELECT MAX(created_at) AS ts
         FROM support_ticket_responses
         WHERE ticket_id = $1 AND responder_type = 'customer'`,
        [ticketId]
      );
      const lastCustomerTs = lastCustomer.rows?.[0]?.ts
        ? new Date(String(lastCustomer.rows[0].ts)).getTime()
        : ticket.created_at
          ? new Date(String(ticket.created_at)).getTime()
          : 0;

      const waitingSince = Math.max(lastAgentTs, lastCustomerTs);
      return now - waitingSince >= thresholdMs;
    }

    case 'customer_replies': {
      const countRes = await query(
        `SELECT COUNT(*)::int AS cnt
         FROM support_ticket_responses
         WHERE ticket_id = $1 AND responder_type = 'customer'`,
        [ticketId]
      );
      const cnt = Number(countRes.rows?.[0]?.cnt || 0);
      return cnt >= triggerMinutes;
    }

    case 'sla_breach': {
      const priority = String(ticket.priority || 'medium');
      const sla = await query(
        `SELECT first_response_minutes FROM support_sla_config
         WHERE priority = $1 AND is_active = true
         ORDER BY created_at DESC LIMIT 1`,
        [priority]
      );
      const slaMinutes = Number(sla.rows?.[0]?.first_response_minutes || triggerMinutes);
      if (!ticket.assigned_to) {
        const ref = ticket.created_at ? new Date(String(ticket.created_at)).getTime() : 0;
        return ref > 0 && now - ref >= slaMinutes * 60 * 1000;
      }
      const agentReply = await query(
        `SELECT 1 FROM support_ticket_responses
         WHERE ticket_id = $1 AND responder_type = 'agent' AND is_internal = false
         LIMIT 1`,
        [ticketId]
      );
      if (agentReply.rows?.length) return false;
      const ref = ticket.created_at ? new Date(String(ticket.created_at)).getTime() : 0;
      return ref > 0 && now - ref >= slaMinutes * 60 * 1000;
    }

    default:
      return false;
  }
}

async function applyEscalationRule(
  ticket: Record<string, unknown>,
  rule: EscalationRuleRow
): Promise<void> {
  const ticketId = String(ticket.id);
  const updateData: Record<string, unknown> = {
    status: 'escalated',
    escalated_at: new Date().toISOString(),
    escalation_reason: `Rule: ${rule.name}`,
    last_updated_at: new Date().toISOString(),
    metadata: appendRuleFired(ticket.metadata, rule.id),
  };

  if (rule.new_priority) {
    updateData.priority = rule.new_priority;
  }
  if (rule.escalate_to) {
    updateData.assigned_to = rule.escalate_to;
    updateData.assigned_at = new Date().toISOString();
  }

  const updated = await update('support_tickets', { id: ticketId }, updateData);
  const updatedTicket = updated[0] || { ...ticket, ...updateData };

  await recordSupportTicketActivity({
    ticketId,
    eventType: SUPPORT_TICKET_EVENT_TYPES.ESCALATED,
    eventActorType: 'system',
    eventTitle: `Escalated by rule: ${rule.name}`,
    eventMetadata: {
      ruleId: rule.id,
      triggerType: rule.trigger_type,
      autoEscalation: true,
    },
  });

  scheduleSupportTicketNotification({
    event: 'sla_breach',
    ticket: updatedTicket as Record<string, unknown>,
    ruleNotifyEmail: rule.notify_email,
    reason: `Automatic escalation: ${rule.name}`,
  });
}

export async function processSupportTicketEscalationBatch(options?: {
  limit?: number;
  timeBudgetMs?: number;
}): Promise<EscalationBatchResult> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  const timeBudgetMs = options?.timeBudgetMs ?? 22000;
  const started = Date.now();

  const rulesRes = await query(
    `SELECT id, name, trigger_type, trigger_value, priority_filter, category_filter,
            escalate_to, new_priority, notify_email
     FROM support_escalation_rules
     WHERE is_active = true
     ORDER BY created_at ASC`
  );
  const rules = (rulesRes.rows || []) as EscalationRuleRow[];
  if (!rules.length) {
    return { evaluated: 0, fired: 0, skipped: 0, timedOut: false };
  }

  const ticketsRes = await query(
    `SELECT *
     FROM support_tickets
     WHERE status = ANY($1::text[])
     ORDER BY created_at ASC
     LIMIT $2`,
    [OPEN_STATUSES, limit]
  );
  const tickets = ticketsRes.rows || [];

  let fired = 0;
  let skipped = 0;
  let timedOut = false;

  for (const ticket of tickets) {
    if (Date.now() - started >= timeBudgetMs) {
      timedOut = true;
      break;
    }

    let ticketFired = false;
    for (const rule of rules) {
      if (Date.now() - started >= timeBudgetMs) {
        timedOut = true;
        break;
      }
      try {
        const matches = await ticketMatchesRule(ticket, rule);
        if (matches) {
          await applyEscalationRule(ticket, rule);
          fired += 1;
          ticketFired = true;
          break;
        }
      } catch (err) {
        console.warn('[escalation-processor] rule evaluation failed:', rule.id, ticket.id, err);
      }
    }
    if (!ticketFired) skipped += 1;
  }

  return { evaluated: tickets.length, fired, skipped, timedOut };
}
