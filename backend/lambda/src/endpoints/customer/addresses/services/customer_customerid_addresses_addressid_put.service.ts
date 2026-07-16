import type { Context } from 'hono';
import * as customer_customerid_addresses_addressid_putRepo from '../repos/customer_customerid_addresses_addressid_put.repo';
import { Hono } from 'hono';
import { findCustomerByPhone } from '../../../../utils/customer-phone-lookup';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';

export async function executecustomerCustomeridAddressesAddressidPut(c: Context) {
    try {
      const { customerId, addressId } = c.req.param();
      const updates = await c.req.json();

      // Resolve customer ID
      let customer = await customer_customerid_addresses_addressid_putRepo.dbCustomerCustomeridAddressesAddressidPut0(customerId)
      if (customer.length === 0) {
        customer = await customer_customerid_addresses_addressid_putRepo.dbCustomerCustomeridAddressesAddressidPut1(customerId)
      }
      if (customer.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const nextLine1 = updates.addressLine1 ?? updates.address_line1;
      if (nextLine1 !== undefined && String(nextLine1).trim()) {
        const hn = updates.houseNo ?? updates.house_no;
        if (!String(hn || '').trim()) {
          return c.json({ error: 'House / flat number is required' }, 400);
        }
      }

      // If setting as default, unset all others
      if (updates.isDefault) {
        await customer_customerid_addresses_addressid_putRepo.dbCustomerCustomeridAddressesAddressidPut2(customer).catch(() => { });
      }

      // ✅ FIX: Process coordinates - normalize format and geocode if missing
      let finalCoordinates = normalizeCoordinates(updates.coordinates);

      // If coordinates are missing, geocode the address
      if (!finalCoordinates) {
        const existingRows = await customer_customerid_addresses_addressid_putRepo.dbCustomerCustomeridAddressesAddressidPut3(address_line2, city, state, pincode).catch(() => ({ rows: [] }));
        const existing = existingRows.rows?.[0] || {};
        const addressLine1 = updates.addressLine1 || updates.address_line1 || existing.address_line1;
        const city = updates.city || existing.city;
        const state = updates.state || existing.state;
        const pincode = updates.pincode || existing.pincode;
        const addressLine2 = updates.addressLine2 || updates.address_line2 || existing.address_line2;

        if (addressLine1 && city && state && pincode) {
          finalCoordinates = await geocodeAddress(
            addressLine1,
            city,
            state,
            pincode,
            addressLine2
          );
        }
        if (!finalCoordinates && existing.coordinates) {
          finalCoordinates = normalizeCoordinates(existing.coordinates);
        }
      }

      const explicitGeo =
        'coordinates' in updates || 'latitude' in updates || 'longitude' in updates;
      const shouldUpdateGeoColumns = explicitGeo || finalCoordinates != null;

      const { latitude: putLat, longitude: putLng } = resolveLatLngForRow(
        finalCoordinates,
        updates.latitude,
        updates.longitude
      );

      const updatePayload: Record<string, any> = {
        address_type: updates.label || updates.address_type,
        full_name: updates.name || updates.full_name,
        phone: updates.phone,
        address_line1: updates.addressLine1 || updates.address_line1,
        address_line2: updates.addressLine2 || updates.address_line2,
        city: updates.city != null ? (updates.city as string).replace(/\s*\d{6}\s*$/, '').trim() : updates.city,
        state: updates.state != null ? (updates.state as string).replace(/\s*\d{6}\s*$/, '').trim() : updates.state,
        pincode: updates.pincode,
        landmark: updates.landmark,
        is_default: updates.isDefault !== undefined ? updates.isDefault : updates.is_default,
      };
      if (shouldUpdateGeoColumns) {
        updatePayload.coordinates = ensureCoordinatesJson(
          finalCoordinates,
          updates.latitude,
          updates.longitude
        );
      }
      if (shouldUpdateGeoColumns && (await hasCustomerAddressLatLngColumns())) {
        updatePayload.latitude = putLat;
        updatePayload.longitude = putLng;
      }
      if (updates.flatNo !== undefined || updates.flat_no !== undefined) updatePayload.flat_no = updates.flatNo ?? updates.flat_no;
      if (updates.houseNo !== undefined || updates.house_no !== undefined) updatePayload.house_no = updates.houseNo ?? updates.house_no;
      if (updates.floor !== undefined) updatePayload.floor = updates.floor;
      if (updates.streetName !== undefined || updates.street_name !== undefined) updatePayload.street_name = updates.streetName ?? updates.street_name;
      if (updates.apartmentName !== undefined || updates.apartment_name !== undefined) updatePayload.apartment_name = updates.apartmentName ?? updates.apartment_name;
      const updated = await customer_customerid_addresses_addressid_putRepo.dbCustomerCustomeridAddressesAddressidPut4(addressId, customer, updatePayload)

      if (updated.length === 0) {
        return c.json({ error: 'Address not found' }, 404);
      }

      return c.json({
        success: true,
        address: mapAddressRow(updated[0]),
      });
    } catch (error: any) {
      console.error('Error updating address:', error);
      return c.json({ error: error.message }, 500);
    }
}