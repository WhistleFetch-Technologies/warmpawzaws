import type { Context } from 'hono';
import * as customer_customerid_addresses_getRepo from '../repos/customer_customerid_addresses_get.repo';
import { Hono } from 'hono';
import { findCustomerByPhone } from '../../../../utils/customer-phone-lookup';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';

export async function executecustomerCustomeridAddressesGet(c: Context) {
    try {
      const { customerId } = c.req.param();

      // Resolve customer ID (could be UUID or phone)
      let customer = await customer_customerid_addresses_getRepo.dbCustomerCustomeridAddressesGet0(customerId)
      if (customer.length === 0) {
        customer = await customer_customerid_addresses_getRepo.dbCustomerCustomeridAddressesGet1(customerId)
      }
      if (customer.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const addresses = await customer_customerid_addresses_getRepo.dbCustomerCustomeridAddressesGet2(customer).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        addresses: addresses.rows.map(mapAddressRow),
      });
    } catch (error: any) {
      console.error('Error fetching addresses:', error);
      return c.json({ error: error.message }, 500);
    }
}