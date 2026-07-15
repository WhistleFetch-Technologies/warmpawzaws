import type { Context } from 'hono';
/**
 * ============================================================================
 * ADDRESS MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles customer address management:
 * - Get customer addresses
 * - Add/update/delete addresses
 * - Set default address
 * 
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../../../../database/rds-connection';
import { findCustomerByPhone } from '../../../../utils/customer-phone-lookup';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';

export async function customerAddressesAddressidGetHandler(c: Context) {
    try {
      const { addressId } = c.req.param();
      if (!isValidUUID(addressId)) {
        return c.json({ error: 'Invalid address id', success: false }, 400);
      }
      const addresses = await query(
        `SELECT * FROM customer_addresses WHERE id = $1`,
        [addressId]
      ).catch(() => ({ rows: [] }));
      if (addresses.rows.length === 0) {
        return c.json({ error: 'Address not found' }, 404);
      }
      const addr = addresses.rows[0] as any;
      const { latitude, longitude } = coordsFromRow(addr);
      return c.json({
        success: true,
        address: {
          id: addr.id,
          customerId: addr.customer_id,
          addressLine1: addr.address_line1,
          addressLine2: addr.address_line2,
          city: addr.city,
          state: addr.state,
          pincode: addr.pincode,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          coordinates: addr.coordinates,
        },
      });
    } catch (error: any) {
      console.error('Error fetching address:', error);
      return c.json({ error: error.message }, 500);
    }
}
