/**
 * Resolve customer's default address city/state (and optional coordinates)
 * for catalogue / dashboard filtering. Keeps logic small and avoids importing
 * the full service-discovery module from lightweight endpoints.
 */

import { query, select } from '../database/rds-connection';

export type ResolvedCustomerLocation = {
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
};

function normalizePhone(phone: string): string {
  return String(phone || '').replace(/[^0-9+]/g, '');
}

async function resolveCustomerIdFromPhone(phone: string): Promise<string | null> {
  const clean = phone.replace(/[^0-9]/g, '');
  if (clean.length < 10) return null;
  const customers = await select('customers', { phone: clean }, { columns: ['id', 'phone'] });
  if (customers.length > 0) return String((customers[0] as { id: string }).id);
  if (clean.length === 10) {
    const with91 = await select('customers', { phone: `+91${clean}` }, { columns: ['id', 'phone'] });
    if (with91.length > 0) return String((with91[0] as { id: string }).id);
  }
  return null;
}

/**
 * Default address row: city, state, coordinates JSON { lat, lng }.
 */
export async function resolveCustomerDefaultAddressLocation(
  phone?: string | null
): Promise<ResolvedCustomerLocation | null> {
  try {
    const raw = phone ? normalizePhone(phone) : '';
    if (!raw) return null;
    const customerId = await resolveCustomerIdFromPhone(raw);
    if (!customerId) return null;

    const addressResult = await query(
      `SELECT city, state, coordinates
       FROM customer_addresses
       WHERE customer_id::text = $1 AND is_default = true
       LIMIT 1`,
      [customerId]
    ).catch(() => ({ rows: [] as any[] }));

    if (!addressResult.rows?.length) return null;

    const row = addressResult.rows[0];
    let latitude: number | null = null;
    let longitude: number | null = null;
    if (row.coordinates) {
      try {
        const coords = typeof row.coordinates === 'string' ? JSON.parse(row.coordinates) : row.coordinates;
        if (coords?.lat != null && coords?.lng != null) {
          latitude = parseFloat(String(coords.lat));
          longitude = parseFloat(String(coords.lng));
        }
      } catch {
        /* ignore */
      }
    }

    return {
      city: String(row.city || '').trim(),
      state: String(row.state || '').trim(),
      latitude,
      longitude,
    };
  } catch {
    return null;
  }
}
