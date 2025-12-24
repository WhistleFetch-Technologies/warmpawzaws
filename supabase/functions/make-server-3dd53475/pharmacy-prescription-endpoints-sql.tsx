/**
 * 📋 PHARMACY PRESCRIPTION VERIFICATION ENDPOINTS - SQL VERSION
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 * 
 * Handles prescription submission from customers to pharmacies
 * Allows pharmacies to verify and process prescriptions
 * 
 * Flow:
 * 1. Customer uploads prescription to pharmacy
 * 2. Pharmacy receives notification
 * 3. Pharmacy verifies prescription
 * 4. Customer can proceed with medicine order
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getDbClient } from "../../lib/db.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";

export function pharmacyPrescriptionEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const client = getDbClient();
  const vendorsRepo = getVendorsRepository();
  const customersRepo = getCustomersRepository();

  // ============================================
  // CUSTOMER ENDPOINTS - Submit Prescription
  // ============================================

  /**
   * POST /customer/prescription/upload
   * Upload prescription file to S3 and return URL
   */
  app.post(`${BASE_PATH}/customer/prescription/upload`, async (c) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      const customerId = formData.get('customerId') as string;
      const petId = formData.get('petId') as string | null;

      if (!customerId || !file) {
        return sendError(c, 'Missing required fields: customerId, file', 400);
      }

      console.log(`📋 [SQL] Customer ${customerId} uploading prescription`);

      // ✅ SQL: Get S3 settings from platform settings
      const { getPlatformSettingsRepository } = await import('../../lib/repositories/platform-settings.ts');
      const platformRepo = getPlatformSettingsRepository();
      const awsSettings = await platformRepo.getAWSSettings();

      if (!awsSettings || !awsSettings.s3_config?.enabled) {
        return sendError(c, 'S3 not configured. Please configure in Admin Portal.', 500);
      }

      // Upload to S3 using AWS SDK
      const { S3Client, PutObjectCommand } = await import('npm:@aws-sdk/client-s3@3');
      const s3Client = new S3Client({
        region: awsSettings.s3_config.region || 'ap-south-1',
        credentials: {
          accessKeyId: awsSettings.credentials.accessKeyId,
          secretAccessKey: awsSettings.credentials.secretAccessKey,
        },
      });

      const fileName = `prescription_${customerId}_${Date.now()}.${file.name.split('.').pop() || 'jpg'}`;
      const s3FileName = `prescriptions/${customerId}/${fileName}`;
      
      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      const uploadCommand = new PutObjectCommand({
        Bucket: awsSettings.s3_config.bucket,
        Key: s3FileName,
        Body: buffer,
        ContentType: file.type || 'image/jpeg',
      });

      await s3Client.send(uploadCommand);

      const prescriptionUrl = `https://${awsSettings.s3_config.bucket}.s3.${awsSettings.s3_config.region || 'ap-south-1'}.amazonaws.com/${s3FileName}`;

      console.log(`✅ [SQL] Prescription uploaded: ${prescriptionUrl}`);

      return sendSuccess(c, {
        url: prescriptionUrl,
        prescriptionUrl: prescriptionUrl,
        message: 'Prescription uploaded successfully'
      });

    } catch (error) {
      console.error('❌ [SQL] Error uploading prescription:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /customer/prescription/submit
   * Customer submits prescription to a pharmacy for verification
   */
  app.post(`${BASE_PATH}/customer/prescription/submit`, async (c) => {
    try {
      const {
        customerId,
        pharmacyVendorId,
        prescriptionUrl,
        prescriptionType,
        notes,
        petId,
        petName
      } = await c.req.json();

      console.log(`📋 [SQL] Customer ${customerId} submitting prescription to pharmacy ${pharmacyVendorId}`);

      if (!customerId || !pharmacyVendorId || !prescriptionUrl) {
        return sendError(c, 'Missing required fields: customerId, pharmacyVendorId, prescriptionUrl', 400);
      }

      // Get pharmacy details
      const pharmacy = await vendorsRepo.findById(pharmacyVendorId);
      if (!pharmacy) {
        return sendError(c, 'Pharmacy not found', 404);
      }

      // Get customer details
      const customer = await customersRepo.findById(customerId);
      if (!customer) {
        return sendError(c, 'Customer not found', 404);
      }

      // Create prescription submission
      const submissionId = `PRESC-SUB-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

      const { data: submission, error: insertError } = await client
        .from('prescription_submissions')
        .insert({
          submission_id: submissionId,
          customer_id: customerId,
          pharmacy_vendor_id: pharmacyVendorId,
          prescription_url: prescriptionUrl,
          prescription_type: prescriptionType || 'image',
          notes: notes || null,
          pet_id: petId || null,
          pet_name: petName || null,
          customer_name: customer.full_name || customer.name || 'Customer',
          customer_phone: customer.phone,
          customer_email: customer.email || null,
          pharmacy_name: pharmacy.business_name,
          status: 'pending_verification',
          medicines: [],
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating prescription submission:', insertError);
        return sendError(c, insertError, 500);
      }

      console.log(`✅ [SQL] Prescription submitted: ${submissionId}`);

      return sendSuccess(c, {
        submission,
        message: 'Prescription submitted successfully. The pharmacy will verify it shortly.'
      });

    } catch (error) {
      console.error('❌ [SQL] Error submitting prescription:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /customer/:customerId/prescriptions
   * Get all prescription submissions for a customer
   */
  app.get(`${BASE_PATH}/customer/:customerId/prescriptions`, async (c) => {
    try {
      const { customerId } = c.req.param();
      const status = c.req.query('status');

      console.log(`📋 [SQL] Loading prescriptions for customer ${customerId}`);

      let query = client
        .from('prescription_submissions')
        .select('*')
        .eq('customer_id', customerId)
        .order('submitted_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data: prescriptions, error } = await query;

      if (error) {
        console.error('Error fetching prescriptions:', error);
        return sendError(c, error, 500);
      }

      console.log(`✅ [SQL] Loaded ${prescriptions?.length || 0} prescriptions`);

      return sendSuccess(c, { prescriptions: prescriptions || [] });

    } catch (error) {
      console.error('❌ [SQL] Error loading prescriptions:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /customer/prescription/:submissionId
   * Get single prescription submission details
   */
  app.get(`${BASE_PATH}/customer/prescription/:submissionId`, async (c) => {
    try {
      const { submissionId } = c.req.param();

      const { data: prescription, error } = await client
        .from('prescription_submissions')
        .select('*')
        .or(`id.eq.${submissionId},submission_id.eq.${submissionId}`)
        .single();

      if (error || !prescription) {
        return sendError(c, 'Prescription not found', 404);
      }

      return sendSuccess(c, { prescription });

    } catch (error) {
      console.error('❌ [SQL] Error loading prescription:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // PHARMACY ENDPOINTS - Verify Prescription
  // ============================================

  /**
   * GET /pharmacy/:pharmacyId/prescriptions/pending
   * Get all pending prescriptions for a pharmacy
   */
  app.get(`${BASE_PATH}/pharmacy/:pharmacyId/prescriptions/pending`, async (c) => {
    try {
      const { pharmacyId } = c.req.param();

      console.log(`📋 [SQL] Loading pending prescriptions for pharmacy ${pharmacyId}`);

      const { data: prescriptions, error } = await client
        .from('prescription_submissions')
        .select('*')
        .eq('pharmacy_vendor_id', pharmacyId)
        .eq('status', 'pending_verification')
        .order('submitted_at', { ascending: false });

      if (error) {
        console.error('Error fetching pending prescriptions:', error);
        return sendError(c, error, 500);
      }

      console.log(`✅ [SQL] Loaded ${prescriptions?.length || 0} pending prescriptions`);

      return sendSuccess(c, { prescriptions: prescriptions || [] });

    } catch (error) {
      console.error('❌ [SQL] Error loading pending prescriptions:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /pharmacy/:pharmacyId/prescriptions
   * Get all prescriptions for a pharmacy (all statuses)
   */
  app.get(`${BASE_PATH}/pharmacy/:pharmacyId/prescriptions`, async (c) => {
    try {
      const { pharmacyId } = c.req.param();
      const status = c.req.query('status');
      const limit = c.req.query('limit');

      console.log(`📋 [SQL] Loading prescriptions for pharmacy ${pharmacyId}`);

      let query = client
        .from('prescription_submissions')
        .select('*')
        .eq('pharmacy_vendor_id', pharmacyId)
        .order('submitted_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      if (limit) {
        query = query.limit(parseInt(limit));
      }

      const { data: prescriptions, error } = await query;

      if (error) {
        console.error('Error fetching prescriptions:', error);
        return sendError(c, error, 500);
      }

      console.log(`✅ [SQL] Loaded ${prescriptions?.length || 0} prescriptions`);

      return sendSuccess(c, {
        prescriptions: prescriptions || [],
        total: prescriptions?.length || 0
      });

    } catch (error) {
      console.error('❌ [SQL] Error loading prescriptions:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /pharmacy/prescription/:submissionId/verify
   * Pharmacy verifies a prescription submission
   */
  app.put(`${BASE_PATH}/pharmacy/prescription/:submissionId/verify`, async (c) => {
    try {
      const { submissionId } = c.req.param();
      const {
        pharmacyId,
        staffId,
        status,
        verificationNotes,
        medicines
      } = await c.req.json();

      console.log(`📋 [SQL] Pharmacy ${pharmacyId} verifying prescription ${submissionId}`);

      // Get prescription
      const { data: prescription, error: fetchError } = await client
        .from('prescription_submissions')
        .select('*')
        .or(`id.eq.${submissionId},submission_id.eq.${submissionId}`)
        .single();

      if (fetchError || !prescription) {
        return sendError(c, 'Prescription not found', 404);
      }

      if (prescription.pharmacy_vendor_id !== pharmacyId) {
        return sendError(c, 'Unauthorized: This prescription belongs to a different pharmacy', 403);
      }

      if (prescription.status !== 'pending_verification') {
        return sendError(c, 'Prescription has already been verified/rejected', 400);
      }

      // Update prescription
      const updateData: any = {
        status: status,
        verification_notes: verificationNotes || null,
        verified_by: staffId || null,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (status === 'verified' && medicines && medicines.length > 0) {
        updateData.medicines = medicines;
      }

      const { data: updatedPrescription, error: updateError } = await client
        .from('prescription_submissions')
        .update(updateData)
        .eq('id', prescription.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating prescription:', updateError);
        return sendError(c, updateError, 500);
      }

      console.log(`✅ [SQL] Prescription ${status}: ${submissionId}`);

      return sendSuccess(c, {
        prescription: updatedPrescription,
        message: `Prescription ${status} successfully`
      });

    } catch (error) {
      console.error('❌ [SQL] Error verifying prescription:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /pharmacy/prescription/:submissionId/request-clarification
   * Pharmacy requests clarification from customer
   */
  app.post(`${BASE_PATH}/pharmacy/prescription/:submissionId/request-clarification`, async (c) => {
    try {
      const { submissionId } = c.req.param();
      const { pharmacyId, clarificationMessage } = await c.req.json();

      const { data: prescription, error: fetchError } = await client
        .from('prescription_submissions')
        .select('*')
        .or(`id.eq.${submissionId},submission_id.eq.${submissionId}`)
        .single();

      if (fetchError || !prescription) {
        return sendError(c, 'Prescription not found', 404);
      }

      if (prescription.pharmacy_vendor_id !== pharmacyId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // Update with clarification request
      const { data: updatedPrescription, error: updateError } = await client
        .from('prescription_submissions')
        .update({
          verification_notes: clarificationMessage,
          status: 'pending_verification', // Keep as pending but with clarification note
          updated_at: new Date().toISOString(),
        })
        .eq('id', prescription.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating prescription:', updateError);
        return sendError(c, updateError, 500);
      }

      console.log(`📋 [SQL] Clarification requested for prescription ${submissionId}`);

      return sendSuccess(c, {
        prescription: updatedPrescription,
        message: 'Clarification requested successfully'
      });

    } catch (error) {
      console.error('❌ [SQL] Error requesting clarification:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /pharmacy/prescription/:submissionId/create-order
   * Create medicine order from verified prescription
   */
  app.post(`${BASE_PATH}/pharmacy/prescription/:submissionId/create-order`, async (c) => {
    try {
      const { submissionId } = c.req.param();
      const { customerId, deliveryAddress, paymentMethod } = await c.req.json();

      const { data: prescription, error: fetchError } = await client
        .from('prescription_submissions')
        .select('*')
        .or(`id.eq.${submissionId},submission_id.eq.${submissionId}`)
        .single();

      if (fetchError || !prescription) {
        return sendError(c, 'Prescription not found', 404);
      }

      if (prescription.status !== 'verified') {
        return sendError(c, 'Prescription must be verified before creating an order', 400);
      }

      if (prescription.customer_id !== customerId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // Create medicine order using medicine_orders table
      const orderNumber = `ORD-MED-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const medicines = prescription.medicines_identified || prescription.medicines || [];
      const totalAmount = medicines.reduce((sum: number, med: any) => 
        sum + (parseFloat(med.price || 0) * parseInt(med.quantity || 0)), 0);

      // Get pharmacy vendor details
      const pharmacy = await vendorsRepo.findById(prescription.pharmacy_vendor_id);
      const pharmacyName = pharmacy?.business_name || 'Unknown Pharmacy';

      const { data: order, error: orderError } = await client
        .from('medicine_orders')
        .insert({
          order_number: orderNumber,
          customer_id: customerId,
          pet_id: prescription.pet_id || null,
          prescription_id: null, // Link to prescriptions table if needed
          medicines: medicines,
          delivery_address: deliveryAddress || prescription.customer_snapshot?.address || {},
          prescription_url: prescription.prescription_url,
          pharmacy_vendor_id: prescription.pharmacy_vendor_id,
          pharmacy_name: pharmacyName,
          pharmacy_phone: pharmacy?.phone || null,
          subtotal: totalAmount,
          total_amount: totalAmount,
          payment_method: paymentMethod || 'online',
          payment_status: 'pending',
          status: 'prescription_uploaded',
        })
        .select()
        .single();

      if (orderError) {
        console.error('Error creating medicine order:', orderError);
        return sendError(c, orderError, 500);
      }

      console.log(`✅ [SQL] Medicine order created: ${orderNumber}`);

      return sendSuccess(c, {
        order,
        message: 'Medicine order created successfully'
      });

    } catch (error) {
      console.error('❌ [SQL] Error creating medicine order:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // UTILITY ENDPOINTS
  // ============================================

  /**
   * GET /prescription/stats/:pharmacyId
   * Get prescription statistics for pharmacy
   */
  app.get(`${BASE_PATH}/prescription/stats/:pharmacyId`, async (c) => {
    try {
      const { pharmacyId } = c.req.param();

      const { data: prescriptions, error } = await client
        .from('prescription_submissions')
        .select('status')
        .eq('pharmacy_vendor_id', pharmacyId);

      if (error) {
        console.error('Error fetching prescription stats:', error);
        return sendError(c, error, 500);
      }

      const stats = {
        total: prescriptions?.length || 0,
        pending: 0,
        verified: 0,
        rejected: 0,
        clarificationRequested: 0,
        ordersCreated: 0
      };

      (prescriptions || []).forEach((p: any) => {
        if (p.status === 'pending_verification') stats.pending++;
        if (p.status === 'verified') stats.verified++;
        if (p.status === 'rejected') stats.rejected++;
      });

      return sendSuccess(c, { stats });

    } catch (error) {
      console.error('❌ [SQL] Error getting prescription stats:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /customer/prescription-orders
   * Get all prescription orders for a customer
   */
  app.get(`${BASE_PATH}/customer/prescription-orders`, async (c) => {
    try {
      const phone = c.req.query('phone');
      
      if (!phone) {
        return sendError(c, 'Missing required parameter: phone', 400);
      }

      console.log(`📋 [SQL] Fetching prescription orders for customer: ${phone}`);

      // Get customer by phone
      const customer = await customersRepo.findByPhone(phone);
      if (!customer) {
        return sendSuccess(c, { orders: [] });
      }

      // Get medicine orders for this customer
      const { data: orders, error } = await client
        .from('medicine_orders')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
        return sendError(c, error, 500);
      }

      // Transform to match expected format
      const transformedOrders = (orders || []).map((order: any) => ({
        id: order.id,
        prescriptionId: order.prescription_id,
        prescriptionNumber: order.order_number,
        customerId: order.customer_id,
        customerName: null, // Would need to join with customers
        customerPhone: phone,
        vendorId: order.pharmacy_vendor_id,
        vendorName: order.pharmacy_name,
        status: order.status,
        medications: order.medicines || [],
        totalAmount: parseFloat(order.total_amount || 0),
        createdAt: order.created_at,
      }));

      console.log(`✅ [SQL] Found ${transformedOrders.length} prescription orders`);

      return sendSuccess(c, { orders: transformedOrders });

    } catch (error) {
      console.error('❌ [SQL] Error fetching prescription orders:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /customer/prescription-orders/:orderId/confirm-payment
   * Confirm payment for a prescription order invoice
   */
  app.post(`${BASE_PATH}/customer/prescription-orders/:orderId/confirm-payment`, async (c) => {
    try {
      const { orderId } = c.req.param();
      const { paymentId, invoiceId } = await c.req.json();

      console.log(`💳 [SQL] Confirming payment for order ${orderId}, payment: ${paymentId}`);

      const { data: order, error: fetchError } = await client
        .from('medicine_orders')
        .select('*')
        .or(`id.eq.${orderId},order_number.eq.${orderId}`)
        .single();

      if (fetchError || !order) {
        return sendError(c, 'Order not found', 404);
      }

      // Update order status
      const { data: updatedOrder, error: updateError } = await client
        .from('medicine_orders')
        .update({
          payment_status: 'paid',
          payment_id: paymentId,
          paid_at: new Date().toISOString(),
          status: 'order_confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating order:', updateError);
        return sendError(c, updateError, 500);
      }

      console.log(`✅ [SQL] Payment confirmed for order ${orderId}`);

      return sendSuccess(c, {
        order: updatedOrder,
        message: 'Payment confirmed successfully'
      });

    } catch (error) {
      console.error('❌ [SQL] Error confirming payment:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Pharmacy Prescription Endpoints (SQL) registered');
}

