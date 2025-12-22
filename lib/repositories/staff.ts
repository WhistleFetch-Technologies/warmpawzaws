/**
 * ============================================================================
 * STAFF REPOSITORY
 * ============================================================================
 * 
 * Repository for staff data access.
 * Replaces: staff:{staffId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-22
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, deleteQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface Staff {
  id: string;
  vendor_id: string;
  name: string;
  phone: string;
  email?: string | null;
  role: string;
  experience_years?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StaffService {
  id: string;
  staff_id: string;
  service_id: string;
  price?: number | null;
  duration_minutes?: number | null;
  is_active: boolean;
  created_at: string;
}

export interface CreateStaffInput {
  vendor_id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  experience_years?: number;
}

export class StaffRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findById(staffId: string): Promise<Staff | null> {
    const results = await selectQuery<Staff>("staff", { id: staffId }, { limit: 1 });
    return results[0] || null;
  }

  async findByVendor(vendorId: string, options?: { limit?: number; offset?: number }): Promise<Staff[]> {
    return selectQuery<Staff>("staff", { vendor_id: vendorId, is_active: true }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  async create(input: CreateStaffInput): Promise<Staff> {
    const results = await insertQuery<Staff>("staff", {
      ...input,
      is_active: true,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create staff");
    }
    
    return results[0];
  }

  async update(staffId: string, input: Partial<CreateStaffInput>): Promise<Staff> {
    const results = await updateQuery<Staff>(
      "staff",
      { id: staffId },
      {
        ...input,
        updated_at: new Date().toISOString(),
      }
    );
    
    if (!results[0]) {
      throw new Error(`Staff not found: ${staffId}`);
    }
    
    return results[0];
  }

  async delete(staffId: string): Promise<void> {
    await this.update(staffId, { is_active: false });
  }

  /**
   * Get staff services
   * Replaces: kv.getByPrefix(`staff:${staffId}:service:`)
   */
  async getStaffServices(staffId: string): Promise<StaffService[]> {
    return selectQuery<StaffService>("staff_services", { staff_id: staffId, is_active: true }, {
      orderBy: "created_at",
    });
  }

  /**
   * Get staff service by service ID
   */
  async getStaffService(staffId: string, serviceId: string): Promise<StaffService | null> {
    const results = await selectQuery<StaffService>(
      "staff_services",
      { staff_id: staffId, service_id: serviceId },
      { limit: 1 }
    );
    return results[0] || null;
  }
}

let repositoryInstance: StaffRepository | null = null;

export function getStaffRepository(): StaffRepository {
  if (!repositoryInstance) {
    repositoryInstance = new StaffRepository();
  }
  return repositoryInstance;
}

