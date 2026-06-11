/**
 * Support ticket operational activity timeline (admin-only).
 */

import { insert, query } from '../../database/rds-connection';

export const SUPPORT_TICKET_EVENT_TYPES = {
  TICKET_CREATED: 'ticket_created',
  AI_ACKNOWLEDGED: 'ai_acknowledged',
  ASSIGNED: 'assigned',
  REASSIGNED: 'reassigned',
  ESCALATED: 'escalated',
  STATUS_CHANGED: 'status_changed',
  AGENT_REPLIED: 'agent_replied',
  CUSTOMER_REPLIED: 'customer_replied',
  INTERNAL_NOTE_ADDED: 'internal_note_added',
  REFUND_INITIATED: 'refund_initiated',
  REFUND_COMPLETED: 'refund_completed',
  TICKET_RESOLVED: 'ticket_resolved',
  TICKET_CLOSED: 'ticket_closed',
  TICKET_REOPENED: 'ticket_reopened',
} as const;

export type SupportTicketEventType =
  (typeof SUPPORT_TICKET_EVENT_TYPES)[keyof typeof SUPPORT_TICKET_EVENT_TYPES];

export type RecordSupportTicketActivityInput = {
  ticketId: string;
  eventType: SupportTicketEventType | string;
  eventTitle: string;
  eventActorType?: string | null;
  eventActorId?: string | null;
  eventMetadata?: Record<string, unknown> | null;
};

let activityTableExists: boolean | null = null;

async function ensureActivityTable(): Promise<boolean> {
  if (activityTableExists !== null) return activityTableExists;
  try {
    const r = await query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'support_ticket_activity'
       ) AS exists`
    );
    activityTableExists = r.rows?.[0]?.exists === true;
  } catch {
    activityTableExists = false;
  }
  return activityTableExists;
}

export async function recordSupportTicketActivity(
  input: RecordSupportTicketActivityInput
): Promise<void> {
  const hasTable = await ensureActivityTable();
  if (!hasTable) {
    console.warn('[support-activity] table missing, skipping:', input.eventType, input.ticketId);
    return;
  }

  try {
    await insert('support_ticket_activity', {
      ticket_id: input.ticketId,
      event_type: input.eventType,
      event_actor_type: input.eventActorType ?? null,
      event_actor_id: input.eventActorId ?? null,
      event_title: input.eventTitle,
      event_metadata: input.eventMetadata ?? {},
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[support-activity] failed to record:', input.eventType, err);
  }
}

export type SupportTicketActivityRow = {
  id: string;
  ticketId: string;
  eventType: string;
  eventActorType: string | null;
  eventActorId: string | null;
  eventTitle: string;
  eventMetadata: Record<string, unknown>;
  createdAt: string;
};

export async function listSupportTicketActivity(
  ticketId: string
): Promise<SupportTicketActivityRow[]> {
  const hasTable = await ensureActivityTable();
  if (!hasTable) return [];

  const result = await query(
    `SELECT id, ticket_id, event_type, event_actor_type, event_actor_id,
            event_title, event_metadata, created_at
     FROM support_ticket_activity
     WHERE ticket_id = $1::uuid
     ORDER BY created_at ASC`,
    [ticketId]
  ).catch(() => ({ rows: [] }));

  return (result.rows || []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    ticketId: String(row.ticket_id),
    eventType: String(row.event_type),
    eventActorType: row.event_actor_type ? String(row.event_actor_type) : null,
    eventActorId: row.event_actor_id ? String(row.event_actor_id) : null,
    eventTitle: String(row.event_title),
    eventMetadata:
      row.event_metadata != null && typeof row.event_metadata === 'object'
        ? (row.event_metadata as Record<string, unknown>)
        : {},
    createdAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
  }));
}

export async function resolveActorDisplayName(
  actorType: string | null | undefined,
  actorId: string | null | undefined
): Promise<string | null> {
  if (!actorId) return null;
  try {
    if (actorType === 'admin' || actorType === 'agent') {
      const r = await query(
        `SELECT COALESCE(NULLIF(TRIM(name), ''), email) AS name
         FROM admins WHERE id = $1::uuid LIMIT 1`,
        [actorId]
      );
      if (r.rows?.[0]?.name) return String(r.rows[0].name);
      const s = await query(
        `SELECT name FROM staff WHERE id = $1::uuid LIMIT 1`,
        [actorId]
      );
      if (s.rows?.[0]?.name) return String(s.rows[0].name);
    }
    if (actorType === 'customer') {
      const r = await query(
        `SELECT full_name FROM customers WHERE id = $1::uuid LIMIT 1`,
        [actorId]
      );
      if (r.rows?.[0]?.full_name) return String(r.rows[0].full_name);
    }
  } catch {
    /* ignore */
  }
  return null;
}
