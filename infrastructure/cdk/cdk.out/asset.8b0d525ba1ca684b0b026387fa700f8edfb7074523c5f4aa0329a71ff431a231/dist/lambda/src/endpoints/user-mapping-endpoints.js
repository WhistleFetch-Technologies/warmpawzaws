"use strict";
/**
 * ============================================================================
 * USER MAPPING ENDPOINTS
 * ============================================================================
 *
 * Maps Cognito user IDs to database customer/vendor/admin IDs
 *
 * ✅ SQL-ONLY: All operations use SQL repositories
 *
 * Date: 2025-01-28
 * Migration: New endpoint for user ID mapping
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.userMappingEndpoints = userMappingEndpoints;
const response_utils_1 = require("./response-utils");
const db_1 = require("../lib/db");
/**
 * Register user mapping endpoints
 */
function userMappingEndpoints(app) {
    /**
     * Get user mapping by Cognito user ID
     * GET /auth/user-mapping/:cognitoUserId
     */
    app.get('/auth/user-mapping/:cognitoUserId', async (c) => {
        try {
            const { cognitoUserId } = c.req.param();
            const pool = await (0, db_1.getDbClient)();
            // Check if mapping table exists, if not return null
            const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'cognito_user_mappings'
        );
      `);
            if (!tableCheck.rows[0].exists) {
                // Table doesn't exist - return empty mapping
                // This allows the system to work without mapping table initially
                return (0, response_utils_1.sendSuccess)(c, {
                    cognito_user_id: cognitoUserId,
                    customer_id: null,
                    vendor_id: null,
                    admin_id: null,
                });
            }
            // Query mapping table
            const result = await pool.query(`SELECT 
          cognito_user_id,
          customer_id,
          vendor_id,
          admin_id,
          created_at
        FROM cognito_user_mappings
        WHERE cognito_user_id = $1`, [cognitoUserId]);
            if (result.rows.length === 0) {
                return (0, response_utils_1.sendSuccess)(c, {
                    cognito_user_id: cognitoUserId,
                    customer_id: null,
                    vendor_id: null,
                    admin_id: null,
                });
            }
            const mapping = result.rows[0];
            return (0, response_utils_1.sendSuccess)(c, {
                cognito_user_id: mapping.cognito_user_id,
                customer_id: mapping.customer_id,
                vendor_id: mapping.vendor_id,
                admin_id: mapping.admin_id,
                created_at: mapping.created_at,
            });
        }
        catch (error) {
            console.error('Error fetching user mapping:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * Create or update user mapping
     * POST /auth/user-mapping
     */
    app.post('/auth/user-mapping', async (c) => {
        try {
            const body = await c.req.json();
            const { cognito_user_id, customer_id, vendor_id, admin_id } = body;
            if (!cognito_user_id) {
                return (0, response_utils_1.sendError)(c, new Error('cognito_user_id is required'), 400);
            }
            const pool = await (0, db_1.getDbClient)();
            // Check if mapping table exists, create if not
            const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'cognito_user_mappings'
        );
      `);
            if (!tableCheck.rows[0].exists) {
                // Create mapping table
                await pool.query(`
          CREATE TABLE cognito_user_mappings (
            cognito_user_id TEXT PRIMARY KEY,
            customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
            vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
            admin_id UUID REFERENCES admin_profiles(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          
          CREATE INDEX idx_cognito_mappings_customer ON cognito_user_mappings(customer_id);
          CREATE INDEX idx_cognito_mappings_vendor ON cognito_user_mappings(vendor_id);
          CREATE INDEX idx_cognito_mappings_admin ON cognito_user_mappings(admin_id);
        `);
            }
            // Upsert mapping
            const result = await pool.query(`INSERT INTO cognito_user_mappings (
          cognito_user_id,
          customer_id,
          vendor_id,
          admin_id,
          updated_at
        ) VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (cognito_user_id)
        DO UPDATE SET
          customer_id = EXCLUDED.customer_id,
          vendor_id = EXCLUDED.vendor_id,
          admin_id = EXCLUDED.admin_id,
          updated_at = NOW()
        RETURNING *`, [cognito_user_id, customer_id || null, vendor_id || null, admin_id || null]);
            return (0, response_utils_1.sendSuccess)(c, {
                mapping: result.rows[0],
                message: 'User mapping created/updated successfully',
            });
        }
        catch (error) {
            console.error('Error creating user mapping:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * Get mapping by database ID
     * GET /auth/user-mapping/by-customer/:customerId
     * GET /auth/user-mapping/by-vendor/:vendorId
     * GET /auth/user-mapping/by-admin/:adminId
     */
    app.get('/auth/user-mapping/by-customer/:customerId', async (c) => {
        try {
            const { customerId } = c.req.param();
            const pool = await (0, db_1.getDbClient)();
            const result = await pool.query(`SELECT * FROM cognito_user_mappings WHERE customer_id = $1`, [customerId]);
            if (result.rows.length === 0) {
                return (0, response_utils_1.sendError)(c, new Error('Mapping not found'), 404);
            }
            return (0, response_utils_1.sendSuccess)(c, result.rows[0]);
        }
        catch (error) {
            console.error('Error fetching mapping by customer ID:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    app.get('/auth/user-mapping/by-vendor/:vendorId', async (c) => {
        try {
            const { vendorId } = c.req.param();
            const pool = await (0, db_1.getDbClient)();
            const result = await pool.query(`SELECT * FROM cognito_user_mappings WHERE vendor_id = $1`, [vendorId]);
            if (result.rows.length === 0) {
                return (0, response_utils_1.sendError)(c, new Error('Mapping not found'), 404);
            }
            return (0, response_utils_1.sendSuccess)(c, result.rows[0]);
        }
        catch (error) {
            console.error('Error fetching mapping by vendor ID:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    console.log('✅ User mapping endpoints registered');
}
//# sourceMappingURL=user-mapping-endpoints.js.map