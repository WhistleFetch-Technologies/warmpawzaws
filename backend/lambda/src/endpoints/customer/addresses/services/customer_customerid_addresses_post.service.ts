import type { Context } from 'hono';
import * as customer_customerid_addresses_postRepo from '../repos/customer_customerid_addresses_post.repo';
import { Hono } from 'hono';
import { findCustomerByPhone } from '../../../../utils/customer-phone-lookup';
import {
  mapAddressRow,
  hasCustomerAddressLatLngColumns,
  normalizeCoordinates,
  geocodeAddress,
  resolveLatLngForRow,
  ensureCoordinatesJson,
  normalizeAddressType,
} from '../repos/module-helpers.repo';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';

export async function executecustomerCustomeridAddressesPost(c: Context) {
    try {
      const { customerId } = c.req.param();
      const body = await c.req.json();
      const {
        label,
        name,
        phone,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        coordinates,
        latitude: bodyLat,
        longitude: bodyLng,
        isDefault = false,
      } = body;
      const flatNo = body.flatNo ?? body.flat_no ?? null;
      const houseNo = body.houseNo ?? body.house_no ?? null;
      const floor = body.floor ?? null;
      const streetName = body.streetName ?? body.street_name ?? null;
      const apartmentName = body.apartmentName ?? body.apartment_name ?? null;

      if (!name || !phone || !addressLine1 || !city || !state || !pincode) {
        return c.json({ error: 'name, phone, addressLine1, city, state, and pincode are required' }, 400);
      }

      if (!String(houseNo || '').trim()) {
        return c.json({ error: 'House / flat number is required' }, 400);
      }

      // Resolve customer ID
      let customer = await customer_customerid_addresses_postRepo.dbCustomerCustomeridAddressesPost0(customerId)
      if (customer.length === 0) {
        customer = await customer_customerid_addresses_postRepo.dbCustomerCustomeridAddressesPost1(customerId)
      }
      if (customer.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Check if first address (auto-default)
      const existingAddresses = await customer_customerid_addresses_postRepo.dbCustomerCustomeridAddressesPost2(customer).catch(() => ({ rows: [{ count: '0' }] }));

      const shouldBeDefault = isDefault || parseInt(existingAddresses.rows[0]?.count || '0', 10) === 0;

      // If setting as default, unset all others
      if (shouldBeDefault) {
        await customer_customerid_addresses_postRepo.dbCustomerCustomeridAddressesPost3(customer).catch(() => { });
      }

      // ✅ FIX: Process coordinates - normalize format and geocode if missing
      let finalCoordinates = normalizeCoordinates(coordinates);

      // If coordinates are missing, geocode the address
      if (!finalCoordinates && addressLine1 && city && state && pincode) {
        finalCoordinates = await geocodeAddress(
          addressLine1,
          city,
          state,
          pincode,
          addressLine2
        );
      }

      finalCoordinates = ensureCoordinatesJson(finalCoordinates, bodyLat, bodyLng);

      const { latitude: rowLat2, longitude: rowLng2 } = resolveLatLngForRow(
        finalCoordinates,
        bodyLat,
        bodyLng
      );

      // Create address
      const insertPayload: Record<string, unknown> = {
        customer_id: customer[0].id,
        address_type: normalizeAddressType(label),
        full_name: name,
        phone: phone,
        address_line1: addressLine1,
        address_line2: addressLine2 || null,
        city: (city || '').replace(/\s*\d{6}\s*$/, '').trim(),
        state: (state || '').replace(/\s*\d{6}\s*$/, '').trim(),
        pincode: pincode,
        landmark: null,
        coordinates: finalCoordinates,
        flat_no: flatNo,
        house_no: String(houseNo).trim(),
        floor: floor,
        street_name: streetName,
        apartment_name: apartmentName,
        is_default: shouldBeDefault,
      };
      if (await hasCustomerAddressLatLngColumns()) {
        insertPayload.latitude = rowLat2;
        insertPayload.longitude = rowLng2;
      }
      const address = await customer_customerid_addresses_postRepo.dbCustomerCustomeridAddressesPost4(insertPayload)

      // Get all addresses
      const allAddresses = await customer_customerid_addresses_postRepo.dbCustomerCustomeridAddressesPost5(customer).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        address: address[0] ? mapAddressRow(address[0]) : null,
        addresses: allAddresses.rows.map(mapAddressRow),
      });
    } catch (error: any) {
      console.error('Error adding address:', error);
      return c.json({ error: error.message }, 500);
    }
}