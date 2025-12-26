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

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { getDbClient } from '../../lib/db.ts';

const BASE_PATH = '/make-server-3dd53475';

export function registerExpiryManagementEndpointsSQL(app: Hono) {
  console.log('✅ Registering Expiry Management Endpoints (SQL-only)...');

  const client = getDbClient();

  // Helper: Calculate days until expiry
  function calculateDaysUntilExpiry(expiryDate: string): number {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  // Helper: Determine batch status
  function determineBatchStatus(expiryDate: string, quantity: number, alertDays: number): string {
    if (quantity <= 0) return 'depleted';
    const daysUntilExpiry = calculateDaysUntilExpiry(expiryDate);
    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry <= alertDays) return 'expiring_soon';
    return 'active';
  }

  // Helper: Determine alert severity
  function determineAlertSeverity(daysUntilExpiry: number): 'critical' | 'warning' | 'info' {
    if (daysUntilExpiry <= 7) return 'critical';
    if (daysUntilExpiry <= 30) return 'warning';
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
      let query = client
        .from('product_batches')
        .select('*')
        .eq('vendor_id', vendorId);

      if (productId) {
        query = query.eq('product_id', productId);
      }

      const { data: batches, error } = await query;

      if (error) {
        console.error('Error fetching batches:', error);
        return sendError(c, 'Failed to fetch batches', 500);
      }

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

      return sendSuccess(c, {
        batches: filteredBatches,
        stats
      });
    } catch (error) {
      console.error('Error fetching batches:', error);
      return sendError(c, String(error), 500);
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
      const { data: batch, error } = await client
        .from('product_batches')
        .insert({
          id: batchId,
          vendor_id: vendorId,
          product_id: body.productId,
          product_name: body.productName,
          batch_number: body.batchNumber,
          manufacturing_date: body.manufacturingDate,
          expiry_date: body.expiryDate,
          quantity: body.quantity,
          remaining_quantity: body.quantity,
          cost_price: body.costPrice,
          selling_price: body.sellingPrice,
          supplier: body.supplier,
          storage_location: body.storageLocation,
          status: status,
          alert_days: body.alertDays || 30,
          notes: body.notes,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating batch:', error);
        return sendError(c, 'Failed to create batch', 500);
      }

      // ✅ SQL: Create alert if expiring soon
      const daysUntilExpiry = calculateDaysUntilExpiry(body.expiryDate);
      if (daysUntilExpiry <= (body.alertDays || 30) && daysUntilExpiry >= 0) {
        const alertId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await client
          .from('expiry_alerts')
          .insert({
            id: alertId,
            vendor_id: vendorId,
            batch_id: batchId,
            product_name: body.productName,
            batch_number: body.batchNumber,
            expiry_date: body.expiryDate,
            days_until_expiry: daysUntilExpiry,
            quantity: body.quantity,
            severity: determineAlertSeverity(daysUntilExpiry),
            status: 'active',
            created_at: now
          });
      }

      return sendSuccess(c, {
        batch,
        message: 'Product batch created successfully'
      });
    } catch (error) {
      console.error('Error creating batch:', error);
      return sendError(c, String(error), 500);
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
      const { data: existing, error: fetchError } = await client
        .from('product_batches')
        .select('*')
        .eq('id', batchId)
        .eq('vendor_id', vendorId)
        .maybeSingle();

      if (fetchError || !existing) {
        return sendError(c, 'Batch not found', 404);
      }

      // ✅ SQL: Update batch
      const updatedStatus = determineBatchStatus(
        body.expiryDate || existing.expiry_date,
        body.remainingQuantity ?? existing.remaining_quantity,
        body.alertDays || existing.alert_days || 30
      );

      const { data: updated, error } = await client
        .from('product_batches')
        .update({
          ...body,
          status: updatedStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', batchId)
        .select()
        .single();

      if (error) {
        console.error('Error updating batch:', error);
        return sendError(c, 'Failed to update batch', 500);
      }

      return sendSuccess(c, {
        batch: updated,
        message: 'Batch updated successfully'
      });
    } catch (error) {
      console.error('Error updating batch:', error);
      return sendError(c, String(error), 500);
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
      let query = client
        .from('expiry_alerts')
        .select('*')
        .eq('vendor_id', vendorId);

      if (status) {
        query = query.eq('status', status);
      }

      if (severity) {
        query = query.eq('severity', severity);
      }

      const { data: alerts, error } = await query.order('days_until_expiry', { ascending: true });

      if (error) {
        console.error('Error fetching alerts:', error);
        return sendError(c, 'Failed to fetch alerts', 500);
      }

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

      return sendSuccess(c, {
        alerts: updatedAlerts,
        stats
      });
    } catch (error) {
      console.error('Error fetching alerts:', error);
      return sendError(c, String(error), 500);
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
      const { data: updated, error } = await client
        .from('expiry_alerts')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alertId)
        .eq('vendor_id', vendorId)
        .select()
        .single();

      if (error || !updated) {
        return sendError(c, 'Alert not found', 404);
      }

      return sendSuccess(c, {
        alert: updated,
        message: 'Alert acknowledged'
      });
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      return sendError(c, String(error), 500);
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
      const { data: disposal, error: disposalError } = await client
        .from('disposal_records')
        .insert({
          id: disposalId,
          vendor_id: vendorId,
          batch_id: body.batchId,
          product_name: body.productName,
          batch_number: body.batchNumber,
          quantity: body.quantity,
          reason: body.reason,
          disposal_method: body.disposalMethod,
          disposal_date: body.disposalDate || now,
          cost: body.cost,
          authorized_by: body.authorizedBy,
          notes: body.notes,
          created_at: now
        })
        .select()
        .single();

      if (disposalError) {
        console.error('Error creating disposal record:', disposalError);
        return sendError(c, 'Failed to record disposal', 500);
      }

      // ✅ SQL: Update batch quantity
      const { data: batch } = await client
        .from('product_batches')
        .select('*')
        .eq('id', body.batchId)
        .single();

      if (batch) {
        const newQuantity = Math.max(0, batch.remaining_quantity - body.quantity);
        await client
          .from('product_batches')
          .update({
            remaining_quantity: newQuantity,
            status: determineBatchStatus(batch.expiry_date, newQuantity, batch.alert_days || 30),
            updated_at: now
          })
          .eq('id', body.batchId);
      }

      return sendSuccess(c, {
        disposal,
        message: 'Disposal recorded successfully'
      });
    } catch (error) {
      console.error('Error recording disposal:', error);
      return sendError(c, String(error), 500);
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
      let query = client
        .from('disposal_records')
        .select('*')
        .eq('vendor_id', vendorId);

      if (startDate) {
        query = query.gte('disposal_date', startDate);
      }
      if (endDate) {
        query = query.lte('disposal_date', endDate);
      }

      const { data: disposals, error } = await query.order('disposal_date', { ascending: false });

      if (error) {
        console.error('Error fetching disposals:', error);
        return sendError(c, 'Failed to fetch disposals', 500);
      }

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

      return sendSuccess(c, {
        disposals: disposals || [],
        stats
      });
    } catch (error) {
      console.error('Error fetching disposals:', error);
      return sendError(c, String(error), 500);
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
      const { error } = await client
        .from('product_batches')
        .delete()
        .eq('id', batchId)
        .eq('vendor_id', vendorId);

      if (error) {
        return sendError(c, 'Batch not found', 404);
      }

      console.log(`✅ Product batch deleted successfully: ${batchId}`);

      return sendSuccess(c, {
        message: 'Batch deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting batch:', error);
      return sendError(c, String(error), 500);
    }
  });

  console.log('✅ Expiry Management Endpoints registered (SQL-only)');
}

