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
import { select, insert, update, query } from '../../../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';

export function registerAddressEndpoints(app: Hono) {
  /**
   * GET /customer/addresses?phone=...
   * Get all addresses for a customer by phone (convenience endpoint)
   * Must be registered BEFORE /customer/:customerId/addresses to avoid route conflicts
   */
  app.get("/customer/addresses", async (c) => {
    try {
      const phone = c.req.query('phone');
      
      if (!phone) {
        return c.json({ error: 'phone parameter is required' }, 400);
      }

      // Resolve customer ID from phone
      let customer = await select('customers', { phone: phone });
      if (customer.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const addresses = await query(
        `SELECT * FROM customer_addresses
         WHERE customer_id = $1
         ORDER BY is_default DESC, created_at DESC`,
        [customer[0].id]
      ).catch(() => ({ rows: [] }));

      const mapAddr = (addr: any) => ({
        id: addr.id,
        customerId: addr.customer_id,
        label: addr.address_type,
        name: addr.full_name,
        phone: addr.phone,
        addressLine1: addr.address_line1,
        addressLine2: addr.address_line2,
        city: addr.city,
        state: addr.state,
        pincode: addr.pincode,
        landmark: addr.landmark,
        coordinates: addr.coordinates || null,
        flatNo: addr.flat_no ?? undefined,
        houseNo: addr.house_no ?? undefined,
        floor: addr.floor ?? undefined,
        streetName: addr.street_name ?? undefined,
        apartmentName: addr.apartment_name ?? undefined,
        isDefault: addr.is_default,
        createdAt: addr.created_at,
        updatedAt: addr.updated_at,
      });
      let list = addresses.rows.map(mapAddr);

      // When no saved addresses exist, use profile address/pincode so checkout doesn't block
      const cust = customer[0] as any;
      if (list.length === 0 && (cust?.address || cust?.pincode)) {
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
          coordinates: null,
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
  });

  /**
   * GET /customer/addresses/:addressId
   * Get a single address by ID (for vendor GPS destination lookup when booking has address_id)
   */
  app.get("/customer/addresses/:addressId", async (c) => {
    try {
      const { addressId } = c.req.param();
      const addresses = await query(
        `SELECT * FROM customer_addresses WHERE id = $1`,
        [addressId]
      ).catch(() => ({ rows: [] }));
      if (addresses.rows.length === 0) {
        return c.json({ error: 'Address not found' }, 404);
      }
      const addr = addresses.rows[0] as any;
      let latitude: number | null = null;
      let longitude: number | null = null;
      if (addr.coordinates) {
        try {
          const coords = typeof addr.coordinates === 'string' ? JSON.parse(addr.coordinates) : addr.coordinates;
          latitude = coords?.lat ?? coords?.latitude ?? null;
          longitude = coords?.lng ?? coords?.longitude ?? null;
        } catch {
          // ignore
        }
      }
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
          latitude,
          longitude,
          coordinates: addr.coordinates,
        },
      });
    } catch (error: any) {
      console.error('Error fetching address:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /customer/addresses
   * Add a new address by phone (convenience endpoint)
   * Must be registered BEFORE /customer/:customerId/addresses to avoid route conflicts
   * 
   * Request body can contain:
   * - phone: customer phone number (required)
   * - OR addresses: array of addresses to save (legacy format)
   * - OR individual address fields: label, name, phone, addressLine1, etc.
   */
  app.post("/customer/addresses", async (c) => {
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

      // Resolve customer ID from phone
      let customer = await select('customers', { phone: customerPhone });
      if (customer.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Check if first address (auto-default)
      const existingAddresses = await query(
        'SELECT COUNT(*) as count FROM customer_addresses WHERE customer_id = $1',
        [customer[0].id]
      ).catch(() => ({ rows: [{ count: '0' }] }));

      const shouldBeDefault = addressData.isDefault || parseInt(existingAddresses.rows[0]?.count || '0', 10) === 0;

      // If setting as default, unset all others
      if (shouldBeDefault) {
        await query(
          'UPDATE customer_addresses SET is_default = false WHERE customer_id = $1',
          [customer[0].id]
        ).catch(() => {});
      }

      // ✅ FIX: Create address with better error handling
      let address;
      try {
        address = await insert('customer_addresses', {
          customer_id: customer[0].id,
          address_type: addressData.label || 'home',
          full_name: addressData.name,
          phone: addressData.phone,
          address_line1: addressData.addressLine1,
          address_line2: addressData.addressLine2 || null,
          city: addressData.city,
          state: addressData.state,
          pincode: addressData.pincode,
          landmark: addressData.landmark || null,
          coordinates: addressData.coordinates ? (typeof addressData.coordinates === 'string' ? addressData.coordinates : JSON.stringify(addressData.coordinates)) : null,
          flat_no: addressData.flatNo || null,
          house_no: addressData.houseNo || null,
          floor: addressData.floor || null,
          street_name: addressData.streetName || null,
          apartment_name: addressData.apartmentName || null,
          is_default: shouldBeDefault,
        });
      } catch (insertError: any) {
        console.error('Error inserting address:', insertError);
        console.error('Address data:', JSON.stringify({
          customer_id: customer[0].id,
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
      const allAddresses = await query(
        'SELECT * FROM customer_addresses WHERE customer_id = $1 ORDER BY is_default DESC, created_at DESC',
        [customer[0].id]
      ).catch(() => ({ rows: [] }));

      const mapRow = (addr: any) => ({
        id: addr.id,
        customerId: addr.customer_id,
        label: addr.address_type,
        name: addr.full_name,
        phone: addr.phone,
        addressLine1: addr.address_line1,
        addressLine2: addr.address_line2,
        city: addr.city,
        state: addr.state,
        pincode: addr.pincode,
        landmark: addr.landmark,
        coordinates: addr.coordinates || null,
        flatNo: addr.flat_no ?? undefined,
        houseNo: addr.house_no ?? undefined,
        floor: addr.floor ?? undefined,
        streetName: addr.street_name ?? undefined,
        apartmentName: addr.apartment_name ?? undefined,
        isDefault: addr.is_default,
        createdAt: addr.created_at,
        updatedAt: addr.updated_at,
      });

      const created = address?.[0] || allAddresses.rows?.[0];
      return c.json({
        success: true,
        address: created ? mapRow(created) : null,
        addresses: allAddresses.rows.map((addr: any) => mapRow(addr)),
      });
    } catch (error: any) {
      console.error('Error adding address:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/:customerId/addresses
   * Get all addresses for a customer
   */
  app.get("/customer/:customerId/addresses", async (c) => {
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

      const mapAddrById = (addr: any) => ({
        id: addr.id,
        customerId: addr.customer_id,
        label: addr.address_type,
        name: addr.full_name,
        phone: addr.phone,
        addressLine1: addr.address_line1,
        addressLine2: addr.address_line2,
        city: addr.city,
        state: addr.state,
        pincode: addr.pincode,
        landmark: addr.landmark,
        coordinates: addr.coordinates || null,
        flatNo: addr.flat_no ?? undefined,
        houseNo: addr.house_no ?? undefined,
        floor: addr.floor ?? undefined,
        streetName: addr.street_name ?? undefined,
        apartmentName: addr.apartment_name ?? undefined,
        isDefault: addr.is_default,
        createdAt: addr.created_at,
        updatedAt: addr.updated_at,
      });
      return c.json({
        success: true,
        addresses: addresses.rows.map(mapAddrById),
      });
    } catch (error: any) {
      console.error('Error fetching addresses:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /customer/:customerId/addresses
   * Add a new address
   */
  app.post("/customer/:customerId/addresses", async (c) => {
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
        landmark,
        coordinates,
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

      // Resolve customer ID
      let customer = await select('customers', { id: customerId });
      if (customer.length === 0) {
        customer = await select('customers', { phone: customerId });
      }
      if (customer.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Check if first address (auto-default)
      const existingAddresses = await query(
        'SELECT COUNT(*) as count FROM customer_addresses WHERE customer_id = $1',
        [customer[0].id]
      ).catch(() => ({ rows: [{ count: '0' }] }));

      const shouldBeDefault = isDefault || parseInt(existingAddresses.rows[0]?.count || '0', 10) === 0;

      // If setting as default, unset all others
      if (shouldBeDefault) {
        await query(
          'UPDATE customer_addresses SET is_default = false WHERE customer_id = $1',
          [customer[0].id]
        ).catch(() => {});
      }

      // Create address
      const address = await insert('customer_addresses', {
        customer_id: customer[0].id,
        address_type: label || 'home',
        full_name: name,
        phone: phone,
        address_line1: addressLine1,
        address_line2: addressLine2 || null,
        city: city,
        state: state,
        pincode: pincode,
        landmark: landmark || null,
        coordinates: coordinates || null,
        flat_no: flatNo,
        house_no: houseNo,
        floor: floor,
        street_name: streetName,
        apartment_name: apartmentName,
        is_default: shouldBeDefault,
      });

      // Get all addresses
      const allAddresses = await query(
        'SELECT * FROM customer_addresses WHERE customer_id = $1 ORDER BY is_default DESC, created_at DESC',
        [customer[0].id]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        address: address[0],
        addresses: allAddresses.rows,
      });
    } catch (error: any) {
      console.error('Error adding address:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /customer/:customerId/addresses/:addressId
   * Update an address
   */
  app.put("/customer/:customerId/addresses/:addressId", async (c) => {
    try {
      const { customerId, addressId } = c.req.param();
      const updates = await c.req.json();

      // Resolve customer ID
      let customer = await select('customers', { id: customerId });
      if (customer.length === 0) {
        customer = await select('customers', { phone: customerId });
      }
      if (customer.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // If setting as default, unset all others
      if (updates.isDefault) {
        await query(
          'UPDATE customer_addresses SET is_default = false WHERE customer_id = $1',
          [customer[0].id]
        ).catch(() => {});
      }

      const updatePayload: Record<string, any> = {
        address_type: updates.label || updates.address_type,
        full_name: updates.name || updates.full_name,
        phone: updates.phone,
        address_line1: updates.addressLine1 || updates.address_line1,
        address_line2: updates.addressLine2 || updates.address_line2,
        city: updates.city,
        state: updates.state,
        pincode: updates.pincode,
        landmark: updates.landmark,
        coordinates: updates.coordinates,
        is_default: updates.isDefault !== undefined ? updates.isDefault : updates.is_default,
      };
      if (updates.flatNo !== undefined || updates.flat_no !== undefined) updatePayload.flat_no = updates.flatNo ?? updates.flat_no;
      if (updates.houseNo !== undefined || updates.house_no !== undefined) updatePayload.house_no = updates.houseNo ?? updates.house_no;
      if (updates.floor !== undefined) updatePayload.floor = updates.floor;
      if (updates.streetName !== undefined || updates.street_name !== undefined) updatePayload.street_name = updates.streetName ?? updates.street_name;
      if (updates.apartmentName !== undefined || updates.apartment_name !== undefined) updatePayload.apartment_name = updates.apartmentName ?? updates.apartment_name;
      const updated = await update('customer_addresses',
        { id: addressId, customer_id: customer[0].id },
        updatePayload
      );

      if (updated.length === 0) {
        return c.json({ error: 'Address not found' }, 404);
      }

      return c.json({
        success: true,
        address: updated[0],
      });
    } catch (error: any) {
      console.error('Error updating address:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /customer/:customerId/addresses/:addressId
   * Delete an address
   */
  app.delete("/customer/:customerId/addresses/:addressId", async (c) => {
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
  });
}

