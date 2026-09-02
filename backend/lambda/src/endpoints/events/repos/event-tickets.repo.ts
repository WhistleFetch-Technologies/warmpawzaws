import { query } from '../../../database/rds-connection';
import type { PoolClient } from 'pg';

export type TicketRow = Record<string, unknown>;

export async function dbInsertTickets(
  client: PoolClient,
  tickets: Array<Record<string, unknown>>
): Promise<TicketRow[]> {
  const inserted: TicketRow[] = [];
  for (const ticket of tickets) {
    const keys = Object.keys(ticket);
    const cols = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const result = await client.query(
      `INSERT INTO event_registration_tickets (${cols}) VALUES (${placeholders}) RETURNING *`,
      keys.map((k) => ticket[k])
    );
    inserted.push(result.rows[0]);
  }
  return inserted;
}

export async function dbListTicketsForRegistration(registrationId: string): Promise<TicketRow[]> {
  const result = await query(
    `SELECT * FROM event_registration_tickets WHERE registration_id = $1::uuid ORDER BY ticket_index ASC`,
    [registrationId]
  );
  return result.rows;
}

export async function dbListTicketsForRegistrations(registrationIds: string[]): Promise<TicketRow[]> {
  if (registrationIds.length === 0) return [];
  const result = await query(
    `SELECT * FROM event_registration_tickets
     WHERE registration_id = ANY($1::uuid[])
     ORDER BY registration_id, ticket_index ASC`,
    [registrationIds]
  );
  return result.rows;
}

export async function dbActivateTicketTokens(
  client: PoolClient,
  tickets: Array<{ id: string; qr_token: string }>
): Promise<void> {
  for (const ticket of tickets) {
    await client.query(
      `UPDATE event_registration_tickets SET qr_token = $2, updated_at = NOW() WHERE id = $1::uuid AND qr_token IS NULL`,
      [ticket.id, ticket.qr_token]
    );
  }
}

export async function dbInvalidateTicketTokens(client: PoolClient, registrationId: string): Promise<void> {
  await client.query(
    `UPDATE event_registration_tickets
     SET qr_token = NULL, updated_at = NOW()
     WHERE registration_id = $1::uuid AND check_in_status <> 'checked_in'`,
    [registrationId]
  );
}

export async function dbFindTicketByToken(qrToken: string): Promise<TicketRow | null> {
  const result = await query(
    `SELECT t.*, r.event_id, r.vendor_id, r.customer_id, r.payment_status, r.status AS registration_status,
            r.booking_reference, e.name AS event_name, e.vendor_id AS event_vendor_id
     FROM event_registration_tickets t
     INNER JOIN event_registrations r ON r.id = t.registration_id
     INNER JOIN events e ON e.id = r.event_id
     WHERE t.qr_token = $1`,
    [qrToken]
  );
  return result.rows[0] || null;
}

export async function dbLockTicket(client: PoolClient, ticketId: string): Promise<TicketRow | null> {
  const result = await client.query(
    `SELECT t.*, r.event_id, r.vendor_id, r.payment_status, r.status AS registration_status, e.vendor_id AS event_vendor_id
     FROM event_registration_tickets t
     INNER JOIN event_registrations r ON r.id = t.registration_id
     INNER JOIN events e ON e.id = r.event_id
     WHERE t.id = $1::uuid
     FOR UPDATE OF t`,
    [ticketId]
  );
  return result.rows[0] || null;
}

export async function dbMarkTicketCheckedIn(
  client: PoolClient,
  ticketId: string,
  checkedInBy: string
): Promise<void> {
  await client.query(
    `UPDATE event_registration_tickets
     SET check_in_status = 'checked_in', check_in_time = NOW(), checked_in_by = $2, updated_at = NOW()
     WHERE id = $1::uuid`,
    [ticketId, checkedInBy]
  );
}
