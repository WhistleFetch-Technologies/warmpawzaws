"use strict";
/**
 * ============================================================================
 * DONATION MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles donations for animal shelters:
 * - Create/manage donations
 * - Donation campaigns
 * - Donor management
 *
 * Migrated from: supabase/functions/server/donation-management-endpoints.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDonationEndpoints = registerDonationEndpoints;
const rds_connection_1 = require("../database/rds-connection");
function registerDonationEndpoints(app) {
    /**
     * GET /donations/vendor/:vendorId
     * Get all donations for a vendor (shelter)
     */
    app.get("/donations/vendor/:vendorId", async (c) => {
        try {
            const { vendorId } = c.req.param();
            const status = c.req.query('status');
            const type = c.req.query('type');
            const startDate = c.req.query('startDate');
            const endDate = c.req.query('endDate');
            let donationsQuery = `
        SELECT * FROM donations
        WHERE vendor_id = $1
      `;
            const params = [vendorId];
            let paramIndex = 2;
            if (status) {
                donationsQuery += ` AND status = $${paramIndex}`;
                params.push(status);
                paramIndex++;
            }
            if (type) {
                donationsQuery += ` AND donation_type = $${paramIndex}`;
                params.push(type);
                paramIndex++;
            }
            if (startDate) {
                donationsQuery += ` AND created_at >= $${paramIndex}`;
                params.push(startDate);
                paramIndex++;
            }
            if (endDate) {
                donationsQuery += ` AND created_at <= $${paramIndex}`;
                params.push(endDate);
                paramIndex++;
            }
            donationsQuery += ` ORDER BY created_at DESC`;
            const donations = await (0, rds_connection_1.query)(donationsQuery, params).catch(() => ({ rows: [] }));
            // Calculate stats
            const allDonations = donations.rows;
            const stats = {
                total: allDonations.length,
                totalValue: allDonations.reduce((sum, d) => sum + parseFloat(d.total_value || '0'), 0),
                pending: allDonations.filter((d) => d.status === 'pending').length,
                received: allDonations.filter((d) => d.status === 'received').length,
                monetary: allDonations.filter((d) => d.donation_type === 'monetary').length,
                inkind: allDonations.filter((d) => d.donation_type !== 'monetary').length,
                thisMonth: allDonations.filter((d) => {
                    const date = new Date(d.created_at);
                    const now = new Date();
                    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                }).length,
            };
            return c.json({
                success: true,
                donations: allDonations,
                stats,
            });
        }
        catch (error) {
            console.error('Error fetching donations:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /donations
     * Create a new donation
     */
    app.post("/donations", async (c) => {
        try {
            const donationData = await c.req.json();
            const { vendorId, donorId, donorName, donorEmail, donorPhone, donorAddress, donationType, amount, items, totalValue, paymentMethod, transactionId, purpose, notes, } = donationData;
            if (!vendorId || !donorName || !donorPhone || !donationType) {
                return c.json({ error: 'vendorId, donorName, donorPhone, and donationType are required' }, 400);
            }
            // Generate receipt number
            const receiptNumber = `DON-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
            const donation = await (0, rds_connection_1.insert)('donations', {
                vendor_id: vendorId,
                donor_id: donorId || null,
                donor_name: donorName,
                donor_email: donorEmail || null,
                donor_phone: donorPhone,
                donor_address: donorAddress || null,
                donation_type: donationType,
                amount: amount || null,
                items: items || [],
                total_value: totalValue || amount || 0,
                payment_method: paymentMethod || null,
                transaction_id: transactionId || null,
                status: 'pending',
                receipt_number: receiptNumber,
                receipt_issued: false,
                tax_benefit: false,
                purpose: purpose || null,
                notes: notes || null,
            });
            return c.json({
                success: true,
                donation: donation[0],
                message: 'Donation created successfully',
            });
        }
        catch (error) {
            console.error('Error creating donation:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /donations/campaigns/vendor/:vendorId
     * Get donation campaigns for a vendor
     */
    app.get("/donations/campaigns/vendor/:vendorId", async (c) => {
        try {
            const { vendorId } = c.req.param();
            const campaigns = await (0, rds_connection_1.query)(`SELECT * FROM donation_campaigns
         WHERE vendor_id = $1
         ORDER BY created_at DESC`, [vendorId]).catch(() => ({ rows: [] }));
            return c.json({
                success: true,
                campaigns: campaigns.rows,
                total: campaigns.rows.length,
            });
        }
        catch (error) {
            console.error('Error fetching campaigns:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /donations/campaigns
     * Create a donation campaign
     */
    app.post("/donations/campaigns", async (c) => {
        try {
            const { vendorId, name, description, goalAmount, startDate, endDate, imageUrl } = await c.req.json();
            if (!vendorId || !name || !goalAmount) {
                return c.json({ error: 'vendorId, name, and goalAmount are required' }, 400);
            }
            const campaign = await (0, rds_connection_1.insert)('donation_campaigns', {
                vendor_id: vendorId,
                name,
                description: description || null,
                goal_amount: goalAmount,
                raised_amount: 0,
                start_date: startDate || new Date().toISOString().split('T')[0],
                end_date: endDate || null,
                status: 'draft',
                image_url: imageUrl || null,
                donation_count: 0,
            });
            return c.json({
                success: true,
                campaign: campaign[0],
                message: 'Campaign created successfully',
            });
        }
        catch (error) {
            console.error('Error creating campaign:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
//# sourceMappingURL=donations.js.map