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
import type { Pool } from "../db";
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
    service_type?: string | null;
    duration?: number | null;
    service_name?: string | null;
}
export interface CreateServiceInput {
    vendor_id?: string;
    name: string;
    description?: string;
    category: string;
    price: number;
    duration_minutes?: number;
}
export declare class ServicesRepository {
    private pool;
    constructor(pool?: Pool);
    private getPool;
    findById(serviceId: string): Promise<Service | null>;
    findByVendor(vendorId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<Service[]>;
    findByCategory(category: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<Service[]>;
    findAll(options?: {
        limit?: number;
        offset?: number;
        is_active?: boolean;
    }): Promise<Service[]>;
    create(input: CreateServiceInput): Promise<Service>;
    update(serviceId: string, input: Partial<CreateServiceInput>): Promise<Service>;
    delete(serviceId: string): Promise<void>;
}
export declare function getServicesRepository(): ServicesRepository;
//# sourceMappingURL=services.d.ts.map