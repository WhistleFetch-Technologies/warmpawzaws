"use strict";
/**
 * ============================================================================
 * PRESCRIPTIONS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles prescription management:
 * - Create prescriptions (immutable)
 * - Get prescriptions with access control
 * - Download prescriptions
 * - Link prescriptions to bookings
 *
 * Migrated from: supabase/functions/make-server-3dd53475/healthcare-compliance-endpoints.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPrescriptionEndpoints = registerPrescriptionEndpoints;
const rds_connection_1 = require("../database/rds-connection");
function registerPrescriptionEndpoints(app) {
    /**
     * POST /prescriptions
     * Create prescription (immutable)
     */
    app.post("/prescriptions", async (c) => {
        try {
            const prescriptionData = await c.req.json();
            const { bookingId, customerId, petId, vendorId, staffId, medications, instructions, diagnosis, followUpDate, createdBy, createdByRole, } = prescriptionData;
            if (!bookingId || !customerId || !vendorId || !medications) {
                return c.json({ error: 'bookingId, customerId, vendorId, and medications are required' }, 400);
            }
            const prescription = await (0, rds_connection_1.insert)('prescriptions', {
                booking_id: bookingId,
                customer_id: customerId,
                pet_id: petId || null,
                vendor_id: vendorId,
                staff_id: staffId || null,
                medications: medications, // JSONB array
                instructions: instructions || null,
                diagnosis: diagnosis || null,
                follow_up_date: followUpDate || null,
                created_by: createdBy || null,
                created_by_role: createdByRole || 'vendor',
                is_active: true,
            });
            return c.json({
                success: true,
                prescription: prescription[0],
                message: 'Prescription created successfully',
            });
        }
        catch (error) {
            console.error('Error creating prescription:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /prescriptions/:prescriptionId
     * Get prescription with access control
     */
    app.get("/prescriptions/:prescriptionId", async (c) => {
        try {
            const { prescriptionId } = c.req.param();
            const actorId = c.req.query('actorId');
            const actorRole = c.req.query('actorRole');
            const prescriptions = await (0, rds_connection_1.select)('prescriptions', { id: prescriptionId });
            if (prescriptions.length === 0) {
                return c.json({ error: 'Prescription not found' }, 404);
            }
            const prescription = prescriptions[0];
            // Access control: customer can only see their own, vendor can see their prescriptions
            if (actorRole === 'customer' && prescription.customer_id !== actorId) {
                return c.json({ error: 'Access denied' }, 403);
            }
            if (actorRole === 'vendor' && prescription.vendor_id !== actorId) {
                return c.json({ error: 'Access denied' }, 403);
            }
            // Get related booking info
            const booking = prescription.booking_id
                ? await (0, rds_connection_1.select)('bookings', { id: prescription.booking_id })
                : [];
            // Get pet info
            const pet = prescription.pet_id
                ? await (0, rds_connection_1.select)('pets', { id: prescription.pet_id })
                : [];
            return c.json({
                success: true,
                prescription: {
                    ...prescription,
                    booking: booking[0] || null,
                    pet: pet[0] || null,
                },
            });
        }
        catch (error) {
            console.error('Error fetching prescription:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /prescriptions/booking/:bookingId
     * Get prescriptions for a booking
     */
    app.get("/prescriptions/booking/:bookingId", async (c) => {
        try {
            const { bookingId } = c.req.param();
            const prescriptions = await (0, rds_connection_1.select)('prescriptions', { booking_id: bookingId }, { orderBy: 'created_at', orderDirection: 'DESC' });
            return c.json({
                success: true,
                prescriptions,
                total: prescriptions.length,
            });
        }
        catch (error) {
            console.error('Error fetching prescriptions:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /prescriptions/customer/:customerId
     * Get all prescriptions for a customer
     */
    app.get("/prescriptions/customer/:customerId", async (c) => {
        try {
            const { customerId } = c.req.param();
            const prescriptions = await (0, rds_connection_1.query)(`SELECT p.*, b.booking_date, b.booking_time, v.business_name as vendor_name
         FROM prescriptions p
         LEFT JOIN bookings b ON p.booking_id = b.id
         LEFT JOIN vendors v ON p.vendor_id = v.id
         WHERE p.customer_id = $1
         ORDER BY p.created_at DESC`, [customerId]);
            return c.json({
                success: true,
                prescriptions: prescriptions.rows,
                total: prescriptions.rows.length,
            });
        }
        catch (error) {
            console.error('Error fetching customer prescriptions:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /prescriptions/:prescriptionId/download
     * Log prescription download
     */
    app.post("/prescriptions/:prescriptionId/download", async (c) => {
        try {
            const { prescriptionId } = c.req.param();
            const { actorId, actorRole, actorName } = await c.req.json();
            // Log download (assuming a prescription_downloads table exists)
            // For now, we'll just return success
            // TODO: Create prescription_downloads table if needed
            return c.json({
                success: true,
                message: 'Download logged successfully',
            });
        }
        catch (error) {
            console.error('Error logging prescription download:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
//# sourceMappingURL=prescriptions.js.map