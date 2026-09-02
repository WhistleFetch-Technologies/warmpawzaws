import { query, withTransaction } from '../../../database/rds-connection';
import type { PoolClient } from 'pg';

export type EventRow = Record<string, unknown>;

export async function dbSelectEventById(eventId: string): Promise<EventRow | null> {
  const result = await query(`SELECT * FROM events WHERE id = $1::uuid`, [eventId]);
  return result.rows[0] || null;
}

export async function dbSelectPublishedEventById(eventId: string): Promise<EventRow | null> {
  const result = await query(
    `SELECT e.*, v.business_name AS vendor_name, v.city AS vendor_city
     FROM events e
     LEFT JOIN vendors v ON e.vendor_id = v.id
     WHERE e.id = $1::uuid
       AND e.status = 'published'
       AND e.approval_status = 'approved'`,
    [eventId]
  );
  return result.rows[0] || null;
}

export async function dbDiscoverPublishedEvents(filters: {
  category?: string;
  city?: string;
  upcoming?: boolean;
}): Promise<EventRow[]> {
  const params: unknown[] = [];
  let sql = `
    SELECT e.*, v.business_name AS vendor_name, v.city AS vendor_city
    FROM events e
    LEFT JOIN vendors v ON e.vendor_id = v.id
    WHERE e.status = 'published'
      AND e.approval_status = 'approved'
      AND (e.vendor_id IS NULL OR (v.status = 'approved' AND v.is_active = true))
  `;
  if (filters.category) {
    params.push(filters.category);
    sql += ` AND e.category = $${params.length}`;
  }
  if (filters.city) {
    params.push(filters.city);
    sql += ` AND v.city = $${params.length}`;
  }
  if (filters.upcoming !== false) {
    sql += ` AND e.event_date >= CURRENT_DATE`;
  }
  sql += ` ORDER BY e.event_date ASC, e.start_time ASC LIMIT 50`;
  const result = await query(sql, params);
  return result.rows;
}

export async function dbListVendorEvents(
  vendorId: string,
  filters: { status?: string; approvalStatus?: string }
): Promise<EventRow[]> {
  const params: unknown[] = [vendorId];
  let sql = `SELECT * FROM events WHERE vendor_id = $1`;
  if (filters.status) {
    params.push(filters.status);
    sql += ` AND status = $${params.length}`;
  }
  if (filters.approvalStatus) {
    params.push(filters.approvalStatus);
    sql += ` AND approval_status = $${params.length}`;
  }
  sql += ` ORDER BY event_date DESC, created_at DESC`;
  const result = await query(sql, params);
  return result.rows;
}

export async function dbInsertEvent(data: Record<string, unknown>): Promise<EventRow> {
  const keys = Object.keys(data);
  const cols = keys.join(', ');
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const result = await query(
    `INSERT INTO events (${cols}) VALUES (${placeholders}) RETURNING *`,
    keys.map((k) => data[k])
  );
  return result.rows[0];
}

export async function dbUpdateEvent(eventId: string, data: Record<string, unknown>): Promise<void> {
  const keys = Object.keys(data);
  if (keys.length === 0) return;
  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  await query(`UPDATE events SET ${sets}, updated_at = NOW() WHERE id = $${keys.length + 1}::uuid`, [
    ...keys.map((k) => data[k]),
    eventId,
  ]);
}

export async function dbListAdminEvents(filters: { status?: string; category?: string }): Promise<EventRow[]> {
  const params: unknown[] = [];
  let sql = `
    SELECT e.*, v.business_name AS vendor_name
    FROM events e
    LEFT JOIN vendors v ON e.vendor_id = v.id
    WHERE 1=1
  `;
  if (filters.status && filters.status !== 'all') {
    params.push(filters.status);
    sql += ` AND e.status = $${params.length}`;
  }
  if (filters.category) {
    params.push(filters.category);
    sql += ` AND e.category = $${params.length}`;
  }
  sql += ` ORDER BY e.event_date DESC, e.start_time DESC LIMIT 100`;
  const result = await query(sql, params);
  return result.rows;
}

export async function dbListPendingEvents(): Promise<EventRow[]> {
  const result = await query(
    `SELECT e.*, v.business_name AS vendor_name, v.city AS vendor_city
     FROM events e
     LEFT JOIN vendors v ON e.vendor_id = v.id
     WHERE e.approval_status = 'pending'
     ORDER BY e.created_at ASC`
  );
  return result.rows;
}

export async function dbLockEventForCapacity(
  client: PoolClient,
  eventId: string
): Promise<EventRow | null> {
  const result = await client.query(`SELECT * FROM events WHERE id = $1::uuid FOR UPDATE`, [eventId]);
  return result.rows[0] || null;
}

export async function dbIncrementAttendees(
  client: PoolClient,
  eventId: string,
  delta: number
): Promise<void> {
  await client.query(
    `UPDATE events SET current_attendees = GREATEST(COALESCE(current_attendees, 0) + $2, 0), updated_at = NOW()
     WHERE id = $1::uuid`,
    [eventId, delta]
  );
}

export { withTransaction };
