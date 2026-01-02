// Medicine Reorder System - Integration with Medicine Delivery Vendors
import { Hono } from 'hono';
import * as kv from './kv_store';

const app = new Hono();

interface MedicineReorderRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  prescriptionId: string;
  bookingId: string;
  petId: string;
  petName: string;
  medications: {
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity: number;
  }[];
  deliveryAddress: string;
  deliveryInstructions?: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'dispatched' | 'delivered' | 'cancelled';
  medicineVendorId?: string; // Will be assigned to medicine delivery vendor
  medicineVendorName?: string;
  estimatedDeliveryDate?: string;
  totalAmount?: number;
  orderNumber?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * POST /make-server-3dd53475/medicine/reorder/create
 * Create a medicine reorder request from a prescription
 */
app.post("/make-server-3dd53475/medicine/reorder/create", async (c) => {
  try {
    const { 
      customerPhone, 
      prescriptionId, 
      medications,
      deliveryAddress,
      deliveryInstructions
    } = await c.req.json();

    console.log('💊 [MEDICINE] Creating reorder request:', { customerPhone, prescriptionId });

    // Validate required fields
    if (!customerPhone || !prescriptionId || !medications || medications.length === 0) {
      return c.json({ 
        success: false, 
        error: 'Customer phone, prescription ID, and medications are required' 
      }, 400);
    }

    // Get prescription details
    const prescription = await kv.get(`prescription:${prescriptionId}`);
    if (!prescription) {
      return c.json({ 
        success: false, 
        error: 'Prescription not found' 
      }, 404);
    }

    // Get customer details
    const customer = await kv.get(`customer:${customerPhone}`);
    if (!customer) {
      return c.json({ 
        success: false, 
        error: 'Customer not found' 
      }, 404);
    }

    // Generate reorder ID
    const reorderId = `REORDER_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const orderNumber = `MED${Date.now().toString().slice(-8)}`;

    const reorderRequest: MedicineReorderRequest = {
      id: reorderId,
      customerId: customerPhone,
      customerName: customer.name,
      customerPhone,
      prescriptionId,
      bookingId: prescription.bookingId,
      petId: prescription.petId,
      petName: prescription.petName,
      medications,
      deliveryAddress: deliveryAddress || customer.address || '',
      deliveryInstructions,
      status: 'pending',
      orderNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save reorder request
    await kv.set(`medicine:reorder:${reorderId}`, reorderRequest);

    // Add to customer's reorder history
    const customerReorders = await kv.get(`customer:${customerPhone}:medicine-reorders`) || [];
    customerReorders.push(reorderId);
    await kv.set(`customer:${customerPhone}:medicine-reorders`, customerReorders);

    // Add to pending reorders queue for admin/medicine vendors
    const pendingReorders = await kv.get('medicine:reorders:pending') || [];
    pendingReorders.push(reorderId);
    await kv.set('medicine:reorders:pending', pendingReorders);

    console.log('✅ [MEDICINE] Reorder request created:', reorderId);

    return c.json({
      success: true,
      reorder: reorderRequest,
      message: 'Medicine reorder request created successfully. We will connect you with a medicine delivery partner shortly.'
    });
  } catch (error) {
    console.error('❌ [MEDICINE] Error creating reorder:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to create reorder request' 
    }, 500);
  }
});

/**
 * GET /make-server-3dd53475/medicine/reorder/:reorderId
 * Get reorder request details
 */
app.get("/make-server-3dd53475/medicine/reorder/:reorderId", async (c) => {
  try {
    const { reorderId } = c.req.param();

    const reorder = await kv.get(`medicine:reorder:${reorderId}`);
    
    if (!reorder) {
      return c.json({ 
        success: false, 
        error: 'Reorder request not found' 
      }, 404);
    }

    return c.json({
      success: true,
      reorder
    });
  } catch (error) {
    console.error('❌ [MEDICINE] Error fetching reorder:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch reorder request' 
    }, 500);
  }
});

/**
 * GET /make-server-3dd53475/medicine/reorder/customer/:customerPhone
 * Get all reorder requests for a customer
 */
app.get("/make-server-3dd53475/medicine/reorder/customer/:customerPhone", async (c) => {
  try {
    const { customerPhone } = c.req.param();

    const reorderIds = await kv.get(`customer:${customerPhone}:medicine-reorders`) || [];

    const reorders = [];
    for (const reorderId of reorderIds) {
      const reorder = await kv.get(`medicine:reorder:${reorderId}`);
      if (reorder) {
        reorders.push(reorder);
      }
    }

    // Sort by creation time (newest first)
    reorders.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return c.json({
      success: true,
      reorders,
      total: reorders.length
    });
  } catch (error) {
    console.error('❌ [MEDICINE] Error fetching customer reorders:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch reorder history' 
    }, 500);
  }
});

/**
 * GET /make-server-3dd53475/medicine/reorder/pending
 * Get all pending reorder requests (for admin/medicine vendors)
 */
app.get("/make-server-3dd53475/medicine/reorder/pending", async (c) => {
  try {
    const reorderIds = await kv.get('medicine:reorders:pending') || [];

    const reorders = [];
    for (const reorderId of reorderIds) {
      const reorder = await kv.get(`medicine:reorder:${reorderId}`);
      if (reorder && reorder.status === 'pending') {
        reorders.push(reorder);
      }
    }

    // Sort by creation time (oldest first for processing)
    reorders.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return c.json({
      success: true,
      reorders,
      total: reorders.length
    });
  } catch (error) {
    console.error('❌ [MEDICINE] Error fetching pending reorders:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch pending reorders' 
    }, 500);
  }
});

/**
 * POST /make-server-3dd53475/medicine/reorder/:reorderId/assign
 * Assign reorder request to a medicine vendor (admin/system use)
 */
app.post("/make-server-3dd53475/medicine/reorder/:reorderId/assign", async (c) => {
  try {
    const { reorderId } = c.req.param();
    const { medicineVendorId, estimatedDeliveryDate, totalAmount } = await c.req.json();

    console.log('💊 [MEDICINE] Assigning reorder:', { reorderId, medicineVendorId });

    const reorder = await kv.get(`medicine:reorder:${reorderId}`);
    if (!reorder) {
      return c.json({ 
        success: false, 
        error: 'Reorder request not found' 
      }, 404);
    }

    // Get medicine vendor details
    const vendor = await kv.get(`vendor:${medicineVendorId}`);
    if (!vendor) {
      return c.json({ 
        success: false, 
        error: 'Medicine vendor not found' 
      }, 404);
    }

    // Update reorder
    reorder.status = 'confirmed';
    reorder.medicineVendorId = medicineVendorId;
    reorder.medicineVendorName = vendor.businessName || vendor.name;
    reorder.estimatedDeliveryDate = estimatedDeliveryDate;
    reorder.totalAmount = totalAmount;
    reorder.updatedAt = new Date().toISOString();

    await kv.set(`medicine:reorder:${reorderId}`, reorder);

    // Add to vendor's assigned reorders
    const vendorReorders = await kv.get(`vendor:${medicineVendorId}:medicine-reorders`) || [];
    vendorReorders.push(reorderId);
    await kv.set(`vendor:${medicineVendorId}:medicine-reorders`, vendorReorders);

    // Remove from pending queue
    const pendingReorders = await kv.get('medicine:reorders:pending') || [];
    const updatedPending = pendingReorders.filter((id: string) => id !== reorderId);
    await kv.set('medicine:reorders:pending', updatedPending);

    console.log('✅ [MEDICINE] Reorder assigned:', reorderId);

    return c.json({
      success: true,
      reorder,
      message: 'Reorder assigned to medicine vendor successfully'
    });
  } catch (error) {
    console.error('❌ [MEDICINE] Error assigning reorder:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to assign reorder' 
    }, 500);
  }
});

/**
 * POST /make-server-3dd53475/medicine/reorder/:reorderId/status
 * Update reorder status
 */
app.post("/make-server-3dd53475/medicine/reorder/:reorderId/status", async (c) => {
  try {
    const { reorderId } = c.req.param();
    const { status } = await c.req.json();

    console.log('💊 [MEDICINE] Updating reorder status:', { reorderId, status });

    const reorder = await kv.get(`medicine:reorder:${reorderId}`);
    if (!reorder) {
      return c.json({ 
        success: false, 
        error: 'Reorder request not found' 
      }, 404);
    }

    // Update status
    reorder.status = status;
    reorder.updatedAt = new Date().toISOString();

    await kv.set(`medicine:reorder:${reorderId}`, reorder);

    console.log('✅ [MEDICINE] Reorder status updated:', { reorderId, status });

    return c.json({
      success: true,
      reorder,
      message: 'Reorder status updated successfully'
    });
  } catch (error) {
    console.error('❌ [MEDICINE] Error updating reorder status:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to update reorder status' 
    }, 500);
  }
});

export default app;
