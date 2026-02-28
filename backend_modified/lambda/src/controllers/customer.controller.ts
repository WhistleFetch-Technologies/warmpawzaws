/**
 * ============================================================================
 * CUSTOMER CONTROLLERS
 * ============================================================================
 * 
 * Extracted from:
 * - endpoints/addresses.ts
 * - endpoints/customer-enhanced.ts
 * - endpoints/customer-profile.ts
 * - endpoints/customer-phone-convenience.ts
 * - endpoints/customer-booking-history.ts
 * - endpoints/customer-appointments.ts
 * - endpoints/customer-orders.ts
 * - endpoints/customer-content.ts
 * - endpoints/behavior-journal.ts
 * - endpoints/notifications.ts
 * - endpoints/refund-policy-engine.ts
 * 
 * Date: 2026-01-28
 * Controller extraction migration
 * ============================================================================
 */

import { Context } from 'hono';
import { randomUUID } from 'crypto';
import { select, insert, update, query } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { BaseHandler } from '../handler/base-handler';
import { BaseHandlerEnhanced, HandlerContext, HandlerResponse } from '../handler/base-handler-enhanced';
import { UpdateCustomerProfileRequestSchema, AddPetRequestSchema } from '@warmpawz/api-contracts/customers';
import { getDiscoveryRules } from '../lib/rule-engine';
import { updateCustomerOnboardingStatus } from '../utils/customer-state';

// ============================================================================
// ADDRESS CONTROLLERS (from addresses.ts)
// ============================================================================

export async function getCustomerAddressesByPhone(c: Context) {
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
        flatNo: null,
        houseNo: null,
        floor: null,
        streetName: null,
        apartmentName: null,
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

export async function getAddressById(c: Context) {
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
}

export async function addAddressByPhone(c: Context) {
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
}

export async function getCustomerAddresses(c: Context) {
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
}

export async function addAddress(c: Context) {
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
}

export async function updateAddress(c: Context) {
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
}

export async function deleteAddress(c: Context) {
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

export async function setDefaultAddress(c: Context) {
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

    // Unset all other addresses as default
    await query(
      'UPDATE customer_addresses SET is_default = false WHERE customer_id = $1',
      [customer[0].id]
    ).catch(() => {});

    // Set this address as default
    const updated = await update('customer_addresses',
      { id: addressId, customer_id: customer[0].id },
      { is_default: true }
    );

    if (updated.length === 0) {
      return c.json({ error: 'Address not found' }, 404);
    }

    return c.json({
      success: true,
      address: updated[0],
    });
  } catch (error: any) {
    console.error('Error setting default address:', error);
    return c.json({ error: error.message }, 500);
  }
}

// ============================================================================
// CUSTOMER HANDLERS (from customer.ts - BaseHandler version)
// ============================================================================

export class GetCustomerHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;

    if (!customerId) {
      return this.error('Customer ID is required', 400);
    }

    const customers = await select('customers', { id: customerId });

    if (customers.length === 0) {
      return this.error('Customer not found', 404);
    }

    return this.success(customers[0]);
  }
}

export class GetCustomerByPhoneHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const phone = context.event.queryStringParameters?.phone;

    if (!phone) {
      return this.error('Phone number is required', 400);
    }

    const customers = await select('customers', { phone });

    if (customers.length === 0) {
      return this.error('Customer not found', 404);
    }

    return this.success({ customer: customers[0] });
  }
}

export class UpdateCustomerHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const body = this.parseBody(context.event);

    if (!customerId) {
      return this.error('Customer ID is required', 400);
    }

    const updateData: any = {};
    if (body.fullName) updateData.full_name = body.fullName;
    if (body.email) updateData.email = body.email;
    if (body.dateOfBirth) updateData.date_of_birth = body.dateOfBirth;
    if (body.address) updateData.address = body.address;
    if (body.city) updateData.city = body.city;
    if (body.state) updateData.state = body.state;
    if (body.pincode) updateData.pincode = body.pincode;

    updateData.updated_at = new Date();

    await update('customers', { id: customerId }, updateData);

    return this.success({ message: 'Customer updated successfully' });
  }
}

