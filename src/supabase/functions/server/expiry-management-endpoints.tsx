/**
 * Expiry Management Endpoints
 * Handles product expiry tracking, alerts, and batch management for pharmacies and stores
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

// Product Batch structure with expiry tracking
interface ProductBatch {
  id: string;
  vendorId: string;
  productId: string;
  productName: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  quantity: number;
  remainingQuantity: number;
  costPrice: number;
  sellingPrice: number;
  supplier: string;
  storageLocation?: string;
  status: 'active' | 'expiring_soon' | 'expired' | 'depleted';
  alertDays: number; // Days before expiry to trigger alert (default 30)
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Expiry Alert structure
interface ExpiryAlert {
  id: string;
  vendorId: string;
  batchId: string;
  productName: string;
  batchNumber: string;
  expiryDate: string;
  daysUntilExpiry: number;
  quantity: number;
  severity: 'critical' | 'warning' | 'info'; // < 7 days, < 30 days, < 90 days
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledgedAt?: string;
  resolvedAt?: string;
  action?: 'returned' | 'discarded' | 'sold_at_discount' | 'donated';
  createdAt: string;
}

// Disposal Record structure
interface DisposalRecord {
  id: string;
  vendorId: string;
  batchId: string;
  productName: string;
  batchNumber: string;
  quantity: number;
  reason: 'expired' | 'damaged' | 'recalled' | 'other';
  disposalMethod: 'returned_to_supplier' | 'destroyed' | 'donated' | 'other';
  disposalDate: string;
  cost: number; // Financial loss
  authorizedBy: string;
  notes?: string;
  createdAt: string;
}

/**
 * Helper: Calculate days until expiry
 */
function calculateDaysUntilExpiry(expiryDate: string): number {
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Helper: Determine batch status
 */
function determineBatchStatus(expiryDate: string, quantity: number, alertDays: number): string {
  if (quantity <= 0) return 'depleted';
  
  const daysUntilExpiry = calculateDaysUntilExpiry(expiryDate);
  
  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= alertDays) return 'expiring_soon';
  return 'active';
}

/**
 * Helper: Determine alert severity
 */
function determineAlertSeverity(daysUntilExpiry: number): 'critical' | 'warning' | 'info' {
  if (daysUntilExpiry <= 7) return 'critical';
  if (daysUntilExpiry <= 30) return 'warning';
  return 'info';
}

/**
 * GET /vendor/expiry/:vendorId/batches
 * Get all product batches with expiry tracking
 */
