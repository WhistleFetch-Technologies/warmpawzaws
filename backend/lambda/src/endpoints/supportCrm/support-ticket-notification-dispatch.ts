/**
 * Dispatch support ticket notifications to customer, agent, and ops audiences.
 */

import { insert, query, select } from '../../database/rds-connection';
import { notifySupportTicketCustomerSms } from './support-ticket-notify';
import {
  channelsForEvent,
  shouldSendCustomerSmsForAgentReply,
  type SupportTicketNotificationEvent,
} from './support-ticket-notification-matrix';
import {
  getSupportNotificationSettings,
  resolveEscalationEmailRecipients,
  resolveOpsInboxRecipients,
} from './support-ticket-notification-settings';
import {
  buildTemplateContext,
  renderAgentAssignedEmail,
  renderAgentCustomerReplyEmail,
  renderCustomerAssignSms,
  renderCustomerEscalationSms,
  renderCustomerResolveSms,
  renderOpsEscalationEmail,
  renderOpsTicketCreatedEmail,
} from './support-ticket-notification-templates';
import { sendSupportTicketEmail } from './support-ticket-notification-email';

export type DispatchSupportTicketNotificationInput = {
  event: SupportTicketNotificationEvent;
  ticket: Record<string, unknown>;
  ruleNotifyEmail?: string | null;
  reason?: string;
  messagePreview?: string;
  assigneeId?: string | null;
  assigneeName?: string;
  previousAssigneeId?: string | null;
};

async function resolveAgentEmail(assigneeId: string | null | undefined): Promise<string | null> {
  if (!assigneeId) return null;
  try {
    const admins = await select('admins', { id: assigneeId });
    if (admins[0]?.email) return String(admins[0].email);
    const staff = await select('staff', { id: assigneeId });
    if (staff[0]?.email) return String(staff[0].email);
    const agents = await query(
      `SELECT COALESCE(a.email, s.email) AS email
       FROM support_agents sa
       LEFT JOIN admins a ON sa.user_id = a.id OR sa.staff_id = a.id
       LEFT JOIN staff s ON sa.staff_id = s.id
       WHERE COALESCE(sa.user_id, sa.staff_id) = $1::uuid
       LIMIT 1`,
      [assigneeId]
    );
    const email = agents.rows?.[0]?.email;
    return email ? String(email) : null;
  } catch {
    return null;
  }
}

