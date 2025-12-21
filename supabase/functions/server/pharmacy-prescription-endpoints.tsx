import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 📋 PHARMACY PRESCRIPTION VERIFICATION ENDPOINTS
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

export function pharmacyPrescriptionEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  // ============================================
  // CUSTOMER ENDPOINTS - Submit Prescription
  // ============================================

  /**
   * POST /customer/prescription/submit
   * Customer submits prescription to a pharmacy for verification
   */
  app.post(`${BASE_PATH}/customer/prescription/submit`, async (c) => {
    try {
      const {
        customerId,
        pharmacyVendorId,
        prescriptionUrl, // Image/PDF URL from S3
        prescriptionType, // 'image' | 'pdf'
        notes,
        petId,
        petName
      } = await c.req.json();

      console.log(`📋 Customer ${customerId} submitting prescription to pharmacy ${pharmacyVendorId}`);

      // Validate required fields
      if (!customerId || !pharmacyVendorId || !prescriptionUrl) {
        return sendError(c, 'Missing required fields: customerId, pharmacyVendorId, prescriptionUrl', 400);
      }

      // Get pharmacy details
      const pharmacy = await kv.get(`vendor:${pharmacyVendorId}`);
      if (!pharmacy) {
        return sendError(c, 'Pharmacy not found', 404);
      }

      // Get customer details
      const customer = await kv.get(`customer:${customerId}`);
      if (!customer) {
        return sendError(c, 'Customer not found', 404);
      }

      // Create prescription submission
      const submissionId = `PRESC-SUB-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      const prescription = {
        id: submissionId,
        customerId,
        customerName: customer.fullName || customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        
        pharmacyVendorId,
        pharmacyName: pharmacy.businessName,
        
        prescriptionUrl,
        prescriptionType,
        notes: notes || '',
        
        petId: petId || null,
        petName: petName || '',
        
        status: 'pending_verification', // pending_verification | verified | rejected
        verificationNotes: '',
        verifiedBy: null,
        verifiedAt: null,
        
        submittedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        
        // Medicines (to be filled after verification)
        medicines: []
      };

      // Save prescription submission
      await kv.set(`prescription:submission:${submissionId}`, prescription);

      // Add to pharmacy's pending prescriptions list
      const pharmacyPrescriptions = await kv.get(`pharmacy:${pharmacyVendorId}:prescriptions:pending`) || [];
      pharmacyPrescriptions.unshift(submissionId);
      await kv.set(`pharmacy:${pharmacyVendorId}:prescriptions:pending`, pharmacyPrescriptions);

      // Add to customer's prescriptions list
      const customerPrescriptions = await kv.get(`customer:${customerId}:prescriptions`) || [];
      customerPrescriptions.unshift(submissionId);
      await kv.set(`customer:${customerId}:prescriptions`, customerPrescriptions);

      // Send notification to pharmacy
      // Note: Requires notification system integration
      console.log(`✅ Prescription submitted: ${submissionId}`);
      console.log(`   Customer: ${customer.fullName}`);
      console.log(`   Pharmacy: ${pharmacy.businessName}`);

      return sendSuccess(c, {
        submission: prescription,
        message: 'Prescription submitted successfully. The pharmacy will verify it shortly.'
      });

    } catch (error) {
      console.error('❌ Error submitting prescription:', error);
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
      const { status } = c.req.query();

      console.log(`📋 Loading prescriptions for customer ${customerId}`);

      const prescriptionIds = await kv.get(`customer:${customerId}:prescriptions`) || [];

      const prescriptions = [];
      for (const id of prescriptionIds) {
        const prescription = await kv.get(`prescription:submission:${id}`);
        if (prescription) {
          // Filter by status if provided
          if (status && prescription.status !== status) continue;
          prescriptions.push(prescription);
        }
      }

      console.log(`✅ Loaded ${prescriptions.length} prescriptions`);

      return sendSuccess(c, { prescriptions });

    } catch (error) {
      console.error('❌ Error loading prescriptions:', error);
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

      const prescription = await kv.get(`prescription:submission:${submissionId}`);
      if (!prescription) {
        return sendError(c, 'Prescription not found', 404);
      }

      return sendSuccess(c, { prescription });

    } catch (error) {
      console.error('❌ Error loading prescription:', error);
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

      console.log(`📋 Loading pending prescriptions for pharmacy ${pharmacyId}`);

      const prescriptionIds = await kv.get(`pharmacy:${pharmacyId}:prescriptions:pending`) || [];

      const prescriptions = [];
      for (const id of prescriptionIds) {
        const prescription = await kv.get(`prescription:submission:${id}`);
        if (prescription) {
          prescriptions.push(prescription);
        }
      }

      console.log(`✅ Loaded ${prescriptions.length} pending prescriptions`);

      return sendSuccess(c, { prescriptions });

    } catch (error) {
      console.error('❌ Error loading pending prescriptions:', error);
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
      const { status, limit } = c.req.query();

      console.log(`📋 Loading prescriptions for pharmacy ${pharmacyId}`);

      // Get all prescription submissions
      const allPrescriptionKeys = await kv.getByPrefix('prescription:submission:');
      
      const prescriptions = [];
      for (const key of allPrescriptionKeys) {
        const prescription = key.value;
        if (prescription && prescription.pharmacyVendorId === pharmacyId) {
          // Filter by status if provided
          if (status && prescription.status !== status) continue;
          prescriptions.push(prescription);
        }
      }

      // Sort by submission date (newest first)
      prescriptions.sort((a, b) => 
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );

      // Apply limit if provided
      const limitNum = limit ? parseInt(limit) : prescriptions.length;
      const limitedPrescriptions = prescriptions.slice(0, limitNum);

      console.log(`✅ Loaded ${limitedPrescriptions.length} prescriptions`);

      return sendSuccess(c, { 
        prescriptions: limitedPrescriptions,
        total: prescriptions.length
      });

    } catch (error) {
      console.error('❌ Error loading prescriptions:', error);
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
        staffName,
        status, // 'verified' | 'rejected'
        verificationNotes,
        medicines // Array of { medicineName, dosage, quantity, price }
      } = await c.req.json();

      console.log(`📋 Pharmacy ${pharmacyId} verifying prescription ${submissionId}`);

      // Get prescription
      const prescription = await kv.get(`prescription:submission:${submissionId}`);
      if (!prescription) {
        return sendError(c, 'Prescription not found', 404);
      }

      if (prescription.pharmacyVendorId !== pharmacyId) {
        return sendError(c, 'Unauthorized: This prescription belongs to a different pharmacy', 403);
      }

      if (prescription.status !== 'pending_verification') {
        return sendError(c, 'Prescription has already been verified/rejected', 400);
      }

      // Update prescription
      prescription.status = status;
      prescription.verificationNotes = verificationNotes || '';
      prescription.verifiedBy = staffId || pharmacyId;
      prescription.verifiedByName = staffName || 'Pharmacist';
      prescription.verifiedAt = new Date().toISOString();

      if (status === 'verified' && medicines && medicines.length > 0) {
        prescription.medicines = medicines;
      }

      // Save updated prescription
      await kv.set(`prescription:submission:${submissionId}`, prescription);

      // Remove from pending list
      const pendingList = await kv.get(`pharmacy:${pharmacyId}:prescriptions:pending`) || [];
      const updatedPending = pendingList.filter(id => id !== submissionId);
      await kv.set(`pharmacy:${pharmacyId}:prescriptions:pending`, updatedPending);

      // Add to verified/rejected list
      const statusList = await kv.get(`pharmacy:${pharmacyId}:prescriptions:${status}`) || [];
      statusList.unshift(submissionId);
      await kv.set(`pharmacy:${pharmacyId}:prescriptions:${status}`, statusList);

      console.log(`✅ Prescription ${status}: ${submissionId}`);

      // TODO: Send notification to customer about verification result

      return sendSuccess(c, {
        prescription,
        message: `Prescription ${status} successfully`
      });

    } catch (error) {
      console.error('❌ Error verifying prescription:', error);
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
      const {
        pharmacyId,
        clarificationMessage
      } = await c.req.json();

      const prescription = await kv.get(`prescription:submission:${submissionId}`);
      if (!prescription) {
        return sendError(c, 'Prescription not found', 404);
      }

      if (prescription.pharmacyVendorId !== pharmacyId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // Add clarification request
      if (!prescription.clarifications) {
        prescription.clarifications = [];
      }

      prescription.clarifications.push({
        message: clarificationMessage,
        requestedAt: new Date().toISOString(),
        response: null,
        respondedAt: null
      });

      prescription.status = 'clarification_requested';

      await kv.set(`prescription:submission:${submissionId}`, prescription);

      console.log(`📋 Clarification requested for prescription ${submissionId}`);

      // TODO: Send notification to customer

      return sendSuccess(c, {
        prescription,
        message: 'Clarification requested successfully'
      });

    } catch (error) {
      console.error('❌ Error requesting clarification:', error);
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
      const {
        customerId,
        deliveryAddress,
        paymentMethod
      } = await c.req.json();

      const prescription = await kv.get(`prescription:submission:${submissionId}`);
      if (!prescription) {
        return sendError(c, 'Prescription not found', 404);
      }

      if (prescription.status !== 'verified') {
        return sendError(c, 'Prescription must be verified before creating an order', 400);
      }

      if (prescription.customerId !== customerId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // Create medicine order
      const orderId = `ORD-MED-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      const order = {
        id: orderId,
        type: 'medicine_order',
        prescriptionId: submissionId,
        
        customerId: prescription.customerId,
        customerName: prescription.customerName,
        
        pharmacyVendorId: prescription.pharmacyVendorId,
        pharmacyName: prescription.pharmacyName,
        
        medicines: prescription.medicines,
        totalAmount: prescription.medicines.reduce((sum, med) => sum + (med.price * med.quantity), 0),
        
        deliveryAddress,
        paymentMethod,
        paymentStatus: 'pending',
        
        orderStatus: 'pending', // pending | confirmed | preparing | dispatched | delivered | cancelled
        
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save order
      await kv.set(`order:medicine:${orderId}`, order);

      // Add to customer's orders
      const customerOrders = await kv.get(`customer:${customerId}:medicine_orders`) || [];
      customerOrders.unshift(orderId);
      await kv.set(`customer:${customerId}:medicine_orders`, customerOrders);

      // Add to pharmacy's orders
      const pharmacyOrders = await kv.get(`pharmacy:${prescription.pharmacyVendorId}:medicine_orders`) || [];
      pharmacyOrders.unshift(orderId);
      await kv.set(`pharmacy:${prescription.pharmacyVendorId}:medicine_orders`, pharmacyOrders);

      // Mark prescription as used
      prescription.orderCreated = true;
      prescription.orderId = orderId;
      await kv.set(`prescription:submission:${submissionId}`, prescription);

      console.log(`✅ Medicine order created: ${orderId}`);

      return sendSuccess(c, {
        order,
        message: 'Medicine order created successfully'
      });

    } catch (error) {
      console.error('❌ Error creating medicine order:', error);
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

      const allPrescriptionKeys = await kv.getByPrefix('prescription:submission:');
      
      const stats = {
        total: 0,
        pending: 0,
        verified: 0,
        rejected: 0,
        clarificationRequested: 0,
        ordersCreated: 0
      };

      for (const key of allPrescriptionKeys) {
        const prescription = key.value;
        if (prescription && prescription.pharmacyVendorId === pharmacyId) {
          stats.total++;
          
          if (prescription.status === 'pending_verification') stats.pending++;
          if (prescription.status === 'verified') stats.verified++;
          if (prescription.status === 'rejected') stats.rejected++;
          if (prescription.status === 'clarification_requested') stats.clarificationRequested++;
          if (prescription.orderCreated) stats.ordersCreated++;
        }
      }

      return sendSuccess(c, { stats });

    } catch (error) {
      console.error('❌ Error getting prescription stats:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Pharmacy Prescription Endpoints registered');
}
