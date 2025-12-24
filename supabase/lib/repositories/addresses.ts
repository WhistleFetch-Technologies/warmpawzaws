/**
 * ============================================================================
 * ADDRESSES REPOSITORY
 * ============================================================================
 * 
 * Repository for customer address management.
 * Replaces: customer:{customerId}:addresses KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, deleteQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface Address {
  id: string;
  customer_id: string;
  address_type: 'home' | 'work' | 'other';
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  landmark?: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAddressInput {
  customer_id: string;
  address_type?: 'home' | 'work' | 'other';
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  is_default?: boolean;
}

export class AddressesRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async create(input: CreateAddressInput): Promise<Address> {
    // If setting as default, unset other defaults
    if (input.is_default) {
      await this.client
        .from('customer_addresses')
        .update({ is_default: false })
        .eq('customer_id', input.customer_id)
        .eq('is_default', true);
    }

    const { data, error } = await this.client
      .from('customer_addresses')
      .insert({
        customer_id: input.customer_id,
        address_type: input.address_type || 'home',
        full_name: input.full_name,
        phone: input.phone,
        address_line1: input.address_line1,
        address_line2: input.address_line2 || null,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        landmark: input.landmark || null,
        is_default: input.is_default || false
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create address: ${error.message}`);
    }

    return this.mapAddress(data);
  }

  async findByCustomer(customerId: string): Promise<Address[]> {
    const results = await selectQuery<any>("customer_addresses", 
      { customer_id: customerId }, 
      { orderBy: "is_default", orderDirection: "desc" }
    );
    return results.map(this.mapAddress);
  }

  async findById(addressId: string): Promise<Address | null> {
    const results = await selectQuery<any>("customer_addresses", { id: addressId }, { limit: 1 });
    if (results.length === 0) return null;
    return this.mapAddress(results[0]);
  }

  async findDefault(customerId: string): Promise<Address | null> {
    const results = await selectQuery<any>("customer_addresses", 
      { customer_id: customerId, is_default: true }, 
      { limit: 1 }
    );
    if (results.length === 0) return null;
    return this.mapAddress(results[0]);
  }

  async update(addressId: string, updates: Partial<CreateAddressInput>): Promise<Address> {
    // If setting as default, unset other defaults
    if (updates.is_default) {
      const address = await this.findById(addressId);
      if (address) {
        await this.client
          .from('customer_addresses')
          .update({ is_default: false })
          .eq('customer_id', address.customer_id)
          .eq('is_default', true)
          .neq('id', addressId);
      }
    }

    const results = await updateQuery<any>("customer_addresses", 
      { id: addressId }, 
      {
        ...updates,
        updated_at: new Date().toISOString()
      }
    );
    
    if (!results[0]) {
      throw new Error(`Address not found: ${addressId}`);
    }
    
    return this.mapAddress(results[0]);
  }

  async delete(addressId: string): Promise<void> {
    await deleteQuery("customer_addresses", { id: addressId });
  }

  private mapAddress(data: any): Address {
    return {
      id: data.id,
      customer_id: data.customer_id,
      address_type: data.address_type,
      full_name: data.full_name,
      phone: data.phone,
      address_line1: data.address_line1,
      address_line2: data.address_line2,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      landmark: data.landmark,
      is_default: data.is_default,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }
}

let repositoryInstance: AddressesRepository | null = null;

export function getAddressesRepository(client?: SupabaseClient): AddressesRepository {
  if (!repositoryInstance) {
    repositoryInstance = new AddressesRepository(client);
  }
  return repositoryInstance;
}

