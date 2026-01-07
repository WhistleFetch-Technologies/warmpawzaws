"use strict";
/**
 * Expiry Management Endpoints (SQL-ONLY VERSION)
 * Handles product expiry tracking, alerts, and batch management for pharmacies and stores
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()`, `kv.del()` with SQL repository calls
 * - All data now comes from SQL tables (product_batches, expiry_alerts, disposal_records)
 *
 * Date: 2025-01-27
 * Migration: Batch 8 - Complete KV to SQL Migration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerExpiryManagementEndpointsSQL = registerExpiryManagementEndpointsSQL;
const response_utils_1 = require("./response-utils");
const db_1 = require("../lib/db");
const BASE_PATH = '/make-server-3dd53475';
function registerExpiryManagementEndpointsSQL(app) {
    console.log('✅ Registering Expiry Management Endpoints (SQL-only)...');
    // Helper: Calculate days until expiry
    function calculateDaysUntilExpiry(expiryDate) {
        const expiry = new Date(expiryDate);
        const now = new Date();
        const diff = expiry.getTime() - now.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }
    // Helper: Determine batch status
    function determineBatchStatus(expiryDate, quantity, alertDays) {
        if (quantity <= 0)
            return 'depleted';
        const daysUntilExpiry = calculateDaysUntilExpiry(expiryDate);
        if (daysUntilExpiry < 0)
            return 'expired';
        if (daysUntilExpiry <= alertDays)
            return 'expiring_soon';
        return 'active';
    }
    // Helper: Determine alert severity
    function determineAlertSeverity(daysUntilExpiry) {
        if (daysUntilExpiry <= 7)
            return 'critical';
        if (daysUntilExpiry <= 30)
            return 'warning';
        return 'info';
    }
    /**
     * GET /vendor/expiry/:vendorId/batches
     * Get all product batches with expiry tracking
     */
    app.get(`${BASE_PATH}/vendor/expiry/:vendorId/batches`, async (c) => {
        try {
            const vendorId = c.req.param('vendorId');
            const { status, productId } = c.req.query();
            // ✅ SQL: Get batches
            const pool = await (0, db_1.getDbClient)();
            let sql = 'SELECT * FROM product_batches WHERE vendor_id = $1';
            const params = [vendorId];
            if (productId) {
                sql += ' AND product_id = $2';
                params.push(productId);
            }
            const result = await pool.query(sql, params);
            const batches = result.rows || [];
            // Update batch statuses based on current date
            const updatedBatches = (batches || []).map(batch => ({
                ...batch,
                status: determineBatchStatus(batch.expiry_date, batch.remaining_quantity, batch.alert_days || 30)
            }));
            // Filter by status if specified
            const filteredBatches = status
                ? updatedBatches.filter(b => b.status === status)
                : updatedBatches;
            // Sort by expiry date (soonest first)
            filteredBatches.sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());
            // Calculate summary stats
            const stats = {
                total: filteredBatches.length,
                active: filteredBatches.filter(b => b.status === 'active').length,
                expiringSoon: filteredBatches.filter(b => b.status === 'expiring_soon').length,
                expired: filteredBatches.filter(b => b.status === 'expired').length,
                depleted: filteredBatches.filter(b => b.status === 'depleted').length,
                totalValue: filteredBatches
                    .filter(b => b.status === 'active' || b.status === 'expiring_soon')
                    .reduce((sum, b) => sum + (b.remaining_quantity * parseFloat(b.selling_price || '0')), 0)
            };
            return (0, response_utils_1.sendSuccess)(c, {
                batches: filteredBatches,
                stats
            });
        }
        catch (error) {
            console.error('Error fetching batches:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    /**
     * POST /vendor/expiry/:vendorId/batches
     * Create a new product batch with expiry tracking
     */
    app.post(`${BASE_PATH}/vendor/expiry/:vendorId/batches`, async (c) => {
        try {
            const vendorId = c.req.param('vendorId');
            const body = await c.req.json();
            const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const now = new Date().toISOString();
            const status = determineBatchStatus(body.expiryDate, body.quantity, body.alertDays || 30);
            // ✅ SQL: Create batch
            const pool = await (0, db_1.getDbClient)();
            const batchResult = await pool.query(`INSERT INTO product_batches (
          id, vendor_id, product_id, product_name, batch_number, manufacturing_date,
          expiry_date, quantity, remaining_quantity, cost_price, selling_price,
          supplier, storage_location, status, alert_days, notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *`, [
                batchId, vendorId, body.productId, body.productName, body.batchNumber,
                body.manufacturingDate, body.expiryDate, body.quantity, body.quantity,
                body.costPrice || null, body.sellingPrice || null, body.supplier || null,
                body.storageLocation || null, status, body.alertDays || 30, body.notes || null,
                now, now
            ]);
            const batch = batchResult.rows[0];
            // ✅ SQL: Create alert if expiring soon
            const daysUntilExpiry = calculateDaysUntilExpiry(body.expiryDate);
            if (daysUntilExpiry <= (body.alertDays || 30) && daysUntilExpiry >= 0) {
                const alertId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                await pool.query(`INSERT INTO expiry_alerts (
            id, vendor_id, batch_id, product_name, batch_number, expiry_date,
            days_until_expiry, quantity, severity, status, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [
                    alertId, vendorId, batchId, body.productName, body.batchNumber,
                    body.expiryDate, daysUntilExpiry, body.quantity,
                    determineAlertSeverity(daysUntilExpiry), 'active', now
                ]);
            }
            return (0, response_utils_1.sendSuccess)(c, {
                batch,
                message: 'Product batch created successfully'
            });
        }
        catch (error) {
            console.error('Error creating batch:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    /**
     * PUT /vendor/expiry/:vendorId/batches/:batchId
     * Update product batch
     */
    app.put(`${BASE_PATH}/vendor/expiry/:vendorId/batches/:batchId`, async (c) => {
        try {
            const { vendorId, batchId } = c.req.param();
            const body = await c.req.json();
            // ✅ SQL: Get existing batch
            const pool = await (0, db_1.getDbClient)();
            const existingResult = await pool.query('SELECT * FROM product_batches WHERE id = $1 AND vendor_id = $2', [batchId, vendorId]);
            const existing = existingResult.rows[0] || null;
            if (!existing) {
                return (0, response_utils_1.sendError)(c, 'Batch not found', 404);
            }
            // ✅ SQL: Update batch
            const updatedStatus = determineBatchStatus(body.expiryDate || existing.expiry_date, body.remainingQuantity ?? existing.remaining_quantity, body.alertDays || existing.alert_days || 30);
            const updateFields = [];
            const updateParams = [];
            let paramIndex = 1;
            Object.keys(body).forEach(key => {
                if (key !== 'id' && body[key] !== undefined) {
                    updateFields.push(`${key} = $${paramIndex}`);
                    updateParams.push(body[key]);
                    paramIndex++;
                }
            });
            updateFields.push(`status = $${paramIndex}`, `updated_at = $${paramIndex + 1}`);
            updateParams.push(updatedStatus, new Date().toISOString());
            updateParams.push(batchId);
            const updatedResult = await pool.query(`UPDATE product_batches SET ${updateFields.join(', ')} WHERE id = $${paramIndex + 2} RETURNING *`, updateParams);
            const updated = updatedResult.rows[0];
            return (0, response_utils_1.sendSuccess)(c, {
                batch: updated,
                message: 'Batch updated successfully'
            });
        }
        catch (error) {
            console.error('Error updating batch:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    /**
     * GET /vendor/expiry/:vendorId/alerts
     * Get expiry alerts
     */
    app.get(`${BASE_PATH}/vendor/expiry/:vendorId/alerts`, async (c) => {
        try {
            const vendorId = c.req.param('vendorId');
            const { status, severity } = c.req.query();
            // ✅ SQL: Get alerts
            const pool = await (0, db_1.getDbClient)();
            let sql = 'SELECT * FROM expiry_alerts WHERE vendor_id = $1';
            const params = [vendorId];
            let paramIndex = 2;
            if (status) {
                sql += ` AND status = $${paramIndex}`;
                params.push(status);
                paramIndex++;
            }
            if (severity) {
                sql += ` AND severity = $${paramIndex}`;
                params.push(severity);
                paramIndex++;
            }
            sql += ' ORDER BY days_until_expiry ASC';
            const result = await pool.query(sql, params);
            const alerts = result.rows || [];
            // Update alerts based on current date
            const updatedAlerts = (alerts || []).map(alert => {
                const daysUntilExpiry = calculateDaysUntilExpiry(alert.expiry_date);
                return {
                    ...alert,
                    days_until_expiry: daysUntilExpiry,
                    severity: determineAlertSeverity(daysUntilExpiry)
                };
            });
            const stats = {
                total: updatedAlerts.length,
                critical: updatedAlerts.filter(a => a.severity === 'critical').length,
                warning: updatedAlerts.filter(a => a.severity === 'warning').length,
                info: updatedAlerts.filter(a => a.severity === 'info').length,
                active: updatedAlerts.filter(a => a.status === 'active').length,
                acknowledged: updatedAlerts.filter(a => a.status === 'acknowledged').length
            };
            return (0, response_utils_1.sendSuccess)(c, {
                alerts: updatedAlerts,
                stats
            });
        }
        catch (error) {
            console.error('Error fetching alerts:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    /**
     * POST /vendor/expiry/:vendorId/alerts/:alertId/acknowledge
     * Acknowledge an expiry alert
     */
    app.post(`${BASE_PATH}/vendor/expiry/:vendorId/alerts/:alertId/acknowledge`, async (c) => {
        try {
            const { vendorId, alertId } = c.req.param();
            // ✅ SQL: Update alert
            const pool = await (0, db_1.getDbClient)();
            const now = new Date().toISOString();
            const updatedResult = await pool.query(`UPDATE expiry_alerts SET 
          status = $1, acknowledged_at = $2
          WHERE id = $3 AND vendor_id = $4 RETURNING *`, ['acknowledged', now, alertId, vendorId]);
            const updated = updatedResult.rows[0] || null;
            if (!updated) {
                return (0, response_utils_1.sendError)(c, 'Alert not found', 404);
            }
            return (0, response_utils_1.sendSuccess)(c, {
                alert: updated,
                message: 'Alert acknowledged'
            });
        }
        catch (error) {
            console.error('Error acknowledging alert:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    /**
     * POST /vendor/expiry/:vendorId/disposal
     * Record product disposal
     */
    app.post(`${BASE_PATH}/vendor/expiry/:vendorId/disposal`, async (c) => {
        try {
            const vendorId = c.req.param('vendorId');
            const body = await c.req.json();
            const disposalId = `disposal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const now = new Date().toISOString();
            // ✅ SQL: Create disposal record
            const pool = await (0, db_1.getDbClient)();
            const disposalResult = await pool.query(`INSERT INTO disposal_records (
          id, vendor_id, batch_id, product_name, batch_number, quantity,
          reason, disposal_method, disposal_date, cost, authorized_by, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`, [
                disposalId, vendorId, body.batchId, body.productName, body.batchNumber,
                body.quantity, body.reason, body.disposalMethod || null,
                body.disposalDate || now, body.cost || null, body.authorizedBy || null,
                body.notes || null, now
            ]);
            const disposal = disposalResult.rows[0];
            // ✅ SQL: Update batch quantity
            const batchResult = await pool.query('SELECT * FROM product_batches WHERE id = $1', [body.batchId]);
            const batch = batchResult.rows[0] || null;
            if (batch) {
                const newQuantity = Math.max(0, batch.remaining_quantity - body.quantity);
                await pool.query(`UPDATE product_batches SET 
            remaining_quantity = $1, status = $2, updated_at = $3
            WHERE id = $4`, [
                    newQuantity,
                    determineBatchStatus(batch.expiry_date, newQuantity, batch.alert_days || 30),
                    now,
                    body.batchId
                ]);
            }
            return (0, response_utils_1.sendSuccess)(c, {
                disposal,
                message: 'Disposal recorded successfully'
            });
        }
        catch (error) {
            console.error('Error recording disposal:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    /**
     * GET /vendor/expiry/:vendorId/disposal
     * Get disposal records
     */
    app.get(`${BASE_PATH}/vendor/expiry/:vendorId/disposal`, async (c) => {
        try {
            const vendorId = c.req.param('vendorId');
            const { startDate, endDate } = c.req.query();
            // ✅ SQL: Get disposals
            const pool = await (0, db_1.getDbClient)();
            let sql = 'SELECT * FROM disposal_records WHERE vendor_id = $1';
            const params = [vendorId];
            let paramIndex = 2;
            if (startDate) {
                sql += ` AND disposal_date >= $${paramIndex}`;
                params.push(startDate);
                paramIndex++;
            }
            if (endDate) {
                sql += ` AND disposal_date <= $${paramIndex}`;
                params.push(endDate);
                paramIndex++;
            }
            sql += ' ORDER BY disposal_date DESC';
            const result = await pool.query(sql, params);
            const disposals = result.rows || [];
            const stats = {
                total: (disposals || []).length,
                totalCost: (disposals || []).reduce((sum, d) => sum + parseFloat(d.cost || '0'), 0),
                byReason: {
                    expired: (disposals || []).filter(d => d.reason === 'expired').length,
                    damaged: (disposals || []).filter(d => d.reason === 'damaged').length,
                    recalled: (disposals || []).filter(d => d.reason === 'recalled').length,
                    other: (disposals || []).filter(d => d.reason === 'other').length
                }
            };
            return (0, response_utils_1.sendSuccess)(c, {
                disposals: disposals || [],
                stats
            });
        }
        catch (error) {
            console.error('Error fetching disposals:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    /**
     * DELETE /vendor/expiry/:vendorId/batches/:batchId
     * Delete a product batch
     */
    app.delete(`${BASE_PATH}/vendor/expiry/:vendorId/batches/:batchId`, async (c) => {
        try {
            const { vendorId, batchId } = c.req.param();
            // ✅ SQL: Delete batch
            const pool = await (0, db_1.getDbClient)();
            const deleteResult = await pool.query('DELETE FROM product_batches WHERE id = $1 AND vendor_id = $2', [batchId, vendorId]);
            if (deleteResult.rowCount === 0) {
                return (0, response_utils_1.sendError)(c, 'Batch not found', 404);
            }
            console.log(`✅ Product batch deleted successfully: ${batchId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                message: 'Batch deleted successfully'
            });
        }
        catch (error) {
            console.error('Error deleting batch:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    console.log('✅ Expiry Management Endpoints registered (SQL-only)');
}
//# sourceMappingURL=expiry-management-endpoints-sql.js.map