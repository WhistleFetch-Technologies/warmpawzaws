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

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { getDbClient } from '../../lib/db.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getPrescriptionsRepository } from '../../lib/repositories/prescriptions.ts';
import { withTransaction } from '../../lib/utils/transaction-helper.ts';

const app = new Hono();
const db = getDbClient();
const vendorsRepo = getVendorsRepository();
const prescriptionsRepo = getPrescriptionsRepository();

/**
 * GET /vendor/controlled-substances/:vendorId
 * Get all controlled substances for a vendor
 */
app.get('/make-server-3dd53475/vendor/controlled-substances/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    
    // ✅ SQL: Get controlled substances from products table (category = 'controlled_substance')
    const { data: substances, error } = await db
      .from('products')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('category', 'controlled_substance')
      .eq('is_active', true)
      .order('name', { ascending: true });
    
    if (error) {
      console.error('Error fetching controlled substances:', error);
      return sendError(c, 'Failed to fetch controlled substances', 500);
    }
    
    // Calculate statistics
    const lowStock = (substances || []).filter((s: any) => 
      (s.stock_quantity || 0) <= (s.metadata?.minimumStock || 0)
    );
    
    const expiringSoon = (substances || []).filter((s: any) => {
      if (!s.metadata?.expiryDate) return false;
      const daysUntilExpiry = (new Date(s.metadata.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
    });
    
    return sendSuccess(c, {
      substances: (substances || []).map((s: any) => ({
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
  } catch (error) {
    console.error('Error fetching controlled substances:', error);
    return sendError(c, error, 500);
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
    const { data: substance, error } = await db
      .from('products')
      .select('*')
      .eq('id', substanceId)
      .eq('vendor_id', vendorId)
      .eq('category', 'controlled_substance')
      .single();
    
    if (error || !substance) {
      return sendError(c, 'Controlled substance not found', 404);
    }
    
    return sendSuccess(c, {
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
  } catch (error) {
    console.error('Error fetching controlled substance:', error);
    return sendError(c, error, 500);
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
    
    return await withTransaction(async (txClient) => {
      const now = new Date().toISOString();
      
      // ✅ SQL: Create product (controlled substance)
      const { data: substance, error: createError } = await txClient
        .from('products')
        .insert({
          vendor_id: vendorId,
          name: body.name,
          category: 'controlled_substance',
          price: 0, // Controlled substances may not have a price
          stock_quantity: body.currentStock || 0,
          is_active: true,
          metadata: {
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
          },
          created_at: now,
          updated_at: now
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Error adding controlled substance:', createError);
        return sendError(c, 'Failed to add controlled substance', 500);
      }
      
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
      await txClient
        .from('platform_settings')
        .insert({
          setting_key: `substance_transaction_${transactionId}`,
          setting_value: transaction,
          setting_type: 'object'
        });
      
      return sendSuccess(c, {
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
  } catch (error) {
    console.error('Error adding controlled substance:', error);
    return sendError(c, error, 500);
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
    const { data: existing, error: getError } = await db
      .from('products')
      .select('*')
      .eq('id', substanceId)
      .eq('vendor_id', vendorId)
      .eq('category', 'controlled_substance')
      .single();
    
    if (getError || !existing) {
      return sendError(c, 'Controlled substance not found', 404);
    }
    
    // ✅ SQL: Update substance
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (body.name) updateData.name = body.name;
    if (body.currentStock !== undefined) updateData.stock_quantity = body.currentStock;
    
    const metadata = existing.metadata || {};
    if (body.genericName) metadata.genericName = body.genericName;
    if (body.schedule) metadata.schedule = body.schedule;
    if (body.form) metadata.form = body.form;
    if (body.strength) metadata.strength = body.strength;
    if (body.unit) metadata.unit = body.unit;
    if (body.minimumStock !== undefined) metadata.minimumStock = body.minimumStock;
    if (body.maximumStock !== undefined) metadata.maximumStock = body.maximumStock;
    if (body.location) metadata.location = body.location;
    if (body.lockNumber) metadata.lockNumber = body.lockNumber;
    if (body.expiryDate) metadata.expiryDate = body.expiryDate;
    if (body.batchNumber) metadata.batchNumber = body.batchNumber;
    if (body.supplier) metadata.supplier = body.supplier;
    if (body.licenseRequired !== undefined) metadata.licenseRequired = body.licenseRequired;
    
    updateData.metadata = metadata;
    
    const { data: updated, error: updateError } = await db
      .from('products')
      .update(updateData)
      .eq('id', substanceId)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating controlled substance:', updateError);
      return sendError(c, 'Failed to update controlled substance', 500);
    }
    
    return sendSuccess(c, {
      substance: {
        id: updated.id,
        name: updated.name,
        currentStock: updated.stock_quantity,
        schedule: updated.metadata?.schedule,
        updatedAt: updated.updated_at
      }
    }, 'Controlled substance updated successfully');
  } catch (error) {
    console.error('Error updating controlled substance:', error);
    return sendError(c, error, 500);
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
    
    return await withTransaction(async (txClient) => {
      // ✅ SQL: Get substance
      const { data: substance, error: getError } = await txClient
        .from('products')
        .select('*')
        .eq('id', substanceId)
        .eq('vendor_id', vendorId)
        .eq('category', 'controlled_substance')
        .single();
      
      if (getError || !substance) {
        return sendError(c, 'Controlled substance not found', 404);
      }
      
      if ((substance.stock_quantity || 0) < body.quantity) {
        return sendError(c, 'Insufficient stock', 400);
      }
      
      // Update stock
      const previousStock = substance.stock_quantity || 0;
      const newStock = previousStock - body.quantity;
      
      // ✅ SQL: Update stock
      const { data: updated, error: updateError } = await txClient
        .from('products')
        .update({
          stock_quantity: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', substanceId)
        .select()
        .single();
      
      if (updateError) {
        console.error('Error updating stock:', updateError);
        return sendError(c, 'Failed to update stock', 500);
      }
      
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
        timestamp: new Date().toISOString(),
        witnessName: body.witnessName,
        witnessId: body.witnessId
      };
      
      await txClient
        .from('platform_settings')
        .insert({
          setting_key: `substance_transaction_${transactionId}`,
          setting_value: transaction,
          setting_type: 'object'
        });
      
      return sendSuccess(c, {
        substance: {
          id: updated.id,
          name: updated.name,
          currentStock: updated.stock_quantity
        },
        transaction
      }, 'Controlled substance dispensed successfully');
    });
  } catch (error) {
    console.error('Error dispensing controlled substance:', error);
    return sendError(c, error, 500);
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
    const { data: settings, error } = await db
      .from('platform_settings')
      .select('*')
      .like('setting_key', `substance_transaction_%`)
      .eq('setting_value->>substanceId', substanceId)
      .eq('setting_value->>vendorId', vendorId);
    
    if (error) {
      console.error('Error fetching transactions:', error);
      return sendError(c, 'Failed to fetch transactions', 500);
    }
    
    const transactions = (settings || [])
      .map((s: any) => s.setting_value)
      .filter((t: any) => t && t.substanceId === substanceId)
      .sort((a: any, b: any) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    
    return sendSuccess(c, {
      transactions,
      total: transactions.length
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return sendError(c, error, 500);
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
    const { data: settings, error } = await db
      .from('platform_settings')
      .select('*')
      .like('setting_key', `substance_audit_${vendorId}_%`);
    
    if (error) {
      console.error('Error fetching audit history:', error);
      return sendError(c, 'Failed to fetch audit history', 500);
    }
    
    const audits = (settings || [])
      .map((s: any) => s.setting_value)
      .filter((a: any) => a && a.vendorId === vendorId)
      .sort((a: any, b: any) => 
        new Date(b.auditDate).getTime() - new Date(a.auditDate).getTime()
      );
    
    return sendSuccess(c, {
      audits,
      total: audits.length
    });
  } catch (error) {
    console.error('Error fetching audit history:', error);
    return sendError(c, error, 500);
  }
});

export default app;

