"use strict";
/**
 * Specialized Services Endpoints - SQL-ONLY VERSION
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 *
 * Handles specialized service configuration for vendors
 *
 * Status: ✅ SQL-ONLY IMPLEMENTATION
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.specializedServicesEndpoints = specializedServicesEndpoints;
const response_utils_1 = require("./response-utils");
const services_1 = require("../lib/repositories/services");
const bookings_1 = require("../lib/repositories/bookings");
const db_1 = require("../lib/db");
// Helper repository functions (inline SQL replacement)
const getPrescriptionsRepository = () => ({
    getById: async (prescriptionId) => {
        const [result] = await (0, db_1.selectQuery)('prescriptions', { id: prescriptionId }, { limit: 1 });
        return result || null;
    }
});
const getMedicalRecordsRepository = () => ({
    getById: async (recordId) => {
        const [result] = await (0, db_1.selectQuery)('medical_records', { id: recordId }, { limit: 1 });
        return result || null;
    }
});
// ============================================================================
// ENDPOINTS
// ============================================================================
function specializedServicesEndpoints(app) {
    const BASE_PATH = '/make-server-3dd53475';
    /**
     * GET /vendor/:vendorId/specialized-services/config
     * Get specialized service configuration for a vendor
     */
    app.get(`${BASE_PATH}/vendor/:vendorId/specialized-services/config`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            // ✅ SQL: Get vendor and services
            const pool = await (0, db_1.getDbClient)();
            const vendorResult = await pool.query('SELECT * FROM vendors WHERE id = $1', [vendorId]);
            const vendor = vendorResult.rows[0];
            if (!vendor) {
                return (0, response_utils_1.sendError)(c, 'Vendor not found', 404);
            }
            // Get services for this vendor
            const servicesRepo = (0, services_1.getServicesRepository)();
            const services = await servicesRepo.findByVendor(vendorId);
            // Build configuration based on vendor type
            const config = {
                requiresPrescription: vendor.category === 'vet_clinic' || vendor.role_id?.toString().includes('vet'),
                requiresMedicalRecords: vendor.category === 'vet_clinic',
                allowsAddOns: true,
                addOns: services
                    .filter((s) => s.is_active && s.add_on === true)
                    .map((s) => ({
                    addOnId: s.id,
                    name: s.name,
                    price: s.base_price || 0,
                    description: s.description || ''
                }))
            };
            return (0, response_utils_1.sendSuccess)(c, { config, vendor: { id: vendor.id, name: vendor.business_name } });
        }
        catch (error) {
            console.error('❌ Error getting specialized services config:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    /**
     * POST /booking/:bookingId/specialized-services/update-total
     * Update booking total amount after adding specialized services
     */
    app.post(`${BASE_PATH}/booking/:bookingId/specialized-services/update-total`, async (c) => {
        try {
            const { bookingId } = c.req.param();
            const { additionalAmount } = await c.req.json();
            if (!additionalAmount || additionalAmount < 0) {
                return (0, response_utils_1.sendError)(c, 'Invalid additional amount', 400);
            }
            // ✅ SQL: Get booking
            const bookingsRepo = (0, bookings_1.getBookingsRepository)();
            const booking = await bookingsRepo.findById(bookingId);
            if (!booking) {
                return (0, response_utils_1.sendError)(c, 'Booking not found', 404);
            }
            // ✅ SQL: Update booking total
            await bookingsRepo.update(bookingId, {
                total_amount: booking.total_amount + additionalAmount
            });
            return (0, response_utils_1.sendSuccess)(c, {
                message: 'Booking total updated',
                newTotal: booking.total_amount + additionalAmount
            });
        }
        catch (error) {
            console.error('❌ Error updating booking total:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
}
//# sourceMappingURL=specialized-services-endpoints-sql.js.map