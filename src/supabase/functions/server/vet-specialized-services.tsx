import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createNotificationHelper } from './notification-system.tsx';

const app = new Hono();

/**
 * Vet Specialized Services Endpoints
 * 
 * Handles ambulance services, diagnostic tests, emergency protocols,
 * and pharmacy management for veterinary clinics
 */

// ============================================================================
// PHARMACY MANAGEMENT
// ============================================================================

/**
 * GET /vendor/:vendorId/pharmacy/inventory
 * Get all medicines in pharmacy inventory
 */
app.get('/vendor/:vendorId/pharmacy/inventory', async (c) => {
  try {
    const { vendorId } = c.req.param();
    console.log(`[VET-PHARMACY] Loading pharmacy inventory for vendor: ${vendorId}`);

    const medicines = await kv.get(`vendor_pharmacy_inventory_${vendorId}`) || [];

    return c.json({
      success: true,
      medicines,
      count: medicines.length
    });
  } catch (error) {
    console.error('[VET-PHARMACY] Error loading inventory:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to load pharmacy inventory',
      medicines: []
    }, 500);
  }
});

/**
 * POST /vendor/:vendorId/pharmacy/inventory
 * Add a new medicine to inventory
 */
app.post('/vendor/:vendorId/pharmacy/inventory', async (c) => {
  try {
    const { vendorId } = c.req.param();
    const medicineData = await c.req.json();
    
    console.log(`[VET-PHARMACY] Adding medicine for vendor: ${vendorId}`, medicineData);

    const medicineId = `med_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newMedicine = {
      id: medicineId,
      vendorId,
      name: medicineData.name,
      category: medicineData.category || 'general',
      manufacturer: medicineData.manufacturer || '',
      stock: medicineData.stock || 0,
      minStock: medicineData.minStock || 10,
      price: medicineData.price || 0,
      expiryDate: medicineData.expiryDate,
      batchNumber: medicineData.batchNumber || '',
      requiresPrescription: medicineData.requiresPrescription || false,
      isControlled: medicineData.isControlled || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const existingMedicines = await kv.get(`vendor_pharmacy_inventory_${vendorId}`) || [];
    const updatedMedicines = [...existingMedicines, newMedicine];
    await kv.set(`vendor_pharmacy_inventory_${vendorId}`, updatedMedicines);

    return c.json({
      success: true,
      message: 'Medicine added successfully',
      medicine: newMedicine
    });
  } catch (error) {
    console.error('[VET-PHARMACY] Error adding medicine:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to add medicine' 
    }, 500);
  }
});

/**
 * GET /vendor/:vendorId/pharmacy/prescription-orders
 * Get all prescription orders for pharmacy
 */
app.get('/vendor/:vendorId/pharmacy/prescription-orders', async (c) => {
  try {
    const { vendorId } = c.req.param();
    console.log(`[VET-PHARMACY] Loading prescription orders for vendor: ${vendorId}`);

    const orders = await kv.getByPrefix(`prescription_order:vendor:${vendorId}:`);
    
    // Sort by creation date (newest first)
    const sortedOrders = orders.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return c.json({
      success: true,
      orders: sortedOrders,
      count: sortedOrders.length
    });
  } catch (error) {
    console.error('[VET-PHARMACY] Error loading prescription orders:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to load prescription orders',
      orders: []
    }, 500);
  }
});

/**
 * POST /vendor/:vendorId/pharmacy/verify-prescription
 * Verify a prescription order
 */
app.post('/vendor/:vendorId/pharmacy/verify-prescription', async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { orderId } = await c.req.json();
    
    console.log(`[VET-PHARMACY] Verifying prescription order ${orderId} for vendor: ${vendorId}`);

    const order = await kv.get(`prescription_order:vendor:${vendorId}:${orderId}`);
    
    if (!order) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    const updatedOrder = {
      ...order,
      status: 'verified',
      verifiedAt: new Date().toISOString(),
      verifiedBy: vendorId
    };

    await kv.set(`prescription_order:vendor:${vendorId}:${orderId}`, updatedOrder);

    // Create notification for customer
    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'prescription_verified',
      title: 'Prescription Verified',
      message: `Your prescription order #${order.orderId} has been verified. Awaiting invoice.`,
      customerPhone: order.customerPhone || order.customerId,
      vendorId,
      orderId,
      createdAt: new Date().toISOString(),
      read: false
    };

    await kv.set(`notification:customer:${order.customerPhone || order.customerId}:${notification.id}`, notification);

    return c.json({
      success: true,
      message: 'Prescription verified successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('[VET-PHARMACY] Error verifying prescription:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to verify prescription' 
    }, 500);
  }
});