app.get('/:vendorId/batches', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { status, productId } = c.req.query();
    
    let batches = await kv.getByPrefix<ProductBatch>(`expiry:batch:${vendorId}:`);
    
    // Update batch statuses based on current date
    batches = batches.map(batch => ({
      ...batch,
      status: determineBatchStatus(batch.expiryDate, batch.remainingQuantity, batch.alertDays)
    }));
    
    // Filter by status if specified
    if (status) {
      batches = batches.filter(b => b.status === status);
    }
    
    // Filter by product if specified
    if (productId) {
      batches = batches.filter(b => b.productId === productId);
    }
    
    // Sort by expiry date (soonest first)
    batches.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
    
    // Calculate summary stats
    const stats = {
      total: batches.length,
      active: batches.filter(b => b.status === 'active').length,
      expiringSoon: batches.filter(b => b.status === 'expiring_soon').length,
      expired: batches.filter(b => b.status === 'expired').length,
      depleted: batches.filter(b => b.status === 'depleted').length,
      totalValue: batches
        .filter(b => b.status === 'active' || b.status === 'expiring_soon')
        .reduce((sum, b) => sum + (b.remainingQuantity * b.sellingPrice), 0)
    };
    
    return c.json({
      success: true,
      batches,
      stats
    });
  } catch (error) {
    console.error('Error fetching batches:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch batches',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/expiry/:vendorId/batches
 * Create a new product batch with expiry tracking
 */
app.post('/:vendorId/batches', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();
    
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const batch: ProductBatch = {
      id: batchId,
      vendorId,
      productId: body.productId,
      productName: body.productName,
      batchNumber: body.batchNumber,
      manufacturingDate: body.manufacturingDate,
      expiryDate: body.expiryDate,
      quantity: body.quantity,
      remainingQuantity: body.quantity,
      costPrice: body.costPrice,
      sellingPrice: body.sellingPrice,
      supplier: body.supplier,
      storageLocation: body.storageLocation,
      status: determineBatchStatus(body.expiryDate, body.quantity, body.alertDays || 30),
      alertDays: body.alertDays || 30,
      notes: body.notes,
      createdAt: now,
      updatedAt: now
    };
    
    await kv.set(`expiry:batch:${vendorId}:${batchId}`, batch);
    
    // Create alert if expiring soon
    const daysUntilExpiry = calculateDaysUntilExpiry(batch.expiryDate);
    if (daysUntilExpiry <= batch.alertDays && daysUntilExpiry >= 0) {
      const alertId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const alert: ExpiryAlert = {
        id: alertId,
        vendorId,
        batchId,
        productName: batch.productName,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        daysUntilExpiry,
        quantity: batch.quantity,
        severity: determineAlertSeverity(daysUntilExpiry),
        status: 'active',
        createdAt: now
      };
      await kv.set(`expiry:alert:${vendorId}:${alertId}`, alert);
    }
    
    return c.json({
      success: true,
      batch,
      message: 'Product batch created successfully'
    });
  } catch (error) {
    console.error('Error creating batch:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to create batch',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * PUT /vendor/expiry/:vendorId/batches/:batchId
 * Update product batch (e.g., reduce quantity after sale)
 */
app.put('/:vendorId/batches/:batchId', async (c) => {
  try {
    const { vendorId, batchId } = c.req.param();
    const body = await c.req.json();
    
    const existing = await kv.get<ProductBatch>(`expiry:batch:${vendorId}:${batchId}`);
    
    if (!existing) {
      return c.json({ 
        success: false, 
        error: 'Batch not found' 
      }, 404);
    }
    
    const updated: ProductBatch = {
      ...existing,
      ...body,
      id: batchId,
      vendorId,
      status: determineBatchStatus(
        body.expiryDate || existing.expiryDate, 
        body.remainingQuantity ?? existing.remainingQuantity,
        body.alertDays || existing.alertDays
      ),
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`expiry:batch:${vendorId}:${batchId}`, updated);
    
    return c.json({
      success: true,
      batch: updated,
      message: 'Batch updated successfully'
    });
  } catch (error) {
    console.error('Error updating batch:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to update batch',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/expiry/:vendorId/alerts
 * Get expiry alerts
 */
app.get('/:vendorId/alerts', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { status, severity } = c.req.query();
    
    let alerts = await kv.getByPrefix<ExpiryAlert>(`expiry:alert:${vendorId}:`);
    
    // Update alerts based on current date
    alerts = alerts.map(alert => ({
      ...alert,
      daysUntilExpiry: calculateDaysUntilExpiry(alert.expiryDate),
      severity: determineAlertSeverity(calculateDaysUntilExpiry(alert.expiryDate))
    }));
    
    // Filter by status
    if (status) {
      alerts = alerts.filter(a => a.status === status);
    }
    
    // Filter by severity
    if (severity) {
      alerts = alerts.filter(a => a.severity === severity);
    }
    
    // Sort by days until expiry (most urgent first)
    alerts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
    
    const stats = {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      info: alerts.filter(a => a.severity === 'info').length,
      active: alerts.filter(a => a.status === 'active').length,
      acknowledged: alerts.filter(a => a.status === 'acknowledged').length
    };
    
    return c.json({
      success: true,
      alerts,
      stats
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch alerts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/expiry/:vendorId/alerts/:alertId/acknowledge
 * Acknowledge an expiry alert
 */
app.post('/:vendorId/alerts/:alertId/acknowledge', async (c) => {
  try {
    const { vendorId, alertId } = c.req.param();
    
    const alert = await kv.get<ExpiryAlert>(`expiry:alert:${vendorId}:${alertId}`);
    
    if (!alert) {
      return c.json({ 
        success: false, 
        error: 'Alert not found' 
      }, 404);
    }
    
    const updated: ExpiryAlert = {
      ...alert,
      status: 'acknowledged',
      acknowledgedAt: new Date().toISOString()
    };
    
    await kv.set(`expiry:alert:${vendorId}:${alertId}`, updated);
    
    return c.json({
      success: true,
      alert: updated,
      message: 'Alert acknowledged'
    });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to acknowledge alert',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/expiry/:vendorId/disposal
 * Record product disposal (expired/damaged items)
 */
app.post('/:vendorId/disposal', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();
    
    const disposalId = `disposal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const disposal: DisposalRecord = {
      id: disposalId,
      vendorId,
      batchId: body.batchId,
      productName: body.productName,
      batchNumber: body.batchNumber,
      quantity: body.quantity,
      reason: body.reason,
      disposalMethod: body.disposalMethod,
      disposalDate: body.disposalDate || now,
      cost: body.cost,
      authorizedBy: body.authorizedBy,
      notes: body.notes,
      createdAt: now
    };
    
    await kv.set(`expiry:disposal:${vendorId}:${disposalId}`, disposal);
    
    // Update batch quantity
    const batch = await kv.get<ProductBatch>(`expiry:batch:${vendorId}:${body.batchId}`);
    if (batch) {
      const updatedBatch: ProductBatch = {
        ...batch,
        remainingQuantity: Math.max(0, batch.remainingQuantity - body.quantity),
        status: determineBatchStatus(
          batch.expiryDate, 
          Math.max(0, batch.remainingQuantity - body.quantity),
          batch.alertDays
        ),
        updatedAt: now
      };
      await kv.set(`expiry:batch:${vendorId}:${body.batchId}`, updatedBatch);
    }
    
    return c.json({
      success: true,
      disposal,
      message: 'Disposal recorded successfully'
    });
  } catch (error) {
    console.error('Error recording disposal:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to record disposal',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/expiry/:vendorId/disposal
 * Get disposal records
 */
app.get('/:vendorId/disposal', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { startDate, endDate } = c.req.query();
    
    let disposals = await kv.getByPrefix<DisposalRecord>(`expiry:disposal:${vendorId}:`);
    
    // Filter by date range
    if (startDate) {
      disposals = disposals.filter(d => d.disposalDate >= startDate);
    }
    if (endDate) {
      disposals = disposals.filter(d => d.disposalDate <= endDate);
    }
    
    // Sort by disposal date (most recent first)
    disposals.sort((a, b) => new Date(b.disposalDate).getTime() - new Date(a.disposalDate).getTime());
    
    const stats = {
      total: disposals.length,
      totalCost: disposals.reduce((sum, d) => sum + d.cost, 0),
      byReason: {
        expired: disposals.filter(d => d.reason === 'expired').length,
        damaged: disposals.filter(d => d.reason === 'damaged').length,
        recalled: disposals.filter(d => d.reason === 'recalled').length,
        other: disposals.filter(d => d.reason === 'other').length
      }
    };
    
    return c.json({
      success: true,
      disposals,
      stats
    });
  } catch (error) {
    console.error('Error fetching disposals:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch disposals',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/expiry/:vendorId/dashboard
 * Get comprehensive expiry management dashboard data
 */
app.get('/:vendorId/dashboard', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    
    // Fetch all data in parallel
    const [batches, alerts, disposals] = await Promise.all([
      kv.getByPrefix<ProductBatch>(`expiry:batch:${vendorId}:`),
      kv.getByPrefix<ExpiryAlert>(`expiry:alert:${vendorId}:`),
      kv.getByPrefix<DisposalRecord>(`expiry:disposal:${vendorId}:`)
    ]);
    
    // Update statuses
    const updatedBatches = batches.map(batch => ({
      ...batch,
      status: determineBatchStatus(batch.expiryDate, batch.remainingQuantity, batch.alertDays)
    }));
    
    const updatedAlerts = alerts.map(alert => ({
      ...alert,
      daysUntilExpiry: calculateDaysUntilExpiry(alert.expiryDate),
      severity: determineAlertSeverity(calculateDaysUntilExpiry(alert.expiryDate))
    }));
    
    // Calculate comprehensive stats
    const stats = {
      batches: {
        total: updatedBatches.length,
        active: updatedBatches.filter(b => b.status === 'active').length,
        expiringSoon: updatedBatches.filter(b => b.status === 'expiring_soon').length,
        expired: updatedBatches.filter(b => b.status === 'expired').length,
        totalValue: updatedBatches
          .filter(b => b.status === 'active' || b.status === 'expiring_soon')
          .reduce((sum, b) => sum + (b.remainingQuantity * b.sellingPrice), 0)
      },
      alerts: {
        total: updatedAlerts.filter(a => a.status === 'active').length,
        critical: updatedAlerts.filter(a => a.severity === 'critical' && a.status === 'active').length,
        warning: updatedAlerts.filter(a => a.severity === 'warning' && a.status === 'active').length,
        info: updatedAlerts.filter(a => a.severity === 'info' && a.status === 'active').length
      },
      disposal: {
        total: disposals.length,
        totalCost: disposals.reduce((sum, d) => sum + d.cost, 0),
        thisMonth: disposals.filter(d => {
          const disposalDate = new Date(d.disposalDate);
          const now = new Date();
          return disposalDate.getMonth() === now.getMonth() && 
                 disposalDate.getFullYear() === now.getFullYear();
        }).length
      }
    };
    
    // Get urgent items (expiring within 7 days)
    const urgentBatches = updatedBatches
      .filter(b => {
        const days = calculateDaysUntilExpiry(b.expiryDate);
        return days >= 0 && days <= 7 && b.remainingQuantity > 0;
      })
      .sort((a, b) => calculateDaysUntilExpiry(a.expiryDate) - calculateDaysUntilExpiry(b.expiryDate))
      .slice(0, 5);
    
    return c.json({
      success: true,
      stats,
      urgentBatches,
      recentAlerts: updatedAlerts
        .filter(a => a.status === 'active')
        .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
        .slice(0, 5)
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch dashboard',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/expiry/:vendorId/batches/bulk-import
 * Import multiple product batches from CSV/JSON
 */
app.post('/:vendorId/batches/bulk-import', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();
    const { batches } = body; // Array of batch objects
    
    if (!Array.isArray(batches) || batches.length === 0) {
      return c.json({
        success: false,
        error: 'Invalid import data - batches array required'
      }, 400);
    }
    
    const imported: ProductBatch[] = [];
    const errors: string[] = [];
    const now = new Date().toISOString();
    
    for (const batchData of batches) {
      try {
        const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Validate required fields
        if (!batchData.productName || !batchData.expiryDate) {
          errors.push(`Batch ${batchData.productName || 'unknown'}: Missing required fields`);
          continue;
        }
        
        const batch: ProductBatch = {
          id: batchId,
          vendorId,
          productName: batchData.productName,
          productId: batchData.productId || `prod-${Date.now()}`,
          category: batchData.category || 'other',
          batchNumber: batchData.batchNumber || `BATCH-${Date.now()}`,
          manufacturer: batchData.manufacturer || 'Unknown',
          manufacturingDate: batchData.manufacturingDate || now,
          expiryDate: batchData.expiryDate,
          initialQuantity: batchData.initialQuantity || 0,
          remainingQuantity: batchData.remainingQuantity || batchData.initialQuantity || 0,
          unit: batchData.unit || 'units',
          costPrice: batchData.costPrice || 0,
          sellingPrice: batchData.sellingPrice || 0,
          alertDays: batchData.alertDays || 30,
          location: batchData.location || 'Default',
          status: determineBatchStatus(
            batchData.expiryDate,
            batchData.remainingQuantity || batchData.initialQuantity || 0,
            batchData.alertDays || 30
          ),
          notes: batchData.notes,
          createdAt: now,
          updatedAt: now
        };
        
        await kv.set(`expiry:batch:${vendorId}:${batchId}`, batch);
        imported.push(batch);
        
        // Create alert if needed
        const daysUntilExpiry = calculateDaysUntilExpiry(batch.expiryDate);
        if (daysUntilExpiry >= 0 && daysUntilExpiry <= batch.alertDays && batch.remainingQuantity > 0) {
          const alertId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const alert: ExpiryAlert = {
            id: alertId,
            vendorId,
            batchId,
            productName: batch.productName,
            batchNumber: batch.batchNumber,
            expiryDate: batch.expiryDate,
            remainingQuantity: batch.remainingQuantity,
            unit: batch.unit,
            estimatedLoss: batch.remainingQuantity * batch.costPrice,
            daysUntilExpiry,
            severity: determineAlertSeverity(daysUntilExpiry),
            status: 'active',
            notificationSent: false,
            acknowledgedBy: '',
            actionTaken: '',
            createdAt: now,
            updatedAt: now
          };
          await kv.set(`expiry:alert:${vendorId}:${alertId}`, alert);
        }
      } catch (error) {
        errors.push(`Batch ${batchData.productName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return c.json({
      success: true,
      imported: imported.length,
      total: batches.length,
      errors: errors.length > 0 ? errors : undefined,
      batches: imported,
      message: `Successfully imported ${imported.length} of ${batches.length} batches`
    });
  } catch (error) {
    console.error('Error importing batches:', error);
    return c.json({
      success: false,
      error: 'Failed to import batches',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/expiry/:vendorId/batches/export
 * Export all batches to JSON/CSV format
 */
app.get('/:vendorId/batches/export', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const format = c.req.query('format') || 'json'; // json or csv
    
    const batches = await kv.getByPrefix<ProductBatch>(`expiry:batch:${vendorId}:`);
    
    // Update statuses before export
    const exportData = batches.map(batch => ({
      ...batch,
      status: determineBatchStatus(batch.expiryDate, batch.remainingQuantity, batch.alertDays)
    }));
    
    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'Product Name', 'Batch Number', 'Category', 'Manufacturer',
        'Manufacturing Date', 'Expiry Date', 'Initial Quantity', 
        'Remaining Quantity', 'Unit', 'Cost Price', 'Selling Price',
        'Location', 'Status', 'Alert Days', 'Notes'
      ];
      
      const csvRows = exportData.map(batch => [
        batch.productName,
        batch.batchNumber,
        batch.category,
        batch.manufacturer,
        batch.manufacturingDate,
        batch.expiryDate,
        batch.initialQuantity,
        batch.remainingQuantity,
        batch.unit,
        batch.costPrice,
        batch.sellingPrice,
        batch.location,
        batch.status,
        batch.alertDays,
        batch.notes || ''
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));
      
      const csv = [headers.join(','), ...csvRows].join('\n');
      
      return c.text(csv, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="expiry-batches-${vendorId}-${Date.now()}.csv"`
      });
    }
    
    // Default JSON format
    return c.json({
      success: true,
      batches: exportData,
      exportDate: new Date().toISOString(),
      total: exportData.length
    });
  } catch (error) {
    console.error('Error exporting batches:', error);
    return c.json({
      success: false,
      error: 'Failed to export batches',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;