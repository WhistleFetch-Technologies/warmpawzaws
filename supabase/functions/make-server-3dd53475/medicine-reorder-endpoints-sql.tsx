/**
 * 💊 MEDICINE REORDER SYSTEM - SQL-ONLY VERSION
 * 
 * Integration with Medicine Delivery Vendors
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Date: 2025-01-28
 * Migration: KV to SQL (21 KV operations → 0)
 */

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { getDbClient } from '../../lib/db.ts';
import { getPrescriptionsRepository } from '../../lib/repositories/prescriptions.ts';
import { getOrdersRepository } from '../../lib/repositories/orders.ts';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { withTransaction } from '../../lib/utils/transaction-helper.ts';

const app = new Hono();
const db = getDbClient();
const prescriptionsRepo = getPrescriptionsRepository();
const ordersRepo = getOrdersRepository();
const customersRepo = getCustomersRepository();
const vendorsRepo = getVendorsRepository();

// Create medicine reorder request
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

    if (!customerPhone || !prescriptionId || !medications || medications.length === 0) {
      return sendError(c, 'Customer phone, prescription ID, and medications are required', 400);
    }

    return await withTransaction(async (txClient) => {
      // ✅ SQL: Get prescription details
      const prescription = await prescriptionsRepo.findById(prescriptionId);
      if (!prescription) {
        return sendError(c, 'Prescription not found', 404);
      }

      // ✅ SQL: Get customer details
      const customer = await customersRepo.findByPhone(customerPhone);
      if (!customer) {
        return sendError(c, 'Customer not found', 404);
      }

      // Generate reorder ID
      const reorderId = `REORDER_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const orderNumber = `MED${Date.now().toString().slice(-8)}`;

      // ✅ SQL: Create order (medicine reorder)
      const order = await ordersRepo.create({
        customer_id: customer.id,
        vendor_id: null, // Will be assigned later
        order_number: orderNumber,
        subtotal: 0, // Will be calculated by vendor
        total_amount: 0,
        shipping_address: deliveryAddress || customer.address || '',
        shipping_city: customer.city || '',
        shipping_state: customer.state || '',
        shipping_pincode: customer.pincode || '',
        shipping_phone: customerPhone,
        payment_status: 'pending',
        order_status: 'pending',
        items: medications.map((med: any) => ({
          name: med.name,
          quantity: med.quantity,
          unit_price: 0, // Will be set by vendor
          total_price: 0
        })),
        metadata: {
          orderType: 'medicine_reorder',
          prescriptionId,
          bookingId: prescription.booking_id,
          petId: prescription.pet_id,
          petName: prescription.metadata?.petName,
          medications,
          deliveryInstructions,
          status: 'pending',
          reorderId
        }
      });

      console.log('✅ [MEDICINE] Reorder request created:', reorderId);

      return sendSuccess(c, {
        reorder: {
          id: reorderId,
          orderId: order.id,
          orderNumber: order.order_number,
          customerId: customer.id,
          customerName: customer.name,
          customerPhone,
          prescriptionId,
          bookingId: prescription.booking_id,
          petId: prescription.pet_id,
          medications,
          deliveryAddress: order.shipping_address,
          deliveryInstructions,
          status: 'pending',
          orderNumber: order.order_number,
          createdAt: order.created_at,
          updatedAt: order.updated_at
        }
      }, 'Medicine reorder request created successfully. We will connect you with a medicine delivery partner shortly.');
    });
  } catch (error) {
    console.error('❌ [MEDICINE] Error creating reorder:', error);
    return sendError(c, 'Failed to create reorder request', 500);
  }
});

// Get reorder request details
app.get("/make-server-3dd53475/medicine/reorder/:reorderId", async (c) => {
  try {
    const reorderId = c.req.param('reorderId');

    // ✅ SQL: Find order by reorderId in metadata
    const { data: orders } = await db
      .from('orders')
      .select('*')
      .eq('metadata->>reorderId', reorderId)
      .limit(1);

    if (!orders || orders.length === 0) {
      return sendError(c, 'Reorder request not found', 404);
    }

    const order = orders[0];

    return sendSuccess(c, {
      reorder: {
        id: reorderId,
        orderId: order.id,
        orderNumber: order.order_number,
        customerId: order.customer_id,
        prescriptionId: order.metadata?.prescriptionId,
        bookingId: order.metadata?.bookingId,
        petId: order.metadata?.petId,
        medications: order.metadata?.medications,
        deliveryAddress: order.shipping_address,
        deliveryInstructions: order.metadata?.deliveryInstructions,
        status: order.metadata?.status || order.order_status,
        medicineVendorId: order.vendor_id,
        estimatedDeliveryDate: order.metadata?.estimatedDeliveryDate,
        totalAmount: order.total_amount,
        orderNumber: order.order_number,
        createdAt: order.created_at,
        updatedAt: order.updated_at
      }
    });
  } catch (error) {
    console.error('❌ [MEDICINE] Error fetching reorder:', error);
    return sendError(c, 'Failed to fetch reorder request', 500);
  }
});

// Get all reorder requests for a customer
app.get("/make-server-3dd53475/medicine/reorder/customer/:customerPhone", async (c) => {
  try {
    const customerPhone = c.req.param('customerPhone');

    // ✅ SQL: Get customer
    const customer = await customersRepo.findByPhone(customerPhone);
    if (!customer) {
      return sendError(c, 'Customer not found', 404);
    }

    // ✅ SQL: Get orders (medicine reorders) for customer
    const orders = await ordersRepo.findByCustomer(customer.id);
    const reorders = orders
      .filter(o => o.metadata?.orderType === 'medicine_reorder')
      .map(order => ({
        id: order.metadata?.reorderId,
        orderId: order.id,
        orderNumber: order.order_number,
        customerId: order.customer_id,
        customerPhone,
        prescriptionId: order.metadata?.prescriptionId,
        bookingId: order.metadata?.bookingId,
        petId: order.metadata?.petId,
        petName: order.metadata?.petName,
        medications: order.metadata?.medications,
        deliveryAddress: order.shipping_address,
        deliveryInstructions: order.metadata?.deliveryInstructions,
        status: order.metadata?.status || order.order_status,
        medicineVendorId: order.vendor_id,
        medicineVendorName: order.metadata?.medicineVendorName,
        estimatedDeliveryDate: order.metadata?.estimatedDeliveryDate,
        totalAmount: order.total_amount,
        createdAt: order.created_at,
        updatedAt: order.updated_at
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return sendSuccess(c, {
      reorders,
      total: reorders.length
    });
  } catch (error) {
    console.error('❌ [MEDICINE] Error fetching customer reorders:', error);
    return sendError(c, 'Failed to fetch reorder history', 500);
  }
});

// Get all pending reorder requests
app.get("/make-server-3dd53475/medicine/reorder/pending", async (c) => {
  try {
    // ✅ SQL: Get all pending medicine reorder orders
    const { data: orders } = await db
      .from('orders')
      .select('*')
      .eq('metadata->>orderType', 'medicine_reorder')
      .eq('order_status', 'pending')
      .order('created_at', { ascending: true });

    const reorders = (orders || []).map(order => ({
      id: order.metadata?.reorderId,
      orderId: order.id,
      orderNumber: order.order_number,
      customerId: order.customer_id,
      customerPhone: order.shipping_phone,
      prescriptionId: order.metadata?.prescriptionId,
      bookingId: order.metadata?.bookingId,
      petId: order.metadata?.petId,
      petName: order.metadata?.petName,
      medications: order.metadata?.medications,
      deliveryAddress: order.shipping_address,
      deliveryInstructions: order.metadata?.deliveryInstructions,
      status: 'pending',
      createdAt: order.created_at,
      updatedAt: order.updated_at
    }));

    return sendSuccess(c, {
      reorders,
      total: reorders.length
    });
  } catch (error) {
    console.error('❌ [MEDICINE] Error fetching pending reorders:', error);
    return sendError(c, 'Failed to fetch pending reorders', 500);
  }
});

// Assign reorder request to a medicine vendor
app.post("/make-server-3dd53475/medicine/reorder/:reorderId/assign", async (c) => {
  try {
    const reorderId = c.req.param('reorderId');
    const { medicineVendorId, estimatedDeliveryDate, totalAmount } = await c.req.json();

    console.log('💊 [MEDICINE] Assigning reorder:', { reorderId, medicineVendorId });

    return await withTransaction(async (txClient) => {
      // ✅ SQL: Find order by reorderId
      const { data: orders } = await txClient
        .from('orders')
        .select('*')
        .eq('metadata->>reorderId', reorderId)
        .limit(1);

      if (!orders || orders.length === 0) {
        return sendError(c, 'Reorder request not found', 404);
      }

      const order = orders[0];

      // ✅ SQL: Verify vendor exists
      const vendor = await vendorsRepo.findById(medicineVendorId);
      if (!vendor) {
        return sendError(c, 'Medicine vendor not found', 404);
      }

      // ✅ SQL: Update order
      const metadata = order.metadata || {};
      metadata.status = 'confirmed';
      metadata.medicineVendorId = medicineVendorId;
      metadata.medicineVendorName = vendor.business_name || vendor.name;
      metadata.estimatedDeliveryDate = estimatedDeliveryDate;
      
      await ordersRepo.update(order.id, {
        vendor_id: medicineVendorId,
        order_status: 'confirmed',
        total_amount: totalAmount || order.total_amount,
        metadata
      });

      console.log('✅ [MEDICINE] Reorder assigned:', reorderId);

      return sendSuccess(c, {
        reorder: {
          id: reorderId,
          orderId: order.id,
          status: 'confirmed',
          medicineVendorId,
          medicineVendorName: metadata.medicineVendorName,
          estimatedDeliveryDate,
          totalAmount: totalAmount || order.total_amount
        }
      }, 'Reorder assigned to medicine vendor successfully');
    });
  } catch (error) {
    console.error('❌ [MEDICINE] Error assigning reorder:', error);
    return sendError(c, 'Failed to assign reorder', 500);
  }
});

// Update reorder status
app.post("/make-server-3dd53475/medicine/reorder/:reorderId/status", async (c) => {
  try {
    const reorderId = c.req.param('reorderId');
    const { status } = await c.req.json();

    console.log('💊 [MEDICINE] Updating reorder status:', { reorderId, status });

    // ✅ SQL: Find order by reorderId
    const { data: orders } = await db
      .from('orders')
      .select('*')
      .eq('metadata->>reorderId', reorderId)
      .limit(1);

    if (!orders || orders.length === 0) {
      return sendError(c, 'Reorder request not found', 404);
    }

    const order = orders[0];

    // ✅ SQL: Update order status
    const metadata = order.metadata || {};
    metadata.status = status;

    await ordersRepo.update(order.id, {
      order_status: status,
      metadata
    });

    console.log('✅ [MEDICINE] Reorder status updated:', { reorderId, status });

    return sendSuccess(c, {
      reorder: {
        id: reorderId,
        orderId: order.id,
        status
      }
    }, 'Reorder status updated successfully');
  } catch (error) {
    console.error('❌ [MEDICINE] Error updating reorder status:', error);
    return sendError(c, 'Failed to update reorder status', 500);
  }
});

export default app;

