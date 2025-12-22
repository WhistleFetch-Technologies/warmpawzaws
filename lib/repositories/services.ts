/**
 * ============================================================================
 * SERVICES REPOSITORY
 * ============================================================================
 * 
 * Repository for service data access.
 * Replaces: service:{serviceId} KV keys
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

export interface Service {
  id: string;
  vendor_id?: string | null;
  name: string;
  description?: string | null;
  category: string;
  price: number;
  duration_minutes?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateServiceInput {
  vendor_id?: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  duration_minutes?: number;
}

export class ServicesRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findById(serviceId: string): Promise<Service | null> {
    const results = await selectQuery<Service>("services", { id: serviceId }, { limit: 1 });
    return results[0] || null;
  }

  async findByVendor(vendorId: string, options?: { limit?: number; offset?: number }): Promise<Service[]> {
    return selectQuery<Service>("services", { vendor_id: vendorId, is_active: true }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  async findByCategory(category: string, options?: { limit?: number; offset?: number }): Promise<Service[]> {
    return selectQuery<Service>("services", { category, is_active: true }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "name",
    });
  }

  async create(input: CreateServiceInput): Promise<Service> {
    const results = await insertQuery<Service>("services", {
      ...input,
      is_active: true,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create service");
    }
    
    return results[0];
  }

  async update(serviceId: string, input: Partial<CreateServiceInput>): Promise<Service> {
    const results = await updateQuery<Service>(
      "services",
      { id: serviceId },
      {
        ...input,
        updated_at: new Date().toISOString(),
      }
    );
    
    if (!results[0]) {
      throw new Error(`Service not found: ${serviceId}`);
    }
    
    return results[0];
  }

  async delete(serviceId: string): Promise<void> {
    await this.update(serviceId, { is_active: false });
  }
}

let repositoryInstance: ServicesRepository | null = null;

export function getServicesRepository(): ServicesRepository {
  if (!repositoryInstance) {
    repositoryInstance = new ServicesRepository();
  }
  return repositoryInstance;
}

