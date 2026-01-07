/**
 * ============================================================================
 * CUSTOMERS REPOSITORY (Lambda Version)
 * ============================================================================
 *
 * Repository for customer data access.
 * Uses AWS RDS Aurora PostgreSQL via RDS Proxy
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ❌ NO Supabase imports allowed
 * ✅ All operations use SQL only
 * ✅ Uses AWS RDS Aurora (not Supabase)
 *
 * Date: 2025-01-28
 * Agent: Agent 3 (Cognito Integration)
 * Migration: Repository Migration to Lambda
 * ============================================================================
 */
import type { Pool } from "../database/db";
export interface Customer {
    id: string;
    user_id?: string | null;
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
    user_id?: string | null;
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
export declare class CustomersRepository {
    private pool;
    constructor(pool?: Pool);
    /**
     * Get database pool (async)
     */
    private getPool;
    /**
     * Get customer by ID
     * Replaces: kv.get(`customer:${customerId}`)
     */
    findById(customerId: string): Promise<Customer | null>;
    /**
     * Get customer by phone
     * Common lookup pattern
     */
    findByPhone(phone: string): Promise<Customer | null>;
    /**
     * Get customer by email
     */
    findByEmail(email: string): Promise<Customer | null>;
    /**
     * Get all customers with filters
     */
    findAll(filters?: {
        city?: string;
        state?: string;
        is_active?: boolean;
    }, options?: {
        limit?: number;
        offset?: number;
        orderBy?: string;
    }): Promise<Customer[]>;
    /**
     * Create a new customer
     * Replaces: kv.set(`customer:${customerId}`, customerData)
     */
    create(input: CreateCustomerInput): Promise<Customer>;
    /**
     * Update customer
     * Replaces: kv.set(`customer:${customerId}`, updatedData)
     */
    update(customerId: string, input: UpdateCustomerInput): Promise<Customer>;
    /**
     * Upsert customer
     */
    upsert(input: CreateCustomerInput & {
        id?: string;
    }): Promise<Customer>;
    /**
     * Delete customer (soft delete)
     */
    delete(customerId: string): Promise<void>;
}
export declare function getCustomersRepository(): CustomersRepository;
//# sourceMappingURL=customers.d.ts.map