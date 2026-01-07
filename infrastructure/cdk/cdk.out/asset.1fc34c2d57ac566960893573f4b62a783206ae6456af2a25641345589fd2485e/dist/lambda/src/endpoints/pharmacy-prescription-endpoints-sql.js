"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.pharmacyPrescriptionEndpointsSQL = pharmacyPrescriptionEndpointsSQL;
const response_utils_1 = require("./response-utils");
const db_1 = require("../lib/db");
const vendors_1 = require("../lib/repositories/vendors");
const customers_1 = require("../lib/repositories/customers");
const client_s3_1 = require("@aws-sdk/client-s3");
function pharmacyPrescriptionEndpointsSQL(app) {
    const BASE_PATH = "/make-server-3dd53475";
    const vendorsRepo = (0, vendors_1.getVendorsRepository)();
    const customersRepo = (0, customers_1.getCustomersRepository)();
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
            const file = formData.get('file');
            const customerId = formData.get('customerId');
            const petId = formData.get('petId');
            if (!customerId || !file) {
                return (0, response_utils_1.sendError)(c, 'Missing required fields: customerId, file', 400);
            }
            console.log(`📋 [SQL] Customer ${customerId} uploading prescription`);
            // ✅ SQL: Get S3 settings from platform settings
            // TODO: Create platform-settings repository or use direct SQL query
            const platformSettings = await (0, db_1.selectQuery)('platform_settings', { setting_key: 'aws_config' });
            const awsSettings = platformSettings[0]?.setting_value;
            if (!awsSettings || !awsSettings.s3_config?.enabled) {
                return (0, response_utils_1.sendError)(c, 'S3 not configured. Please configure in Admin Portal.', 500);
            }
            // Upload to S3 using AWS SDK
            const s3Client = new client_s3_1.S3Client({
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
            const uploadCommand = new client_s3_1.PutObjectCommand({
                Bucket: awsSettings.s3_config.bucket,
                Key: s3FileName,
                Body: buffer,
                ContentType: file.type || 'image/jpeg',
            });
            await s3Client.send(uploadCommand);
            const prescriptionUrl = `https://${awsSettings.s3_config.bucket}.s3.${awsSettings.s3_config.region || 'ap-south-1'}.amazonaws.com/${s3FileName}`;
            console.log(`✅ [SQL] Prescription uploaded: ${prescriptionUrl}`);
            return (0, response_utils_1.sendSuccess)(c, {
                url: prescriptionUrl,
                prescriptionUrl: prescriptionUrl,
                message: 'Prescription uploaded successfully'
            });
        }
        catch (error) {
            console.error('❌ [SQL] Error uploading prescription:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * POST /customer/prescription/submit
     * Customer submits prescription to a pharmacy for verification
     */
    app.post(`${BASE_PATH}/customer/prescription/submit`, async (c) => {
        try {
            const { customerId, pharmacyVendorId, prescriptionUrl, prescriptionType, notes, petId, petName } = await c.req.json();
            console.log(`📋 [SQL] Customer ${customerId} submitting prescription to pharmacy ${pharmacyVendorId}`);
            if (!customerId || !pharmacyVendorId || !prescriptionUrl) {
                return (0, response_utils_1.sendError)(c, 'Missing required fields: customerId, pharmacyVendorId, prescriptionUrl', 400);
            }
            // Get pharmacy details
            const pharmacy = await vendorsRepo.findById(pharmacyVendorId);
            if (!pharmacy) {
                return (0, response_utils_1.sendError)(c, 'Pharmacy not found', 404);
            }
            // Get customer details
            const customer = await customersRepo.findById(customerId);
            if (!customer) {
                return (0, response_utils_1.sendError)(c, 'Customer not found', 404);
            }
            // Create prescription submission
            const submissionId = `PRESC-SUB-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
            const pool = await (0, db_1.getDbClient)();
            const submissionResult = await pool.query(`INSERT INTO prescription_submissions (
          submission_id, customer_id, pharmacy_vendor_id, prescription_url, prescription_type,
          notes, pet_id, pet_name, customer_name, customer_phone, customer_email,
          pharmacy_name, status, medicines, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`, [
                submissionId, customerId, pharmacyVendorId, prescriptionUrl, prescriptionType || 'image',
                notes || null, petId || null, petName || null,
                customer.full_name || 'Customer', customer.phone, customer.email || null,
                pharmacy.business_name, 'pending_verification', JSON.stringify([]), expiresAt
            ]);
            const submission = submissionResult.rows[0];
            console.log(`✅ [SQL] Prescription submitted: ${submissionId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                submission,
                message: 'Prescription submitted successfully. The pharmacy will verify it shortly.'
            });
        }
        catch (error) {
            console.error('❌ [SQL] Error submitting prescription:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
            const pool = await (0, db_1.getDbClient)();
            let sql = 'SELECT * FROM prescription_submissions WHERE customer_id = $1';
            const params = [customerId];
            if (status) {
                sql += ' AND status = $2';
                params.push(status);
            }
            sql += ' ORDER BY submitted_at DESC';
            const result = await pool.query(sql, params);
            const prescriptions = result.rows || [];
            console.log(`✅ [SQL] Loaded ${prescriptions?.length || 0} prescriptions`);
            return (0, response_utils_1.sendSuccess)(c, { prescriptions: prescriptions || [] });
        }
        catch (error) {
            console.error('❌ [SQL] Error loading prescriptions:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /customer/prescription/:submissionId
     * Get single prescription submission details
     */
    app.get(`${BASE_PATH}/customer/prescription/:submissionId`, async (c) => {
        try {
            const { submissionId } = c.req.param();
            const pool = await (0, db_1.getDbClient)();
            const prescriptionResult = await pool.query('SELECT * FROM prescription_submissions WHERE id = $1 OR submission_id = $1', [submissionId]);
            const prescription = prescriptionResult.rows[0] || null;
            if (!prescription) {
                return (0, response_utils_1.sendError)(c, 'Prescription not found', 404);
            }
            return (0, response_utils_1.sendSuccess)(c, { prescription });
        }
        catch (error) {
            console.error('❌ [SQL] Error loading prescription:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
            const pool = await (0, db_1.getDbClient)();
            const prescriptionsResult = await pool.query('SELECT * FROM prescription_submissions WHERE pharmacy_vendor_id = $1 AND status = $2 ORDER BY submitted_at DESC', [pharmacyId, 'pending_verification']);
            const prescriptions = prescriptionsResult.rows || [];
            console.log(`✅ [SQL] Loaded ${prescriptions?.length || 0} pending prescriptions`);
            return (0, response_utils_1.sendSuccess)(c, { prescriptions: prescriptions || [] });
        }
        catch (error) {
            console.error('❌ [SQL] Error loading pending prescriptions:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
            const pool = await (0, db_1.getDbClient)();
            let sql = 'SELECT * FROM prescription_submissions WHERE pharmacy_vendor_id = $1';
            const params = [pharmacyId];
            let paramIndex = 2;
            if (status) {
                sql += ` AND status = $${paramIndex}`;
                params.push(status);
                paramIndex++;
            }
            sql += ' ORDER BY submitted_at DESC';
            if (limit) {
                sql += ` LIMIT $${paramIndex}`;
                params.push(parseInt(limit));
            }
            const result = await pool.query(sql, params);
            const prescriptions = result.rows || [];
            console.log(`✅ [SQL] Loaded ${prescriptions?.length || 0} prescriptions`);
            return (0, response_utils_1.sendSuccess)(c, {
                prescriptions: prescriptions || [],
                total: prescriptions?.length || 0
            });
        }
        catch (error) {
            console.error('❌ [SQL] Error loading prescriptions:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * PUT /pharmacy/prescription/:submissionId/verify
     * Pharmacy verifies a prescription submission
     */
    app.put(`${BASE_PATH}/pharmacy/prescription/:submissionId/verify`, async (c) => {
        try {
            const { submissionId } = c.req.param();
            const { pharmacyId, staffId, status, verificationNotes, medicines } = await c.req.json();
            console.log(`📋 [SQL] Pharmacy ${pharmacyId} verifying prescription ${submissionId}`);
            // Get prescription
            const pool = await (0, db_1.getDbClient)();
            const prescriptionResult = await pool.query('SELECT * FROM prescription_submissions WHERE id = $1 OR submission_id = $1', [submissionId]);
            const prescription = prescriptionResult.rows[0] || null;
            if (!prescription) {
                return (0, response_utils_1.sendError)(c, 'Prescription not found', 404);
            }
            if (prescription.pharmacy_vendor_id !== pharmacyId) {
                return (0, response_utils_1.sendError)(c, 'Unauthorized: This prescription belongs to a different pharmacy', 403);
            }
            if (prescription.status !== 'pending_verification') {
                return (0, response_utils_1.sendError)(c, 'Prescription has already been verified/rejected', 400);
            }
            // Update prescription
            const now = new Date().toISOString();
            const updateFields = ['status = $1', 'verification_notes = $2', 'verified_by = $3', 'verified_at = $4', 'updated_at = $5'];
            const updateParams = [status, verificationNotes || null, staffId || null, now, now];
            let paramIndex = 6;
            if (status === 'verified' && medicines && medicines.length > 0) {
                updateFields.push(`medicines = $${paramIndex}`);
                updateParams.push(JSON.stringify(medicines));
                paramIndex++;
            }
            updateParams.push(prescription.id);
            const updatedResult = await pool.query(`UPDATE prescription_submissions SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`, updateParams);
            const updatedPrescription = updatedResult.rows[0];
            console.log(`✅ [SQL] Prescription ${status}: ${submissionId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                prescription: updatedPrescription,
                message: `Prescription ${status} successfully`
            });
        }
        catch (error) {
            console.error('❌ [SQL] Error verifying prescription:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
            const pool = await (0, db_1.getDbClient)();
            const prescriptionResult = await pool.query('SELECT * FROM prescription_submissions WHERE id = $1 OR submission_id = $1', [submissionId]);
            const prescription = prescriptionResult.rows[0] || null;
            if (!prescription) {
                return (0, response_utils_1.sendError)(c, 'Prescription not found', 404);
            }
            if (prescription.pharmacy_vendor_id !== pharmacyId) {
                return (0, response_utils_1.sendError)(c, 'Unauthorized', 403);
            }
            // Update with clarification request
            const now = new Date().toISOString();
            const updatedResult = await pool.query(`UPDATE prescription_submissions SET 
          verification_notes = $1, status = $2, updated_at = $3
          WHERE id = $4 RETURNING *`, [clarificationMessage, 'pending_verification', now, prescription.id]);
            const updatedPrescription = updatedResult.rows[0];
            if (!updatedPrescription) {
                console.error('Error updating prescription: No record updated');
                return (0, response_utils_1.sendError)(c, 'Failed to update prescription', 500);
            }
            console.log(`📋 [SQL] Clarification requested for prescription ${submissionId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                prescription: updatedPrescription,
                message: 'Clarification requested successfully'
            });
        }
        catch (error) {
            console.error('❌ [SQL] Error requesting clarification:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
            const pool = await (0, db_1.getDbClient)();
            const prescriptionResult = await pool.query('SELECT * FROM prescription_submissions WHERE id = $1 OR submission_id = $1', [submissionId]);
            const prescription = prescriptionResult.rows[0] || null;
            if (!prescription) {
                return (0, response_utils_1.sendError)(c, 'Prescription not found', 404);
            }
            if (prescription.status !== 'verified') {
                return (0, response_utils_1.sendError)(c, 'Prescription must be verified before creating an order', 400);
            }
            if (prescription.customer_id !== customerId) {
                return (0, response_utils_1.sendError)(c, 'Unauthorized', 403);
            }
            // Create medicine order using medicine_orders table
            const orderNumber = `ORD-MED-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
            const medicines = prescription.medicines_identified || prescription.medicines || [];
            const totalAmount = medicines.reduce((sum, med) => sum + (parseFloat(med.price || 0) * parseInt(med.quantity || 0)), 0);
            // Get pharmacy vendor details
            const pharmacy = await vendorsRepo.findById(prescription.pharmacy_vendor_id);
            const pharmacyName = pharmacy?.business_name || 'Unknown Pharmacy';
            const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const orderResult = await pool.query(`INSERT INTO medicine_orders (
          id, order_number, customer_id, pet_id, prescription_id, medicines,
          delivery_address, prescription_url, pharmacy_vendor_id, pharmacy_name,
          pharmacy_phone, subtotal, total_amount, payment_method, payment_status, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`, [
                orderId, orderNumber, customerId, prescription.pet_id || null, null,
                JSON.stringify(medicines),
                JSON.stringify(deliveryAddress || prescription.customer_snapshot?.address || {}),
                prescription.prescription_url, prescription.pharmacy_vendor_id, pharmacyName,
                pharmacy?.phone || null, totalAmount, totalAmount, paymentMethod || 'online',
                'pending', 'prescription_uploaded'
            ]);
            const order = orderResult.rows[0];
            console.log(`✅ [SQL] Medicine order created: ${orderNumber}`);
            return (0, response_utils_1.sendSuccess)(c, {
                order,
                message: 'Medicine order created successfully'
            });
        }
        catch (error) {
            console.error('❌ [SQL] Error creating medicine order:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
            const pool = await (0, db_1.getDbClient)();
            const prescriptionsResult = await pool.query('SELECT status FROM prescription_submissions WHERE pharmacy_vendor_id = $1', [pharmacyId]);
            const prescriptions = prescriptionsResult.rows || [];
            const stats = {
                total: prescriptions?.length || 0,
                pending: 0,
                verified: 0,
                rejected: 0,
                clarificationRequested: 0,
                ordersCreated: 0
            };
            (prescriptions || []).forEach((p) => {
                if (p.status === 'pending_verification')
                    stats.pending++;
                if (p.status === 'verified')
                    stats.verified++;
                if (p.status === 'rejected')
                    stats.rejected++;
            });
            return (0, response_utils_1.sendSuccess)(c, { stats });
        }
        catch (error) {
            console.error('❌ [SQL] Error getting prescription stats:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
                return (0, response_utils_1.sendError)(c, 'Missing required parameter: phone', 400);
            }
            console.log(`📋 [SQL] Fetching prescription orders for customer: ${phone}`);
            // Get customer by phone
            const customer = await customersRepo.findByPhone(phone);
            if (!customer) {
                return (0, response_utils_1.sendSuccess)(c, { orders: [] });
            }
            // Get medicine orders for this customer
            const pool = await (0, db_1.getDbClient)();
            const ordersResult = await pool.query('SELECT * FROM medicine_orders WHERE customer_id = $1 ORDER BY created_at DESC', [customer.id]);
            const orders = ordersResult.rows || [];
            // Transform to match expected format
            const transformedOrders = (orders || []).map((order) => ({
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
            return (0, response_utils_1.sendSuccess)(c, { orders: transformedOrders });
        }
        catch (error) {
            console.error('❌ [SQL] Error fetching prescription orders:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
            const pool = await (0, db_1.getDbClient)();
            const orderResult = await pool.query('SELECT * FROM medicine_orders WHERE id = $1 OR order_number = $1', [orderId]);
            const order = orderResult.rows[0] || null;
            if (!order) {
                return (0, response_utils_1.sendError)(c, 'Order not found', 404);
            }
            // Update order status
            const now = new Date().toISOString();
            const updatedResult = await pool.query(`UPDATE medicine_orders SET 
          payment_status = $1, payment_id = $2, paid_at = $3,
          status = $4, updated_at = $5
          WHERE id = $6 RETURNING *`, ['paid', paymentId, now, 'order_confirmed', now, order.id]);
            const updatedOrder = updatedResult.rows[0];
            if (!updatedOrder) {
                console.error('Error updating order: No record updated');
                return (0, response_utils_1.sendError)(c, 'Failed to update order', 500);
            }
            console.log(`✅ [SQL] Payment confirmed for order ${orderId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                order: updatedOrder,
                message: 'Payment confirmed successfully'
            });
        }
        catch (error) {
            console.error('❌ [SQL] Error confirming payment:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    console.log('✅ Pharmacy Prescription Endpoints (SQL) registered');
}
//# sourceMappingURL=pharmacy-prescription-endpoints-sql.js.map