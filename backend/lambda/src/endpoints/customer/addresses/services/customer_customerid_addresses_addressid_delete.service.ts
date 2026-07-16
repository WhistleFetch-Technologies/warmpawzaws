import type { Context } from 'hono';
import * as customer_customerid_addresses_addressid_deleteRepo from '../repos/customer_customerid_addresses_addressid_delete.repo';
import { Hono } from 'hono';
import { findCustomerByPhone } from '../../../../utils/customer-phone-lookup';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';

export async function executecustomerCustomeridAddressesAddressidDelete(c: Context) {
    try {
      const { customerId, addressId } = c.req.param();

      // Resolve customer ID
      let customer = await customer_customerid_addresses_addressid_deleteRepo.dbCustomerCustomeridAddressesAddressidDelete0(customerId)
      if (customer.length === 0) {
        customer = await customer_customerid_addresses_addressid_deleteRepo.dbCustomerCustomeridAddressesAddressidDelete1(customerId)
      }
      if (customer.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      await customer_customerid_addresses_addressid_deleteRepo.dbCustomerCustomeridAddressesAddressidDelete2(addressId, customer)

      return c.json({
        success: true,
        message: 'Address deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting address:', error);
      return c.json({ error: error.message }, 500);
    }
}