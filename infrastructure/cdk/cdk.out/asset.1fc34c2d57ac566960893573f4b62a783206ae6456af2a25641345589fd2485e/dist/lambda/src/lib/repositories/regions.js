"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRegionsRepository = getRegionsRepository;
const db_1 = require("../db");
/**
 * Get Regions Repository
 */
function getRegionsRepository() {
    return {
        /**
         * Find all regions
         */
        async findAll() {
            const pool = await (0, db_1.getDbClient)();
            const result = await pool.query(`SELECT * FROM regions ORDER BY name ASC`);
            return result.rows.map(mapRowToRegion);
        },
        /**
         * Find active regions only
         */
        async findActive() {
            const pool = await (0, db_1.getDbClient)();
            const result = await pool.query(`SELECT * FROM regions WHERE is_active = true ORDER BY name ASC`);
            return result.rows.map(mapRowToRegion);
        },
        /**
         * Find region by code
         */
        async findByCode(code) {
            const pool = await (0, db_1.getDbClient)();
            const result = await pool.query(`SELECT * FROM regions WHERE code = $1 LIMIT 1`, [code]);
            if (result.rows.length === 0) {
                return null;
            }
            return mapRowToRegion(result.rows[0]);
        },
        /**
         * Create a new region
         */
        async create(regionData) {
            const pool = await (0, db_1.getDbClient)();
            // Extract config data
            const config = regionData.region_config || {};
            const currency = config.currency || {};
            const localization = config.localization || {};
            const insertData = {
                id: regionData.code, // Use code as id
                name: regionData.name,
                code: regionData.code,
                country: regionData.country || undefined,
                region_config: regionData.region_config || {},
                is_active: regionData.is_active ?? true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            // Include optional fields if table has them
            if (regionData.country_code !== undefined) {
                insertData.country_code = regionData.country_code;
            }
            if (regionData.currency_code !== undefined || currency.code) {
                insertData.currency_code = regionData.currency_code || currency.code;
            }
            if (regionData.currency_symbol !== undefined || currency.symbol) {
                insertData.currency_symbol = regionData.currency_symbol || currency.symbol;
            }
            if (regionData.timezone !== undefined || localization.timezone) {
                insertData.timezone = regionData.timezone || localization.timezone;
            }
            const result = await (0, db_1.insertQuery)('regions', insertData);
            if (result.length === 0) {
                throw new Error('Failed to create region');
            }
            const created = result[0];
            // Reconstruct region with config for backward compatibility
            return {
                id: created.id || created.code,
                name: created.name,
                code: created.code,
                country: created.country || undefined,
                region_config: regionData.region_config || {},
                is_active: created.is_active ?? true,
                created_at: created.created_at || new Date().toISOString(),
                updated_at: created.updated_at || new Date().toISOString(),
            };
        },
        /**
         * Update a region
         */
        async update(regionId, updates) {
            const updateData = {
                ...updates,
                updated_at: new Date().toISOString(),
            };
            const result = await (0, db_1.updateQuery)('regions', { code: regionId }, updateData);
            if (result.length === 0) {
                throw new Error('Region not found');
            }
            return result[0];
        },
        /**
         * Activate/deactivate a region
         */
        async setActive(regionId, isActive) {
            return this.update(regionId, { is_active: isActive });
        },
    };
}
/**
 * Map database row to Region interface
 */
function mapRowToRegion(row) {
    return {
        id: row.id || row.code,
        name: row.name,
        code: row.code,
        country: row.country || undefined,
        region_config: row.region_config || {},
        is_active: row.is_active ?? true,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
    };
}
//# sourceMappingURL=regions.js.map