/**
 * POST /vendor/:vendorId/pharmacy/send-invoice
 * Send proforma invoice to customer
 */
app.post('/vendor/:vendorId/pharmacy/send-invoice', async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { orderId, amount, notes } = await c.req.json();
    
    console.log(`[VET-PHARMACY] Sending invoice for order ${orderId}`);

    const order = await kv.get(`prescription_order:vendor:${vendorId}:${orderId}`);
    
    if (!order) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    // Generate invoice ID
    const invoiceId = `INV-${Date.now()}`;
    
    const updatedOrder = {
      ...order,
      status: 'invoice_sent',
      totalAmount: amount,
      invoiceId,
      invoiceNotes: notes,
      invoiceSentAt: new Date().toISOString()
    };

    await kv.set(`prescription_order:vendor:${vendorId}:${orderId}`, updatedOrder);

    // Create notification for customer
    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'invoice_received',
      title: 'Invoice Received',
      message: `Invoice #${invoiceId} for ₹${amount} has been sent. Please review and pay.`,
      customerPhone: order.customerPhone || order.customerId,
      vendorId,
      orderId,
      invoiceId,
      amount,
      createdAt: new Date().toISOString(),
      read: false
    };

    await kv.set(`notification:customer:${order.customerPhone || order.customerId}:${notification.id}`, notification);

    return c.json({
      success: true,
      message: 'Invoice sent successfully',
      order: updatedOrder,
      invoiceId
    });
  } catch (error) {
    console.error('[VET-PHARMACY] Error sending invoice:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to send invoice' 
    }, 500);
  }
});

/**
 * POST /vendor/:vendorId/pharmacy/dispatch-order
 * Dispatch order and notify delivery partner
 */
app.post('/vendor/:vendorId/pharmacy/dispatch-order', async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { orderId } = await c.req.json();
    
    console.log(`[VET-PHARMACY] Dispatching order ${orderId}`);

    const order = await kv.get(`prescription_order:vendor:${vendorId}:${orderId}`);
    
    if (!order) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    // Simulate assigning to delivery partner
    const deliveryPartnerId = `delivery_${Math.random().toString(36).substr(2, 9)}`;
    
    const updatedOrder = {
      ...order,
      status: 'dispatched',
      deliveryPartnerId,
      dispatchedAt: new Date().toISOString()
    };

    await kv.set(`prescription_order:vendor:${vendorId}:${orderId}`, updatedOrder);

    // ✅ NOTIFICATION: Delivery Dispatched - Use existing notification system
    try {
      const customerId = order.customerPhone || order.customerId;
      const customer = await kv.get(`customer:${customerId}`);
      const trackingUrl = order.trackingUrl || `https://warmpawz.com/track/${orderId}`;

      await createNotificationHelper({
        recipientId: customerId,
        recipientType: 'customer',
        type: 'order_dispatched',
        category: 'orders',
        title: 'Order Dispatched',
        message: `Your order #${order.orderId || orderId} has been dispatched! Track: ${trackingUrl}`,
        recipientEmail: customer?.email,
        recipientPhone: order.customerPhone || customer?.phone,
        channels: { email: false, sms: true, inApp: true, push: false },
        data: { orderId, trackingUrl, deliveryPartnerId },
        priority: 'high'
      });

      console.log(`📱 [NOTIFICATION] Delivery dispatched notification sent to customer`);
    } catch (notifError) {
      console.error(`⚠️ [NOTIFICATION] Failed to send delivery dispatched notification:`, notifError);
      // Don't fail the request if notification fails
    }

    return c.json({
      success: true,
      message: 'Order dispatched successfully',
      order: updatedOrder,
      deliveryPartnerId
    });
  } catch (error) {
    console.error('[VET-PHARMACY] Error dispatching order:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to dispatch order' 
    }, 500);
  }
});

// ============================================================================
// AMBULANCE SERVICES
// ============================================================================

/**
 * GET /vendor/:vendorId/ambulance-services
 * Get all ambulance services for a vet vendor
 */
