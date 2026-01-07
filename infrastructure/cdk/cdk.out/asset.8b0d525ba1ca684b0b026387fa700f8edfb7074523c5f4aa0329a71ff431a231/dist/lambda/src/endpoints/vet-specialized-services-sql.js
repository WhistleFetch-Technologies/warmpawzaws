"use strict";
/**
 * Vet Specialized Services Endpoints - SQL VERSION
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 *
 * Handles ambulance services, diagnostic tests, emergency protocols,
 * and pharmacy management for veterinary clinics
 *
 * Status: ✅ SQL-ONLY IMPLEMENTATION
 * KV Operations: 34 → 0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.vetSpecializedServicesSQL = vetSpecializedServicesSQL;
const db_1 = require("../lib/db");
const vendors_1 = require("../lib/repositories/vendors");
const notifications_1 = require("../lib/repositories/notifications");
const customers_1 = require("../lib/repositories/customers");
// Helper repository functions (TODO: Create proper repositories)
const getProductsRepository = () => ({
    findByVendor: async (vendorId) => {
        return (0, db_1.selectQuery)('products', { vendor_id: vendorId, is_active: true });
    },
    create: async (data) => {
        const pool = await (0, db_1.getDbClient)();
        const result = await pool.query(`INSERT INTO products (vendor_id, name, description, price, stock_quantity, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [data.vendor_id, data.name, data.description, data.price, data.stock_quantity || 0, true]);
        return result.rows[0];
    }
});
const getMedicineOrdersRepository = () => ({
    create: async (data) => {
        const pool = await (0, db_1.getDbClient)();
        const result = await pool.query(`INSERT INTO medicine_orders (customer_id, vendor_id, items, total_amount, status)
       VALUES ($1, $2, $3::jsonb, $4, $5) RETURNING *`, [data.customerId, data.vendorId, JSON.stringify(data.items), data.totalAmount, 'pending']);
        return result.rows[0];
    },
    findById: async (orderId) => {
        const results = await (0, db_1.selectQuery)('medicine_orders', { id: orderId });
        return results[0] || null;
    },
    getById: async (orderId) => {
        const results = await (0, db_1.selectQuery)('medicine_orders', { id: orderId });
        return results[0] || null;
    },
    selectPharmacy: async (orderId, vendorId) => {
        // Update order to assign pharmacy
        await (0, db_1.updateQuery)('medicine_orders', { id: orderId }, { vendor_id: vendorId });
        return (0, db_1.selectQuery)('vendors', { id: vendorId });
    },
    generateProformaInvoice: async (orderId) => {
        const orders = await (0, db_1.selectQuery)('medicine_orders', { id: orderId });
        const order = orders[0];
        if (!order)
            return null;
        return {
            orderId: order.id,
            items: order.items,
            totalAmount: order.total_amount,
            invoiceNumber: `INV-${order.id.substring(0, 8).toUpperCase()}`
        };
    },
    updateDeliveryStatus: async (orderId, status, deliveryPartnerId) => {
        const updateData = { status, updated_at: new Date().toISOString() };
        if (deliveryPartnerId)
            updateData.delivery_partner_id = deliveryPartnerId;
        return (0, db_1.updateQuery)('medicine_orders', { id: orderId }, updateData);
    },
    update: async (orderId, data) => {
        return (0, db_1.updateQuery)('medicine_orders', { id: orderId }, data);
    }
});
const getAmbulanceVehiclesRepository = () => ({
    findByVendor: async (vendorId) => {
        return (0, db_1.selectQuery)('ambulance_vehicles', { vendor_id: vendorId, is_active: true });
    },
    create: async (data) => {
        const pool = await (0, db_1.getDbClient)();
        const result = await pool.query(`INSERT INTO ambulance_vehicles (vendor_id, vehicle_number, vehicle_type, driver_name, driver_phone, is_available, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`, [data.vendor_id, data.vehicleNumber, data.vehicleType, data.driverName, data.driverPhone, true, true]);
        return result.rows[0];
    },
    update: async (vehicleId, data) => {
        return (0, db_1.updateQuery)('ambulance_vehicles', { id: vehicleId }, data);
    }
});
const getDiagnosticTestsRepository = () => ({
    findByVendor: async (vendorId) => {
        return (0, db_1.selectQuery)('diagnostic_tests', { vendor_id: vendorId, is_active: true });
    },
    create: async (data) => {
        const pool = await (0, db_1.getDbClient)();
        const result = await pool.query(`INSERT INTO diagnostic_tests (vendor_id, test_name, description, price, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`, [data.vendor_id, data.test_name, data.description, data.price, true]);
        return result.rows[0];
    },
    update: async (testId, data) => {
        return (0, db_1.updateQuery)('diagnostic_tests', { id: testId }, data);
    }
});
/**
 * VET SPECIALIZED SERVICES ENDPOINTS - SQL VERSION
 */
