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
  created_at: string;
  updated_at: string;
  approved_at?: string | null;
  approved_by?: string | null;
}

export interface CreateVendorInput {
  phone: string;
  email: string;
  business_name: string;
  owner_name: string;
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
  tier?: string;
  commission_percentage?: number;
  operating_hours?: string;
  capacity?: number;
  specialization?: string;
}

export interface UpdateVendorInput {
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
  tier?: string;
  commission_percentage?: number;
  operating_hours?: string;
  capacity?: number;
  specialization?: string;
  is_active?: boolean;
  approved_at?: string;
  approved_by?: string;
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
   * Get vendor by ID
   * Replaces: kv.get(`vendor:${vendorId}`)
   */
  async findById(vendorId: string): Promise<Vendor | null> {
    const results = await selectQuery<Vendor>("vendors", { id: vendorId }, { limit: 1 });
    return results[0] || null;
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
   * Get all active vendors
   */
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
    const results = await insertQuery<Vendor>("vendors", {
      ...input,
      status: input.status || "pending",
      tier: input.tier || "Bronze",
      commission_percentage: input.commission_percentage || 15.00,
      is_active: true,
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

  /**
   * Normalize phone number to 10-digit Indian mobile number
   * Removes country code, spaces, special characters
   */
  private normalizePhone(phone: string): string {
    if (!phone) return '';
    
    // Remove all non-digit characters
    let clean = phone.replace(/[^0-9]/g, '');
    
    // If starts with 91 and has 12 digits (91 + 10 digits), remove country code
    if (clean.startsWith('91') && clean.length === 12) {
      clean = clean.substring(2);
    }
    
    // If starts with 0, remove it (some people write 09876543210)
    if (clean.startsWith('0') && clean.length === 11) {
      clean = clean.substring(1);
    }
    
    return clean;
  }

  /**
   * Resolve vendor ID from various formats
   * Handles:
   * - UUID format (returns as-is if found)
   * - Legacy string format like "vendor_9611377119" (extracts phone number and looks up)
   * - Phone number lookup (with normalization and multiple format attempts)
   * 
   * @param vendorIdOrPhone - Vendor ID in various formats or phone number
   * @returns Resolved UUID vendor ID or null if not found
   */
  async resolveVendorId(vendorIdOrPhone: string): Promise<string | null> {
    if (!vendorIdOrPhone) {
      return null;
    }

    // Check if it's already a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(vendorIdOrPhone)) {
      const vendor = await this.findById(vendorIdOrPhone);
      return vendor ? vendor.id : null;
    }

    // Extract phone number if it's a legacy format like "vendor_9611377119"
    let phoneToSearch = vendorIdOrPhone;
    if (vendorIdOrPhone.startsWith('vendor_')) {
      phoneToSearch = vendorIdOrPhone.replace(/^vendor_/, '');
    }

    // Normalize the phone number
    const normalizedPhone = this.normalizePhone(phoneToSearch);
    
    // Try multiple phone formats to find the vendor
    const phoneVariants = [
      normalizedPhone,                    // "9611377119"
      `+91${normalizedPhone}`,           // "+919611377119"
      `91${normalizedPhone}`,            // "919611377119"
      phoneToSearch,                      // Original format
    ];

    // Remove duplicates
    const uniqueVariants = [...new Set(phoneVariants.filter(v => v))];

    // Try each variant
    for (const phoneVariant of uniqueVariants) {
      const vendor = await this.findByPhone(phoneVariant);
      if (vendor) {
        return vendor.id;
      }
    }

    // Last resort: try to find by ID as-is (in case it's stored differently)
    const vendorById = await this.findById(vendorIdOrPhone);
    return vendorById ? vendorById.id : null;
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

