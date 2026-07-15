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

export async function customerCustomeridAddressesGetHandler(c: Context) {
    try {
      const { customerId } = c.req.param();

      // Resolve customer ID (could be UUID or phone)
      let customer = await select('customers', { id: customerId });
      if (customer.length === 0) {
        customer = await select('customers', { phone: customerId });
      }
      if (customer.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const addresses = await query(
        `SELECT * FROM customer_addresses
         WHERE customer_id = $1
         ORDER BY is_default DESC, created_at DESC`,
        [customer[0].id]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        addresses: addresses.rows.map(mapAddressRow),
      });
    } catch (error: any) {
      console.error('Error fetching addresses:', error);
      return c.json({ error: error.message }, 500);
    }
}
