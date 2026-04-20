/**
 * Resolve customer default-address coordinates for discovery / AI booking flows.
 */

import { select, query } from '../database/rds-connection';

/** Resolve customer ID from phone (same rules as legacy discovery helper). */
export async function resolveCustomerIdFromPhone(phone: string): Promise<string | null> {
  if (!phone || typeof phone !== 'string') return null;
  const clean = phone.replace(/[^0-9]/g, '');
  if (clean.length < 10) return null;
  const customers = await select('customers', { phone: clean }, { columns: ['id', 'phone'] });
  if (customers.length > 0) return (customers[0] as { id: string }).id;
  if (clean.length === 10) {
    const with91 = await select('customers', { phone: `+91${clean}` }, { columns: ['id', 'phone'] });
    if (with91.length > 0) return (with91[0] as { id: string }).id;
  }
  return null;
}

/**
 * Customer coordinates from default address (customer_addresses.coordinates JSON: lat/lng).
 */
export async function getCustomerCoordinates(
  customerPhone?: string | null,
  customerId?: string | null
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    let resolvedCustomerId: string | null = customerId || null;
    if (resolvedCustomerId === null && customerPhone) {
      resolvedCustomerId = await resolveCustomerIdFromPhone(customerPhone);
    }
    if (!resolvedCustomerId) {
      console.warn('[getCustomerCoordinates] No customerId resolved', { customerPhone, customerId });
      return null;
    }

    const addressResult = await query(
      `SELECT coordinates 
       FROM customer_addresses 
       WHERE customer_id = $1 AND is_default = true 
       LIMIT 1`,
      [resolvedCustomerId]
    );

    if (addressResult.rows.length === 0) {
      console.warn('[getCustomerCoordinates] No default address found', { customerId: resolvedCustomerId });
      return null;
    }

    const addr = addressResult.rows[0] as { coordinates?: unknown };
    let latitude: number | null = null;
    let longitude: number | null = null;

    if (addr.coordinates) {
      try {
        const coords =
          typeof addr.coordinates === 'string' ? JSON.parse(addr.coordinates) : addr.coordinates;
        if (coords?.lat != null && coords?.lng != null) {
          latitude = parseFloat(String(coords.lat));
          longitude = parseFloat(String(coords.lng));
        }
      } catch (e) {
        console.warn('[getCustomerCoordinates] Failed to parse coordinates JSON', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (latitude != null && longitude != null && !Number.isNaN(latitude) && !Number.isNaN(longitude)) {
      return { latitude, longitude };
    }

    console.warn('[getCustomerCoordinates] Could not extract valid coordinates', {
      customerId: resolvedCustomerId,
      hasCoordinates: !!addr.coordinates,
    });

    return null;
  } catch (error) {
    console.error('[getCustomerCoordinates] Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
      customerPhone,
      customerId,
    });
    return null;
  }
}
