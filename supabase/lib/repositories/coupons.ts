/**
 * ============================================================================
 * COUPONS REPOSITORY
 * ============================================================================
 * 
 * Repository for coupon data access.
 * Replaces: admin:coupons, coupons:list KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-22
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, withTransaction } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface Coupon {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_discount?: number | null;
  minimum_amount?: number | null;
  max_uses?: number | null;
  max_uses_per_customer?: number | null;
  is_active: boolean;
  starts_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCouponInput {
  code: string;
  name: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_discount?: number;
  minimum_amount?: number;
  max_uses?: number;
  max_uses_per_customer?: number;
  is_active?: boolean;
  starts_at?: string;
  expires_at?: string;
}

export interface CouponUsage {
  id: string;
  coupon_id: string;
  customer_id?: string | null;
  booking_id?: string | null;
  order_id?: string | null;
  used_at: string;
}

export interface ValidateCouponResult {
  valid: boolean;
  coupon?: Coupon;
  discount_amount?: number;
  error?: string;
}

export class CouponsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findAll(options?: { 
    is_active?: boolean; 
    search?: string;
    limit?: number; 
    offset?: number 
  }): Promise<Coupon[]> {
    const filters: any = {};
    if (options?.is_active !== undefined) filters.is_active = options.is_active;
    
    let query = this.client
      .from("coupons")
      .select("*");
    
    if (options?.is_active !== undefined) {
      query = query.eq("is_active", options.is_active);
    }
    
    if (options?.search) {
      query = query.or(`code.ilike.%${options.search}%,name.ilike.%${options.search}%`);
    }
    
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }
    
    query = query.order("created_at", { ascending: false });
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    return (data || []) as Coupon[];
  }

  async findByCode(code: string): Promise<Coupon | null> {
    const results = await selectQuery<Coupon>("coupons", { code: code.toUpperCase() }, { limit: 1 });
    return results[0] || null;
  }

  async findById(couponId: string): Promise<Coupon | null> {
    const results = await selectQuery<Coupon>("coupons", { id: couponId }, { limit: 1 });
    return results[0] || null;
  }

  async getUsageCount(couponId: string, customerId?: string): Promise<number> {
    let query = this.client
      .from("coupon_usages")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", couponId);
    
    if (customerId) {
      query = query.eq("customer_id", customerId);
    }
    
    const { count, error } = await query;
    
    if (error) {
      throw error;
    }
    
    return count || 0;
  }

  async validateCoupon(code: string, amount: number, customerId?: string): Promise<ValidateCouponResult> {
    const coupon = await this.findByCode(code);
    
    if (!coupon) {
      return { valid: false, error: "Invalid coupon code" };
    }
    
    if (!coupon.is_active) {
      return { valid: false, error: "Coupon is not active" };
    }
    
    // Check dates
    const now = new Date();
    if (coupon.starts_at && new Date(coupon.starts_at) > now) {
      return { valid: false, error: "Coupon is not yet valid" };
    }
    
    if (coupon.expires_at && new Date(coupon.expires_at) < now) {
      return { valid: false, error: "Coupon has expired" };
    }
    
    // Check minimum amount
    if (coupon.minimum_amount && amount < coupon.minimum_amount) {
      return { valid: false, error: `Minimum order amount of ₹${coupon.minimum_amount} required` };
    }
    
    // Check max uses
    if (coupon.max_uses) {
      const usageCount = await this.getUsageCount(coupon.id);
      if (usageCount >= coupon.max_uses) {
        return { valid: false, error: "Coupon usage limit reached" };
      }
    }
    
    // Check per-customer limit
    if (coupon.max_uses_per_customer && customerId) {
      const customerUsageCount = await this.getUsageCount(coupon.id, customerId);
      if (customerUsageCount >= coupon.max_uses_per_customer) {
        return { valid: false, error: "You have already used this coupon" };
      }
    }
    
    // Calculate discount
    let discountAmount = 0;
    if (coupon.discount_type === 'percentage') {
      discountAmount = (amount * coupon.discount_value) / 100;
      if (coupon.max_discount) {
        discountAmount = Math.min(discountAmount, coupon.max_discount);
      }
    } else {
      discountAmount = coupon.discount_value;
    }
    
    return {
      valid: true,
      coupon,
      discount_amount: discountAmount
    };
  }

  async create(input: CreateCouponInput): Promise<Coupon> {
    // Normalize code to uppercase
    const code = input.code.toUpperCase();
    
    // Check if code already exists
    const existing = await this.findByCode(code);
    if (existing) {
      throw new Error(`Coupon code ${code} already exists`);
    }
    
    const results = await insertQuery<Coupon>("coupons", {
      ...input,
      code,
      is_active: input.is_active !== false,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create coupon");
    }
    
    return results[0];
  }

  async update(couponId: string, input: Partial<CreateCouponInput>): Promise<Coupon> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (input.code !== undefined) {
      updateData.code = input.code.toUpperCase();
      // Check if new code already exists (excluding current coupon)
      const existing = await this.findByCode(input.code.toUpperCase());
      if (existing && existing.id !== couponId) {
        throw new Error(`Coupon code ${input.code.toUpperCase()} already exists`);
      }
    }
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.discount_type !== undefined) updateData.discount_type = input.discount_type;
    if (input.discount_value !== undefined) updateData.discount_value = input.discount_value;
    if (input.max_discount !== undefined) updateData.max_discount = input.max_discount;
    if (input.minimum_amount !== undefined) updateData.minimum_amount = input.minimum_amount;
    if (input.max_uses !== undefined) updateData.max_uses = input.max_uses;
    if (input.max_uses_per_customer !== undefined) updateData.max_uses_per_customer = input.max_uses_per_customer;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;
    if (input.starts_at !== undefined) updateData.starts_at = input.starts_at;
    if (input.expires_at !== undefined) updateData.expires_at = input.expires_at;
    
    const results = await updateQuery<Coupon>(
      "coupons",
      { id: couponId },
      updateData
    );
    
    if (!results[0]) {
      throw new Error(`Coupon not found: ${couponId}`);
    }
    
    return results[0];
  }

  async delete(couponId: string): Promise<void> {
    // Soft delete
    await updateQuery<Coupon>(
      "coupons",
      { id: couponId },
      { is_active: false }
    );
  }

  async recordUsage(couponId: string, customerId?: string, bookingId?: string, orderId?: string): Promise<CouponUsage> {
    const results = await insertQuery<CouponUsage>("coupon_usages", {
      coupon_id: couponId,
      customer_id: customerId || null,
      booking_id: bookingId || null,
      order_id: orderId || null,
      used_at: new Date().toISOString(),
    });
    
    if (!results[0]) {
      throw new Error("Failed to record coupon usage");
    }
    
    return results[0];
  }

  async getUsages(couponId: string, options?: { limit?: number; offset?: number }): Promise<CouponUsage[]> {
    return selectQuery<CouponUsage>("coupon_usages", { coupon_id: couponId }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "used_at",
      orderDirection: "desc",
    });
  }
}

let repositoryInstance: CouponsRepository | null = null;

export function getCouponsRepository(): CouponsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new CouponsRepository();
  }
  return repositoryInstance;
}

