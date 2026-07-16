import type { Context } from 'hono';
import * as customer_addresses_addressid_getRepo from '../repos/customer_addresses_addressid_get.repo';
import { Hono } from 'hono';
import { findCustomerByPhone } from '../../../../utils/customer-phone-lookup';
import { coordsFromRow } from '../repos/module-helpers.repo';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';

export async function executecustomerAddressesAddressidGet(c: Context) {
    try {
      const { addressId } = c.req.param();
      if (!isValidUUID(addressId)) {
        return c.json({ error: 'Invalid address id', success: false }, 400);
      }
      const addresses = await customer_addresses_addressid_getRepo.dbCustomerAddressesAddressidGet0(addressId).catch(() => ({ rows: [] }));
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