/**
 * Routing pool derivation for support ticket auto-assignment (no DB deps).
 */

export type RoutingPoolKey = 'booking' | 'meal_order' | 'billing' | 'account' | 'general';

function resolveMealOrderIdFromTicket(row: {
  meal_order_id?: string | null;
  metadata?: unknown;
}): string | null {
  if (row.meal_order_id) return String(row.meal_order_id);
  const meta = row.metadata as Record<string, unknown> | undefined;
  if (meta?.linked_meal_order_id) return String(meta.linked_meal_order_id);
  const ctx = meta?.meal_order_context;
  if (ctx && typeof ctx === 'object' && (ctx as { orderId?: string }).orderId) {
    return String((ctx as { orderId: string }).orderId);
  }
  return null;
}

function deriveTicketTypeForRouting(row: {
  booking_id?: string | null;
  meal_order_id?: string | null;
  metadata?: unknown;
}): 'general' | 'booking' | 'meal_order' {
  if (row.booking_id) return 'booking';
  const meta = row.metadata as Record<string, unknown> | undefined;
  if (meta?.ticket_type === 'booking') return 'booking';
  if (meta?.ticket_type === 'meal_order' || resolveMealOrderIdFromTicket(row)) {
    return 'meal_order';
  }
  return 'general';
}

export function deriveRoutingPoolKey(ticket: {
  booking_id?: string | null;
  meal_order_id?: string | null;
  category?: string | null;
  metadata?: unknown;
}): RoutingPoolKey {
  const ticketType = deriveTicketTypeForRouting(ticket);
  if (ticketType === 'booking') return 'booking';
  if (ticketType === 'meal_order' || resolveMealOrderIdFromTicket(ticket)) return 'meal_order';

  const category = String(ticket.category || '').trim().toLowerCase();
  if (category === 'account') return 'account';
  if (category === 'billing') return 'billing';

  return 'general';
}
