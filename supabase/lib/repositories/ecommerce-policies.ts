/**
 * ============================================================================
 * ECOMMERCE POLICIES REPOSITORY
 * ============================================================================
 * 
 * Repository for ecommerce policy data access.
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-23
 * Migration: Phase 3, Task 3.2 - Complete Ecommerce Policies
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, deleteQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface EcommercePolicy {
  id: string;
  vendor_id: string | null;
  policy_type: 'return' | 'shipping' | 'warranty' | 'refund' | 'cancellation' | 'exchange';
  policy_name: string;
  policy_description: string | null;
  policy_data: any;
  return_window_days: number | null;
  return_conditions: string[] | null;
  return_shipping_cost: number | null;
  refund_processing_days: number | null;
  shipping_zones: any | null;
  shipping_rates: any | null;
  delivery_timeframes: any | null;
  free_shipping_threshold: number | null;
  warranty_period_days: number | null;
  warranty_terms: string | null;
  warranty_claim_process: string | null;
  refund_method: string | null;
  refund_processing_time_days: number | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePolicyInput {
  vendor_id?: string | null;
  policy_type: 'return' | 'shipping' | 'warranty' | 'refund' | 'cancellation' | 'exchange';
  policy_name: string;
  policy_description?: string | null;
  policy_data: any;
  return_window_days?: number | null;
  return_conditions?: string[] | null;
  return_shipping_cost?: number | null;
  refund_processing_days?: number | null;
  shipping_zones?: any | null;
  shipping_rates?: any | null;
  delivery_timeframes?: any | null;
  free_shipping_threshold?: number | null;
  warranty_period_days?: number | null;
  warranty_terms?: string | null;
  warranty_claim_process?: string | null;
  refund_method?: string | null;
  refund_processing_time_days?: number | null;
  is_active?: boolean;
  is_default?: boolean;
}

export class EcommercePoliciesRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findById(policyId: string): Promise<EcommercePolicy | null> {
    const results = await selectQuery<EcommercePolicy>("ecommerce_policies", { id: policyId }, { limit: 1 });
    return results[0] || null;
  }

  async findByVendor(vendorId: string, options?: { policyType?: string; isActive?: boolean }): Promise<EcommercePolicy[]> {
    const filters: any = { vendor_id: vendorId };
    if (options?.policyType) {
      filters.policy_type = options.policyType;
    }
    if (options?.isActive !== undefined) {
      filters.is_active = options.isActive;
    }
    return selectQuery<EcommercePolicy>("ecommerce_policies", filters, {
      orderBy: "is_default",
      orderDirection: "desc",
    });
  }

  async findDefaultForVendor(vendorId: string, policyType: string): Promise<EcommercePolicy | null> {
    const results = await selectQuery<EcommercePolicy>("ecommerce_policies", {
      vendor_id: vendorId,
      policy_type: policyType,
      is_default: true,
      is_active: true,
    }, { limit: 1 });
    return results[0] || null;
  }

  async findByProduct(productId: string, policyType?: string): Promise<EcommercePolicy[]> {
    const { data: productPolicies } = await this.client
      .from('product_policies')
      .select('policy_id, policy_type')
      .eq('product_id', productId);

    if (!productPolicies || productPolicies.length === 0) {
      return [];
    }

    const policyIds = productPolicies
      .filter(pp => !policyType || pp.policy_type === policyType)
      .map(pp => pp.policy_id);

    if (policyIds.length === 0) {
      return [];
    }

    return selectQuery<EcommercePolicy>("ecommerce_policies", {
      id: { $in: policyIds },
      is_active: true,
    });
  }

  async create(input: CreatePolicyInput): Promise<EcommercePolicy> {
    const results = await insertQuery<EcommercePolicy>("ecommerce_policies", {
      vendor_id: input.vendor_id || null,
      policy_type: input.policy_type,
      policy_name: input.policy_name,
      policy_description: input.policy_description || null,
      policy_data: input.policy_data,
      return_window_days: input.return_window_days || null,
      return_conditions: input.return_conditions || null,
      return_shipping_cost: input.return_shipping_cost || null,
      refund_processing_days: input.refund_processing_days || null,
      shipping_zones: input.shipping_zones || null,
      shipping_rates: input.shipping_rates || null,
      delivery_timeframes: input.delivery_timeframes || null,
      free_shipping_threshold: input.free_shipping_threshold || null,
      warranty_period_days: input.warranty_period_days || null,
      warranty_terms: input.warranty_terms || null,
      warranty_claim_process: input.warranty_claim_process || null,
      refund_method: input.refund_method || null,
      refund_processing_time_days: input.refund_processing_time_days || null,
      is_active: input.is_active !== false,
      is_default: input.is_default || false,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create policy");
    }
    
    return results[0];
  }

  async update(policyId: string, input: Partial<CreatePolicyInput>): Promise<EcommercePolicy> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (input.policy_name !== undefined) updateData.policy_name = input.policy_name;
    if (input.policy_description !== undefined) updateData.policy_description = input.policy_description;
    if (input.policy_data !== undefined) updateData.policy_data = input.policy_data;
    if (input.return_window_days !== undefined) updateData.return_window_days = input.return_window_days;
    if (input.return_conditions !== undefined) updateData.return_conditions = input.return_conditions;
    if (input.return_shipping_cost !== undefined) updateData.return_shipping_cost = input.return_shipping_cost;
    if (input.refund_processing_days !== undefined) updateData.refund_processing_days = input.refund_processing_days;
    if (input.shipping_zones !== undefined) updateData.shipping_zones = input.shipping_zones;
    if (input.shipping_rates !== undefined) updateData.shipping_rates = input.shipping_rates;
    if (input.delivery_timeframes !== undefined) updateData.delivery_timeframes = input.delivery_timeframes;
    if (input.free_shipping_threshold !== undefined) updateData.free_shipping_threshold = input.free_shipping_threshold;
    if (input.warranty_period_days !== undefined) updateData.warranty_period_days = input.warranty_period_days;
    if (input.warranty_terms !== undefined) updateData.warranty_terms = input.warranty_terms;
    if (input.warranty_claim_process !== undefined) updateData.warranty_claim_process = input.warranty_claim_process;
    if (input.refund_method !== undefined) updateData.refund_method = input.refund_method;
    if (input.refund_processing_time_days !== undefined) updateData.refund_processing_time_days = input.refund_processing_time_days;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;
    if (input.is_default !== undefined) updateData.is_default = input.is_default;
    
    const results = await updateQuery<EcommercePolicy>("ecommerce_policies", { id: policyId }, updateData);
    
    if (!results[0]) {
      throw new Error(`Policy not found: ${policyId}`);
    }
    
    return results[0];
  }

  async delete(policyId: string): Promise<void> {
    await deleteQuery("ecommerce_policies", { id: policyId });
  }

  async linkProductToPolicy(productId: string, policyId: string, policyType: string): Promise<void> {
    await insertQuery("product_policies", {
      product_id: productId,
      policy_id: policyId,
      policy_type: policyType,
    });
  }

  async unlinkProductFromPolicy(productId: string, policyId: string, policyType: string): Promise<void> {
    await deleteQuery("product_policies", {
      product_id: productId,
      policy_id: policyId,
      policy_type: policyType,
    });
  }

  async recordAcceptance(customerId: string, policyId: string, policyType: string, orderId?: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await insertQuery("policy_acceptances", {
      customer_id: customerId,
      order_id: orderId || null,
      policy_id: policyId,
      policy_type: policyType,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
    });
  }

  async hasAccepted(customerId: string, policyId: string, orderId?: string): Promise<boolean> {
    const filters: any = {
      customer_id: customerId,
      policy_id: policyId,
    };
    if (orderId) {
      filters.order_id = orderId;
    }
    const results = await selectQuery("policy_acceptances", filters, { limit: 1 });
    return results.length > 0;
  }
}

let repositoryInstance: EcommercePoliciesRepository | null = null;

export function getEcommercePoliciesRepository(): EcommercePoliciesRepository {
  if (!repositoryInstance) {
    repositoryInstance = new EcommercePoliciesRepository();
  }
  return repositoryInstance;
}

