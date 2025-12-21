/**
 * Controlled Substances Management Endpoints
 * Handles controlled substances inventory, compliance, and tracking
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

// Controlled Substance structure
interface ControlledSubstance {
  id: string;
  vendorId: string;
  name: string;
  genericName?: string;
  schedule: 'I' | 'II' | 'III' | 'IV' | 'V'; // DEA Schedule
  form: 'tablet' | 'injection' | 'liquid' | 'powder' | 'other';
  strength: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  location: string;
  lockNumber?: string;
  expiryDate: string;
  batchNumber: string;
  supplier: string;
  licenseRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

// Transaction log for controlled substances
interface SubstanceTransaction {
  id: string;
  substanceId: string;
  vendorId: string;
  type: 'dispensed' | 'received' | 'destroyed' | 'lost' | 'returned' | 'transferred';
  quantity: number;
  previousStock: number;
  newStock: number;
  prescriptionId?: string;
  patientId?: string;
  patientName?: string;
  authorizedBy: string;
  authorizedById: string;
  reason: string;
  notes?: string;
  timestamp: string;
  witnessName?: string;
  witnessId?: string;
}

// Audit log for compliance
interface ComplianceAudit {
  id: string;
  vendorId: string;
  auditDate: string;
  auditorName: string;
  auditorId: string;
  findings: string[];
  discrepancies: {
    substanceId: string;
    substanceName: string;
    expectedStock: number;
    actualStock: number;
    difference: number;
  }[];
  status: 'passed' | 'failed' | 'pending';
  notes?: string;
  nextAuditDate?: string;
}

/**
 * GET /vendor/controlled-substances/:vendorId
 * Get all controlled substances for a vendor
 */