async function createAgentInAppNotification(
  assigneeId: string,
  title: string,
  message: string,
  ticketId: string
): Promise<void> {
  try {
    await insert('notifications', {
      recipient_type: 'admin',
      recipient_id: assigneeId,
      notification_type: 'support_ticket',
      title,
      message,
      channels: { in_app: true, email: false, push: false, sms: false },
      is_read: false,
      data: { ticketId, deepLink: `/support?ticket=${ticketId}` },
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[support-notify] in-app insert failed:', err);
  }
}

export function scheduleSupportTicketNotification(input: DispatchSupportTicketNotificationInput): void {
  void dispatchSupportTicketNotification(input).catch((err) => {
    console.warn('[support-notify] dispatch failed:', input.event, input.ticket?.id, err);
  });
}

export async function dispatchSupportTicketNotification(
  input: DispatchSupportTicketNotificationInput
): Promise<void> {
  const settings = await getSupportNotificationSettings();
  const ctx = buildTemplateContext(input.ticket);
  if (input.reason) ctx.reason = input.reason;
  if (input.messagePreview) ctx.messagePreview = input.messagePreview;
  if (input.assigneeName) ctx.assigneeName = input.assigneeName;

  const ticketId = ctx.ticketId;
  const priority = ctx.priority;

  switch (input.event) {
    case 'ticket_created': {
      if (!settings.notifyOpsOnTicketCreated) break;
      const opsChannels = channelsForEvent('ticket_created', 'ops', settings.channels.ops);
      if (opsChannels.includes('email')) {
        const { to, cc } = resolveOpsInboxRecipients(settings);
        const email = renderOpsTicketCreatedEmail(ctx);
        await sendSupportTicketEmail({
          to,
          cc,
          subject: email.subject,
          htmlBody: email.html,
          textBody: email.text,
          tags: { ticketId, event: 'ticket_created' },
        });
      }
      break;
    }

    case 'assigned':
    case 'reassigned': {
      const assigneeId = input.assigneeId ? String(input.assigneeId) : null;
      if (assigneeId && settings.notifyAgentOnAssign) {
        const agentChannels = channelsForEvent(input.event, 'agent', settings.channels.agent);
        if (agentChannels.includes('in_app')) {
          await createAgentInAppNotification(
            assigneeId,
            input.event === 'reassigned' ? 'Ticket reassigned to you' : 'New ticket assigned',
            `${ctx.ticketNumber}: ${ctx.subject}`,
            ticketId
          );
        }
        if (agentChannels.includes('email')) {
          const agentEmail = await resolveAgentEmail(assigneeId);
          if (agentEmail) {
            const email = renderAgentAssignedEmail(ctx);
            await sendSupportTicketEmail({
              to: [agentEmail],
              subject: email.subject,
              htmlBody: email.html,
              textBody: email.text,
              tags: { ticketId, event: input.event },
            });
          }
        }
      }

      if (input.event === 'assigned' && settings.notifyCustomerOnAssign) {
        const custChannels = channelsForEvent('assigned', 'customer', settings.channels.customer);
        if (custChannels.includes('sms')) {
          await notifySupportTicketCustomerSms(input.ticket, renderCustomerAssignSms(ctx));
        }
      }
      break;
    }

    case 'customer_replied': {
      const assigneeId = input.ticket.assigned_to
        ? String(input.ticket.assigned_to)
        : input.assigneeId
          ? String(input.assigneeId)
          : null;
      if (!assigneeId || !settings.notifyAgentOnCustomerReply) break;

      const agentChannels = channelsForEvent('customer_replied', 'agent', settings.channels.agent);
      if (agentChannels.includes('in_app')) {
        await createAgentInAppNotification(
          assigneeId,
          'Customer replied',
          `${ctx.ticketNumber}: ${input.messagePreview || 'New message'}`,
          ticketId
        );
      }
      if (agentChannels.includes('email')) {
        const agentEmail = await resolveAgentEmail(assigneeId);
        if (agentEmail) {
          const email = renderAgentCustomerReplyEmail(ctx);
          await sendSupportTicketEmail({
            to: [agentEmail],
            subject: email.subject,
            htmlBody: email.html,
            textBody: email.text,
            tags: { ticketId, event: 'customer_replied' },
          });
        }
      }
      break;
    }

    case 'agent_replied':
      break;

    case 'escalated':
    case 'sla_breach': {
      if (settings.notifyOpsOnEscalation) {
        const opsChannels = channelsForEvent(input.event, 'ops', settings.channels.ops);
        if (opsChannels.includes('email')) {
          const { to, cc } = resolveEscalationEmailRecipients(settings, input.ruleNotifyEmail);
          const email = renderOpsEscalationEmail(ctx);
          await sendSupportTicketEmail({
            to,
            cc,
            subject: email.subject,
            htmlBody: email.html,
            textBody: email.text,
            tags: { ticketId, event: input.event },
          });
        }
      }

      if (input.event === 'escalated') {
        const custChannels = channelsForEvent('escalated', 'customer', settings.channels.customer);
        if (custChannels.includes('sms')) {
          await notifySupportTicketCustomerSms(input.ticket, renderCustomerEscalationSms(ctx));
        }
      }

      const assigneeId = input.ticket.assigned_to ? String(input.ticket.assigned_to) : null;
      if (assigneeId) {
        const agentChannels = channelsForEvent('escalated', 'agent', settings.channels.agent);
        if (agentChannels.includes('in_app')) {
          await createAgentInAppNotification(
            assigneeId,
            'Ticket escalated',
            `${ctx.ticketNumber}: ${input.reason || 'Escalated'}`,
            ticketId
          );
        }
      }
      break;
    }

    case 'resolved':
    case 'closed': {
      if (!settings.notifyCustomerOnResolve) break;
      const custChannels = channelsForEvent(input.event, 'customer', settings.channels.customer);
      if (custChannels.includes('sms')) {
        await notifySupportTicketCustomerSms(input.ticket, renderCustomerResolveSms(ctx));
      }
      break;
    }

    case 'awaiting_assignment': {
      const opsChannels = channelsForEvent('awaiting_assignment', 'ops', settings.channels.ops);
      if (opsChannels.includes('email')) {
        const { to, cc } = resolveOpsInboxRecipients(settings);
        if (to.length) {
          const email = renderOpsTicketCreatedEmail({
            ...ctx,
            messagePreview: `Ticket unassigned for extended period — ${ctx.ticketNumber}`,
          });
          await sendSupportTicketEmail({
            to,
            cc,
            subject: `[Warmpawz Backlog] Unassigned ticket ${ctx.ticketNumber}`,
            htmlBody: email.html,
            textBody: email.text,
            tags: { ticketId, event: 'awaiting_assignment' },
          });
        }
      }
      break;
    }

    default:
      break;
  }
}

/** Whether customer SMS should fire on agent reply (respects urgent-only toggle). */
export async function shouldNotifyCustomerOnAgentReply(ticket: Record<string, unknown>): Promise<boolean> {
  const settings = await getSupportNotificationSettings();
  const priority = String(ticket.priority || 'medium');
  return shouldSendCustomerSmsForAgentReply(priority, settings.customerSmsOnAgentReplyUrgentOnly);
}
