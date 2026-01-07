"use strict";
/**
 * ============================================================================
 * ADDRESS MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles customer address management:
 * - Get customer addresses
 * - Add/update/delete addresses
 * - Set default address
 *
 * Migrated from: supabase/functions/make-server-3dd53475/user-account-routes.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAddressEndpoints = registerAddressEndpoints;
const rds_connection_1 = require("../database/rds-connection");
function registerAddressEndpoints(app) {
    /**
     * GET /customer/:customerId/addresses
     * Get all addresses for a customer
     */
    app.get("/customer/:customerId/addresses", async (c) => {
        try {
            const { customerId } = c.req.param();
            // Resolve customer ID (could be UUID or phone)
            let customer = await (0, rds_connection_1.select)('customers', { id: customerId });
            if (customer.length === 0) {
                customer = await (0, rds_connection_1.select)('customers', { phone: customerId });
            }
            if (customer.length === 0) {
                return c.json({ error: 'Customer not found' }, 404);
            }
            const addresses = await (0, rds_connection_1.query)(`SELECT * FROM customer_addresses
         WHERE customer_id = $1
         ORDER BY is_default DESC, created_at DESC`, [customer[0].id]).catch(() => ({ rows: [] }));
            return c.json({
                success: true,
                addresses: addresses.rows.map((addr) => ({
                    id: addr.id,
                    customerId: addr.customer_id,
                    label: addr.address_type,
                    name: addr.full_name,
                    phone: addr.phone,
                    addressLine1: addr.address_line1,
                    addressLine2: addr.address_line2,
                    city: addr.city,
                    state: addr.state,
                    pincode: addr.pincode,
                    landmark: addr.landmark,
                    coordinates: addr.coordinates || null,
                    isDefault: addr.is_default,
                    createdAt: addr.created_at,
                    updatedAt: addr.updated_at,
                })),
            });
        }
        catch (error) {
            console.error('Error fetching addresses:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /customer/:customerId/addresses
     * Add a new address
     */
    app.post("/customer/:customerId/addresses", async (c) => {
        try {
            const { customerId } = c.req.param();
            const { label, name, phone, addressLine1, addressLine2, city, state, pincode, landmark, coordinates, isDefault = false, } = await c.req.json();
            if (!name || !phone || !addressLine1 || !city || !state || !pincode) {
                return c.json({ error: 'name, phone, addressLine1, city, state, and pincode are required' }, 400);
            }
            // Resolve customer ID
            let customer = await (0, rds_connection_1.select)('customers', { id: customerId });
            if (customer.length === 0) {
                customer = await (0, rds_connection_1.select)('customers', { phone: customerId });
            }
            if (customer.length === 0) {
                return c.json({ error: 'Customer not found' }, 404);
            }
            // Check if first address (auto-default)
            const existingAddresses = await (0, rds_connection_1.query)('SELECT COUNT(*) as count FROM customer_addresses WHERE customer_id = $1', [customer[0].id]).catch(() => ({ rows: [{ count: '0' }] }));
            const shouldBeDefault = isDefault || parseInt(existingAddresses.rows[0]?.count || '0', 10) === 0;
            // If setting as default, unset all others
            if (shouldBeDefault) {
                await (0, rds_connection_1.query)('UPDATE customer_addresses SET is_default = false WHERE customer_id = $1', [customer[0].id]).catch(() => { });
            }
            // Create address
            const address = await (0, rds_connection_1.insert)('customer_addresses', {
                customer_id: customer[0].id,
                address_type: label || 'home',
                full_name: name,
                phone: phone,
                address_line1: addressLine1,
                address_line2: addressLine2 || null,
                city: city,
                state: state,
                pincode: pincode,
                landmark: landmark || null,
                coordinates: coordinates || null,
                is_default: shouldBeDefault,
            });
            // Get all addresses
            const allAddresses = await (0, rds_connection_1.query)('SELECT * FROM customer_addresses WHERE customer_id = $1 ORDER BY is_default DESC, created_at DESC', [customer[0].id]).catch(() => ({ rows: [] }));
            return c.json({
                success: true,
                address: address[0],
                addresses: allAddresses.rows,
            });
        }
        catch (error) {
            console.error('Error adding address:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * PUT /customer/:customerId/addresses/:addressId
     * Update an address
     */
    app.put("/customer/:customerId/addresses/:addressId", async (c) => {
        try {
            const { customerId, addressId } = c.req.param();
            const updates = await c.req.json();
            // Resolve customer ID
            let customer = await (0, rds_connection_1.select)('customers', { id: customerId });
            if (customer.length === 0) {
                customer = await (0, rds_connection_1.select)('customers', { phone: customerId });
            }
            if (customer.length === 0) {
                return c.json({ error: 'Customer not found' }, 404);
            }
            // If setting as default, unset all others
            if (updates.isDefault) {
                await (0, rds_connection_1.query)('UPDATE customer_addresses SET is_default = false WHERE customer_id = $1', [customer[0].id]).catch(() => { });
            }
            const updated = await (0, rds_connection_1.update)('customer_addresses', { id: addressId, customer_id: customer[0].id }, {
                address_type: updates.label || updates.address_type,
                full_name: updates.name || updates.full_name,
                phone: updates.phone,
                address_line1: updates.addressLine1 || updates.address_line1,
                address_line2: updates.addressLine2 || updates.address_line2,
                city: updates.city,
                state: updates.state,
                pincode: updates.pincode,
                landmark: updates.landmark,
                coordinates: updates.coordinates,
                is_default: updates.isDefault !== undefined ? updates.isDefault : updates.is_default,
            });
            if (updated.length === 0) {
                return c.json({ error: 'Address not found' }, 404);
            }
            return c.json({
                success: true,
                address: updated[0],
            });
        }
        catch (error) {
            console.error('Error updating address:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * DELETE /customer/:customerId/addresses/:addressId
     * Delete an address
     */
    app.delete("/customer/:customerId/addresses/:addressId", async (c) => {
        try {
            const { customerId, addressId } = c.req.param();
            // Resolve customer ID
            let customer = await (0, rds_connection_1.select)('customers', { id: customerId });
            if (customer.length === 0) {
                customer = await (0, rds_connection_1.select)('customers', { phone: customerId });
            }
            if (customer.length === 0) {
                return c.json({ error: 'Customer not found' }, 404);
            }
            await (0, rds_connection_1.query)('DELETE FROM customer_addresses WHERE id = $1 AND customer_id = $2', [addressId, customer[0].id]);
            return c.json({
                success: true,
                message: 'Address deleted successfully',
            });
        }
        catch (error) {
            console.error('Error deleting address:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
//# sourceMappingURL=addresses.js.map