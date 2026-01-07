"use strict";
/**
 * ============================================================================
 * CUSTOMER PROFILE MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles customer profile management:
 * - Get customer profile (unified)
 * - Update customer profile
 * - Get customer preferences
 * - Update customer preferences
 *
 * Migrated from: supabase/functions/make-server-3dd53475/customer-ecommerce-endpoints-sql.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCustomerProfileEndpoints = registerCustomerProfileEndpoints;
const rds_connection_1 = require("../database/rds-connection");
function normalizePhone(phone) {
    return phone.replace(/\D/g, '');
}
async function resolveCustomerId(identifier) {
    // Check if it's a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(identifier)) {
        const customers = await (0, rds_connection_1.select)('customers', { id: identifier });
        return customers.length > 0 ? customers[0].id : null;
    }
    // Check if it's a phone number
    const cleanPhone = normalizePhone(identifier);
    const customers = await (0, rds_connection_1.select)('customers', { phone: cleanPhone });
    return customers.length > 0 ? customers[0].id : null;
}
function registerCustomerProfileEndpoints(app) {
    /**
     * GET /customer/profile/unified/:identifier
     * Get unified customer profile with wallet, addresses, bookings, orders
     */
    app.get("/customer/profile/unified/:identifier", async (c) => {
        try {
            const { identifier } = c.req.param();
            // Resolve identifier (phone or customer ID)
            const customerId = await resolveCustomerId(identifier);
            if (!customerId) {
                return c.json({ error: 'Customer not found' }, 404);
            }
            // Get customer
            const customers = await (0, rds_connection_1.select)('customers', { id: customerId });
            if (customers.length === 0) {
                return c.json({ error: 'Customer not found' }, 404);
            }
            const customer = customers[0];
            // Fetch Wallet
            const wallets = await (0, rds_connection_1.query)('SELECT * FROM customer_wallets WHERE customer_id = $1', [customerId]).catch(() => ({ rows: [] }));
            const wallet = wallets.rows.length > 0 ? wallets.rows[0] : { balance: 0, currency: 'INR', status: 'active' };
            // Fetch Addresses
            const addresses = await (0, rds_connection_1.query)('SELECT * FROM customer_addresses WHERE customer_id = $1 ORDER BY is_default DESC, created_at DESC', [customerId]).catch(() => ({ rows: [] }));
            // Fetch Bookings
            const bookings = await (0, rds_connection_1.query)('SELECT * FROM bookings WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50', [customerId]).catch(() => ({ rows: [] }));
            // Fetch Orders
            const orders = await (0, rds_connection_1.query)('SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50', [customerId]).catch(() => ({ rows: [] }));
            // Calculate stats
            const stats = {
                totalBookings: bookings.rows.length,
                activeBookings: bookings.rows.filter((b) => ['pending', 'confirmed', 'in_progress'].includes(b.status)).length,
                totalEcommerceOrders: orders.rows.length,
                walletBalance: parseFloat(wallet.balance || '0'),
            };
            return c.json({
                success: true,
                profile: {
                    id: customer.id,
                    name: customer.full_name,
                    email: customer.email,
                    phone: customer.phone,
                    wallet: {
                        balance: parseFloat(wallet.balance || '0'),
                        currency: wallet.currency || 'INR',
                        status: wallet.status || 'active',
                    },
                    addresses: addresses.rows.map((addr) => ({
                        id: addr.id,
                        label: addr.address_type,
                        name: addr.full_name,
                        phone: addr.phone,
                        addressLine1: addr.address_line1,
                        addressLine2: addr.address_line2,
                        city: addr.city,
                        state: addr.state,
                        pincode: addr.pincode,
                        landmark: addr.landmark,
                        isDefault: addr.is_default,
                    })),
                    orders: {
                        all: orders.rows,
                        total: orders.rows.length,
                    },
                    bookings: bookings.rows,
                    stats,
                },
            });
        }
        catch (error) {
            console.error('Error fetching unified customer profile:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /customer/profile/:identifier
     * Get customer profile (basic)
     */
    app.get("/customer/profile/:identifier", async (c) => {
        try {
            const { identifier } = c.req.param();
            const customerId = await resolveCustomerId(identifier);
            if (!customerId) {
                return c.json({ error: 'Customer not found' }, 404);
            }
            const customers = await (0, rds_connection_1.select)('customers', { id: customerId });
            if (customers.length === 0) {
                return c.json({ error: 'Customer not found' }, 404);
            }
            const customer = customers[0];
            // Map backend fields to UI fields
            const nameParts = (customer.full_name || '').split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            // Extract photo from preferences JSONB
            const preferences = customer.preferences || {};
            const photoUrl = preferences.profile_photo_url || null;
            // Extract address fields from JSONB
            const addressData = customer.address || {};
            return c.json({
                success: true,
                profile: {
                    firstName,
                    lastName,
                    email: customer.email || '',
                    phone: customer.phone || identifier,
                    address: addressData.street || '',
                    pincode: addressData.pincode || '',
                    photo: photoUrl || '',
                },
            });
        }
        catch (error) {
            console.error('Error fetching customer profile:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * PUT /customer/profile/:identifier
     * Update customer profile
     */
    app.put("/customer/profile/:identifier", async (c) => {
        try {
            const { identifier } = c.req.param();
            const profileData = await c.req.json();
            const customerId = await resolveCustomerId(identifier);
            if (!customerId) {
                return c.json({ error: 'Customer not found' }, 404);
            }
            // Prepare update data
            const updateData = {};
            if (profileData.firstName || profileData.lastName) {
                updateData.full_name = `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim();
            }
            if (profileData.email) {
                updateData.email = profileData.email;
            }
            if (profileData.photo) {
                // Store photo in preferences JSONB
                const customers = await (0, rds_connection_1.select)('customers', { id: customerId });
                const existingPreferences = customers[0]?.preferences || {};
                updateData.preferences = {
                    ...existingPreferences,
                    profile_photo_url: profileData.photo,
                };
            }
            if (profileData.address || profileData.pincode) {
                // Store address in address JSONB
                const customers = await (0, rds_connection_1.select)('customers', { id: customerId });
                const existingAddress = customers[0]?.address || {};
                updateData.address = {
                    ...existingAddress,
                    street: profileData.address || existingAddress.street,
                    pincode: profileData.pincode || existingAddress.pincode,
                };
            }
            const updated = await (0, rds_connection_1.update)('customers', { id: customerId }, updateData);
            return c.json({
                success: true,
                message: 'Profile updated successfully',
                profile: updated[0],
            });
        }
        catch (error) {
            console.error('Error updating customer profile:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /customer/:customerId/preferences
     * Get customer preferences
     */
    app.get("/customer/:customerId/preferences", async (c) => {
        try {
            const { customerId } = c.req.param();
            const customers = await (0, rds_connection_1.select)('customers', { id: customerId });
            if (customers.length === 0) {
                return c.json({ error: 'Customer not found' }, 404);
            }
            const preferences = customers[0].preferences || {};
            return c.json({
                success: true,
                preferences,
            });
        }
        catch (error) {
            console.error('Error fetching customer preferences:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * PUT /customer/:customerId/preferences
     * Update customer preferences
     */
    app.put("/customer/:customerId/preferences", async (c) => {
        try {
            const { customerId } = c.req.param();
            const newPreferences = await c.req.json();
            const customers = await (0, rds_connection_1.select)('customers', { id: customerId });
            if (customers.length === 0) {
                return c.json({ error: 'Customer not found' }, 404);
            }
            const existingPreferences = customers[0].preferences || {};
            const updated = await (0, rds_connection_1.update)('customers', { id: customerId }, {
                preferences: {
                    ...existingPreferences,
                    ...newPreferences,
                },
            });
            return c.json({
                success: true,
                message: 'Preferences updated successfully',
                preferences: updated[0].preferences,
            });
        }
        catch (error) {
            console.error('Error updating customer preferences:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
//# sourceMappingURL=customer-profile.js.map