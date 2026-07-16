import type { Context } from 'hono';
import * as customer_addresses_getRepo from '../repos/customer_addresses_get.repo';
import { Hono } from 'hono';
import { findCustomerByPhone } from '../../../../utils/customer-phone-lookup';
import { mapAddressRow } from '../repos/module-helpers.repo';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';

export async function executecustomerAddressesGet(c: Context) {
    try {
      const phone = c.req.query('phone');

      if (!phone) {
        return c.json({ error: 'phone parameter is required' }, 400);
      }

      // Resolve customer ID from phone (+91/plain/normalized supported)
      const customer = await findCustomerByPhone(phone);
      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const addresses = await customer_addresses_getRepo.dbCustomerAddressesGet0(customer).catch(() => ({ rows: [] }));

      let list: any = addresses.rows.map(mapAddressRow);

      // When no saved addresses exist, use profile address/pincode so checkout doesn't block
      const cust = customer as any;
      if (list.length === 0 && (cust?.address || cust?.pincode)) {
        const plat = cust?.latitude != null ? Number(cust.latitude) : NaN;
        const plng = cust?.longitude != null ? Number(cust.longitude) : NaN;
        const profileCoords =
          Number.isFinite(plat) && Number.isFinite(plng)
            ? { lat: plat, lng: plng }
            : null;
        list = [{
          id: 'profile',
          customerId: cust.id,
          label: 'home',
          name: cust.full_name || '',
          phone: cust.phone || '',
          addressLine1: cust.address || '',
          addressLine2: null,
          city: cust.city || '',
          state: cust.state || '',
          pincode: cust.pincode || '',
          landmark: null,
          houseNo: cust.house_no ?? undefined,
          floor: cust.floor ?? undefined,
          coordinates: profileCoords,
          latitude: Number.isFinite(plat) ? plat : undefined,
          longitude: Number.isFinite(plng) ? plng : undefined,
          isDefault: true,
          createdAt: null,
          updatedAt: null,
        }];
      }

      return c.json({
        success: true,
        addresses: list,
      });
    } catch (error: any) {
      console.error('Error fetching addresses:', error);
      return c.json({ error: error.message }, 500);
    }
}