function vetSpecializedServicesSQL(app) {
    const BASE_PATH = '/make-server-3dd53475';
    // ============================================================================
    // PHARMACY MANAGEMENT
    // ============================================================================
    /**
     * GET /vendor/:vendorId/pharmacy/inventory
     * Get all medicines in pharmacy inventory
     * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
     */
    app.get(`${BASE_PATH}/vendor/:vendorId/pharmacy/inventory`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            console.log(`[VET-PHARMACY] Loading pharmacy inventory for vendor: ${vendorId}`);
            // ✅ SQL: Get products for this vendor (pharmacy inventory)
            const productsRepo = getProductsRepository();
            const medicines = await productsRepo.findByVendor(vendorId);
            return c.json({
                success: true,
                medicines,
                count: medicines.length
            });
        }
        catch (error) {
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
     * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
     */
    app.post(`${BASE_PATH}/vendor/:vendorId/pharmacy/inventory`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            const medicineData = await c.req.json();
            console.log(`[VET-PHARMACY] Adding medicine for vendor: ${vendorId}`, medicineData);
            // ✅ SQL: Create product (medicine) using ProductsRepository
            const productsRepo = getProductsRepository();
            const newMedicine = await productsRepo.create({
                vendor_id: vendorId,
                name: medicineData.name,
                description: medicineData.description || '',
                category: medicineData.category || 'general',
                price: medicineData.price || 0,
                stock: medicineData.stock || 0,
                min_stock: medicineData.minStock || 10,
                sku: medicineData.batchNumber || null,
                barcode: medicineData.barcode || null,
                is_active: true
            });
            return c.json({
                success: true,
                message: 'Medicine added successfully',
                medicine: newMedicine
            });
        }
        catch (error) {
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
     * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
     */
    app.get(`${BASE_PATH}/vendor/:vendorId/pharmacy/prescription-orders`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            console.log(`[VET-PHARMACY] Loading prescription orders for vendor: ${vendorId}`);
            // ✅ SQL: Get medicine orders for this pharmacy vendor
            const orders = await (0, db_1.selectQuery)('medicine_orders', { pharmacy_vendor_id: vendorId }, {
                orderBy: 'created_at',
                orderDirection: 'desc'
            });
            return c.json({
                success: true,
                orders: orders || [],
                count: orders?.length || 0
            });
        }
        catch (error) {
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
     * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
     */
    app.post(`${BASE_PATH}/vendor/:vendorId/pharmacy/verify-prescription`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            const { orderId } = await c.req.json();
            console.log(`[VET-PHARMACY] Verifying prescription order ${orderId} for vendor: ${vendorId}`);
            const medicineOrdersRepo = getMedicineOrdersRepository();
            const notificationsRepo = (0, notifications_1.getNotificationsRepository)();
            // ✅ SQL: Get medicine order
            const order = await medicineOrdersRepo.getById(orderId);
            if (!order) {
                return c.json({ success: false, error: 'Order not found' }, 404);
            }
            // Check if order belongs to this pharmacy (using selected_pharmacy_id or pharmacy_vendor_id)
            const orderPharmacyId = order.pharmacy_vendor_id || order.selected_pharmacy_id;
            if (orderPharmacyId !== vendorId) {
                return c.json({ success: false, error: 'Unauthorized' }, 403);
            }
            // ✅ SQL: Update order status using selectPharmacy method
            await medicineOrdersRepo.selectPharmacy(orderId, vendorId);
            const updatedOrder = await medicineOrdersRepo.getById(orderId);
            // ✅ SQL: Create notification for customer
            const orderAny = order;
            await notificationsRepo.create({
                recipient_id: orderAny.customer_id,
                recipient_type: 'customer',
                notification_type: 'prescription_verified',
                title: 'Prescription Verified',
                message: `Your prescription order #${orderAny.order_number || orderId} has been verified. Awaiting invoice.`,
                data: { orderId, orderNumber: orderAny.order_number || orderId }
            });
            return c.json({
                success: true,
                message: 'Prescription verified successfully',
                order: updatedOrder
            });
        }
        catch (error) {
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
     * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
     */
    app.post(`${BASE_PATH}/vendor/:vendorId/pharmacy/send-invoice`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            const { orderId, amount, notes } = await c.req.json();
            console.log(`[VET-PHARMACY] Sending invoice for order ${orderId}`);
            const medicineOrdersRepo = getMedicineOrdersRepository();
            const notificationsRepo = (0, notifications_1.getNotificationsRepository)();
            // ✅ SQL: Get medicine order
            const order = await medicineOrdersRepo.getById(orderId);
            if (!order) {
                return c.json({ success: false, error: 'Order not found' }, 404);
            }
            // Check if order belongs to this pharmacy
            const orderPharmacyId = order.pharmacy_vendor_id || order.selected_pharmacy_id;
            if (orderPharmacyId !== vendorId) {
                return c.json({ success: false, error: 'Unauthorized' }, 403);
            }
            // Generate invoice ID
            const invoiceId = `INV-${Date.now()}`;
            // ✅ SQL: Generate invoice and update order
            const invoice = await medicineOrdersRepo.generateProformaInvoice(orderId);
            await (0, db_1.updateQuery)('medicine_orders', { id: orderId }, {
                invoice_url: `https://warmpawz.com/invoices/${invoiceId}`,
                invoice_amount: amount,
                status: 'invoiced',
                updated_at: new Date().toISOString()
            });
            // Update notes if provided
            if (notes) {
                await (0, db_1.updateQuery)('medicine_orders', { id: orderId }, { notes });
            }
            const updatedOrder = await medicineOrdersRepo.getById(orderId);
            const orderData = order;
            // ✅ SQL: Create notification for customer
            await notificationsRepo.create({
                recipient_id: orderData.customer_id,
                recipient_type: 'customer',
                notification_type: 'invoice_received',
                title: 'Invoice Received',
                message: `Invoice #${invoiceId} for ₹${amount} has been sent. Please review and pay.`,
                data: { orderId, invoiceId, amount }
            });
            return c.json({
                success: true,
                message: 'Invoice sent successfully',
                order: updatedOrder,
                invoiceId
            });
        }
        catch (error) {
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
     * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
     */
    app.post(`${BASE_PATH}/vendor/:vendorId/pharmacy/dispatch-order`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            const { orderId } = await c.req.json();
            console.log(`[VET-PHARMACY] Dispatching order ${orderId}`);
            const medicineOrdersRepo = getMedicineOrdersRepository();
            const notificationsRepo = (0, notifications_1.getNotificationsRepository)();
            const customersRepo = (0, customers_1.getCustomersRepository)();
            // ✅ SQL: Get medicine order
            const order = await medicineOrdersRepo.getById(orderId);
            if (!order) {
                return c.json({ success: false, error: 'Order not found' }, 404);
            }
            // Check if order belongs to this pharmacy
            const orderPharmacyId = order.pharmacy_vendor_id || order.selected_pharmacy_id;
            if (orderPharmacyId !== vendorId) {
                return c.json({ success: false, error: 'Unauthorized' }, 403);
            }
            // Simulate assigning to delivery partner
            const deliveryPartnerId = `delivery_${Math.random().toString(36).substr(2, 9)}`;
            const trackingUrl = `https://warmpawz.com/track/${orderId}`;
            // ✅ SQL: Update order delivery status to dispatched
            await medicineOrdersRepo.updateDeliveryStatus(orderId, 'in_transit', deliveryPartnerId);
            // Update tracking URL
            await (0, db_1.updateQuery)('medicine_orders', { id: orderId }, {
                tracking_url: trackingUrl
            });
            const updatedOrder = await medicineOrdersRepo.getById(orderId);
            const orderData = order;
            // ✅ SQL: Get customer for notification
            const customer = await customersRepo.findById(orderData.customer_id);
            // ✅ SQL: Create notification for customer
            await notificationsRepo.create({
                recipient_id: orderData.customer_id,
                recipient_type: 'customer',
                notification_type: 'order_dispatched',
                title: 'Order Dispatched',
                message: `Your order #${orderData.order_number || orderId} has been dispatched! Track: ${trackingUrl}`,
                data: { orderId, trackingUrl, deliveryPartnerId }
            });
            return c.json({
                success: true,
                message: 'Order dispatched successfully',
                order: updatedOrder,
                deliveryPartnerId,
                trackingUrl
            });
        }
        catch (error) {
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
     * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
     */
    app.get(`${BASE_PATH}/vendor/:vendorId/ambulance-services`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            console.log(`[VET-SERVICES] Loading ambulance services for vendor: ${vendorId}`);
            // ✅ SQL: Get ambulance vehicles using repository
            const vehiclesRepo = getAmbulanceVehiclesRepository();
            const ambulances = await vehiclesRepo.findByVendor(vendorId);
            return c.json({
                success: true,
                ambulances,
                count: ambulances.length
            });
        }
        catch (error) {
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
     * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
     */
    app.post(`${BASE_PATH}/vendor/:vendorId/ambulance-services`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            const ambulanceData = await c.req.json();
            console.log(`[VET-SERVICES] Adding ambulance for vendor: ${vendorId}`, ambulanceData);
            // ✅ SQL: Create ambulance vehicle using repository
            const vehiclesRepo = getAmbulanceVehiclesRepository();
            const newAmbulance = await vehiclesRepo.create({
                vendor_id: vendorId,
                vehicle_number: ambulanceData.vehicleNumber || `AMB-${Date.now()}`,
                vehicle_type: ambulanceData.vehicleType || 'basic',
                capacity: ambulanceData.capacity || 2,
                equipment: ambulanceData.equipment || [],
                current_location: ambulanceData.currentLocation || null,
                is_available: ambulanceData.availability !== 'offline'
            });
            return c.json({
                success: true,
                message: 'Ambulance service added successfully',
                ambulance: newAmbulance
            });
        }
        catch (error) {
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
     * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
     */
    app.put(`${BASE_PATH}/vendor/:vendorId/ambulance-services/:ambulanceId`, async (c) => {
        try {
            const { vendorId, ambulanceId } = c.req.param();
            const updates = await c.req.json();
            console.log(`[VET-SERVICES] Updating ambulance ${ambulanceId} for vendor: ${vendorId}`);
            // ✅ SQL: Update ambulance vehicle using repository
            const vehiclesRepo = getAmbulanceVehiclesRepository();
            const updatedAmbulance = await vehiclesRepo.update(ambulanceId, {
                vehicle_type: updates.vehicleType || updates.vehicle_type,
                capacity: updates.capacity,
                equipment: updates.equipment,
                current_location: updates.currentLocation || updates.current_location,
                is_available: updates.availability !== 'offline'
            });
            return c.json({
                success: true,
                message: 'Ambulance service updated successfully',
                ambulance: updatedAmbulance
            });
        }
        catch (error) {
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
     * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
     */
    app.delete(`${BASE_PATH}/vendor/:vendorId/ambulance-services/:ambulanceId`, async (c) => {
        try {
            const { vendorId, ambulanceId } = c.req.param();
            console.log(`[VET-SERVICES] Deleting ambulance ${ambulanceId} for vendor: ${vendorId}`);
            // ✅ SQL: Delete ambulance vehicle (soft delete by setting is_available to false)
            const vehiclesRepo = getAmbulanceVehiclesRepository();
            await vehiclesRepo.update(ambulanceId, {
                is_available: false
            });
            return c.json({
                success: true,
                message: 'Ambulance service deleted successfully'
            });
        }
        catch (error) {
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
     * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
     */
    app.get(`${BASE_PATH}/vendor/:vendorId/diagnostic-tests`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            console.log(`[VET-SERVICES] Loading diagnostic tests for vendor: ${vendorId}`);
            // ✅ SQL: Get diagnostic tests using repository
            const testsRepo = getDiagnosticTestsRepository();
            const tests = await testsRepo.findByVendor(vendorId);
            return c.json({
                success: true,
                tests,
                count: tests.length
            });
        }
        catch (error) {
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
     * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
     */
    app.post(`${BASE_PATH}/vendor/:vendorId/diagnostic-tests`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            const testData = await c.req.json();
            console.log(`[VET-SERVICES] Adding diagnostic test for vendor: ${vendorId}`, testData);
            // ✅ SQL: Create diagnostic test using repository
            const testsRepo = getDiagnosticTestsRepository();
            const newTest = await testsRepo.create({
                vendor_id: vendorId,
                test_name: testData.testName,
                test_code: testData.testCode || null,
                category: testData.category || 'other',
                description: testData.description || null,
                price: testData.price || 0,
                duration_minutes: testData.duration || 30,
                sample_type: testData.sampleRequired || null,
                preparation_instructions: testData.prerequisites?.join(', ') || null,
                is_available: testData.isActive !== false
            });
            return c.json({
                success: true,
                message: 'Diagnostic test added successfully',
                test: newTest
            });
        }
        catch (error) {
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
     * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
     */
    app.put(`${BASE_PATH}/vendor/:vendorId/diagnostic-tests/:testId`, async (c) => {
        try {
            const { vendorId, testId } = c.req.param();
            const updates = await c.req.json();
            console.log(`[VET-SERVICES] Updating diagnostic test ${testId} for vendor: ${vendorId}`);
            // ✅ SQL: Update diagnostic test using repository
            const testsRepo = getDiagnosticTestsRepository();
            const updatedTest = await testsRepo.update(testId, {
                test_name: updates.testName,
                category: updates.category,
                description: updates.description,
                price: updates.price,
                duration_minutes: updates.duration,
                sample_type: updates.sampleRequired,
                preparation_instructions: updates.prerequisites?.join(', '),
                is_available: updates.isActive !== false
            });
            return c.json({
                success: true,
                message: 'Diagnostic test updated successfully',
                test: updatedTest
            });
        }
        catch (error) {
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
     * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
     */
    app.delete(`${BASE_PATH}/vendor/:vendorId/diagnostic-tests/:testId`, async (c) => {
        try {
            const { vendorId, testId } = c.req.param();
            console.log(`[VET-SERVICES] Deleting diagnostic test ${testId} for vendor: ${vendorId}`);
            // ✅ SQL: Delete diagnostic test (soft delete by setting is_available to false)
            const testsRepo = getDiagnosticTestsRepository();
            await testsRepo.update(testId, {
                is_available: false
            });
            return c.json({
                success: true,
                message: 'Diagnostic test deleted successfully'
            });
        }
        catch (error) {
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
     * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
     * Note: Emergency protocols stored in vendor metadata JSONB field
     */
    app.get(`${BASE_PATH}/vendor/:vendorId/emergency-protocols`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            console.log(`[VET-SERVICES] Loading emergency protocols for vendor: ${vendorId}`);
            // ✅ SQL: Get vendor and extract emergency protocols from metadata
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const vendor = await vendorsRepo.findById(vendorId);
            if (!vendor) {
                return c.json({ success: false, error: 'Vendor not found' }, 404);
            }
            const protocols = vendor.metadata?.emergency_protocols || [];
            return c.json({
                success: true,
                protocols,
                count: protocols.length
            });
        }
        catch (error) {
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
     * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
     */
    app.post(`${BASE_PATH}/vendor/:vendorId/emergency-protocols`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            const protocolData = await c.req.json();
            console.log(`[VET-SERVICES] Adding emergency protocol for vendor: ${vendorId}`, protocolData);
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const vendor = await vendorsRepo.findById(vendorId);
            if (!vendor) {
                return c.json({ success: false, error: 'Vendor not found' }, 404);
            }
            // Generate unique ID
            const protocolId = `proto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const newProtocol = {
                id: protocolId,
                vendorId,
                protocolName: protocolData.protocolName,
                severity: protocolData.severity || 'medium',
                responseTime: protocolData.responseTime || 15,
                requiredEquipment: protocolData.requiredEquipment || [],
                steps: protocolData.steps || [],
                emergencyContacts: protocolData.emergencyContacts || [],
                medications: protocolData.medications || [],
                notes: protocolData.notes || '',
                isActive: protocolData.isActive !== false,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };
            // ✅ SQL: Update vendor metadata with new protocol
            const metadata = vendor.metadata || {};
            const protocols = (metadata.emergency_protocols || []);
            protocols.push(newProtocol);
            await vendorsRepo.update(vendorId, {
                metadata: {
                    ...metadata,
                    emergency_protocols: protocols
                }
            });
            return c.json({
                success: true,
                message: 'Emergency protocol added successfully',
                protocol: newProtocol
            });
        }
        catch (error) {
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
     * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
     */
    app.put(`${BASE_PATH}/vendor/:vendorId/emergency-protocols/:protocolId`, async (c) => {
        try {
            const { vendorId, protocolId } = c.req.param();
            const updates = await c.req.json();
            console.log(`[VET-SERVICES] Updating emergency protocol ${protocolId} for vendor: ${vendorId}`);
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const vendor = await vendorsRepo.findById(vendorId);
            if (!vendor) {
                return c.json({ success: false, error: 'Vendor not found' }, 404);
            }
            // ✅ SQL: Update protocol in vendor metadata
            const metadata = vendor.metadata || {};
            const protocols = (metadata.emergency_protocols || []);
            const updatedProtocols = protocols.map((protocol) => {
                if (protocol.id === protocolId) {
                    return {
                        ...protocol,
                        ...updates,
                        lastUpdated: new Date().toISOString()
                    };
                }
                return protocol;
            });
            await vendorsRepo.update(vendorId, {
                metadata: {
                    ...metadata,
                    emergency_protocols: updatedProtocols
                }
            });
            const updatedProtocol = updatedProtocols.find((p) => p.id === protocolId);
            return c.json({
                success: true,
                message: 'Emergency protocol updated successfully',
                protocol: updatedProtocol
            });
        }
        catch (error) {
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
     * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
     */
    app.delete(`${BASE_PATH}/vendor/:vendorId/emergency-protocols/:protocolId`, async (c) => {
        try {
            const { vendorId, protocolId } = c.req.param();
            console.log(`[VET-SERVICES] Deleting emergency protocol ${protocolId} for vendor: ${vendorId}`);
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const vendor = await vendorsRepo.findById(vendorId);
            if (!vendor) {
                return c.json({ success: false, error: 'Vendor not found' }, 404);
            }
            // ✅ SQL: Remove protocol from vendor metadata
            const metadata = vendor.metadata || {};
            const protocols = (metadata.emergency_protocols || []);
            const filteredProtocols = protocols.filter((protocol) => protocol.id !== protocolId);
            await vendorsRepo.update(vendorId, {
                metadata: {
                    ...metadata,
                    emergency_protocols: filteredProtocols
                }
            });
            return c.json({
                success: true,
                message: 'Emergency protocol deleted successfully'
            });
        }
        catch (error) {
            console.error('[VET-SERVICES] Error deleting emergency protocol:', error);
            return c.json({
                success: false,
                error: 'Failed to delete emergency protocol'
            }, 500);
        }
    });
    console.log('✅ Vet specialized services endpoints registered (SQL-only)');
}
//# sourceMappingURL=vet-specialized-services-sql.js.map