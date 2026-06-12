/**
 * Shared types for customer Help → My Tickets → ticket thread UI.
 */

export interface SupportTicketResponseRow {
  id?: string;
  message?: string;
  responder_type?: string;
  responder_name?: string;
  created_at?: string;
  is_internal?: boolean;
}

/** Payload from GET /support/tickets/:id after filtering internal notes. */
export interface SupportTicketDetailBundle {
  ticket: Record<string, unknown>;
  responses: SupportTicketResponseRow[];
}
