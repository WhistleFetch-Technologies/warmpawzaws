import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

/**
 * 💊 CONTROLLED SUBSTANCES MANAGEMENT ENDPOINTS
 * For pharmacies and veterinary clinics managing controlled drugs
 * 
 * Features:
 * - Track controlled substance inventory
 * - Prescription verification
 * - Audit trail for compliance
 * - Stock level monitoring
 * - Expiry tracking
 */

// ==================== INTERFACES ====================

interface ControlledSubstance {
  id: string;
  vendorId: string;
  drugName: string;
  genericName?: string;
  scheduleClass: 'I' | 'II' | 'III' | 'IV' | 'V'; // DEA schedule classification
  strength: string;
  unit: string; // mg, ml, tablets, etc.
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  manufacturer: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  storageLocation: string;
  requiresPrescription: boolean;
  restrictedAccess: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ControlledSubstanceTransaction {
  id: string;
  vendorId: string;
  substanceId: string;
  transactionType: 'stock_in' | 'stock_out' | 'adjustment' | 'expired' | 'damaged';
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  prescriptionId?: string;
  customerId?: string;
  customerName?: string;
  petName?: string;
  staffId: string;
  staffName: string;
  reason: string;
  notes?: string;
  timestamp: string;
}

interface PrescriptionVerification {
  id: string;
  vendorId: string;
  prescriptionId: string;
  substanceId: string;
  prescribedBy: string;
  prescribedByLicenseNo: string;
  verifiedBy: string;
  verifiedByLicenseNo: string;
  patientName: string;
  quantity: number;
  dosage: string;
  frequency: string;
  duration: string;
  isVerified: boolean;
  verifiedAt?: string;
  dispensedAt?: string;
  status: 'pending' | 'verified' | 'dispensed' | 'rejected';
  rejectionReason?: string;
  createdAt: string;
}

// ==================== GET ALL CONTROLLED SUBSTANCES ====================

app.get('/controlled-substances/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');

    const substances = await kv.getByPrefix<ControlledSubstance>(`controlled_substance:${vendorId}:`);

    // Sort by schedule class and name
    substances.sort((a, b) => {
      if (a.scheduleClass !== b.scheduleClass) {
        return a.scheduleClass.localeCompare(b.scheduleClass);
      }
      return a.drugName.localeCompare(b.drugName);
    });