app.get('/vendor/:vendorId/ambulance-services', async (c) => {
  try {
    const { vendorId } = c.req.param();
    console.log(`[VET-SERVICES] Loading ambulance services for vendor: ${vendorId}`);

    const ambulances = await kv.get(`vendor_ambulances_${vendorId}`) || [];

    return c.json({
      success: true,
      ambulances,
      count: ambulances.length
    });
  } catch (error) {
    console.error('[VET-SERVICES] Error loading ambulances:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to load ambulance services',
      ambulances: []
    }, 500);
  }
});

/**
 * POST /vendor/:vendorId/ambulance-services
 * Add a new ambulance service
 */
app.post('/vendor/:vendorId/ambulance-services', async (c) => {
  try {
    const { vendorId } = c.req.param();
    const ambulanceData = await c.req.json();
    
    console.log(`[VET-SERVICES] Adding ambulance for vendor: ${vendorId}`, ambulanceData);

    // Generate unique ID
    const ambulanceId = `amb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newAmbulance = {
      id: ambulanceId,
      vendorId,
      vehicleNumber: ambulanceData.vehicleNumber,
      driverName: ambulanceData.driverName,
      driverPhone: ambulanceData.driverPhone,
      basePrice: ambulanceData.basePrice || 500,
      pricePerKm: ambulanceData.pricePerKm || 20,
      availability: ambulanceData.availability || 'available', // 'available', 'busy', 'offline'
      currentLocation: ambulanceData.currentLocation || '',
      equipment: ambulanceData.equipment || [],
      capacity: ambulanceData.capacity || 'small', // 'small', 'medium', 'large'
      notes: ambulanceData.notes || '',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    // Get existing ambulances
    const existingAmbulances = await kv.get(`vendor_ambulances_${vendorId}`) || [];
    
    // Add new ambulance
    const updatedAmbulances = [...existingAmbulances, newAmbulance];
    await kv.set(`vendor_ambulances_${vendorId}`, updatedAmbulances);

    return c.json({
      success: true,
      message: 'Ambulance service added successfully',
      ambulance: newAmbulance
    });
  } catch (error) {
    console.error('[VET-SERVICES] Error adding ambulance:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to add ambulance service' 
    }, 500);
  }
});

/**
 * PUT /vendor/:vendorId/ambulance-services/:ambulanceId
 * Update an ambulance service
 */
app.put('/vendor/:vendorId/ambulance-services/:ambulanceId', async (c) => {
  try {
    const { vendorId, ambulanceId } = c.req.param();
    const updates = await c.req.json();
    
    console.log(`[VET-SERVICES] Updating ambulance ${ambulanceId} for vendor: ${vendorId}`);

    const ambulances = await kv.get(`vendor_ambulances_${vendorId}`) || [];
    
    const updatedAmbulances = ambulances.map((amb: any) => {
      if (amb.id === ambulanceId) {
        return {
          ...amb,
          ...updates,
          lastUpdated: new Date().toISOString()
        };
      }
      return amb;
    });

    await kv.set(`vendor_ambulances_${vendorId}`, updatedAmbulances);

    const updatedAmbulance = updatedAmbulances.find((a: any) => a.id === ambulanceId);

    return c.json({
      success: true,
      message: 'Ambulance service updated successfully',
      ambulance: updatedAmbulance
    });
  } catch (error) {
    console.error('[VET-SERVICES] Error updating ambulance:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to update ambulance service' 
    }, 500);
  }
});

/**
 * DELETE /vendor/:vendorId/ambulance-services/:ambulanceId
 * Delete an ambulance service
 */
app.delete('/vendor/:vendorId/ambulance-services/:ambulanceId', async (c) => {
  try {
    const { vendorId, ambulanceId } = c.req.param();
    
    console.log(`[VET-SERVICES] Deleting ambulance ${ambulanceId} for vendor: ${vendorId}`);

    const ambulances = await kv.get(`vendor_ambulances_${vendorId}`) || [];
    const filteredAmbulances = ambulances.filter((amb: any) => amb.id !== ambulanceId);

    await kv.set(`vendor_ambulances_${vendorId}`, filteredAmbulances);

    return c.json({
      success: true,
      message: 'Ambulance service deleted successfully'
    });
  } catch (error) {
    console.error('[VET-SERVICES] Error deleting ambulance:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to delete ambulance service' 
    }, 500);
  }
});

// ============================================================================
// DIAGNOSTIC TESTS
// ============================================================================

/**
 * GET /vendor/:vendorId/diagnostic-tests
 * Get all diagnostic tests for a vet vendor
 */
app.get('/vendor/:vendorId/diagnostic-tests', async (c) => {
  try {
    const { vendorId } = c.req.param();
    console.log(`[VET-SERVICES] Loading diagnostic tests for vendor: ${vendorId}`);

    const tests = await kv.get(`vendor_diagnostics_${vendorId}`) || [];

    return c.json({
      success: true,
      tests,
      count: tests.length
    });
  } catch (error) {
    console.error('[VET-SERVICES] Error loading diagnostic tests:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to load diagnostic tests',
      tests: []
    }, 500);
  }
});

/**
 * POST /vendor/:vendorId/diagnostic-tests
 * Add a new diagnostic test
 */
app.post('/vendor/:vendorId/diagnostic-tests', async (c) => {
  try {
    const { vendorId } = c.req.param();
    const testData = await c.req.json();
    
    console.log(`[VET-SERVICES] Adding diagnostic test for vendor: ${vendorId}`, testData);

    // Generate unique ID
    const testId = `diag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newTest = {
      id: testId,
      vendorId,
      testName: testData.testName,
      category: testData.category || 'other', // 'blood', 'urine', 'xray', 'ultrasound', 'other'
      price: testData.price || 0,
      duration: testData.duration || 30, // minutes
      requiresFasting: testData.requiresFasting || false,
      description: testData.description || '',
      sampleRequired: testData.sampleRequired || '',
      reportDeliveryTime: testData.reportDeliveryTime || '24 hours',
      prerequisites: testData.prerequisites || [],
      isActive: testData.isActive !== undefined ? testData.isActive : true,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    // Get existing tests
    const existingTests = await kv.get(`vendor_diagnostics_${vendorId}`) || [];
    
    // Add new test
    const updatedTests = [...existingTests, newTest];
    await kv.set(`vendor_diagnostics_${vendorId}`, updatedTests);

    return c.json({
      success: true,
      message: 'Diagnostic test added successfully',
      test: newTest
    });
  } catch (error) {
    console.error('[VET-SERVICES] Error adding diagnostic test:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to add diagnostic test' 
    }, 500);
  }
});

