"use strict";
/**
 * DONATION MANAGEMENT ENDPOINTS - SQL-ONLY VERSION
 *
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 *
 * Handles donations for animal shelters (monetary and in-kind)
 *
 * Date: 2025-01-28
 * Migration: KV to SQL (19 KV operations → 0)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.donationManagementEndpointsSQL = donationManagementEndpointsSQL;
const db_1 = require("../lib/db");
const response_utils_1 = require("./response-utils");
function donationManagementEndpointsSQL(app) {
    const BASE_PATH = '/make-server-3dd53475';
    // ============================================
    // DONATION ENDPOINTS
    // ============================================
    /**
     * GET /vendor/donations/:vendorId/list
     * Get all donations for a shelter
     */
    app.get(`${BASE_PATH}/vendor/donations/:vendorId/list`, async (c) => {
        try {
            const vendorId = c.req.param('vendorId');
            const { status, type, startDate, endDate } = c.req.query();
            // ✅ SQL: Get all donations for vendor
            const pool = await (0, db_1.getDbClient)();
            let sql = 'SELECT * FROM donations WHERE vendor_id = $1';
            const params = [vendorId];
            let paramIndex = 2;
            if (status) {
                sql += ` AND status = $${paramIndex}`;
                params.push(status);
                paramIndex++;
            }
            if (type) {
                sql += ` AND type = $${paramIndex}`;
                params.push(type);
                paramIndex++;
            }
            if (startDate) {
                sql += ` AND created_at >= $${paramIndex}`;
                params.push(startDate);
                paramIndex++;
            }
            if (endDate) {
                sql += ` AND created_at <= $${paramIndex}`;
                params.push(endDate);
                paramIndex++;
            }
            sql += ' ORDER BY created_at DESC';
            const result = await pool.query(sql, params);
            const donations = result.rows || [];
            // Calculate stats
            const now = new Date();
            const thisMonth = donations?.filter((d) => {
                const date = new Date(d.created_at);
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            }) || [];
            const stats = {
                total: donations?.length || 0,
                totalValue: donations?.reduce((sum, d) => sum + parseFloat(d.total_value || 0), 0) || 0,
                pending: donations?.filter((d) => d.status === 'pending').length || 0,
                received: donations?.filter((d) => d.status === 'received').length || 0,
                monetary: donations?.filter((d) => d.type === 'monetary').length || 0,
                inkind: donations?.filter((d) => d.type !== 'monetary').length || 0,
                thisMonth: thisMonth.length
            };
            return (0, response_utils_1.sendSuccess)(c, { donations: donations || [], stats });
        }
        catch (error) {
            console.error('Error fetching donations:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * POST /vendor/donations/:vendorId/create
     * Create a new donation
     */
    app.post(`${BASE_PATH}/vendor/donations/:vendorId/create`, async (c) => {
        try {
            const vendorId = c.req.param('vendorId');
            const body = await c.req.json();
            const now = new Date().toISOString();
            const receiptNumber = `RCP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
            return await (0, db_1.withTransaction)(async (txClient) => {
                // ✅ SQL: Create donation
                const donationId = `don_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                const totalValue = body.totalValue || body.amount || 0;
                const donationResult = await txClient.query(`INSERT INTO donations (
            id, vendor_id, donor_id, donor_name, donor_email, donor_phone, donor_address,
            type, amount, items, total_value, payment_method, transaction_id, status,
            receipt_number, receipt_issued, tax_benefit, purpose, notes, thankyou_sent,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
          RETURNING *`, [
                    donationId, vendorId, body.donorId || null, body.donorName, body.donorEmail,
                    body.donorPhone, body.donorAddress || null, body.type, body.amount || null,
                    body.items ? JSON.stringify(body.items) : null, totalValue, body.paymentMethod || null,
                    body.transactionId || null, 'pending', receiptNumber, false, body.taxBenefit || false,
                    body.purpose || null, body.notes || null, false, now, now
                ]);
                const donation = donationResult.rows[0];
                // ✅ SQL: Update or create donor profile
                if (body.donorEmail || body.donorPhone) {
                    // Check for existing donor
                    let donorQuery = 'SELECT * FROM donors WHERE vendor_id = $1';
                    const donorParams = [vendorId];
                    if (body.donorEmail && body.donorPhone) {
                        donorQuery += ' AND (donor_email = $2 OR donor_phone = $3)';
                        donorParams.push(body.donorEmail, body.donorPhone);
                    }
                    else if (body.donorEmail) {
                        donorQuery += ' AND donor_email = $2';
                        donorParams.push(body.donorEmail);
                    }
                    else {
                        donorQuery += ' AND donor_phone = $2';
                        donorParams.push(body.donorPhone);
                    }
                    const existingDonorResult = await txClient.query(donorQuery, donorParams);
                    const existingDonor = existingDonorResult.rows[0] || null;
                    if (existingDonor) {
                        // Update existing donor
                        await txClient.query(`UPDATE donors SET 
                total_donations = $1, total_amount = $2, donation_count = $3,
                last_donation_date = $4, updated_at = $5
                WHERE id = $6`, [
                            (parseFloat(existingDonor.total_donations || 0) + parseFloat(totalValue.toString())).toString(),
                            (parseFloat(existingDonor.total_amount || 0) + parseFloat(totalValue.toString())).toString(),
                            (existingDonor.donation_count || 0) + 1,
                            now, now, existingDonor.id
                        ]);
                    }
                    else {
                        // Create new donor
                        const donorId = `donor_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                        await txClient.query(`INSERT INTO donors (
                id, vendor_id, name, email, phone, address, total_donations, total_amount,
                donation_count, first_donation_date, last_donation_date, tags, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`, [
                            donorId, vendorId, body.donorName, body.donorEmail || null, body.donorPhone || null,
                            body.donorAddress || null, totalValue.toString(), totalValue.toString(),
                            1, now, now, JSON.stringify([]), now, now
                        ]);
                    }
                }
                return (0, response_utils_1.sendSuccess)(c, { donation, message: 'Donation recorded successfully' });
            });
        }
        catch (error) {
            console.error('Error creating donation:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * PUT /vendor/donations/:vendorId/:donationId/status
     * Update donation status
     */
    app.put(`${BASE_PATH}/vendor/donations/:vendorId/:donationId/status`, async (c) => {
        try {
            const { vendorId, donationId } = c.req.param();
            const { status } = await c.req.json();
            const now = new Date().toISOString();
            // ✅ SQL: Get donation
            const pool = await (0, db_1.getDbClient)();
            const donationResult = await pool.query('SELECT * FROM donations WHERE id = $1 AND vendor_id = $2', [donationId, vendorId]);
            const donation = donationResult.rows[0] || null;
            if (!donation) {
                return (0, response_utils_1.sendError)(c, 'Donation not found', 404);
            }
            // ✅ SQL: Update donation status
            const updateFields = ['status = $1', 'updated_at = $2'];
            const updateParams = [status, now];
            let paramIndex = 3;
            if (status === 'received' && !donation.received_date) {
                updateFields.push(`received_date = $${paramIndex}`);
                updateParams.push(now);
                paramIndex++;
            }
            if (status === 'acknowledged' && !donation.acknowledged_date) {
                updateFields.push(`acknowledged_date = $${paramIndex}`);
                updateParams.push(now);
                paramIndex++;
            }
            updateParams.push(donationId, vendorId);
            const updatedResult = await pool.query(`UPDATE donations SET ${updateFields.join(', ')} WHERE id = $${paramIndex} AND vendor_id = $${paramIndex + 1} RETURNING *`, updateParams);
            const updated = updatedResult.rows[0];
            return (0, response_utils_1.sendSuccess)(c, { donation: updated, message: 'Donation status updated' });
        }
        catch (error) {
            console.error('Error updating donation status:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /vendor/donations/:vendorId/donors
     * Get all donors
     */
    app.get(`${BASE_PATH}/vendor/donations/:vendorId/donors`, async (c) => {
        try {
            const vendorId = c.req.param('vendorId');
            // ✅ SQL: Get all donors for vendor
            const pool = await (0, db_1.getDbClient)();
            const donorsResult = await pool.query('SELECT * FROM donors WHERE vendor_id = $1 ORDER BY total_amount DESC', [vendorId]);
            const donors = donorsResult.rows || [];
            const stats = {
                total: donors?.length || 0,
                majorDonors: donors?.filter((d) => parseFloat(d.total_amount || 0) >= 10000).length || 0,
                recurring: donors?.filter((d) => (d.donation_count || 0) >= 3).length || 0,
                totalValue: donors?.reduce((sum, d) => sum + parseFloat(d.total_amount || 0), 0) || 0
            };
            return (0, response_utils_1.sendSuccess)(c, { donors: donors || [], stats });
        }
        catch (error) {
            console.error('Error fetching donors:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /vendor/donations/:vendorId/campaigns
     * Get all donation campaigns
     */
    app.get(`${BASE_PATH}/vendor/donations/:vendorId/campaigns`, async (c) => {
        try {
            const vendorId = c.req.param('vendorId');
            const { status } = c.req.query();
            // ✅ SQL: Get campaigns
            const pool = await (0, db_1.getDbClient)();
            let sql = 'SELECT * FROM donation_campaigns WHERE vendor_id = $1';
            const params = [vendorId];
            if (status) {
                sql += ' AND status = $2';
                params.push(status);
            }
            sql += ' ORDER BY start_date DESC';
            const campaignsResult = await pool.query(sql, params);
            const campaigns = campaignsResult.rows || [];
            return (0, response_utils_1.sendSuccess)(c, { campaigns: campaigns || [], total: campaigns?.length || 0 });
        }
        catch (error) {
            console.error('Error fetching campaigns:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * POST /vendor/donations/:vendorId/campaigns
     * Create a new donation campaign
     */
    app.post(`${BASE_PATH}/vendor/donations/:vendorId/campaigns`, async (c) => {
        try {
            const vendorId = c.req.param('vendorId');
            const body = await c.req.json();
            const now = new Date().toISOString();
            // ✅ SQL: Create campaign
            const pool = await (0, db_1.getDbClient)();
            const campaignId = `camp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const campaignResult = await pool.query(`INSERT INTO donation_campaigns (
          id, vendor_id, name, description, goal_amount, raised_amount,
          start_date, end_date, status, image_url, donation_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`, [
                campaignId, vendorId, body.name, body.description, body.goalAmount, 0,
                body.startDate, body.endDate, 'draft', body.imageUrl || null, 0, now, now
            ]);
            const campaign = campaignResult.rows[0];
            return (0, response_utils_1.sendSuccess)(c, { campaign, message: 'Campaign created successfully' });
        }
        catch (error) {
            console.error('Error creating campaign:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /vendor/donations/:vendorId/dashboard
     * Get comprehensive donation dashboard data
     */
    app.get(`${BASE_PATH}/vendor/donations/:vendorId/dashboard`, async (c) => {
        try {
            const vendorId = c.req.param('vendorId');
            // ✅ SQL: Fetch all data in parallel
            const pool = await (0, db_1.getDbClient)();
            const [donationsResult, donorsResult, campaignsResult] = await Promise.all([
                pool.query('SELECT * FROM donations WHERE vendor_id = $1', [vendorId]),
                pool.query('SELECT * FROM donors WHERE vendor_id = $1', [vendorId]),
                pool.query('SELECT * FROM donation_campaigns WHERE vendor_id = $1', [vendorId])
            ]);
            const donations = donationsResult.rows || [];
            const donors = donorsResult.rows || [];
            const campaigns = campaignsResult.rows || [];
            // Calculate comprehensive stats
            const now = new Date();
            const thisMonth = donations.filter((d) => {
                const date = new Date(d.created_at);
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            });
            const thisYear = donations.filter((d) => {
                const date = new Date(d.created_at);
                return date.getFullYear() === now.getFullYear();
            });
            const stats = {
                donations: {
                    total: donations.length,
                    totalValue: donations.reduce((sum, d) => sum + parseFloat(d.total_value || 0), 0),
                    thisMonth: thisMonth.length,
                    thisMonthValue: thisMonth.reduce((sum, d) => sum + parseFloat(d.total_value || 0), 0),
                    thisYear: thisYear.length,
                    thisYearValue: thisYear.reduce((sum, d) => sum + parseFloat(d.total_value || 0), 0),
                    pending: donations.filter((d) => d.status === 'pending').length,
                    byType: {
                        monetary: donations.filter((d) => d.type === 'monetary').reduce((sum, d) => sum + parseFloat(d.total_value || 0), 0),
                        food: donations.filter((d) => d.type === 'food').reduce((sum, d) => sum + parseFloat(d.total_value || 0), 0),
                        medicine: donations.filter((d) => d.type === 'medicine').reduce((sum, d) => sum + parseFloat(d.total_value || 0), 0),
                        supplies: donations.filter((d) => d.type === 'supplies').reduce((sum, d) => sum + parseFloat(d.total_value || 0), 0)
                    }
                },
                donors: {
                    total: donors.length,
                    majorDonors: donors.filter((d) => parseFloat(d.total_amount || 0) >= 10000).length,
                    recurring: donors.filter((d) => (d.donation_count || 0) >= 3).length,
                    new: donors.filter((d) => {
                        const date = new Date(d.first_donation_date);
                        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                    }).length
                },
                campaigns: {
                    active: campaigns.filter((c) => c.status === 'active').length,
                    total: campaigns.length,
                    totalGoal: campaigns.filter((c) => c.status === 'active').reduce((sum, c) => sum + parseFloat(c.goal_amount || 0), 0),
                    totalRaised: campaigns.filter((c) => c.status === 'active').reduce((sum, c) => sum + parseFloat(c.raised_amount || 0), 0)
                }
            };
            // Get recent donations
            const recentDonations = donations
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 5);
            // Get top donors
            const topDonors = donors
                .sort((a, b) => parseFloat(b.total_amount || 0) - parseFloat(a.total_amount || 0))
                .slice(0, 5);
            return (0, response_utils_1.sendSuccess)(c, { stats, recentDonations, topDonors });
        }
        catch (error) {
            console.error('Error fetching dashboard:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * POST /vendor/donations/:vendorId/donations/:donationId/generate-receipt
     * Generate and issue receipt for a donation
     */
    app.post(`${BASE_PATH}/vendor/donations/:vendorId/donations/:donationId/generate-receipt`, async (c) => {
        try {
            const { vendorId, donationId } = c.req.param();
            // ✅ SQL: Get donation
            const pool = await (0, db_1.getDbClient)();
            const donationResult = await pool.query('SELECT * FROM donations WHERE id = $1 AND vendor_id = $2', [donationId, vendorId]);
            const donation = donationResult.rows[0] || null;
            if (!donation) {
                return (0, response_utils_1.sendError)(c, 'Donation not found', 404);
            }
            // Generate receipt URL (in production, this would generate a PDF)
            const receiptUrl = `https://warmpawz.com/receipts/${donationId}`;
            const certificateUrl = donation.tax_benefit
                ? `https://warmpawz.com/certificates/80G/${donationId}`
                : undefined;
            // ✅ SQL: Update donation
            const now = new Date().toISOString();
            const updatedResult = await pool.query(`UPDATE donations SET 
          receipt_issued = $1, receipt_url = $2, certificate_url = $3,
          status = $4, acknowledged_date = $5, updated_at = $6
          WHERE id = $7 AND vendor_id = $8
          RETURNING *`, [true, receiptUrl, certificateUrl || null, 'acknowledged', now, now, donationId, vendorId]);
            const updated = updatedResult.rows[0];
            return (0, response_utils_1.sendSuccess)(c, {
                donation: updated,
                receiptUrl,
                certificateUrl,
                message: 'Receipt generated successfully'
            });
        }
        catch (error) {
            console.error('Error generating receipt:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /vendor/donations/:vendorId/donations/:donationId/receipt
     * Get receipt details for a donation
     */
    app.get(`${BASE_PATH}/vendor/donations/:vendorId/donations/:donationId/receipt`, async (c) => {
        try {
            const { vendorId, donationId } = c.req.param();
            // ✅ SQL: Get donation
            const pool = await (0, db_1.getDbClient)();
            const donationResult = await pool.query('SELECT * FROM donations WHERE id = $1 AND vendor_id = $2', [donationId, vendorId]);
            const donation = donationResult.rows[0] || null;
            if (!donation) {
                return (0, response_utils_1.sendError)(c, 'Donation not found', 404);
            }
            if (!donation.receipt_issued) {
                return (0, response_utils_1.sendError)(c, 'Receipt not yet generated', 404);
            }
            return (0, response_utils_1.sendSuccess)(c, {
                receipt: {
                    receiptNumber: donation.receipt_number,
                    receiptUrl: donation.receipt_url,
                    certificateUrl: donation.certificate_url,
                    donorName: donation.donor_name,
                    amount: donation.amount,
                    type: donation.type,
                    date: donation.created_at,
                    taxBenefit: donation.tax_benefit
                }
            });
        }
        catch (error) {
            console.error('Error fetching receipt:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * DELETE /vendor/donations/:vendorId/:donationId
     * Delete a donation
     */
    app.delete(`${BASE_PATH}/vendor/donations/:vendorId/:donationId`, async (c) => {
        try {
            const { vendorId, donationId } = c.req.param();
            return await (0, db_1.withTransaction)(async (txClient) => {
                // ✅ SQL: Get donation
                const donationResult = await txClient.query('SELECT * FROM donations WHERE id = $1 AND vendor_id = $2', [donationId, vendorId]);
                const donation = donationResult.rows[0] || null;
                if (!donation) {
                    return (0, response_utils_1.sendError)(c, 'Donation not found', 404);
                }
                // ✅ SQL: Delete donation
                await txClient.query('DELETE FROM donations WHERE id = $1', [donationId]);
                // ✅ SQL: Update donor stats if needed
                if (donation.donor_email || donation.donor_phone) {
                    let donorQuery = 'SELECT * FROM donors WHERE vendor_id = $1';
                    const donorParams = [vendorId];
                    if (donation.donor_email && donation.donor_phone) {
                        donorQuery += ' AND (donor_email = $2 OR donor_phone = $3)';
                        donorParams.push(donation.donor_email, donation.donor_phone);
                    }
                    else if (donation.donor_email) {
                        donorQuery += ' AND donor_email = $2';
                        donorParams.push(donation.donor_email);
                    }
                    else {
                        donorQuery += ' AND donor_phone = $2';
                        donorParams.push(donation.donor_phone);
                    }
                    const donorResult = await txClient.query(donorQuery, donorParams);
                    const donor = donorResult.rows[0] || null;
                    if (donor) {
                        const now = new Date().toISOString();
                        await txClient.query(`UPDATE donors SET 
                total_donations = $1, total_amount = $2, donation_count = $3, updated_at = $4
                WHERE id = $5`, [
                            Math.max(0, parseFloat(donor.total_donations || 0) - parseFloat(donation.total_value || 0)).toString(),
                            Math.max(0, parseFloat(donor.total_amount || 0) - parseFloat(donation.total_value || 0)).toString(),
                            Math.max(0, (donor.donation_count || 0) - 1),
                            now,
                            donor.id
                        ]);
                    }
                }
                console.log(`✅ Donation deleted successfully: ${donationId}`);
                return (0, response_utils_1.sendSuccess)(c, {}, 'Donation deleted successfully');
            });
        }
        catch (error) {
            console.error('Error deleting donation:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    console.log('✅ Donation management endpoints registered (SQL-only)');
}
//# sourceMappingURL=donation-management-endpoints-sql.js.map