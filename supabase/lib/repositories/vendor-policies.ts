/**
 * VENDOR POLICIES REPOSITORY
 * SQL-based repository for vendor policies
 * NO KV STORE - All data from SQL
 */

import { getDbClient } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface VendorPolicy {
  id: string;
  vendorId: string;
  policyType: string;
  policyConfig: any; // JSONB
  serviceType?: string;
  serviceStyle?: string;
  isActive: boolean;
  isDefault: boolean;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class VendorPoliciesRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Get policies for a vendor
   */
  async getVendorPolicies(vendorId: string, policyType?: string): Promise<VendorPolicy[]> {
    try {
      let query = this.client
        .from('vendor_policies')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (policyType) {
        query = query.eq('policy_type', policyType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching vendor policies:', error);
        return [];
      }

      return (data || []).map(this.mapPolicyFromDb);
    } catch (error) {
      console.error('Error in getVendorPolicies:', error);
      return [];
    }
  }

  /**
   * Get default policy for a vendor and type
   */
  async getDefaultPolicy(vendorId: string, policyType: string): Promise<VendorPolicy | null> {
    try {
      const { data, error } = await this.client
        .from('vendor_policies')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('policy_type', policyType)
        .eq('is_default', true)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapPolicyFromDb(data);
    } catch (error) {
      console.error('Error in getDefaultPolicy:', error);
      return null;
    }
  }

  /**
   * Create a new policy
   */
  async createPolicy(policyData: Partial<VendorPolicy>): Promise<VendorPolicy> {
    try {
      // If this is a default policy, unset other defaults of the same type
      if (policyData.isDefault) {
        await this.client
          .from('vendor_policies')
          .update({ is_default: false })
          .eq('vendor_id', policyData.vendorId!)
          .eq('policy_type', policyData.policyType!);
      }

      const insertData: any = {
        vendor_id: policyData.vendorId!,
        policy_type: policyData.policyType!,
        policy_config: policyData.policyConfig || {},
        service_type: policyData.serviceType || null,
        service_style: policyData.serviceStyle || null,
        is_active: policyData.isActive !== undefined ? policyData.isActive : true,
        is_default: policyData.isDefault || false,
        description: policyData.description || null
      };

      const { data, error } = await this.client
        .from('vendor_policies')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapPolicyFromDb(data);
    } catch (error) {
      console.error('Error creating policy:', error);
      throw error;
    }
  }

  /**
   * Update a policy
   */
  async updatePolicy(policyId: string, updates: Partial<VendorPolicy>): Promise<VendorPolicy | null> {
    try {
      // If setting as default, unset other defaults
      if (updates.isDefault) {
        const existing = await this.getPolicyById(policyId);
        if (existing) {
          await this.client
            .from('vendor_policies')
            .update({ is_default: false })
            .eq('vendor_id', existing.vendorId)
            .eq('policy_type', existing.policyType)
            .neq('id', policyId);
        }
      }

      const updateData: any = {};

      if (updates.policyConfig !== undefined) updateData.policy_config = updates.policyConfig;
      if (updates.serviceType !== undefined) updateData.service_type = updates.serviceType;
      if (updates.serviceStyle !== undefined) updateData.service_style = updates.serviceStyle;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      if (updates.isDefault !== undefined) updateData.is_default = updates.isDefault;
      if (updates.description !== undefined) updateData.description = updates.description;

      updateData.updated_at = new Date().toISOString();

      const { data, error } = await this.client
        .from('vendor_policies')
        .update(updateData)
        .eq('id', policyId)
        .select()
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapPolicyFromDb(data);
    } catch (error) {
      console.error('Error updating policy:', error);
      return null;
    }
  }

  /**
   * Delete a policy (soft delete)
   */
  async deletePolicy(policyId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('vendor_policies')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', policyId);

      return !error;
    } catch (error) {
      console.error('Error deleting policy:', error);
      return false;
    }
  }

  /**
   * Get policy by ID
   */
  async getPolicyById(policyId: string): Promise<VendorPolicy | null> {
    try {
      const { data, error } = await this.client
        .from('vendor_policies')
        .select('*')
        .eq('id', policyId)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapPolicyFromDb(data);
    } catch (error) {
      console.error('Error in getPolicyById:', error);
      return null;
    }
  }

  /**
   * Map database row to VendorPolicy
   */
  private mapPolicyFromDb(row: any): VendorPolicy {
    return {
      id: row.id,
      vendorId: row.vendor_id,
      policyType: row.policy_type,
      policyConfig: row.policy_config || {},
      serviceType: row.service_type || undefined,
      serviceStyle: row.service_style || undefined,
      isActive: row.is_active,
      isDefault: row.is_default,
      description: row.description || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

let vendorPoliciesRepositoryInstance: VendorPoliciesRepository | null = null;

export function getVendorPoliciesRepository(): VendorPoliciesRepository {
  if (!vendorPoliciesRepositoryInstance) {
    vendorPoliciesRepositoryInstance = new VendorPoliciesRepository();
  }
  return vendorPoliciesRepositoryInstance;
}