/**
 * PUT /vendor/:vendorId/diagnostic-tests/:testId
 * Update a diagnostic test
 */
app.put('/vendor/:vendorId/diagnostic-tests/:testId', async (c) => {
  try {
    const { vendorId, testId } = c.req.param();
    const updates = await c.req.json();
    
    console.log(`[VET-SERVICES] Updating diagnostic test ${testId} for vendor: ${vendorId}`);

    const tests = await kv.get(`vendor_diagnostics_${vendorId}`) || [];
    
    const updatedTests = tests.map((test: any) => {
      if (test.id === testId) {
        return {
          ...test,
          ...updates,
          lastUpdated: new Date().toISOString()
        };
      }
      return test;
    });

    await kv.set(`vendor_diagnostics_${vendorId}`, updatedTests);

    const updatedTest = updatedTests.find((t: any) => t.id === testId);

    return c.json({
      success: true,
      message: 'Diagnostic test updated successfully',
      test: updatedTest
    });
  } catch (error) {
    console.error('[VET-SERVICES] Error updating diagnostic test:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to update diagnostic test' 
    }, 500);
  }
});

/**
 * DELETE /vendor/:vendorId/diagnostic-tests/:testId
 * Delete a diagnostic test
 */
app.delete('/vendor/:vendorId/diagnostic-tests/:testId', async (c) => {
  try {
    const { vendorId, testId } = c.req.param();
    
    console.log(`[VET-SERVICES] Deleting diagnostic test ${testId} for vendor: ${vendorId}`);

    const tests = await kv.get(`vendor_diagnostics_${vendorId}`) || [];
    const filteredTests = tests.filter((test: any) => test.id !== testId);

    await kv.set(`vendor_diagnostics_${vendorId}`, filteredTests);

    return c.json({
      success: true,
      message: 'Diagnostic test deleted successfully'
    });
  } catch (error) {
    console.error('[VET-SERVICES] Error deleting diagnostic test:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to delete diagnostic test' 
    }, 500);
  }
});

// ============================================================================
// EMERGENCY PROTOCOLS
// ============================================================================

