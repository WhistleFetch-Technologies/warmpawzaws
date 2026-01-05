"use strict";
/**
 * 💊 CONTROLLED SUBSTANCES MANAGEMENT - SQL-ONLY VERSION
 *
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 *
 * Handles controlled substances inventory, compliance, and tracking
 *
 * Date: 2025-01-28
 * Migration: KV to SQL (16 KV operations → 0)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.controlledSubstancesEndpointsSQL = controlledSubstancesEndpointsSQL;
const hono_1 = require("hono");
const response_utils_1 = require("./response-utils");
const db_1 = require("../lib/db");
const vendors_1 = require("../lib/repositories/vendors");
// TODO: Create prescriptions repository or use direct SQL queries
// import { getPrescriptionsRepository } from '../lib/repositories/prescriptions';
const app = new hono_1.Hono();
const vendorsRepo = (0, vendors_1.getVendorsRepository)();
// TODO: Create prescriptions repository or use direct SQL queries
// const prescriptionsRepo = getPrescriptionsRepository();
/**
 * GET /vendor/controlled-substances/:vendorId
 * Get all controlled substances for a vendor
 */
app.get('/make-server-3dd53475/vendor/controlled-substances/:vendorId', async (c) => {
    try {
        const vendorId = c.req.param('vendorId');
        // ✅ SQL: Get controlled substances from products table (category = 'controlled_substance')
        const pool = await (0, db_1.getDbClient)();
        const result = await pool.query(`SELECT * FROM products 
       WHERE vendor_id = $1 AND category = $2 AND is_active = $3 
       ORDER BY name ASC`, [vendorId, 'controlled_substance', true]);
        const substances = result.rows || [];
        // Calculate statistics
        const lowStock = (substances || []).filter((s) => (s.stock_quantity || 0) <= (s.metadata?.minimumStock || 0));
        const expiringSoon = (substances || []).filter((s) => {
            if (!s.metadata?.expiryDate)
                return false;
            const daysUntilExpiry = (new Date(s.metadata.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
            return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
        });
        return (0, response_utils_1.sendSuccess)(c, {
            substances: (substances || []).map((s) => ({
                id: s.id,
                vendorId: s.vendor_id,
                name: s.name,
                genericName: s.metadata?.genericName,
                schedule: s.metadata?.schedule,
                form: s.metadata?.form,
                strength: s.metadata?.strength,
                unit: s.metadata?.unit,
                currentStock: s.stock_quantity || 0,
                minimumStock: s.metadata?.minimumStock || 0,
                maximumStock: s.metadata?.maximumStock || 1000,
                location: s.metadata?.location,
                lockNumber: s.metadata?.lockNumber,
                expiryDate: s.metadata?.expiryDate,
                batchNumber: s.metadata?.batchNumber,
                supplier: s.metadata?.supplier,
                licenseRequired: s.metadata?.licenseRequired !== false,
                createdAt: s.created_at,
                updatedAt: s.updated_at
            })),
            total: substances?.length || 0,
            lowStock: lowStock.length,
            expiringSoon: expiringSoon.length
        });
    }
    catch (error) {
        console.error('Error fetching controlled substances:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
    }
});
/**
 * GET /vendor/controlled-substances/:vendorId/:substanceId
 * Get a specific controlled substance
 */
app.get('/make-server-3dd53475/vendor/controlled-substances/:vendorId/:substanceId', async (c) => {
    try {
        const { vendorId, substanceId } = c.req.param();
        // ✅ SQL: Get substance
        const pool = await (0, db_1.getDbClient)();
        const result = await pool.query('SELECT * FROM products WHERE id = $1 AND vendor_id = $2 AND category = $3', [substanceId, vendorId, 'controlled_substance']);
        const substance = result.rows[0] || null;
        if (!substance) {
            return (0, response_utils_1.sendError)(c, 'Controlled substance not found', 404);
        }
        return (0, response_utils_1.sendSuccess)(c, {
            substance: {
                id: substance.id,
                vendorId: substance.vendor_id,
                name: substance.name,
                genericName: substance.metadata?.genericName,
                schedule: substance.metadata?.schedule,
                form: substance.metadata?.form,
                strength: substance.metadata?.strength,
                unit: substance.metadata?.unit,
                currentStock: substance.stock_quantity || 0,
                minimumStock: substance.metadata?.minimumStock || 0,
                maximumStock: substance.metadata?.maximumStock || 1000,
                location: substance.metadata?.location,
                lockNumber: substance.metadata?.lockNumber,
                expiryDate: substance.metadata?.expiryDate,
                batchNumber: substance.metadata?.batchNumber,
                supplier: substance.metadata?.supplier,
                licenseRequired: substance.metadata?.licenseRequired !== false,
                createdAt: substance.created_at,
                updatedAt: substance.updated_at
            }
        });
    }
    catch (error) {
        console.error('Error fetching controlled substance:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
    }
});
/**
 * POST /vendor/controlled-substances/:vendorId
 * Add a new controlled substance
 */
app.post('/make-server-3dd53475/vendor/controlled-substances/:vendorId', async (c) => {
    try {
        const vendorId = c.req.param('vendorId');
        const body = await c.req.json();
        return await (0, db_1.withTransaction)(async (txClient) => {
            const now = new Date().toISOString();
            const substanceId = `prod_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            // ✅ SQL: Create product (controlled substance)
            const metadata = {
                genericName: body.genericName,
                schedule: body.schedule,
                form: body.form,
                strength: body.strength,
                unit: body.unit,
                minimumStock: body.minimumStock || 0,
                maximumStock: body.maximumStock || 1000,
                location: body.location,
                lockNumber: body.lockNumber,
                expiryDate: body.expiryDate,
                batchNumber: body.batchNumber,
                supplier: body.supplier,
                licenseRequired: body.licenseRequired !== false
            };
            const substanceResult = await txClient.query(`INSERT INTO products (
          id, vendor_id, name, category, price, stock_quantity, is_active,
          metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`, [
                substanceId, vendorId, body.name, 'controlled_substance', 0,
                body.currentStock || 0, true, JSON.stringify(metadata), now, now
            ]);
            const substance = substanceResult.rows[0];
            // ✅ SQL: Log initial stock receipt in transactions table (using platform_settings for transaction log)
            const transactionId = `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const transaction = {
                id: transactionId,
                substanceId: substance.id,
                vendorId,
                type: 'received',
                quantity: substance.stock_quantity,
                previousStock: 0,
                newStock: substance.stock_quantity,
                authorizedBy: body.authorizedBy || 'System',
                authorizedById: body.authorizedById || 'system',
                reason: 'Initial stock',
                timestamp: now
            };
            // Store transaction in platform_settings
            await txClient.query(`INSERT INTO platform_settings (setting_key, setting_value, setting_type)
         VALUES ($1, $2, $3)`, [`substance_transaction_${transactionId}`, JSON.stringify(transaction), 'object']);
            return (0, response_utils_1.sendSuccess)(c, {
                substance: {
                    id: substance.id,
                    vendorId: substance.vendor_id,
                    name: substance.name,
                    schedule: substance.metadata?.schedule,
                    currentStock: substance.stock_quantity,
                    createdAt: substance.created_at
                }
            }, 'Controlled substance added successfully');
        });
    }
    catch (error) {
        console.error('Error adding controlled substance:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
    }
});
/**
 * PUT /vendor/controlled-substances/:vendorId/:substanceId
 * Update a controlled substance
 */
app.put('/make-server-3dd53475/vendor/controlled-substances/:vendorId/:substanceId', async (c) => {
    try {
        const { vendorId, substanceId } = c.req.param();
        const body = await c.req.json();
        // ✅ SQL: Get existing substance
        const pool = await (0, db_1.getDbClient)();
        const existingResult = await pool.query('SELECT * FROM products WHERE id = $1 AND vendor_id = $2 AND category = $3', [substanceId, vendorId, 'controlled_substance']);
        const existing = existingResult.rows[0] || null;
        if (!existing) {
            return (0, response_utils_1.sendError)(c, 'Controlled substance not found', 404);
        }
        // ✅ SQL: Update substance
        const now = new Date().toISOString();
        const metadata = existing.metadata || {};
        if (body.genericName)
            metadata.genericName = body.genericName;
        if (body.schedule)
            metadata.schedule = body.schedule;
        if (body.form)
            metadata.form = body.form;
        if (body.strength)
            metadata.strength = body.strength;
        if (body.unit)
            metadata.unit = body.unit;
        if (body.minimumStock !== undefined)
            metadata.minimumStock = body.minimumStock;
        if (body.maximumStock !== undefined)
            metadata.maximumStock = body.maximumStock;
        if (body.location)
            metadata.location = body.location;
        if (body.lockNumber)
            metadata.lockNumber = body.lockNumber;
        if (body.expiryDate)
            metadata.expiryDate = body.expiryDate;
        if (body.batchNumber)
            metadata.batchNumber = body.batchNumber;
        if (body.supplier)
            metadata.supplier = body.supplier;
        if (body.licenseRequired !== undefined)
            metadata.licenseRequired = body.licenseRequired;
        const updateFields = ['updated_at = $1'];
        const updateParams = [now];
        let paramIndex = 2;
        if (body.name) {
            updateFields.push(`name = $${paramIndex}`);
            updateParams.push(body.name);
            paramIndex++;
        }
        if (body.currentStock !== undefined) {
            updateFields.push(`stock_quantity = $${paramIndex}`);
            updateParams.push(body.currentStock);
            paramIndex++;
        }
        updateFields.push(`metadata = $${paramIndex}`);
        updateParams.push(JSON.stringify(metadata));
        paramIndex++;
        updateParams.push(substanceId);
        const updatedResult = await pool.query(`UPDATE products SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`, updateParams);
        const updated = updatedResult.rows[0];
        return (0, response_utils_1.sendSuccess)(c, {
            substance: {
                id: updated.id,
                name: updated.name,
                currentStock: updated.stock_quantity,
                schedule: updated.metadata?.schedule,
                updatedAt: updated.updated_at
            }
        }, 'Controlled substance updated successfully');
    }
    catch (error) {
        console.error('Error updating controlled substance:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
    }
});
/**
 * POST /vendor/controlled-substances/:vendorId/:substanceId/dispense
 * Dispense a controlled substance
 */
app.post('/make-server-3dd53475/vendor/controlled-substances/:vendorId/:substanceId/dispense', async (c) => {
    try {
        const { vendorId, substanceId } = c.req.param();
        const body = await c.req.json();
        return await (0, db_1.withTransaction)(async (txClient) => {
            // ✅ SQL: Get substance
            const substanceResult = await txClient.query('SELECT * FROM products WHERE id = $1 AND vendor_id = $2 AND category = $3', [substanceId, vendorId, 'controlled_substance']);
            const substance = substanceResult.rows[0] || null;
            if (!substance) {
                return (0, response_utils_1.sendError)(c, 'Controlled substance not found', 404);
            }
            if ((substance.stock_quantity || 0) < body.quantity) {
                return (0, response_utils_1.sendError)(c, 'Insufficient stock', 400);
            }
            // Update stock
            const previousStock = substance.stock_quantity || 0;
            const newStock = previousStock - body.quantity;
            const now = new Date().toISOString();
            // ✅ SQL: Update stock
            const updatedResult = await txClient.query(`UPDATE products SET stock_quantity = $1, updated_at = $2 WHERE id = $3 RETURNING *`, [newStock, now, substanceId]);
            const updated = updatedResult.rows[0];
            // ✅ SQL: Log transaction
            const transactionId = `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const transaction = {
                id: transactionId,
                substanceId,
                vendorId,
                type: 'dispensed',
                quantity: body.quantity,
                previousStock,
                newStock,
                prescriptionId: body.prescriptionId,
                patientId: body.patientId,
                patientName: body.patientName,
                authorizedBy: body.authorizedBy,
                authorizedById: body.authorizedById,
                reason: body.reason || 'Dispensed to patient',
                notes: body.notes,
                timestamp: now,
                witnessName: body.witnessName,
                witnessId: body.witnessId
            };
            await txClient.query(`INSERT INTO platform_settings (setting_key, setting_value, setting_type)
         VALUES ($1, $2, $3)`, [`substance_transaction_${transactionId}`, JSON.stringify(transaction), 'object']);
            return (0, response_utils_1.sendSuccess)(c, {
                substance: {
                    id: updated.id,
                    name: updated.name,
                    currentStock: updated.stock_quantity
                },
                transaction
            }, 'Controlled substance dispensed successfully');
        });
    }
    catch (error) {
        console.error('Error dispensing controlled substance:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
    }
});
/**
 * GET /vendor/controlled-substances/:vendorId/:substanceId/transactions
 * Get transaction history for a substance
 */
app.get('/make-server-3dd53475/vendor/controlled-substances/:vendorId/:substanceId/transactions', async (c) => {
    try {
        const { vendorId, substanceId } = c.req.param();
        // ✅ SQL: Get transactions from platform_settings
        const pool = await (0, db_1.getDbClient)();
        const settingsResult = await pool.query(`SELECT * FROM platform_settings 
       WHERE setting_key LIKE $1 
       AND setting_value->>'substanceId' = $2
       AND setting_value->>'vendorId' = $3`, [`substance_transaction_%`, substanceId, vendorId]);
        const settings = settingsResult.rows || [];
        const transactions = (settings || [])
            .map((s) => s.setting_value)
            .filter((t) => t && t.substanceId === substanceId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return (0, response_utils_1.sendSuccess)(c, {
            transactions,
            total: transactions.length
        });
    }
    catch (error) {
        console.error('Error fetching transactions:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
    }
});
/**
 * GET /vendor/controlled-substances/:vendorId/audit-history
 * Get audit history for a vendor
 */
app.get('/make-server-3dd53475/vendor/controlled-substances/:vendorId/audit-history', async (c) => {
    try {
        const vendorId = c.req.param('vendorId');
        // ✅ SQL: Get audits from platform_settings
        const pool = await (0, db_1.getDbClient)();
        const settingsResult = await pool.query(`SELECT * FROM platform_settings WHERE setting_key LIKE $1`, [`substance_audit_${vendorId}_%`]);
        const settings = settingsResult.rows || [];
        const audits = (settings || [])
            .map((s) => s.setting_value)
            .filter((a) => a && a.vendorId === vendorId)
            .sort((a, b) => new Date(b.auditDate).getTime() - new Date(a.auditDate).getTime());
        return (0, response_utils_1.sendSuccess)(c, {
            audits,
            total: audits.length
        });
    }
    catch (error) {
        console.error('Error fetching audit history:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
    }
});
function controlledSubstancesEndpointsSQL(mainApp) {
    mainApp.route('/', app);
}
exports.default = controlledSubstancesEndpointsSQL;
//# sourceMappingURL=controlled-substances-endpoints-sql.js.map