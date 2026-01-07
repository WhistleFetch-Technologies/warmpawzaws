/**
 * ============================================================================
 * REGIONS REPOSITORY - SQL-ONLY VERSION
 * ============================================================================
 *
 * Repository for region data access.
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ❌ NO Supabase client allowed
 * ✅ All operations use SQL only (pg Pool)
 *
 * Date: 2025-01-28
 * Migration: Supabase → Lambda
 * ============================================================================
 */
export interface Region {
    id: string;
    name: string;
    code: string;
    country?: string;
    region_config?: any;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}
export interface CreateRegionInput {
    code: string;
    name: string;
    country?: string;
    region_config?: any;
    is_active?: boolean;
    country_code?: string;
    currency_code?: string;
    currency_symbol?: string;
    timezone?: string;
}
export interface UpdateRegionInput {
    name?: string;
    country?: string;
    region_config?: any;
    is_active?: boolean;
}
/**
 * Get Regions Repository
 */
export declare function getRegionsRepository(): {
    /**
     * Find all regions
     */
    findAll(): Promise<Region[]>;
    /**
     * Find active regions only
     */
    findActive(): Promise<Region[]>;
    /**
     * Find region by code
     */
    findByCode(code: string): Promise<Region | null>;
    /**
     * Create a new region
     */
    create(regionData: CreateRegionInput): Promise<Region>;
    /**
     * Update a region
     */
    update(regionId: string, updates: UpdateRegionInput): Promise<Region>;
    /**
     * Activate/deactivate a region
     */
    setActive(regionId: string, isActive: boolean): Promise<Region>;
};
//# sourceMappingURL=regions.d.ts.map