export class GetCustomerPetsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;

    if (!customerId) {
      return this.error('Customer ID is required', 400);
    }

    const pets = await select('pets', { customer_id: customerId });

    return this.success({ pets });
  }
}

export class CreateCustomerHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    console.log('body', body);
    
    if (!body.phone && !body.email) {
      return this.error('Phone or email is required', 400);
    }

    try {
      if (body.phone) {
        const existing = await select('customers', { phone: body.phone });
        if (existing.length > 0) {
          return this.success({
            customer: existing[0],
            message: 'Customer already exists'
          });
        }
      }

      const customerData: any = {
        phone: body.phone,
        email: body.email,
        full_name: body.name || body.fullName,
        created_at: new Date(),
        updated_at: new Date(),
      };

      if (body.address) customerData.address = body.address;
      if (body.city) customerData.city = body.city;
      if (body.state) customerData.state = body.state;
      if (body.pincode) customerData.pincode = body.pincode;

      const customers = await insert('customers', customerData);

      return this.success({ customer: customers[0] }, 201);
    } catch (error: any) {
      console.error('Error creating customer:', error);
      if (error.message?.includes('duplicate') || error.code === '23505') {
        const existing = await select('customers', { phone: body.phone });
        if (existing.length > 0) {
          return this.success({
            customer: existing[0],
            message: 'Customer already exists'
          });
        }
      }
      return this.error(error.message || 'Failed to create customer', 500);
    }
  }
}

export class AddPetHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const body = this.parseBody(context.event);

    this.validateRequired(body, ['name', 'species', 'breed']);

    const petData = {
      customer_id: customerId,
      name: body.name,
      species: body.species,
      breed: body.breed,
      age: body.age,
      gender: body.gender,
      weight: body.weight,
      color: body.color,
      medical_history: body.medicalHistory || [],
    };

    const pets = await insert('pets', petData);

    return this.success({ pet: pets[0] });
  }
}

// Helper functions for customer.ts
export function createApiGatewayEventForCustomerTs(req: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    headers: req.headers,
    body: JSON.stringify(req.body || {}),
    pathParameters: req.param() || {},
    queryStringParameters: Object.fromEntries(new URL(req.url, 'http://localhost').searchParams),
    requestContext: {
      requestId: randomUUID(),
    },
  };
}

export function createLambdaContextForCustomerTs(): any {
  return {
    requestId: randomUUID(),
    functionName: 'customer-handler',
    functionVersion: '$LATEST',
  };
}

// ============================================================================
// CUSTOMER ENHANCED CONTROLLERS (from customer-enhanced.ts)
// ============================================================================

