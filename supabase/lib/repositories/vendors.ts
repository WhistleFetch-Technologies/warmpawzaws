/**
 * ============================================================================
 * VENDORS REPOSITORY
 * ============================================================================
 * 
 * Repository for vendor data access.
 * Replaces: vendor:{vendorId} KV keys
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

export interface Vendor {
  id: string;
  user_id?: string | null; // ✅ UUID reference to user account
  phone: string;
  email: string;
  business_name: string;
  owner_name: string;
  alternate_phone?: string | null;
  role_id?: string | null;
  category?: string | null;
  experience_years?: number | null;
  registration_number?: string | null;
  gst_number?: string | null;
  pan_number?: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: string;
  tier: string;
  commission_percentage: number;
  operating_hours?: string | null;
  capacity?: number | null;
  specialization?: string | null;
  is_active: boolean;
  setup_completed?: boolean; // ✅ FIX: Add setup_completed field
  created_at: string;
  updated_at: string;
  approved_at?: string | null;
  approved_by?: string | null;
}

export interface CreateVendorInput {
  vendor_id?: string; // ✅ CRITICAL: vendor_id is required by DB (NOT NULL), but can be auto-generated if not provided
  phone: string;
  email: string;
  business_name: string;
  owner_name: string;
  user_id?: string; // ✅ UUID reference to user account
  alternate_phone?: string;
  role_id?: string;
  category?: string;
  experience_years?: number;
  registration_number?: string;
  gst_number?: string;
  pan_number?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  status?: string;
  // ✅ Removed: tier and commission_percentage don't exist in vendors table
  operating_hours?: string;
  capacity?: number;
  specialization?: string;
}

export interface UpdateVendorInput {
  user_id?: string; // ✅ UUID reference to user account
  email?: string;
  business_name?: string;
  owner_name?: string;
  alternate_phone?: string;
  role_id?: string;
  category?: string;
  experience_years?: number;
  registration_number?: string;
  gst_number?: string;
  pan_number?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  status?: string;
  // ✅ Removed: tier and commission_percentage don't exist in vendors table
  operating_hours?: string;
  capacity?: number;
  specialization?: string;
  is_active?: boolean;
  setup_completed?: boolean; // ✅ FIX: Add setup_completed field
  approved_at?: string;
  approved_by?: string;
  rejection_reason?: string; // ✅ PHASE 4 FIX 4.2: Add rejection_reason field
}

// ============================================================================
// REPOSITORY CLASS
// ============================================================================

export class VendorsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Get vendor by ID (UUID)
   * Replaces: kv.get(`vendor:${vendorId}`)
   */
  async findById(vendorId: string): Promise<Vendor | null> {
    const results = await selectQuery<Vendor>("vendors", { id: vendorId }, { limit: 1 });
    return results[0] || null;
  }

  /**
   * Get vendor by vendor_id (string identifier like vendor_9611377119)
   * ✅ CRITICAL: Handles vendor_id string identifiers, not just UUIDs
   */
  async findByVendorId(vendorIdString: string): Promise<Vendor | null> {
    const results = await selectQuery<Vendor>("vendors", { vendor_id: vendorIdString }, { limit: 1 });
    return results[0] || null;
  }

  /**
   * Resolve vendor ID - handles both UUID and vendor_id string
   * ✅ CRITICAL FIX: Resolves vendor_9611377119 to UUID
   * ✅ FIX: Also tries phone number as fallback
   */
  async resolveVendorId(identifier: string): Promise<string | null> {
    // Check if it's a UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(identifier)) {
      const vendor = await this.findById(identifier);
      return vendor ? vendor.id : null;
    }
    
    // Check if it's a vendor_id string (like vendor_9611377119)
    if (identifier.startsWith('vendor_')) {
      const vendor = await this.findByVendorId(identifier);
      if (vendor) {
        return vendor.id;
      }
      
      // ✅ FIX: If vendor_id not found, try extracting phone number from vendor_id
      // e.g., "vendor_9611377119" -> "9611377119"
      const phoneMatch = identifier.match(/vendor_(\d+)/);
      if (phoneMatch) {
        const phone = phoneMatch[1];
        console.log(`🔍 [RESOLVE-VENDOR] Trying phone number fallback: ${phone}`);
        const vendorByPhone = await this.findByPhone(phone);
        if (vendorByPhone) {
          console.log(`✅ [RESOLVE-VENDOR] Found vendor by phone: ${vendorByPhone.id}`);
          return vendorByPhone.id;
        }
      }
      
      return null;
    }
    
    // Try as vendor_id string anyway
    const vendor = await this.findByVendorId(identifier);
    if (vendor) {
      return vendor.id;
    }
    
    // ✅ FIX: Last resort - try as phone number
    if (/^\d+$/.test(identifier)) {
      console.log(`🔍 [RESOLVE-VENDOR] Trying as phone number: ${identifier}`);
      const vendorByPhone = await this.findByPhone(identifier);
      if (vendorByPhone) {
        console.log(`✅ [RESOLVE-VENDOR] Found vendor by phone: ${vendorByPhone.id}`);
        return vendorByPhone.id;
      }
    }
    
    return null;
  }

  /**
   * Get vendor by phone
   */
  async findByPhone(phone: string): Promise<Vendor | null> {
    const results = await selectQuery<Vendor>("vendors", { phone }, { limit: 1 });
    return results[0] || null;
  }

  /**
   * Get vendors by status
   * Replaces: kv.getByPrefix('vendor:') with status filter
   */
  async findByStatus(status: string, options?: { limit?: number; offset?: number }): Promise<Vendor[]> {
    return selectQuery<Vendor>("vendors", { status, is_active: true }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  /**
   * Get vendors by tier
   */
  async findByTier(tier: string, options?: { limit?: number; offset?: number }): Promise<Vendor[]> {
    return selectQuery<Vendor>("vendors", { tier, is_active: true }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  /**
   * Get vendors by location
   */
  async findByLocation(filters: {
    city?: string;
    state?: string;
    pincode?: string;
  }, options?: { limit?: number; offset?: number }): Promise<Vendor[]> {
    return selectQuery<Vendor>("vendors", {
      ...filters,
      is_active: true,
    }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  /**
   * Get vendors by role_id
   */
  async findByRole(roleId: string, options?: { limit?: number; offset?: number; status?: string }): Promise<Vendor[]> {
    const filters: any = {
      role_id: roleId,
      is_active: true,
    };
    if (options?.status) {
      filters.status = options.status;
    }
    return selectQuery<Vendor>("vendors", filters, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  /**
   * Get all active vendors
   */
  /**
   * Get all vendors (with optional filters)
   */
  async findAll(options?: { limit?: number; offset?: number; status?: string }): Promise<Vendor[]> {
    const conditions: any = {};
    if (options?.status) {
      conditions.status = options.status;
    }
    
    return selectQuery<Vendor>("vendors", conditions, {
      limit: options?.limit || 1000,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  async findAllActive(options?: { limit?: number; offset?: number }): Promise<Vendor[]> {
    return selectQuery<Vendor>("vendors", { is_active: true }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  /**
   * Create a new vendor
   * Replaces: kv.set(`vendor:${vendorId}`, vendorData)
   */
  async create(input: CreateVendorInput): Promise<Vendor> {
    // ✅ CRITICAL FIX: Generate vendor_id if not provided (required field, NOT NULL)
    // vendor_id format: vendor_{phone} (e.g., vendor_9611377118)
    let vendorId = input.vendor_id;
    if (!vendorId && input.phone) {
      // Extract phone number and create vendor_id
      const phoneDigits = input.phone.replace(/[^0-9]/g, '');
      // Remove country code if present (91)
      const cleanPhone = phoneDigits.startsWith('91') && phoneDigits.length === 12 
        ? phoneDigits.substring(2) 
        : phoneDigits.startsWith('0') && phoneDigits.length === 11
        ? phoneDigits.substring(1)
        : phoneDigits;
      vendorId = `vendor_${cleanPhone}`;
    }
    
    if (!vendorId) {
      throw new Error("vendor_id is required. Either provide vendor_id or phone number.");
    }
    
    const results = await insertQuery<Vendor>("vendors", {
      ...input,
      vendor_id: vendorId, // ✅ CRITICAL: Ensure vendor_id is set
      status: input.status || "pending",
      // ✅ Removed: tier and commission_percentage don't exist in vendors table
      is_active: input.is_active !== undefined ? input.is_active : true,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create vendor");
    }
    
    return results[0];
  }

  /**
   * Update vendor
   * Replaces: kv.set(`vendor:${vendorId}`, updatedData)
   */
  async update(vendorId: string, input: UpdateVendorInput): Promise<Vendor> {
    const results = await updateQuery<Vendor>(
      "vendors",
      { id: vendorId },
      {
        ...input,
        updated_at: new Date().toISOString(),
      }
    );
    
    if (!results[0]) {
      throw new Error(`Vendor not found: ${vendorId}`);
    }
    
    return results[0];
  }

  /**
   * Approve vendor
   */
  async approve(vendorId: string, approvedBy: string): Promise<Vendor> {
    return this.update(vendorId, {
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
    });
  }

  /**
   * Reject vendor
   */
  async reject(vendorId: string, approvedBy: string): Promise<Vendor> {
    return this.update(vendorId, {
      status: "rejected",
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
    });
  }

  /**
   * Activate vendor
   */
  async activate(vendorId: string): Promise<Vendor> {
    return this.update(vendorId, {
      status: "active",
      is_active: true,
    });
  }

  /**
   * Suspend vendor
   */
  async suspend(vendorId: string): Promise<Vendor> {
    return this.update(vendorId, {
      status: "suspended",
      is_active: false,
    });
  }

  /**
   * Delete vendor (soft delete)
   */
  async delete(vendorId: string): Promise<void> {
    await this.update(vendorId, { is_active: false });
  }

  /**
   * Upsert vendor
   */
  async upsert(input: CreateVendorInput & { id?: string }): Promise<Vendor> {
    const results = await upsertQuery<Vendor>(
      "vendors",
      {
        ...input,
        status: input.status || "pending",
        tier: input.tier || "Bronze",
        commission_percentage: input.commission_percentage || 15.00,
        is_active: true,
      },
      "phone"
    );
    
    if (!results[0]) {
      throw new Error("Failed to upsert vendor");
    }
    
    return results[0];
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let repositoryInstance: VendorsRepository | null = null;

export function getVendorsRepository(): VendorsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new VendorsRepository();
  }
  return repositoryInstance;
}

