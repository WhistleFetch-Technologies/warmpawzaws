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
  address?: any; // JSONB field - can be object with street, city, state, pincode, etc.
  profile_photo_url?: string;
  is_active?: boolean;
  last_login_at?: string;
  user_id?: string; // For linking to users table
  journey_stage?: string; // Customer journey stage
  preferences?: any; // JSONB field for preferences
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
   * CRITICAL: Phone must be normalized before calling this method
   */
  async findByPhone(phone: string): Promise<Customer | null> {
    // Normalize phone to ensure consistent lookup
    const normalizedPhone = phone.trim().replace(/[^0-9]/g, '');
    // Remove country code if present (91 + 10 digits = 12 digits)
    const cleanPhone = normalizedPhone.startsWith('91') && normalizedPhone.length === 12 
      ? normalizedPhone.substring(2) 
      : normalizedPhone.startsWith('0') && normalizedPhone.length === 11
      ? normalizedPhone.substring(1)
      : normalizedPhone;
    
    console.log(`[CustomersRepository.findByPhone] Searching for phone: "${cleanPhone}" (original: "${phone}")`);
    
    const results = await selectQuery<Customer>("customers", { phone: cleanPhone }, { limit: 1 });
    
    console.log(`[CustomersRepository.findByPhone] Found ${results.length} customer(s) for phone: "${cleanPhone}"`);
    if (results.length > 0) {
      console.log(`[CustomersRepository.findByPhone] Customer found: ${results[0].id}, phone: "${results[0].phone}"`);
    }
    
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
    if (!input.phone) {
      throw new Error("Phone is required to create a customer");
    }
    
    // CRITICAL: The actual database has a customer_id VARCHAR NOT NULL column
    // Generate a unique customer_id based on phone number
    const customerId = `customer_${input.phone.trim().replace(/\D/g, '')}_${Date.now()}`;
    
    // Build insert data matching the ACTUAL database schema
    const insertData: Record<string, any> = {
      customer_id: customerId, // REQUIRED: VARCHAR NOT NULL
      phone: input.phone.trim(), // REQUIRED: VARCHAR NOT NULL
    };
    
    // Add optional fields based on actual schema
    if (input.full_name && input.full_name.trim()) {
      insertData.full_name = input.full_name.trim();
    }
    if (input.email && input.email.trim()) {
      insertData.email = input.email.trim();
    }
    // Note: The actual schema uses JSONB for address, not separate fields
    // If address is provided as string, we might need to convert it
    
    // Explicitly exclude auto-generated fields
    delete (insertData as any).id; // UUID primary key, auto-generated
    delete (insertData as any).created_at; // Auto-generated
    delete (insertData as any).updated_at; // Auto-generated
    
    console.log('[CustomersRepository] Creating customer with data:', JSON.stringify(insertData));
    console.log('[CustomersRepository] Data keys:', Object.keys(insertData));
    
    const results = await insertQuery<Customer>("customers", insertData);
    
    if (!results[0]) {
      throw new Error("Failed to create customer: No result returned");
    }
    
    console.log('[CustomersRepository] Customer created successfully:', results[0].id);
    
    return results[0];
  }

  /**
   * Update customer
   * Replaces: kv.set(`customer:${customerId}`, updatedData)
   */
  async update(customerId: string, input: UpdateCustomerInput): Promise<Customer> {
    // Get existing customer to preserve preferences
    const existing = await this.findById(customerId);
    if (!existing) {
      throw new Error(`Customer not found: ${customerId}`);
    }
    
    // Build update data - only include fields that exist in actual schema
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    
    // Add allowed fields that exist in actual schema
    if (input.email !== undefined) updateData.email = input.email;
    if (input.full_name !== undefined) updateData.full_name = input.full_name;
    if (input.address !== undefined) updateData.address = input.address; // JSONB field
    if (input.is_active !== undefined) updateData.is_active = input.is_active;
    if (input.user_id !== undefined) updateData.user_id = input.user_id;
    if (input.journey_stage !== undefined) updateData.journey_stage = input.journey_stage;
    
    // Handle profile_photo_url - store in preferences JSONB (column doesn't exist)
    if (input.profile_photo_url !== undefined) {
      const currentPreferences = (existing.preferences as any) || {};
      updateData.preferences = {
        ...currentPreferences,
        profile_photo_url: input.profile_photo_url,
      };
    } else if (input.preferences !== undefined) {
      // If preferences are provided directly, merge with existing
      const currentPreferences = (existing.preferences as any) || {};
      updateData.preferences = {
        ...currentPreferences,
        ...input.preferences,
      };
    }
    
    const results = await updateQuery<Customer>(
      "customers",
      { id: customerId },
      updateData
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
   * Useful for phone-based upserts and avoiding race conditions
   * Note: Uses Supabase upsert without explicit conflict column if unique constraint fails
   */
  async upsert(input: CreateCustomerInput & { id?: string }): Promise<Customer> {
    // Clean input - remove fields that shouldn't be in the upsert
    const cleanInput: Record<string, any> = {
      phone: input.phone.trim(),
      full_name: input.full_name.trim(),
    };
    
    // Add optional fields only if provided
    if (input.email && input.email.trim()) cleanInput.email = input.email.trim();
    if (input.date_of_birth) cleanInput.date_of_birth = input.date_of_birth;
    if (input.gender) cleanInput.gender = input.gender;
    if (input.address && input.address.trim()) cleanInput.address = input.address.trim();
    if (input.city && input.city.trim()) cleanInput.city = input.city.trim();
    if (input.state && input.state.trim()) cleanInput.state = input.state.trim();
    if (input.pincode && input.pincode.trim()) cleanInput.pincode = input.pincode.trim();
    if (input.profile_photo_url && input.profile_photo_url.trim()) {
      cleanInput.profile_photo_url = input.profile_photo_url.trim();
    }
    
    // Explicitly remove forbidden fields
    delete cleanInput.id;
    delete cleanInput.customer_id;
    delete cleanInput.created_at;
    delete cleanInput.updated_at;
    delete cleanInput.last_login_at;
    // Don't set is_active here - let it use default
    
    try {
      // Try upsert with phone conflict column first
      const results = await upsertQuery<Customer>(
        "customers",
        cleanInput,
        "phone"
      );
      
      if (!results[0]) {
        throw new Error("Failed to upsert customer");
      }
      
      return results[0];
    } catch (error: any) {
      // If conflict specification fails (42P10), try without it
      // Supabase will use the unique constraint automatically
      if (error?.code === '42P10' || error?.message?.includes('ON CONFLICT')) {
        console.log('[CustomersRepository] Retrying upsert without conflict specification...');
        const results = await upsertQuery<Customer>(
          "customers",
          cleanInput
          // No conflict column - let Supabase handle it
        );
        
        if (!results[0]) {
          throw new Error("Failed to upsert customer");
        }
        
        return results[0];
      }
      throw error;
    }
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

