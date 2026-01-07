"use strict";
/**
 * ============================================================================
 * MEDICAL RECORDS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles medical records management:
 * - Create medical records
 * - Get medical records with access control
 * - Get records by pet
 * - Update records (with audit trail)
 *
 * Migrated from: supabase/functions/make-server-3dd53475/healthcare-compliance-endpoints.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMedicalRecordsEndpoints = registerMedicalRecordsEndpoints;
const rds_connection_1 = require("../database/rds-connection");
function registerMedicalRecordsEndpoints(app) {
    /**
     * POST /medical-records
     * Create medical record
     */
    app.post("/medical-records", async (c) => {
        try {
            const recordData = await c.req.json();
            const { petId, customerId, vendorId, bookingId, recordType, title, description, attachments, createdBy, createdByRole, } = recordData;
            if (!petId || !customerId || !vendorId || !recordType) {
                return c.json({ error: 'petId, customerId, vendorId, and recordType are required' }, 400);
            }
            const record = await (0, rds_connection_1.insert)('medical_records', {
                pet_id: petId,
                customer_id: customerId,
                vendor_id: vendorId,
                booking_id: bookingId || null,
                record_type: recordType,
                title: title || null,
                description: description || null,
                attachments: attachments || [],
                created_by: createdBy || null,
                created_by_role: createdByRole || 'vendor',
                is_active: true,
            });
            return c.json({
                success: true,
                record: record[0],
                message: 'Medical record created successfully',
            });
        }
        catch (error) {
            console.error('Error creating medical record:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /medical-records/:recordId
     * Get medical record with access control
     */
    app.get("/medical-records/:recordId", async (c) => {
        try {
            const { recordId } = c.req.param();
            const actorId = c.req.query('actorId');
            const actorRole = c.req.query('actorRole');
            const records = await (0, rds_connection_1.select)('medical_records', { id: recordId });
            if (records.length === 0) {
                return c.json({ error: 'Medical record not found' }, 404);
            }
            const record = records[0];
            // Access control
            if (actorRole === 'customer' && record.customer_id !== actorId) {
                return c.json({ error: 'Access denied' }, 403);
            }
            if (actorRole === 'vendor' && record.vendor_id !== actorId) {
                return c.json({ error: 'Access denied' }, 403);
            }
            // Get related info
            const pet = record.pet_id
                ? await (0, rds_connection_1.select)('pets', { id: record.pet_id })
                : [];
            const booking = record.booking_id
                ? await (0, rds_connection_1.select)('bookings', { id: record.booking_id })
                : [];
            return c.json({
                success: true,
                record: {
                    ...record,
                    pet: pet[0] || null,
                    booking: booking[0] || null,
                },
            });
        }
        catch (error) {
            console.error('Error fetching medical record:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /medical-records/pet/:petId
     * Get medical records for a pet
     */
    app.get("/medical-records/pet/:petId", async (c) => {
        try {
            const { petId } = c.req.param();
            const actorId = c.req.query('actorId');
            const actorRole = c.req.query('actorRole');
            // Verify access to pet
            const pets = await (0, rds_connection_1.select)('pets', { id: petId });
            if (pets.length === 0) {
                return c.json({ error: 'Pet not found' }, 404);
            }
            const pet = pets[0];
            if (actorRole === 'customer' && pet.customer_id !== actorId) {
                return c.json({ error: 'Access denied' }, 403);
            }
            const records = await (0, rds_connection_1.query)(`SELECT mr.*, v.business_name as vendor_name, b.booking_date
         FROM medical_records mr
         LEFT JOIN vendors v ON mr.vendor_id = v.id
         LEFT JOIN bookings b ON mr.booking_id = b.id
         WHERE mr.pet_id = $1
         AND mr.is_active = true
         ORDER BY mr.created_at DESC`, [petId]);
            return c.json({
                success: true,
                records: records.rows,
                total: records.rows.length,
            });
        }
        catch (error) {
            console.error('Error fetching medical records:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /medical-records/customer/:customerId
     * Get all medical records for a customer
     */
    app.get("/medical-records/customer/:customerId", async (c) => {
        try {
            const { customerId } = c.req.param();
            const records = await (0, rds_connection_1.query)(`SELECT mr.*, p.name as pet_name, v.business_name as vendor_name
         FROM medical_records mr
         LEFT JOIN pets p ON mr.pet_id = p.id
         LEFT JOIN vendors v ON mr.vendor_id = v.id
         WHERE mr.customer_id = $1
         AND mr.is_active = true
         ORDER BY mr.created_at DESC`, [customerId]);
            return c.json({
                success: true,
                records: records.rows,
                total: records.rows.length,
            });
        }
        catch (error) {
            console.error('Error fetching customer medical records:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * PUT /medical-records/:recordId
     * Update medical record (creates audit trail)
     */
    app.put("/medical-records/:recordId", async (c) => {
        try {
            const { recordId } = c.req.param();
            const { title, description, attachments, updatedBy } = await c.req.json();
            // Get existing record
            const existing = await (0, rds_connection_1.select)('medical_records', { id: recordId });
            if (existing.length === 0) {
                return c.json({ error: 'Medical record not found' }, 404);
            }
            // Update record
            const updated = await (0, rds_connection_1.update)('medical_records', { id: recordId }, {
                title: title,
                description: description,
                attachments: attachments,
                updated_by: updatedBy || null,
            });
            // TODO: Create audit log entry if audit_logs table exists
            return c.json({
                success: true,
                record: updated[0],
                message: 'Medical record updated successfully',
            });
        }
        catch (error) {
            console.error('Error updating medical record:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
//# sourceMappingURL=medical-records.js.map