export class GetCustomerHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const requestId = context.requestId;

    if (!customerId) {
      return this.error('Customer ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    try {
      const customers = await select('customers', { id: customerId });
      
      if (customers.length === 0) {
        return this.error('Customer not found', 404, 'NOT_FOUND', undefined, requestId);
      }

      return this.success({ customer: customers[0] }, requestId);
    } catch (error: any) {
      console.error('Error getting customer:', error);
      return this.error(
        error.message || 'Failed to get customer',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

export class GetCustomerByPhoneHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const phone = context.event.queryStringParameters?.phone;
    const requestId = context.requestId;

    if (!phone) {
      return this.error('Phone number is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    try {
      // Normalize phone - remove non-digits
      const cleanPhone = phone.replace(/\D/g, '');
      
      const customers = await select('customers', { phone: cleanPhone });
      
      if (customers.length === 0) {
        return this.error('Customer not found', 404, 'NOT_FOUND', undefined, requestId);
      }

      const customer = customers[0];
      return this.success({ 
        customer: {
          id: customer.id,
          phone: customer.phone,
          name: customer.full_name,
          email: customer.email,
          status: customer.status,
          onboarding_status: customer.onboarding_status,
          profile_completed: customer.profile_completed,
          created_at: customer.created_at,
        }
      }, requestId);
    } catch (error: any) {
      console.error('Error getting customer by phone:', error);
      return this.error(
        error.message || 'Failed to get customer',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

export class UpdateCustomerHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const body = this.parseBody(context.event);
    const requestId = context.requestId;

    if (!customerId) {
      return this.error('Customer ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    // Validate request with Zod schema
    const validationResult = UpdateCustomerProfileRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return this.error(
        'Validation failed',
        400,
        'VALIDATION_ERROR',
        { errors: validationResult.error.errors },
        requestId
      );
    }

    try {
      const updateData: any = {
        updated_at: new Date(),
      };

      if (validationResult.data.firstName) updateData.first_name = validationResult.data.firstName;
      if (validationResult.data.lastName) updateData.last_name = validationResult.data.lastName;
      if (validationResult.data.email) updateData.email = validationResult.data.email;
      if (validationResult.data.address) updateData.address = validationResult.data.address;
      if (validationResult.data.pincode) updateData.pincode = validationResult.data.pincode;
      if (validationResult.data.photo) updateData.profile_photo_url = validationResult.data.photo;

      await update('customers', { id: customerId }, updateData);

      // Get updated customer
      const customers = await select('customers', { id: customerId });

      return this.success({
        message: 'Customer updated successfully',
        customer: customers[0],
      }, requestId);
    } catch (error: any) {
      console.error('Error updating customer:', error);
      return this.error(
        error.message || 'Failed to update customer',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

export class GetCustomerPetsHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const requestId = context.requestId;

    if (!customerId) {
      return this.error('Customer ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    try {
      const pets = await select('pets', { customer_id: customerId });

      return this.success({ pets }, requestId);
    } catch (error: any) {
      console.error('Error getting customer pets:', error);
      return this.error(
        error.message || 'Failed to get pets',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

export class AddPetHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const body = this.parseBody(context.event);
    const requestId = context.requestId;

    if (!customerId) {
      return this.error('Customer ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    // Validate request with Zod schema
    // Note: AddPetRequestSchema expects phone and pets array, but we're using customerId
    // For now, validate required fields manually
    this.validateRequired(body, ['name', 'species']);

    try {
      const petData = {
        customer_id: customerId,
        name: body.name,
        species: body.species,
        breed: body.breed || null,
        age: body.age || null,
        gender: body.gender || null,
        weight: body.weight || null,
        color: body.color || null,
        medical_history: body.medicalHistory || [],
      };

      const pets = await insert('pets', petData);

      // Check if this is the first pet (complete profile bonus)
      const existingPets = await select('pets', { customer_id: customerId });
      if (existingPets.length === 1) {
        // First pet - award complete profile bonus (100 points)
        try {
          const { loyaltyPointsService } = await import('../lib/services/loyalty-points-service');
          await loyaltyPointsService.awardPoints({
            customerId,
            actionName: 'complete_pet_profile',
            referenceType: 'pet_profile',
            referenceId: pets[0].id,
            description: 'Complete pet profile bonus',
          });
        } catch (loyaltyError) {
          console.error('Error awarding complete profile bonus:', loyaltyError);
          // Don't fail pet creation if loyalty points fail
        }
      }

      return this.success({ pet: pets[0] }, requestId);
    } catch (error: any) {
      console.error('Error adding pet:', error);
      return this.error(
        error.message || 'Failed to add pet',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

export class DeactivateCustomerHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const body = this.parseBody(context.event);
    const requestId = context.requestId;

    if (!customerId) {
      return this.error('Customer ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    const reason = body.reason || body.deactivationReason || 'Customer request';
    const actorId = context.userId || body.actorId;
    const actorType = context.userRole || body.actorType || 'customer';
    const permanentDelete = body.permanentDelete === true; // Only if explicitly requested

    try {
      // Get current customer
      const existingCustomers = await select('customers', { id: customerId });
      if (existingCustomers.length === 0) {
        return this.error('Customer not found', 404, 'NOT_FOUND', undefined, requestId);
      }

      const currentCustomer = existingCustomers[0];

      if (permanentDelete) {
        // Hard delete - only allowed by admins or system
        if (actorType !== 'admin' && actorType !== 'system') {
          return this.error(
            'Permanent deletion is only allowed by administrators',
            403,
            'FORBIDDEN',
            undefined,
            requestId
          );
        }

        // Check for active bookings/orders before deletion
        const activeBookings = await query(
          `SELECT COUNT(*) as count FROM bookings 
           WHERE customer_id = $1 AND status NOT IN ('cancelled', 'completed', 'no_show')`,
          [customerId]
        );

        const activeOrders = await query(
          `SELECT COUNT(*) as count FROM orders 
           WHERE customer_id = $1 AND order_status NOT IN ('cancelled', 'delivered', 'refunded')`,
          [customerId]
        );

        if (parseInt(activeBookings.rows[0]?.count || '0', 10) > 0 ||
            parseInt(activeOrders.rows[0]?.count || '0', 10) > 0) {
          return this.error(
            'Cannot delete customer with active bookings or orders. Please cancel them first.',
            400,
            'VALIDATION_ERROR',
            undefined,
            requestId
          );
        }

        // Soft delete by setting is_active = false and updating
        await update('customers', { id: customerId }, {
          is_active: false,
          updated_at: new Date(),
        });

        return this.success({
          customerId,
          message: 'Customer account deactivated successfully',
          deactivated: true,
        }, requestId);
      } else {
        // Soft delete - deactivate account
        await update('customers', { id: customerId }, {
          is_active: false,
          updated_at: new Date(),
        });

        // Log audit entry
        try {
          const { logAuditEntry } = await import('../utils/audit-log');
          await logAuditEntry({
            entityType: 'customer',
            entityId: customerId,
            action: 'deactivate',
            oldValues: { is_active: currentCustomer.is_active },
            newValues: { is_active: false, reason },
            changedFields: ['is_active'],
            actorId,
            actorType,
            requestId,
          });
        } catch (error) {
          console.error('Error logging audit entry:', error);
        }

        return this.success({
          customerId,
          message: 'Customer account deactivated successfully',
          deactivated: true,
        }, requestId);
      }
    } catch (error: any) {
      console.error('Error deactivating customer:', error);
      return this.error(
        error.message || 'Failed to deactivate customer',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS - API Gateway Event Creation (used by endpoint wrappers)
// ============================================================================

export function createApiGatewayEventForCustomer(req: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    headers: req.headers,
    body: JSON.stringify(req.body || {}),
    pathParameters: req.param() || {},
    queryStringParameters: Object.fromEntries(new URL(req.url, 'http://localhost').searchParams),
    requestContext: {
      requestId: randomUUID(),
    },
  };
}

export function createLambdaContextForCustomer(): any {
  return {
    requestId: randomUUID(),
    functionName: 'customer-handler',
    functionVersion: '$LATEST',
  };
}

// ============================================================================
// CUSTOMER ENHANCED INLINE HANDLERS (from customer-enhanced.ts)
// ============================================================================

export async function getCustomerByPhoneRoute(c: Context) {
  const startTime = Date.now();
  try {
    const phone = c.req.query('phone');
    
    if (!phone) {
      return c.json({ 
        success: false,
        error: { code: 'MISSING_PHONE', message: 'phone parameter is required' }
      }, 400);
    }

    const event = createApiGatewayEventForCustomer(c.req);
    event.queryStringParameters = Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams);
    const context = createLambdaContextForCustomer();
    
    try {
      const handler = new GetCustomerByPhoneHandlerEnhanced();
      const result: any = await handler.execute(event, context);
      const body = JSON.parse(result.body);
      const duration = Date.now() - startTime;
      if (duration > 2000) {
        console.warn(`[by-phone] Slow response: ${duration}ms for phone ${phone.substring(0, 4)}****`);
      }
      return c.json(body, result.statusCode);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error?.message || String(error);
      console.error(`[by-phone] Error after ${duration}ms:`, errorMessage);
      if (errorMessage.includes('connection pool') || errorMessage.includes('too many clients')) {
        console.error('[by-phone] ⚠️ Connection pool exhausted');
      }
      return c.json({ success: false, customer: null }, 200);
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[by-phone] Error after ${duration}ms:`, error?.message || error);
    return c.json({ success: false, customer: null }, 200);
  }
}

export async function getMealPlanOrders(c: Context) {
  try {
    const customerId = c.req.query('customerId');
    if (!customerId) {
      return c.json({ success: false, error: 'customerId is required' }, 400);
    }
    const allOrders: any[] = [];

    // 1. From meal_orders (MealOrderCheckout flow)
    const mealResult = await query(
      `SELECT mo.*, mp.name as meal_plan_name, v.business_name as vendor_name
       FROM meal_orders mo
       LEFT JOIN meal_plans mp ON mo.meal_plan_id = mp.id
       LEFT JOIN vendors v ON mo.vendor_id = v.id
       WHERE mo.customer_id = $1
       ORDER BY mo.created_at DESC`,
      [customerId]
    ).catch(() => ({ rows: [] }));

    for (const o of (mealResult as any).rows || []) {
      allOrders.push({
        id: o.id,
        order_number: o.order_number || o.id?.toString().slice(-8),
        order_type: 'meal_plan_delivery',
        orderType: 'meal_plan_delivery',
        meal_plan_id: o.meal_plan_id,
        meal_plan_name: o.meal_name || o.meal_plan_name,
        pet_id: o.pet_id,
        vendor_id: o.vendor_id,
        vendor_name: o.vendor_name,
        total_amount: o.total_amount,
        status: o.status,
        delivery_address: o.delivery_address,
        scheduled_delivery_date: o.scheduled_delivery_date,
        scheduled_delivery_slot: o.scheduled_delivery_slot,
        created_at: o.created_at,
        source: 'meal_orders',
      });
    }

    // 2. From orders table (MealPlanBookingFlow /nutrition/delivery-orders)
    try {
      const hasOrderType = await query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_type' LIMIT 1`
      ).then((r: any) => (r?.rows?.length || 0) > 0);
      if (hasOrderType) {
        const ordResult = await query(
          `SELECT o.id, o.order_number, o.order_status as status, o.total_amount, o.shipping_address as delivery_address,
                  o.delivery_date as scheduled_delivery_date, o.delivery_time as scheduled_delivery_slot, o.created_at,
                  o.vendor_id, v.business_name as vendor_name,
                  (SELECT mp.name FROM meal_plan_orders mpo LEFT JOIN meal_plans mp ON mpo.meal_plan_id = mp.id WHERE mpo.order_id = o.id LIMIT 1) as meal_plan_name
           FROM orders o
           LEFT JOIN vendors v ON o.vendor_id = v.id
           WHERE o.customer_id = $1 AND o.order_type = 'meal_plan_delivery'
           ORDER BY o.created_at DESC`,
          [customerId]
        ).catch(() => ({ rows: [] }));

        for (const o of (ordResult as any).rows || []) {
          allOrders.push({
            id: o.id,
            order_number: o.order_number || o.id?.toString().slice(-8),
            order_type: 'meal_plan_delivery',
            orderType: 'meal_plan_delivery',
            meal_plan_id: null,
            meal_plan_name: o.meal_plan_name || 'Meal Plan',
            pet_id: null,
            vendor_id: o.vendor_id,
            vendor_name: o.vendor_name,
            total_amount: o.total_amount,
            status: o.status,
            delivery_address: o.delivery_address,
            scheduled_delivery_date: o.scheduled_delivery_date,
            scheduled_delivery_slot: o.scheduled_delivery_slot,
            created_at: o.created_at,
            source: 'orders',
          });
        }
      }
    } catch (_) {
      /* ignore */
    }

    // Sort by created_at desc
    allOrders.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    return c.json({ success: true, orders: allOrders });
  } catch (error: any) {
    console.error('[meal-plan-orders] Error:', error);
    return c.json({ success: true, orders: [] });
  }
}

export async function getCustomerPetsByPhone(c: Context) {
  try {
    const phone = c.req.query('phone');
    if (!phone) {
      return c.json({ error: 'phone is required' }, 400);
    }

    // Clean phone - remove non-digits and country code
    let cleanPhone = phone.replace(/\D/g, '');
    // Remove leading country code (91 for India) if present
    if (cleanPhone.length > 10 && cleanPhone.startsWith('91')) {
      cleanPhone = cleanPhone.slice(2);
    }

    // Get customer by phone - try both original and cleaned
    let customers = await select('customers', { phone: cleanPhone });
    if (customers.length === 0) {
      // Try with original phone (in case it's stored differently)
      customers = await select('customers', { phone });
    }
    if (customers.length === 0) {
      // Try with +91 prefix
      customers = await select('customers', { phone: `+91${cleanPhone}` });
    }
    if (customers.length === 0) {
      return c.json({ 
        success: false, 
        error: { code: 'NOT_FOUND', message: 'Customer not found' },
        pets: [],
        count: 0
      }, 404);
    }

    const customer = customers[0];

    // Get pets
    const pets = await select('pets',
      { customer_id: customer.id },
      { orderBy: 'created_at', orderDirection: 'DESC' }
    );

    return c.json({
      success: true,
      pets: pets.map((pet: any) => ({
        id: pet.id,
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        age_years: pet.age_years,
        age_months: pet.age_months,
        gender: pet.gender,
        weight_kg: pet.weight_kg,
        profile_photo_url: pet.profile_photo_url,
        medical_history: pet.medical_history || {},
        createdAt: pet.created_at,
      })),
      count: pets.length,
    });
  } catch (error: any) {
    console.error('[pets] Error fetching customer pets by phone:', error);
    console.error('[pets] Error stack:', error?.stack);
    
    const errorMessage = error?.message || 'Unknown error';
    
    // Return 200 with empty on pool exhaustion or other errors so customer home loads
    if (errorMessage.includes('connection pool') || errorMessage.includes('too many clients')) {
      return c.json({ success: true, pets: [], count: 0 });
    }
    
    return c.json({ success: true, pets: [], count: 0 });
  }
}

// ============================================================================
// CUSTOMER PROFILE HELPERS (from customer-profile.ts)
// ============================================================================

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export async function resolveCustomerId(identifier: string): Promise<string | null> {
  // Check if it's a UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(identifier)) {
    const customers = await select('customers', { id: identifier });
    return customers.length > 0 ? customers[0].id : null;
  }

  // Check if it's a phone number
  const cleanPhone = normalizePhone(identifier);
  const customers = await select('customers', { phone: cleanPhone });
  return customers.length > 0 ? customers[0].id : null;
}

// ============================================================================
// BEHAVIOR JOURNAL HANDLERS (from behavior-journal.ts)
// ============================================================================

export async function getBehaviorJournal(c: Context) {
  try {
    const petId = c.req.query('petId');
    const customerId = c.req.query('customerId');
    const phone = c.req.query('phone');
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    if (!petId && !customerId && !phone) {
      return c.json({ 
        success: true,
        journal: [],
        trends: [],
        total: 0,
        message: 'No petId, customerId, or phone provided. Returning empty results.'
      });
    }

    let resolvedCustomerId = customerId;
    if (phone && !customerId) {
      try {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const customerResult = await query(
          `SELECT id FROM customers WHERE phone = $1 LIMIT 1`,
          [cleanPhone]
        );
        if (customerResult.rows.length > 0) {
          resolvedCustomerId = customerResult.rows[0].id;
        }
      } catch (err: any) {
        console.error('[Behavior Journal] Error resolving customer:', err?.message);
        return c.json({ 
          success: true,
          journal: [],
          trends: [],
          total: 0,
          message: 'Could not resolve customer from phone. Returning empty results.'
        });
      }
    }

    if (!petId && !resolvedCustomerId) {
      return c.json({ 
        success: true,
        journal: [],
        trends: [],
        total: 0,
        message: 'No valid petId, customerId, or phone provided. Returning empty results.'
      });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    let rawQuery = `SELECT * FROM behavior_journal WHERE 1=1`;
    const queryParams: any[] = [];
    let paramIdx = 1;
    
    if (petId) {
      if (uuidRegex.test(String(petId))) {
        rawQuery += ` AND pet_id = $${paramIdx}::uuid`;
        queryParams.push(String(petId));
      } else {
        return c.json({
          success: true,
          journal: [],
          trends: [],
          total: 0,
          message: 'Invalid petId format. Must be a valid UUID.'
        });
      }
      paramIdx++;
    }
    
    if (resolvedCustomerId) {
      if (uuidRegex.test(String(resolvedCustomerId))) {
        rawQuery += ` AND customer_id = $${paramIdx}::uuid`;
        queryParams.push(String(resolvedCustomerId));
      } else {
        return c.json({
          success: true,
          journal: [],
          trends: [],
          total: 0,
          message: 'Invalid customerId format. Must be a valid UUID.'
        });
      }
      paramIdx++;
    }
    
    rawQuery += ` ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    queryParams.push(limit, offset);
    
    let journalEntries: any[] = [];
    try {
      const journalResult = await query(rawQuery, queryParams);
      journalEntries = journalResult.rows || [];
    } catch (err: any) {
      console.error('[Behavior Journal] Query error:', err?.message);
      journalEntries = [];
    }
    
    let enrichedEntries = journalEntries;
    if (journalEntries.length > 0) {
      try {
        enrichedEntries = await Promise.all(
          journalEntries.map(async (entry: any) => {
            let petData: { rows: Array<{ name?: string; species?: string }> } = { rows: [] };
            let customerData: { rows: Array<{ full_name?: string }> } = { rows: [] };
            
            if (entry.pet_id) {
              try {
                const petResult = await query(
                  `SELECT name, species FROM pets WHERE id = $1::uuid LIMIT 1`,
                  [String(entry.pet_id)]
                );
                petData = petResult as any;
              } catch (err: any) {
                console.error('[Behavior Journal] Error fetching pet data:', err?.message);
              }
            }
            
            if (entry.customer_id) {
              try {
                const customerResult = await query(
                  `SELECT full_name FROM customers WHERE id = $1::uuid LIMIT 1`,
                  [String(entry.customer_id)]
                );
                customerData = customerResult as any;
              } catch (err: any) {
                console.error('[Behavior Journal] Error fetching customer data:', err?.message);
              }
            }
            
            return {
              ...entry,
              pet_name: petData.rows[0]?.name || null,
              species: petData.rows[0]?.species || null,
              customer_name: customerData.rows[0]?.full_name || null,
            };
          })
        );
      } catch (err: any) {
        console.error('[Behavior Journal] Error during enrichment:', err?.message);
        enrichedEntries = journalEntries;
      }
    }

    let trends: { rows: Array<{ behavior: string; count: number; avg_severity: number }> } = { rows: [] };
    if (petId || resolvedCustomerId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let trendsQuery = `SELECT * FROM behavior_journal WHERE 1=1`;
      const trendsParams: any[] = [];
      let trendsParamIdx = 1;
      
      if (petId && uuidRegex.test(String(petId))) {
        trendsQuery += ` AND pet_id = $${trendsParamIdx}::uuid`;
        trendsParams.push(String(petId));
        trendsParamIdx++;
      } else if (resolvedCustomerId && uuidRegex.test(String(resolvedCustomerId))) {
        trendsQuery += ` AND customer_id = $${trendsParamIdx}::uuid`;
        trendsParams.push(String(resolvedCustomerId));
        trendsParamIdx++;
      }
      
      let trendsEntries: any[] = [];
      try {
        const trendsResult = await query(trendsQuery, trendsParams);
        trendsEntries = trendsResult.rows || [];
      } catch (err: any) {
        console.error('[Behavior Journal] Error fetching trends:', err?.message);
        trendsEntries = [];
      }
      
      const trendsMap = new Map<string, { count: number; totalSeverity: number }>();
      trendsEntries.forEach((entry: any) => {
        const behavior = entry.behavior;
        const severityValue = entry.severity === 'low' ? 1 : 
                             entry.severity === 'medium' ? 2 :
                             entry.severity === 'high' ? 3 :
                             entry.severity === 'critical' ? 4 : 2;
        
        if (!trendsMap.has(behavior)) {
          trendsMap.set(behavior, { count: 0, totalSeverity: 0 });
        }
        const trend = trendsMap.get(behavior)!;
        trend.count++;
        trend.totalSeverity += severityValue;
      });
      
      const trendsArray = Array.from(trendsMap.entries())
        .map(([behavior, data]) => ({
          behavior,
          count: data.count,
          avg_severity: data.totalSeverity / data.count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      trends = { rows: trendsArray };
    }

    return c.json({
      success: true,
      journal: enrichedEntries,
      trends: trends.rows || [],
      total: enrichedEntries.length,
    });
  } catch (error: any) {
    console.error('[Behavior Journal] Top-level error:', error);
    
    if (error?.message?.includes('operator does not exist') || 
        error?.message?.includes('uuid = text') ||
        error?.message?.includes('uuid =')) {
      console.error('[Behavior Journal] UUID comparison error detected - returning empty results');
      return c.json({
        success: true,
        journal: [],
        trends: [],
        total: 0,
        message: 'No behavior journal entries found (database query issue resolved gracefully).'
      });
    }
    
    return c.json({ 
      success: false,
      error: error.message 
    }, 500);
  }
}

export async function createBehaviorJournalEntry(c: Context) {
  try {
    const body = await c.req.json();
    const {
      petId,
      customerId,
      behavior,
      triggers,
      duration,
      severity,
      notes
    } = body;

    if (!petId || !customerId || !behavior) {
      return c.json({ 
        error: 'petId, customerId, and behavior are required' 
      }, 400);
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(String(petId)) || !uuidRegex.test(String(customerId))) {
      return c.json({ 
        error: 'petId and customerId must be valid UUIDs' 
      }, 400);
    }

    const petResult = await query(
      `SELECT * FROM pets WHERE id = $1::uuid`,
      [petId]
    );
    
    if (petResult.rows.length === 0) {
      return c.json({ error: 'Pet not found' }, 404);
    }

    const pet = petResult.rows[0];
    if (pet.customer_id?.toString() !== customerId?.toString()) {
      return c.json({ error: 'Pet does not belong to customer' }, 403);
    }

    await query(`
      CREATE TABLE IF NOT EXISTS behavior_journal (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
        customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
        behavior TEXT NOT NULL,
        triggers TEXT[] DEFAULT '{}',
        duration TEXT,
        severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});

    await query(`
      CREATE INDEX IF NOT EXISTS idx_behavior_journal_pet_id ON behavior_journal(pet_id);
      CREATE INDEX IF NOT EXISTS idx_behavior_journal_customer_id ON behavior_journal(customer_id);
      CREATE INDEX IF NOT EXISTS idx_behavior_journal_created_at ON behavior_journal(created_at DESC);
    `).catch(() => {});

    const triggersArray = Array.isArray(triggers) ? triggers : (triggers ? [triggers] : []);
    const result = await query(
      `INSERT INTO behavior_journal (pet_id, customer_id, behavior, triggers, duration, severity, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [petId, customerId, behavior, triggersArray, duration || null, severity || 'medium', notes || null]
    );

    const journalEntry = result.rows[0];

    return c.json({
      success: true,
      message: 'Behavior journal entry created successfully',
      entry: journalEntry,
    });
  } catch (error: any) {
    console.error('Error creating behavior journal entry:', error);
    return c.json({ error: error.message }, 500);
  }
}

// ============================================================================
// CUSTOMER PROFILE HANDLERS (from customer-profile.ts)
// ============================================================================
// Note: Due to the large scope (111 routes across 12 files), handlers from
// customer-profile.ts are being extracted systematically. The remaining
// inline handlers will be extracted in subsequent batches as the migration continues.