/**
 * GET /vendor/:vendorId/emergency-protocols
 * Get all emergency protocols for a vet vendor
 */
app.get('/vendor/:vendorId/emergency-protocols', async (c) => {
  try {
    const { vendorId } = c.req.param();
    console.log(`[VET-SERVICES] Loading emergency protocols for vendor: ${vendorId}`);

    const protocols = await kv.get(`vendor_emergency_protocols_${vendorId}`) || [];

    return c.json({
      success: true,
      protocols,
      count: protocols.length
    });
  } catch (error) {
    console.error('[VET-SERVICES] Error loading emergency protocols:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to load emergency protocols',
      protocols: []
    }, 500);
  }
});

/**
 * POST /vendor/:vendorId/emergency-protocols
 * Add a new emergency protocol
 */
app.post('/vendor/:vendorId/emergency-protocols', async (c) => {
  try {
    const { vendorId } = c.req.param();
    const protocolData = await c.req.json();
    
    console.log(`[VET-SERVICES] Adding emergency protocol for vendor: ${vendorId}`, protocolData);

    // Generate unique ID
    const protocolId = `proto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newProtocol = {
      id: protocolId,
      vendorId,
      protocolName: protocolData.protocolName,
      severity: protocolData.severity || 'medium', // 'critical', 'high', 'medium'
      responseTime: protocolData.responseTime || 15, // minutes
      requiredEquipment: protocolData.requiredEquipment || [],
      steps: protocolData.steps || [],
      emergencyContacts: protocolData.emergencyContacts || [],
      medications: protocolData.medications || [],
      notes: protocolData.notes || '',
      isActive: protocolData.isActive !== undefined ? protocolData.isActive : true,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    // Get existing protocols
    const existingProtocols = await kv.get(`vendor_emergency_protocols_${vendorId}`) || [];
    
    // Add new protocol
    const updatedProtocols = [...existingProtocols, newProtocol];
    await kv.set(`vendor_emergency_protocols_${vendorId}`, updatedProtocols);

    return c.json({
      success: true,
      message: 'Emergency protocol added successfully',
      protocol: newProtocol
    });
  } catch (error) {
    console.error('[VET-SERVICES] Error adding emergency protocol:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to add emergency protocol' 
    }, 500);
  }
});

/**
 * PUT /vendor/:vendorId/emergency-protocols/:protocolId
 * Update an emergency protocol
 */
app.put('/vendor/:vendorId/emergency-protocols/:protocolId', async (c) => {
  try {
    const { vendorId, protocolId } = c.req.param();
    const updates = await c.req.json();
    
    console.log(`[VET-SERVICES] Updating emergency protocol ${protocolId} for vendor: ${vendorId}`);

    const protocols = await kv.get(`vendor_emergency_protocols_${vendorId}`) || [];
    
    const updatedProtocols = protocols.map((protocol: any) => {
      if (protocol.id === protocolId) {
        return {
          ...protocol,
          ...updates,
          lastUpdated: new Date().toISOString()
        };
      }
      return protocol;
    });

    await kv.set(`vendor_emergency_protocols_${vendorId}`, updatedProtocols);

    const updatedProtocol = updatedProtocols.find((p: any) => p.id === protocolId);

    return c.json({
      success: true,
      message: 'Emergency protocol updated successfully',
      protocol: updatedProtocol
    });
  } catch (error) {
    console.error('[VET-SERVICES] Error updating emergency protocol:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to update emergency protocol' 
    }, 500);
  }
});

/**
 * DELETE /vendor/:vendorId/emergency-protocols/:protocolId
 * Delete an emergency protocol
 */
app.delete('/vendor/:vendorId/emergency-protocols/:protocolId', async (c) => {
  try {
    const { vendorId, protocolId } = c.req.param();
    
    console.log(`[VET-SERVICES] Deleting emergency protocol ${protocolId} for vendor: ${vendorId}`);

    const protocols = await kv.get(`vendor_emergency_protocols_${vendorId}`) || [];
    const filteredProtocols = protocols.filter((protocol: any) => protocol.id !== protocolId);

    await kv.set(`vendor_emergency_protocols_${vendorId}`, filteredProtocols);

    return c.json({
      success: true,
      message: 'Emergency protocol deleted successfully'
    });
  } catch (error) {
    console.error('[VET-SERVICES] Error deleting emergency protocol:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to delete emergency protocol' 
    }, 500);
  }
});

export default app;