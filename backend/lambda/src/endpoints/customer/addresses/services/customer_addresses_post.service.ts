import type { Context } from 'hono';
import * as customer_addresses_postRepo from '../repos/customer_addresses_post.repo';
import { Hono } from 'hono';
import { findCustomerByPhone } from '../../../../utils/customer-phone-lookup';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';

export async function executecustomerAddressesPost(c: Context) {
    try {
      const body = await c.req.json();

      // Support legacy format where body contains { phone, addresses: [...] }
      // Also support new format where body contains individual address fields + phone
      let customerPhone: string | undefined;
      let addressData: any;

      if (body.phone && body.addresses && Array.isArray(body.addresses)) {
        // Legacy format: { phone, addresses: [...] }
        // Take the last address from the array (most recent)
        customerPhone = body.phone;
        const addressesArray = body.addresses;
        const lastAddress = addressesArray[addressesArray.length - 1];

        // Extract individual fields from address object
        addressData = {
          label: lastAddress.label || lastAddress.addressType || 'home',
          name: lastAddress.name || lastAddress.fullName,
          phone: lastAddress.phone || customerPhone,
          addressLine1: lastAddress.addressLine1 || lastAddress.address_line1 || lastAddress.address?.split(',')[0],
          addressLine2: lastAddress.addressLine2 || lastAddress.address_line2 || (lastAddress.address?.split(',').slice(1).join(',').trim() || null),
          city: lastAddress.city,
          state: lastAddress.state,
          pincode: lastAddress.pincode || lastAddress.pincode,
          landmark: lastAddress.landmark || null,
          coordinates: lastAddress.coordinates || null,
          latitude: lastAddress.latitude,
          longitude: lastAddress.longitude,
          isDefault: lastAddress.isDefault !== undefined ? lastAddress.isDefault : (addressesArray.length === 1),
        };
      } else {
        // New format: individual fields in body with phone
        customerPhone = body.phone;
        addressData = {
          label: body.label || 'home',
          name: body.name || body.fullName,
          phone: body.phone || customerPhone,
          addressLine1: body.addressLine1 || body.address_line1,
          addressLine2: body.addressLine2 || body.address_line2 || null,
          city: body.city,
          state: body.state,
          pincode: body.pincode,
          landmark: body.landmark || null,
          coordinates: body.coordinates || null,
          latitude: body.latitude,
          longitude: body.longitude,
          flatNo: body.flatNo ?? body.flat_no ?? null,
          houseNo: body.houseNo ?? body.house_no ?? null,
          floor: body.floor ?? null,
          streetName: body.streetName ?? body.street_name ?? null,
          apartmentName: body.apartmentName ?? body.apartment_name ?? null,
          isDefault: body.isDefault !== undefined ? body.isDefault : false,
        };
      }

      if (!customerPhone) {
        return c.json({ error: 'phone is required' }, 400);
      }

      // ✅ FIX B5: More flexible validation - name optional (default 'Customer'), addressLine1/city/state/pincode required
      const name = (addressData.name || addressData.fullName || body.name || body.fullName || '').trim() || 'Customer';

      // ✅ FIX B5: Handle address field variations - addressLine1, address_line1, or address
      let addressLine1 = addressData.addressLine1 || addressData.address_line1 || body.addressLine1 || body.address_line1;
      if (!addressLine1 && body.address) {
        addressLine1 = typeof body.address === 'string' ? body.address.split(',')[0].trim() : body.address;
      }

      const phone = addressData.phone || body.phone || customerPhone;

      if (!phone || !addressLine1 || !addressData.city || !addressData.state || !addressData.pincode) {
        const missingFields = [];
        if (!phone) missingFields.push('phone');
        if (!addressLine1) missingFields.push('addressLine1');
        if (!addressData.city) missingFields.push('city');
        if (!addressData.state) missingFields.push('state');
        if (!addressData.pincode) missingFields.push('pincode');

        console.error('Address validation failed. Missing fields:', missingFields);
        return c.json({
          error: `Missing required fields: ${missingFields.join(', ')}`,
          missingFields,
        }, 400);
      }

      addressData.name = name;
      addressData.phone = phone;
      addressData.addressLine1 = addressLine1;

      // Resolve customer ID from phone (+91/plain/normalized supported)
      const customer = await findCustomerByPhone(customerPhone);
      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Check if first address (auto-default)
      const existingAddresses = await customer_addresses_postRepo.dbCustomerAddressesPost0(customer).catch(() => ({ rows: [{ count: '0' }] }));

      const shouldBeDefault = addressData.isDefault || parseInt(existingAddresses.rows[0]?.count || '0', 10) === 0;

      // If setting as default, unset all others
      if (shouldBeDefault) {
        await customer_addresses_postRepo.dbCustomerAddressesPost1(customer).catch(() => { });
      }

      // ✅ FIX: Process coordinates - normalize format and geocode if missing
      let finalCoordinates = normalizeCoordinates(addressData.coordinates);

      // If coordinates are missing, geocode the address
      if (!finalCoordinates && addressData.addressLine1 && addressData.city && addressData.state && addressData.pincode) {
        finalCoordinates = await geocodeAddress(
          addressData.addressLine1,
          addressData.city,
          addressData.state,
          addressData.pincode,
          addressData.addressLine2
        );
      }

      finalCoordinates = ensureCoordinatesJson(
        finalCoordinates,
        (addressData as any).latitude ?? body.latitude,
        (addressData as any).longitude ?? body.longitude
      );

      const { latitude: rowLat, longitude: rowLng } = resolveLatLngForRow(
        finalCoordinates,
        (addressData as any).latitude ?? body.latitude,
        (addressData as any).longitude ?? body.longitude
      );

      // ✅ FIX: Create address with better error handling
      let address;
      try {
        const insertPayload: Record<string, unknown> = {
          customer_id: customer.id,
          address_type: addressData.label || 'home',
          full_name: addressData.name,
          phone: addressData.phone,
          address_line1: addressData.addressLine1,
          address_line2: addressData.addressLine2 || null,
          city: (addressData.city || '').replace(/\s*\d{6}\s*$/, '').trim(),
          state: (addressData.state || '').replace(/\s*\d{6}\s*$/, '').trim(),
          pincode: addressData.pincode,
          landmark: addressData.landmark || null,
          coordinates: finalCoordinates,
          flat_no: addressData.flatNo || null,
          house_no: addressData.houseNo || null,
          floor: addressData.floor || null,
          street_name: addressData.streetName || null,
          apartment_name: addressData.apartmentName || null,
          is_default: shouldBeDefault,
        };
        if (await hasCustomerAddressLatLngColumns()) {
          insertPayload.latitude = rowLat;
          insertPayload.longitude = rowLng;
        }
        address = await customer_addresses_postRepo.dbCustomerAddressesPost2(insertPayload)
      } catch (insertError: any) {
        console.error('Error inserting address:', insertError);
        console.error('Address data:', JSON.stringify({
          customer_id: customer.id,
          address_type: addressData.label || 'home',
          full_name: addressData.name,
          phone: addressData.phone,
          address_line1: addressData.addressLine1,
          address_line2: addressData.addressLine2 || null,
          city: addressData.city,
          state: addressData.state,
          pincode: addressData.pincode,
          landmark: addressData.landmark || null,
          coordinates: addressData.coordinates,
          is_default: shouldBeDefault,
        }, null, 2));
        return c.json({
          error: `Error saving address: ${insertError.message || 'Database error'}`,
          details: insertError.message
        }, 500);
      }

      // Get all addresses
      const allAddresses = await customer_addresses_postRepo.dbCustomerAddressesPost3(customer).catch(() => ({ rows: [] }));

      const created = address?.[0] || allAddresses.rows?.[0];
      return c.json({
        success: true,
        address: created ? mapAddressRow(created) : null,
        addresses: allAddresses.rows.map((addr: any) => mapAddressRow(addr)),
      });
    } catch (error: any) {
      console.error('Error adding address:', error);
      return c.json({ error: error.message }, 500);
    }
}