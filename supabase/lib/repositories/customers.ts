/**
 * ============================================================================
 * CUSTOMERS REPOSITORY
 * ============================================================================
 * 
 * Repository for customer data access.
 * Replaces: customer:{customerId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All queries use prepared statements
 * 
 * Date: 2024-12-22
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, deleteQuery, upsertQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// TYPES
// ============================================================================

export interface Customer {
  id: string;
  phone: string;
  email?: string | null;
  full_name: string;
  date_of_birth?: string | null;
  gender?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  profile_photo_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
}

export interface CreateCustomerInput {
  phone: string;
  email?: string;
  full_name: string;
  date_of_birth?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  profile_photo_url?: string;
}

export interface UpdateCustomerInput {
  email?: string;
  full_name?: string;
  date_of_birth?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  profile_photo_url?: string;
  is_active?: boolean;
  last_login_at?: string;
}

// ============================================================================
// REPOSITORY CLASS
// ============================================================================

export class CustomersRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Get customer by ID
   * Replaces: kv.get(`customer:${customerId}`)
   */
  async findById(customerId: string): Promise<Customer | null> {
    const results = await selectQuery<Customer>("customers", { id: customerId }, { limit: 1 });
    return results[0] || null;
  }

  /**
   * Get customer by phone
   * Common lookup pattern
   */
  async findByPhone(phone: string): Promise<Customer | null> {
    const results = await selectQuery<Customer>("customers", { phone }, { limit: 1 });
    return results[0] || null;
  }

  /**
   * Get customer by email
   */
  async findByEmail(email: string): Promise<Customer | null> {
    const results = await selectQuery<Customer>("customers", { email }, { limit: 1 });
    return results[0] || null;
  }

  /**
   * Get all customers with filters
   */
  async findAll(filters?: {
    city?: string;
    state?: string;
    is_active?: boolean;
  }, options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
  }): Promise<Customer[]> {
    return selectQuery<Customer>("customers", filters, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: options?.orderBy || "created_at",
      orderDirection: "desc",
    });
  }

  /**
   * Create a new customer
   * Replaces: kv.set(`customer:${customerId}`, customerData)
   */
  async create(input: CreateCustomerInput): Promise<Customer> {
    // Ensure required fields are present
    if (!input.phone || !input.full_name) {
      throw new Error("Phone and full_name are required to create a customer");
    }
    
    // Only pass fields that exist in the table, excluding is_active (it has a default)
    const insertData: any = {
      phone: input.phone,
      full_name: input.full_name,
    };
    
    // Add optional fields only if they're provided
    if (input.email) insertData.email = input.email;
    if (input.date_of_birth) insertData.date_of_birth = input.date_of_birth;
    if (input.gender) insertData.gender = input.gender;
    if (input.address) insertData.address = input.address;
    if (input.city) insertData.city = input.city;
    if (input.state) insertData.state = input.state;
    if (input.pincode) insertData.pincode = input.pincode;
    if (input.profile_photo_url) insertData.profile_photo_url = input.profile_photo_url;
    
    // is_active has a default value of true, so we don't need to set it explicitly
    // But we can set it if it's explicitly provided as false
    
    const results = await insertQuery<Customer>("customers", insertData);
    
    if (!results[0]) {
      throw new Error("Failed to create customer");
    }
    
    return results[0];
  }

  /**
   * Update customer
   * Replaces: kv.set(`customer:${customerId}`, updatedData)
   */
  async update(customerId: string, input: UpdateCustomerInput): Promise<Customer> {
    const results = await updateQuery<Customer>(
      "customers",
      { id: customerId },
      {
        ...input,
        updated_at: new Date().toISOString(),
      }
    );
    
    if (!results[0]) {
      throw new Error(`Customer not found: ${customerId}`);
    }
    
    return results[0];
  }

  /**
   * Delete customer (soft delete by setting is_active = false)
   */
  async delete(customerId: string): Promise<void> {
    await this.update(customerId, { is_active: false });
  }

  /**
   * Upsert customer (create or update)
   * Useful for phone-based upserts
   */
  async upsert(input: CreateCustomerInput & { id?: string }): Promise<Customer> {
    const results = await upsertQuery<Customer>(
      "customers",
      {
        ...input,
        is_active: true,
      },
      "phone"
    );
    
    if (!results[0]) {
      throw new Error("Failed to upsert customer");
    }
    
    return results[0];
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(customerId: string): Promise<void> {
    await this.update(customerId, {
      last_login_at: new Date().toISOString(),
    });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let repositoryInstance: CustomersRepository | null = null;

export function getCustomersRepository(): CustomersRepository {
  if (!repositoryInstance) {
    repositoryInstance = new CustomersRepository();
  }
  return repositoryInstance;
}