    // Calculate low stock items
    const lowStock = substances.filter(s => s.currentStock <= s.minStockLevel);
    const expiringSoon = substances.filter(s => {
      const daysUntilExpiry = Math.floor((new Date(s.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
    });

    return c.json({
      success: true,
      substances,
      stats: {
        total: substances.length,
        lowStock: lowStock.length,
        expiringSoon: expiringSoon.length
      }
    });
  } catch (error) {
    console.error('❌ Error fetching controlled substances:', error);
    return c.json({ success: false, error: 'Failed to fetch controlled substances' }, 500);
  }
});

// ==================== ADD CONTROLLED SUBSTANCE ====================

app.post('/controlled-substances/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();

    const substance: ControlledSubstance = {
      id: `CS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      vendorId,
      drugName: body.drugName,
      genericName: body.genericName,
      scheduleClass: body.scheduleClass,
      strength: body.strength,
      unit: body.unit,
      currentStock: body.currentStock || 0,
      minStockLevel: body.minStockLevel || 10,
      maxStockLevel: body.maxStockLevel || 100,
      manufacturer: body.manufacturer,
      batchNumber: body.batchNumber,
      manufacturingDate: body.manufacturingDate,
      expiryDate: body.expiryDate,
      storageLocation: body.storageLocation,
      requiresPrescription: body.requiresPrescription !== false,
      restrictedAccess: body.scheduleClass === 'I' || body.scheduleClass === 'II',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await kv.set(`controlled_substance:${vendorId}:${substance.id}`, substance);

    // Create initial stock-in transaction
    if (substance.currentStock > 0) {
      const transaction: ControlledSubstanceTransaction = {
        id: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        vendorId,
        substanceId: substance.id,
        transactionType: 'stock_in',
        quantity: substance.currentStock,
        balanceBefore: 0,
        balanceAfter: substance.currentStock,
        staffId: body.staffId || 'system',
        staffName: body.staffName || 'System',
        reason: 'Initial stock',
        timestamp: new Date().toISOString()
      };

      await kv.set(`cs_transaction:${vendorId}:${transaction.id}`, transaction);
    }

    return c.json({
      success: true,
      substance
    });
  } catch (error) {
    console.error('❌ Error adding controlled substance:', error);
    return c.json({ success: false, error: 'Failed to add controlled substance' }, 500);
  }
});

// ==================== UPDATE CONTROLLED SUBSTANCE ====================

app.put('/controlled-substances/:vendorId/:substanceId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const substanceId = c.req.param('substanceId');
    const body = await c.req.json();

    const key = `controlled_substance:${vendorId}:${substanceId}`;
    const existing = await kv.get<ControlledSubstance>(key);

    if (!existing) {
      return c.json({ success: false, error: 'Controlled substance not found' }, 404);
    }

    const updated: ControlledSubstance = {
      ...existing,
      ...body,
      id: substanceId, // Prevent ID change
      vendorId: vendorId, // Prevent vendor change
      updatedAt: new Date().toISOString()
    };

    await kv.set(key, updated);

    return c.json({
      success: true,
      substance: updated
    });
  } catch (error) {
    console.error('❌ Error updating controlled substance:', error);
    return c.json({ success: false, error: 'Failed to update controlled substance' }, 500);
  }
});

// ==================== RECORD TRANSACTION ====================

app.post('/controlled-substances/:vendorId/:substanceId/transaction', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const substanceId = c.req.param('substanceId');
    const body = await c.req.json();

    const substanceKey = `controlled_substance:${vendorId}:${substanceId}`;
    const substance = await kv.get<ControlledSubstance>(substanceKey);

    if (!substance) {
      return c.json({ success: false, error: 'Controlled substance not found' }, 404);
    }

    const quantity = body.transactionType === 'stock_in' || body.transactionType === 'adjustment'
      ? Math.abs(body.quantity)
      : -Math.abs(body.quantity);

    const newStock = substance.currentStock + quantity;

    if (newStock < 0) {
      return c.json({ success: false, error: 'Insufficient stock' }, 400);
    }

    // Create transaction record
    const transaction: ControlledSubstanceTransaction = {
      id: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      vendorId,
      substanceId,
      transactionType: body.transactionType,
      quantity: Math.abs(body.quantity),
      balanceBefore: substance.currentStock,
      balanceAfter: newStock,
      prescriptionId: body.prescriptionId,
      customerId: body.customerId,
      customerName: body.customerName,
      petName: body.petName,
      staffId: body.staffId,
      staffName: body.staffName,
      reason: body.reason,
      notes: body.notes,
      timestamp: new Date().toISOString()
    };

    // Update substance stock
    substance.currentStock = newStock;
    substance.updatedAt = new Date().toISOString();

    await kv.set(substanceKey, substance);
    await kv.set(`cs_transaction:${vendorId}:${transaction.id}`, transaction);

    return c.json({
      success: true,
      transaction,
      newStock
    });
  } catch (error) {
    console.error('❌ Error recording transaction:', error);
    return c.json({ success: false, error: 'Failed to record transaction' }, 500);
  }
});

// ==================== GET TRANSACTION HISTORY ====================

app.get('/controlled-substances/:vendorId/:substanceId/transactions', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const substanceId = c.req.param('substanceId');

    const allTransactions = await kv.getByPrefix<ControlledSubstanceTransaction>(`cs_transaction:${vendorId}:`);
    const transactions = allTransactions.filter(t => t.substanceId === substanceId);

    // Sort by timestamp descending
    transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return c.json({
      success: true,
      transactions
    });
  } catch (error) {
    console.error('❌ Error fetching transactions:', error);
    return c.json({ success: false, error: 'Failed to fetch transactions' }, 500);
  }
});

// ==================== PRESCRIPTION VERIFICATION ====================

app.post('/controlled-substances/:vendorId/verify-prescription', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();

    const verification: PrescriptionVerification = {
      id: `VERIFY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      vendorId,
      prescriptionId: body.prescriptionId,
      substanceId: body.substanceId,
      prescribedBy: body.prescribedBy,
      prescribedByLicenseNo: body.prescribedByLicenseNo,
      verifiedBy: body.verifiedBy,
      verifiedByLicenseNo: body.verifiedByLicenseNo,
      patientName: body.patientName,
      quantity: body.quantity,
      dosage: body.dosage,
      frequency: body.frequency,
      duration: body.duration,
      isVerified: body.isVerified || false,
      verifiedAt: body.isVerified ? new Date().toISOString() : undefined,
      status: body.status || 'pending',
      rejectionReason: body.rejectionReason,
      createdAt: new Date().toISOString()
    };

    await kv.set(`cs_verification:${vendorId}:${verification.id}`, verification);

    return c.json({
      success: true,
      verification
    });
  } catch (error) {
    console.error('❌ Error verifying prescription:', error);
    return c.json({ success: false, error: 'Failed to verify prescription' }, 500);
  }
});

// ==================== GET AUDIT REPORT ====================

app.get('/controlled-substances/:vendorId/audit-report', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { startDate, endDate } = c.req.query();

    const substances = await kv.getByPrefix<ControlledSubstance>(`controlled_substance:${vendorId}:`);
    const transactions = await kv.getByPrefix<ControlledSubstanceTransaction>(`cs_transaction:${vendorId}:`);

    // Filter by date if provided
    let filteredTransactions = transactions;
    if (startDate && endDate) {
      filteredTransactions = transactions.filter(t => {
        const txnDate = new Date(t.timestamp);
        return txnDate >= new Date(startDate) && txnDate <= new Date(endDate);
      });
    }

    // Group by substance
    const report = substances.map(substance => {
      const substanceTransactions = filteredTransactions.filter(t => t.substanceId === substance.id);
      const stockIn = substanceTransactions
        .filter(t => t.transactionType === 'stock_in')
        .reduce((sum, t) => sum + t.quantity, 0);
      const stockOut = substanceTransactions
        .filter(t => t.transactionType === 'stock_out')
        .reduce((sum, t) => sum + t.quantity, 0);

      return {
        substance: substance.drugName,
        scheduleClass: substance.scheduleClass,
        currentStock: substance.currentStock,
        stockIn,
        stockOut,
        transactionCount: substanceTransactions.length,
        lastTransaction: substanceTransactions[0]?.timestamp
      };
    });

    return c.json({
      success: true,
      report,
      period: startDate && endDate ? { startDate, endDate } : 'all-time',
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error generating audit report:', error);
    return c.json({ success: false, error: 'Failed to generate audit report' }, 500);
  }
});

export default app;