app.get('/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    
    const substances = await kv.getByPrefix<ControlledSubstance>(`substance:${vendorId}:`);
    
    // Sort by schedule (most controlled first) then by name
    const scheduleOrder = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5 };
    substances.sort((a, b) => {
      const scheduleCompare = scheduleOrder[a.schedule] - scheduleOrder[b.schedule];
      if (scheduleCompare !== 0) return scheduleCompare;
      return a.name.localeCompare(b.name);
    });
    
    // Calculate statistics
    const lowStock = substances.filter(s => s.currentStock <= s.minimumStock);
    const expiringSoon = substances.filter(s => {
      const daysUntilExpiry = (new Date(s.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
    });
    
    return c.json({
      success: true,
      substances,
      total: substances.length,
      lowStock: lowStock.length,
      expiringSoon: expiringSoon.length
    });
  } catch (error) {
    console.error('Error fetching controlled substances:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch controlled substances',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/controlled-substances/:vendorId/:substanceId
 * Get a specific controlled substance
 */
app.get('/:vendorId/:substanceId', async (c) => {
  try {
    const { vendorId, substanceId } = c.req.param();
    
    const substance = await kv.get<ControlledSubstance>(`substance:${vendorId}:${substanceId}`);
    
    if (!substance) {
      return c.json({ 
        success: false, 
        error: 'Controlled substance not found' 
      }, 404);
    }
    
    return c.json({
      success: true,
      substance
    });
  } catch (error) {
    console.error('Error fetching controlled substance:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch controlled substance',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/controlled-substances/:vendorId
 * Add a new controlled substance
 */
app.post('/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();
    
    const substanceId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const substance: ControlledSubstance = {
      id: substanceId,
      vendorId,
      name: body.name,
      genericName: body.genericName,
      schedule: body.schedule,
      form: body.form,
      strength: body.strength,
      unit: body.unit,
      currentStock: body.currentStock || 0,
      minimumStock: body.minimumStock || 0,
      maximumStock: body.maximumStock || 1000,
      location: body.location,
      lockNumber: body.lockNumber,
      expiryDate: body.expiryDate,
      batchNumber: body.batchNumber,
      supplier: body.supplier,
      licenseRequired: body.licenseRequired !== false,
      createdAt: now,
      updatedAt: now
    };
    
    await kv.set(`substance:${vendorId}:${substanceId}`, substance);
    
    // Log initial stock receipt
    const transactionId = `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const transaction: SubstanceTransaction = {
      id: transactionId,
      substanceId,
      vendorId,
      type: 'received',
      quantity: substance.currentStock,
      previousStock: 0,
      newStock: substance.currentStock,
      authorizedBy: body.authorizedBy || 'System',
      authorizedById: body.authorizedById || 'system',
      reason: 'Initial stock',
      timestamp: now
    };
    
    await kv.set(`substance:transaction:${vendorId}:${transactionId}`, transaction);
    
    return c.json({
      success: true,
      substance,
      message: 'Controlled substance added successfully'
    });
  } catch (error) {
    console.error('Error adding controlled substance:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to add controlled substance',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * PUT /vendor/controlled-substances/:vendorId/:substanceId
 * Update a controlled substance
 */
app.put('/:vendorId/:substanceId', async (c) => {
  try {
    const { vendorId, substanceId } = c.req.param();
    const body = await c.req.json();
    
    const existing = await kv.get<ControlledSubstance>(`substance:${vendorId}:${substanceId}`);
    
    if (!existing) {
      return c.json({ 
        success: false, 
        error: 'Controlled substance not found' 
      }, 404);
    }
    
    const updated: ControlledSubstance = {
      ...existing,
      ...body,
      id: substanceId,
      vendorId,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`substance:${vendorId}:${substanceId}`, updated);
    
    return c.json({
      success: true,
      substance: updated,
      message: 'Controlled substance updated successfully'
    });
  } catch (error) {
    console.error('Error updating controlled substance:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to update controlled substance',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/controlled-substances/:vendorId/:substanceId/dispense
 * Dispense a controlled substance (record transaction)
 */
app.post('/:vendorId/:substanceId/dispense', async (c) => {
  try {
    const { vendorId, substanceId } = c.req.param();
    const body = await c.req.json();
    
    const substance = await kv.get<ControlledSubstance>(`substance:${vendorId}:${substanceId}`);
    
    if (!substance) {
      return c.json({ 
        success: false, 
        error: 'Controlled substance not found' 
      }, 404);
    }
    
    if (substance.currentStock < body.quantity) {
      return c.json({ 
        success: false, 
        error: 'Insufficient stock' 
      }, 400);
    }
    
    // Update stock
    const previousStock = substance.currentStock;
    const newStock = previousStock - body.quantity;
    
    const updated: ControlledSubstance = {
      ...substance,
      currentStock: newStock,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`substance:${vendorId}:${substanceId}`, updated);
    
    // Log transaction
    const transactionId = `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const transaction: SubstanceTransaction = {
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
    
    await kv.set(`substance:transaction:${vendorId}:${transactionId}`, transaction);
    
    return c.json({
      success: true,
      substance: updated,
      transaction,
      message: 'Controlled substance dispensed successfully'
    });
  } catch (error) {
    console.error('Error dispensing controlled substance:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to dispense controlled substance',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/controlled-substances/:vendorId/:substanceId/transactions
 * Get transaction history for a substance
 */
app.get('/:vendorId/:substanceId/transactions', async (c) => {
  try {
    const { vendorId, substanceId } = c.req.param();
    
    const allTransactions = await kv.getByPrefix<SubstanceTransaction>(`substance:transaction:${vendorId}:`);
    const transactions = allTransactions.filter(t => t.substanceId === substanceId);
    
    // Sort by timestamp (most recent first)
    transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return c.json({
      success: true,
      transactions,
      total: transactions.length
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch transactions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/controlled-substances/:vendorId/audit-history
 * Get audit history for a vendor
 */
app.get('/:vendorId/audit-history', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    
    const audits = await kv.getByPrefix<ComplianceAudit>(`substance:audit:${vendorId}:`);
    
    // Sort by date (most recent first)
    audits.sort((a, b) => new Date(b.auditDate).getTime() - new Date(a.auditDate).getTime());
    
    return c.json({
      success: true,
      audits,
      total: audits.length
    });
  } catch (error) {
    console.error('Error fetching audit history:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch audit history',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/controlled-substances/:vendorId/audit
 * Create a new compliance audit
 */
app.post('/:vendorId/audit', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();
    
    const auditId = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const audit: ComplianceAudit = {
      id: auditId,
      vendorId,
      auditDate: new Date().toISOString(),
      auditorName: body.auditorName,
      auditorId: body.auditorId,
      findings: body.findings || [],
      discrepancies: body.discrepancies || [],
      status: body.status || 'pending',
      notes: body.notes,
      nextAuditDate: body.nextAuditDate
    };
    
    await kv.set(`substance:audit:${vendorId}:${auditId}`, audit);
    
    return c.json({
      success: true,
      audit,
      message: 'Audit created successfully'
    });
  } catch (error) {
    console.error('Error creating audit:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to create audit',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;
