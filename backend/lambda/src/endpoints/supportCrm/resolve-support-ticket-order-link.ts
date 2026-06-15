import { query } from '../../database/rds-connection';

export type SupportTicketOrderLink =
  | { kind: 'none'; orderId: null; mealOrderId: null }
  | { kind: 'orders'; orderId: string; mealOrderId: null }
  | { kind: 'meal_orders'; orderId: null; mealOrderId: string }
  | { kind: 'error'; error: string };

/**
 * Meal plan rows live in meal_orders (or legacy orders with meal type).
 * support_tickets.order_id FK references orders(id) only — never set order_id for meal_orders ids.
 */
export async function resolveSupportTicketOrderLink(
  rawOrderId: string | null | undefined,
  ticketType?: string | null,
): Promise<SupportTicketOrderLink> {
  const id = String(rawOrderId || '').trim();
  if (!id) {
    return { kind: 'none', orderId: null, mealOrderId: null };
  }

  const mealResult = await query(
    `SELECT id FROM meal_orders
     WHERE id::text = $1 OR order_number = $1
     LIMIT 1`,
    [id],
  ).catch(() => ({ rows: [] as { id: string }[] }));

  if (mealResult.rows.length > 0) {
    return {
      kind: 'meal_orders',
      orderId: null,
      mealOrderId: String(mealResult.rows[0].id),
    };
  }

  const orderResult = await query(
    `SELECT id FROM orders
     WHERE id::text = $1 OR order_number = $1
     LIMIT 1`,
    [id],
  ).catch(() => ({ rows: [] as { id: string }[] }));

  if (orderResult.rows.length > 0) {
    return {
      kind: 'orders',
      orderId: String(orderResult.rows[0].id),
      mealOrderId: null,
    };
  }

  if (ticketType === 'meal_order') {
    return { kind: 'error', error: 'Meal order not found for this support ticket' };
  }

  return { kind: 'error', error: 'Order not found for this support ticket' };
}
