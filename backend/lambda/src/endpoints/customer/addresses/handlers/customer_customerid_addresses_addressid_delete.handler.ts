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

export async function customerCustomeridAddressesAddressidDeleteHandler(c: Context) {
    try {
      const { customerId, addressId } = c.req.param();

      // Resolve customer ID
      let customer = await select('customers', { id: customerId });
      if (customer.length === 0) {
        customer = await select('customers', { phone: customerId });
      }
      if (customer.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      await query(
        'DELETE FROM customer_addresses WHERE id = $1 AND customer_id = $2',
        [addressId, customer[0].id]
      );

      return c.json({
        success: true,
        message: 'Address deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting address:', error);
      return c.json({ error: error.message }, 500);
    }
}
