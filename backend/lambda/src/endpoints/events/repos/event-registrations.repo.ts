import { query } from '../../../database/rds-connection';
import type { PoolClient } from 'pg';

export type RegistrationRow = Record<string, unknown>;

export async function dbInsertRegistration(
  client: PoolClient,
  data: Record<string, unknown>
): Promise<RegistrationRow> {
  const keys = Object.keys(data);
  const cols = keys.join(', ');
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const result = await client.query(
    `INSERT INTO event_registrations (${cols}) VALUES (${placeholders}) RETURNING *`,
    keys.map((k) => data[k])
  );
  return result.rows[0];
}

export async function dbSelectRegistrationById(id: string): Promise<RegistrationRow | null> {
  const result = await query(
    `SELECT r.*, e.name AS event_name, e.event_date, e.start_time, e.end_time,
            e.venue, e.category, e.vendor_id AS event_vendor_id,
            v.business_name AS vendor_name
     FROM event_registrations r
     INNER JOIN events e ON r.event_id = e.id
     LEFT JOIN vendors v ON e.vendor_id = v.id
     WHERE r.id = $1::uuid`,
    [id]
  );
  return result.rows[0] || null;
}

export async function dbLockRegistration(client: PoolClient, id: string): Promise<RegistrationRow | null> {
  const result = await client.query(`SELECT * FROM event_registrations WHERE id = $1::uuid FOR UPDATE`, [id]);
  return result.rows[0] || null;
}

export async function dbCountActiveTicketsForEvent(client: PoolClient, eventId: string): Promise<number> {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM event_registration_tickets t
     INNER JOIN event_registrations r ON r.id = t.registration_id
     WHERE r.event_id = $1::uuid
       AND r.status IN ('confirmed', 'pending_payment')`,
    [eventId]
  );
  return parseInt(String(result.rows[0]?.count || '0'), 10);
}

export async function dbListCustomerRegistrations(customerId: string): Promise<RegistrationRow[]> {
  const result = await query(
    `SELECT r.*, e.name AS event_title, e.event_date, e.start_time, e.end_time, e.venue, e.category
     FROM event_registrations r
     INNER JOIN events e ON r.event_id = e.id
     WHERE r.customer_id = $1::uuid
     ORDER BY e.event_date DESC, e.start_time DESC`,
    [customerId]
  );
  return result.rows;
}

export async function dbListEventRegistrations(eventId: string): Promise<RegistrationRow[]> {
  const result = await query(
    `SELECT r.*, c.name AS customer_name, c.phone AS customer_phone
     FROM event_registrations r
     LEFT JOIN customers c ON r.customer_id = c.id
     WHERE r.event_id = $1::uuid
     ORDER BY r.created_at DESC`,
    [eventId]
  );
  return result.rows;
}

export async function dbUpdateRegistration(
  client: PoolClient | null,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  const keys = Object.keys(data);
  if (keys.length === 0) return;
  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const sql = `UPDATE event_registrations SET ${sets}, updated_at = NOW() WHERE id = $${keys.length + 1}::uuid`;
  const params = [...keys.map((k) => data[k]), id];
  if (client) {
    await client.query(sql, params);
    return;
  }
  await query(sql, params);
}

export async function dbSelectCustomerById(customerId: string): Promise<Record<string, unknown> | null> {
  const result = await query(`SELECT id, name, full_name, phone, email FROM customers WHERE id = $1::uuid`, [
    customerId,
  ]);
  return result.rows[0] || null;
}

export async function dbSelectPetsByCustomer(customerId: string): Promise<Record<string, unknown>[]> {
  const result = await query(`SELECT * FROM pets WHERE customer_id = $1::uuid ORDER BY created_at ASC`, [
    customerId,
  ]);
  return result.rows;
}

export async function dbSelectPetOwned(petId: string, customerId: string): Promise<Record<string, unknown> | null> {
  const result = await query(`SELECT * FROM pets WHERE id = $1::uuid AND customer_id = $2::uuid`, [
    petId,
    customerId,
  ]);
  return result.rows[0] || null;
}
