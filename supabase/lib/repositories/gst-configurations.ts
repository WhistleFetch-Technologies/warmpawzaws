/**
 * ============================================================================
 * GST CONFIGURATIONS REPOSITORY
 * ============================================================================
 * 
 * Repository for GST configuration data access.
 * Replaces: platform:gst_configs KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-23
 * Migration: Phase 1, Task 1.2 - KV to SQL
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, deleteQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface GstConfiguration {
  id: string;
  hsn_code: string | null;
  category: string | null;
  gst_rate: number;
  cgst_rate: number | null;
  sgst_rate: number | null;
  igst_rate: number | null;
  applicable_states: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateGstConfigurationInput {
  hsn_code?: string | null;
  category?: string | null;
  gst_rate: number;
  cgst_rate?: number | null;
  sgst_rate?: number | null;
  igst_rate?: number | null;
  applicable_states?: string[];
  is_active?: boolean;
}

export interface UpdateGstConfigurationInput {
  hsn_code?: string | null;
  category?: string | null;
  gst_rate?: number;
  cgst_rate?: number | null;
  sgst_rate?: number | null;
  igst_rate?: number | null;
  applicable_states?: string[];
  is_active?: boolean;
}

export class GstConfigurationsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findById(configId: string): Promise<GstConfiguration | null> {
    const results = await selectQuery<GstConfiguration>("gst_configurations", { id: configId }, { limit: 1 });
    return results[0] || null;
  }

  async findByHsnCode(hsnCode: string): Promise<GstConfiguration | null> {
    const results = await selectQuery<GstConfiguration>("gst_configurations", { hsn_code: hsnCode, is_active: true }, { limit: 1 });
    return results[0] || null;
  }

  async findByCategory(category: string): Promise<GstConfiguration[]> {
    return selectQuery<GstConfiguration>("gst_configurations", { category, is_active: true }, {
      orderBy: "created_at",
      orderDirection: "desc"
    });
  }

  async findAll(options?: { isActive?: boolean }): Promise<GstConfiguration[]> {
    const conditions: any = {};
    if (options?.isActive !== undefined) {
      conditions.is_active = options.isActive;
    }
    return selectQuery<GstConfiguration>("gst_configurations", conditions, {
      orderBy: "created_at",
      orderDirection: "desc"
    });
  }

  async create(input: CreateGstConfigurationInput): Promise<GstConfiguration> {
    const results = await insertQuery<GstConfiguration>("gst_configurations", {
      hsn_code: input.hsn_code || null,
      category: input.category || null,
      gst_rate: input.gst_rate,
      cgst_rate: input.cgst_rate || null,
      sgst_rate: input.sgst_rate || null,
      igst_rate: input.igst_rate || null,
      applicable_states: input.applicable_states || [],
      is_active: input.is_active !== false,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create GST configuration");
    }
    
    return results[0];
  }

  async update(configId: string, input: UpdateGstConfigurationInput): Promise<GstConfiguration> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (input.hsn_code !== undefined) updateData.hsn_code = input.hsn_code;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.gst_rate !== undefined) updateData.gst_rate = input.gst_rate;
    if (input.cgst_rate !== undefined) updateData.cgst_rate = input.cgst_rate;
    if (input.sgst_rate !== undefined) updateData.sgst_rate = input.sgst_rate;
    if (input.igst_rate !== undefined) updateData.igst_rate = input.igst_rate;
    if (input.applicable_states !== undefined) updateData.applicable_states = input.applicable_states;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;
    
    const results = await updateQuery<GstConfiguration>("gst_configurations", { id: configId }, updateData);
    
    if (!results[0]) {
      throw new Error(`GST configuration not found: ${configId}`);
    }
    
    return results[0];
  }

  async delete(configId: string): Promise<void> {
    await deleteQuery("gst_configurations", { id: configId });
  }
}

let repositoryInstance: GstConfigurationsRepository | null = null;

export function getGstConfigurationsRepository(): GstConfigurationsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new GstConfigurationsRepository();
  }
  return repositoryInstance;
}

