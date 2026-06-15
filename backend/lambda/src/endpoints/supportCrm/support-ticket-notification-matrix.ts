/**
 * Event × audience × channel matrix for support ticket notifications.
 */

export type SupportTicketNotificationEvent =
  | 'ticket_created'
  | 'ai_acknowledged'
  | 'awaiting_assignment'
  | 'assigned'
  | 'reassigned'
  | 'customer_replied'
  | 'agent_replied'
  | 'escalated'
  | 'sla_breach'
  | 'resolved'
  | 'closed'
  | 'refund_initiated'
  | 'refund_completed';

export type NotificationAudience = 'customer' | 'agent' | 'ops';

export type NotificationChannel = 'sms' | 'email' | 'in_app' | 'push';

const URGENT_PRIORITIES = new Set(['urgent', 'high']);

/** Which channels to attempt per event and audience (before settings toggles). */
export const SUPPORT_NOTIFICATION_MATRIX: Record<
  SupportTicketNotificationEvent,
  Partial<Record<NotificationAudience, NotificationChannel[]>>
> = {
  ticket_created: {
    customer: ['in_app'],
    ops: ['email'],
  },
  ai_acknowledged: {
    customer: ['sms'],
  },
  awaiting_assignment: {
    ops: ['email'],
  },
  assigned: {
    customer: ['sms'],
    agent: ['in_app', 'email'],
  },
  reassigned: {
    agent: ['in_app', 'email'],
  },
  customer_replied: {
    agent: ['in_app', 'email'],
  },
  agent_replied: {
    customer: ['sms'],
  },
  escalated: {
    customer: ['sms'],
    agent: ['in_app', 'email'],
    ops: ['email'],
  },
  sla_breach: {
    agent: ['in_app', 'email'],
    ops: ['email'],
  },
  resolved: {
    customer: ['sms'],
  },
  closed: {
    customer: ['sms'],
  },
  refund_initiated: {
    customer: ['sms'],
    ops: ['email'],
  },
  refund_completed: {
    customer: ['sms'],
  },
};

export function shouldSendCustomerSmsForAgentReply(priority: string, urgentOnly: boolean): boolean {
  if (!urgentOnly) return true;
  return URGENT_PRIORITIES.has(String(priority || '').toLowerCase());
}

export function channelsForEvent(
  event: SupportTicketNotificationEvent,
  audience: NotificationAudience,
  enabledChannels: NotificationChannel[]
): NotificationChannel[] {
  const planned = SUPPORT_NOTIFICATION_MATRIX[event]?.[audience] ?? [];
  return planned.filter((ch) => enabledChannels.includes(ch));
}
