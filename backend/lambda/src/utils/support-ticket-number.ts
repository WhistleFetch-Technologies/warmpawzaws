/** Human-readable unique id for support_tickets.ticket_number (NOT NULL). */
export function generateSupportTicketNumber(prefix = 'TKT'): string {
  const ymd = new Date().toISOString().split('T')[0].replace(/-/g, '');
  return `${prefix}-${ymd}-${Date.now().toString().slice(-6)}`;
}
