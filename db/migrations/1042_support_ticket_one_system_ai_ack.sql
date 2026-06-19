-- One system AI acknowledgement per support ticket (prevents duplicate auto-replies).

DELETE FROM support_ticket_responses dup
WHERE dup.responder_type = 'system_ai'
  AND dup.id NOT IN (
    SELECT DISTINCT ON (ticket_id) id
    FROM support_ticket_responses
    WHERE responder_type = 'system_ai'
    ORDER BY ticket_id, created_at ASC, id ASC
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_ticket_responses_one_system_ai_per_ticket
  ON support_ticket_responses (ticket_id)
  WHERE responder_type = 'system_ai';
