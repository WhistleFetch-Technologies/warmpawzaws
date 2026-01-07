"use strict";
/**
 * ============================================================================
 * RAZORPAY SETTLEMENTS - MARKETPLACE MODE
 * ============================================================================
 *
 * Handles vendor settlements using Razorpay Route API:
 * - Linked account creation and verification
 * - Route transfers from payments to vendor accounts
 * - Settlement status tracking
 * - Bank account verification
 *
 * Date: 2026-01-02
 * ============================================================================
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRazorpaySettlementEndpoints = registerRazorpaySettlementEndpoints;
const base_handler_1 = require("../handler/base-handler");
const rds_connection_1 = require("../database/rds-connection");
const aws_clients_1 = require("../utils/aws-clients");
const crypto_1 = __importDefault(require("crypto"));
// ============================================================================
// RAZORPAY CONFIGURATION
// ============================================================================
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_BASE_URL = 'https://api.razorpay.com/v1';
// ============================================================================
// RAZORPAY API HELPERS
// ============================================================================
async function razorpayRequest(endpoint, method = 'GET', body) {
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    const response = await fetch(`${RAZORPAY_BASE_URL}${endpoint}`, {
        method,
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) {
        console.error('Razorpay API error:', data);
        throw new Error(data.error?.description || 'Razorpay API error');
    }
    return data;
}
// ============================================================================
// LINKED ACCOUNT HANDLERS
// ============================================================================
class CreateLinkedAccountHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const { vendor_id } = body;
        this.validateRequired(body, ['vendor_id']);
        // Get vendor details
        const vendors = await (0, rds_connection_1.select)('vendors', { id: vendor_id });
        if (vendors.length === 0) {
            return this.error('Vendor not found', 404);
        }
        const vendor = vendors[0];
        // Check if linked account already exists
        if (vendor.razorpay_account_id) {
            return this.success({
                account_id: vendor.razorpay_account_id,
                message: 'Linked account already exists',
            });
        }
        // Create linked account via Razorpay Route API
        const accountData = {
            email: vendor.email,
            phone: vendor.phone,
            legal_business_name: vendor.business_name || vendor.owner_name,
            business_type: vendor.business_type === 'business' ? 'partnership' : 'individual',
            contact_name: vendor.owner_name,
            profile: {
                category: 'healthcare',
                subcategory: 'veterinary',
                addresses: {
                    registered: {
                        street1: vendor.address,
                        city: vendor.city,
                        state: vendor.state,
                        postal_code: parseInt(vendor.pincode) || 0,
                        country: 'IN',
                    },
                },
            },
            legal_info: {
                pan: vendor.pan_number || '',
                gst: vendor.gst_number || '',
            },
        };
        try {
            const account = await razorpayRequest('/accounts', 'POST', accountData);
            // Update vendor with Razorpay account ID
            await (0, rds_connection_1.update)('vendors', { id: vendor_id }, {
                razorpay_account_id: account.id,
                razorpay_account_status: account.status,
                updated_at: new Date(),
            });
            // Log the account creation
            await (0, rds_connection_1.insert)('razorpay_accounts', {
                vendor_id,
                account_id: account.id,
                status: account.status,
                created_at: new Date(),
            });
            return this.success({
                account_id: account.id,
                status: account.status,
                message: 'Linked account created successfully',
            });
        }
        catch (error) {
            console.error('Error creating linked account:', error);
            return this.error(`Failed to create linked account: ${error.message}`, 500);
        }
    }
}
class AddBankAccountHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const { vendor_id, account_number, ifsc_code, beneficiary_name } = body;
        this.validateRequired(body, ['vendor_id', 'account_number', 'ifsc_code', 'beneficiary_name']);
        // Get vendor with Razorpay account
        const vendors = await (0, rds_connection_1.select)('vendors', { id: vendor_id });
        if (vendors.length === 0) {
            return this.error('Vendor not found', 404);
        }
        const vendor = vendors[0];
        if (!vendor.razorpay_account_id) {
            return this.error('Linked account not created. Please create linked account first.', 400);
        }
        try {
            // Add bank account to linked account
            const bankAccount = await razorpayRequest(`/accounts/${vendor.razorpay_account_id}/bank_accounts`, 'POST', {
                beneficiary_name,
                account_type: 'savings',
                account_number,
                ifsc_code,
            });
            // Update vendor bank details
            await (0, rds_connection_1.update)('vendors', { id: vendor_id }, {
                bank_account_id: bankAccount.id,
                bank_account_number: maskAccountNumber(account_number),
                bank_ifsc: ifsc_code,
                bank_beneficiary_name: beneficiary_name,
                bank_verified: false, // Will be verified after penny testing
                updated_at: new Date(),
            });
            // Initiate bank verification (penny drop)
            await this.initiateBankVerification(vendor_id, bankAccount.id);
            return this.success({
                bank_account_id: bankAccount.id,
                message: 'Bank account added. Verification in progress.',
            });
        }
        catch (error) {
            console.error('Error adding bank account:', error);
            return this.error(`Failed to add bank account: ${error.message}`, 500);
        }
    }
    async initiateBankVerification(vendorId, bankAccountId) {
        // Queue bank verification
        await (0, aws_clients_1.sendToSQS)('settlement-queue', {
            type: 'verify_bank_account',
            vendor_id: vendorId,
            bank_account_id: bankAccountId,
        });
    }
}
class VerifyBankAccountHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const { vendor_id } = body;
        const vendors = await (0, rds_connection_1.select)('vendors', { id: vendor_id });
        if (vendors.length === 0) {
            return this.error('Vendor not found', 404);
        }
        const vendor = vendors[0];
        if (!vendor.razorpay_account_id || !vendor.bank_account_id) {
            return this.error('Bank account not configured', 400);
        }
        try {
            // Request stakeholder docs for verification
            const verification = await razorpayRequest(`/accounts/${vendor.razorpay_account_id}/stakeholders`, 'GET');
            // Check bank account status
            const bankAccount = await razorpayRequest(`/accounts/${vendor.razorpay_account_id}/bank_accounts/${vendor.bank_account_id}`, 'GET');
            const isVerified = bankAccount.verification_status === 'verified';
            await (0, rds_connection_1.update)('vendors', { id: vendor_id }, {
                bank_verified: isVerified,
                bank_verification_status: bankAccount.verification_status,
                updated_at: new Date(),
            });
            if (isVerified) {
                await (0, aws_clients_1.publishNotification)('vendor', vendor_id, {
                    title: 'Bank Account Verified',
                    body: 'Your bank account has been verified. You can now receive settlements.',
                    type: 'bank_verified',
                });
            }
            return this.success({
                verified: isVerified,
                status: bankAccount.verification_status,
            });
        }
        catch (error) {
            console.error('Error verifying bank account:', error);
            return this.error(`Verification failed: ${error.message}`, 500);
        }
    }
}
// ============================================================================
// SETTLEMENT HANDLERS
// ============================================================================
class ProcessSettlementHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const body = this.parseBody(context.event);
        const { vendor_id, booking_ids, amount } = body;
        this.validateRequired(body, ['vendor_id']);
        // Get vendor details
        const vendors = await (0, rds_connection_1.select)('vendors', { id: vendor_id });
        if (vendors.length === 0) {
            return this.error('Vendor not found', 404);
        }
        const vendor = vendors[0];
        if (!vendor.razorpay_account_id) {
            return this.error('Vendor linked account not configured', 400);
        }
        if (!vendor.bank_verified) {
            return this.error('Vendor bank account not verified', 400);
        }
        // Get pending settlements for vendor
        let settlementAmount = amount;
        let bookingIdsToSettle = booking_ids;
        if (!bookingIdsToSettle) {
            // Get all pending settlements
            const pendingSettlements = await (0, rds_connection_1.query)(`
        SELECT booking_id, vendor_amount
        FROM settlements
        WHERE vendor_id = $1 AND status = 'pending'
      `, [vendor_id]);
            const pendingRows = Array.isArray(pendingSettlements) ? pendingSettlements : pendingSettlements.rows || [];
            bookingIdsToSettle = pendingRows.map((s) => s.booking_id);
            settlementAmount = pendingRows.reduce((sum, s) => sum + s.vendor_amount, 0);
        }
        if (!settlementAmount || settlementAmount <= 0) {
            return this.error('No pending amount to settle', 400);
        }
        // Get tier commission rate
        const tierCommission = await this.getTierCommission(vendor_id);
        const platformCommission = Math.round(settlementAmount * tierCommission / 100);
        const vendorPayout = settlementAmount - platformCommission;
        try {
            // Create transfer via Razorpay Route API
            const transfer = await razorpayRequest('/transfers', 'POST', {
                account: vendor.razorpay_account_id,
                amount: vendorPayout * 100, // Razorpay uses paise
                currency: 'INR',
                notes: {
                    vendor_id,
                    booking_ids: JSON.stringify(bookingIdsToSettle),
                    settlement_date: new Date().toISOString(),
                },
            });
            // Create settlement record
            const settlementId = `STL${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
            await (0, rds_connection_1.insert)('vendor_settlements', {
                id: settlementId,
                vendor_id,
                razorpay_transfer_id: transfer.id,
                total_amount: settlementAmount,
                commission_amount: platformCommission,
                commission_rate: tierCommission,
                payout_amount: vendorPayout,
                booking_ids: bookingIdsToSettle,
                status: 'processing',
                created_at: new Date(),
            });
            // Update individual booking settlements
            await (0, rds_connection_1.query)(`
        UPDATE settlements 
        SET status = 'processing', 
            settlement_id = $1,
            transfer_id = $2,
            updated_at = NOW()
        WHERE vendor_id = $3 AND booking_id = ANY($4)
      `, [settlementId, transfer.id, vendor_id, bookingIdsToSettle]);
            // Notify vendor
            await (0, aws_clients_1.publishNotification)('vendor', vendor_id, {
                title: 'Settlement Processing',
                body: `Settlement of ₹${vendorPayout} is being processed. Expected in 2-3 business days.`,
                type: 'settlement_processing',
                data: { settlement_id: settlementId, amount: vendorPayout },
            });
            return this.success({
                settlement_id: settlementId,
                transfer_id: transfer.id,
                total_amount: settlementAmount,
                commission: platformCommission,
                payout_amount: vendorPayout,
                status: 'processing',
                message: 'Settlement initiated successfully',
            });
        }
        catch (error) {
            console.error('Error processing settlement:', error);
            return this.error(`Settlement failed: ${error.message}`, 500);
        }
    }
    async getTierCommission(vendorId) {
        const result = await (0, rds_connection_1.query)(`
      SELECT t.commission_rate
      FROM vendors v
      JOIN tiers t ON v.tier = t.name
      WHERE v.id = $1
    `, [vendorId]);
        const rows = Array.isArray(result) ? result : result.rows || [];
        return rows[0]?.commission_rate || 15; // Default 15% commission
    }
}
class GetSettlementStatusHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const settlementId = context.event.pathParameters?.settlementId;
        if (!settlementId) {
            return this.error('Settlement ID required', 400);
        }
        const settlements = await (0, rds_connection_1.select)('vendor_settlements', { id: settlementId });
        if (settlements.length === 0) {
            return this.error('Settlement not found', 404);
        }
        const settlement = settlements[0];
        // Get latest status from Razorpay if processing
        if (settlement.status === 'processing' && settlement.razorpay_transfer_id) {
            try {
                const transfer = await razorpayRequest(`/transfers/${settlement.razorpay_transfer_id}`);
                if (transfer.status !== settlement.status) {
                    await (0, rds_connection_1.update)('vendor_settlements', { id: settlementId }, {
                        status: transfer.status === 'processed' ? 'completed' : transfer.status,
                        completed_at: transfer.status === 'processed' ? new Date() : null,
                        updated_at: new Date(),
                    });
                    settlement.status = transfer.status;
                    // Notify vendor on completion
                    if (transfer.status === 'processed') {
                        await (0, aws_clients_1.publishNotification)('vendor', settlement.vendor_id, {
                            title: 'Settlement Completed',
                            body: `₹${settlement.payout_amount} has been credited to your bank account.`,
                            type: 'settlement_completed',
                            data: { settlement_id: settlementId },
                        });
                    }
                }
            }
            catch (error) {
                console.error('Error fetching transfer status:', error);
            }
        }
        return this.success(settlement);
    }
}
class GetVendorSettlementsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const vendorId = context.event.pathParameters?.vendorId;
        const status = context.event.queryStringParameters?.status;
        const limit = parseInt(context.event.queryStringParameters?.limit || '20');
        const offset = parseInt(context.event.queryStringParameters?.offset || '0');
        if (!vendorId) {
            return this.error('Vendor ID required', 400);
        }
        let whereClause = 'vendor_id = $1';
        const params = [vendorId];
        if (status) {
            whereClause += ' AND status = $2';
            params.push(status);
        }
        const settlements = await (0, rds_connection_1.query)(`
      SELECT * FROM vendor_settlements
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `, params);
        const totalResult = await (0, rds_connection_1.query)(`
      SELECT COUNT(*) as count FROM vendor_settlements
      WHERE ${whereClause}
    `, params);
        // Calculate summary
        const summaryResult = await (0, rds_connection_1.query)(`
      SELECT 
        SUM(CASE WHEN status = 'completed' THEN payout_amount ELSE 0 END) as total_settled,
        SUM(CASE WHEN status = 'pending' THEN payout_amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN status = 'processing' THEN payout_amount ELSE 0 END) as processing_amount
      FROM vendor_settlements
      WHERE vendor_id = $1
    `, [vendorId]);
        const totalRows = Array.isArray(totalResult) ? totalResult : totalResult.rows || [];
        const summaryRows = Array.isArray(summaryResult) ? summaryResult : summaryResult.rows || [];
        return this.success({
            settlements,
            total: parseInt(totalRows[0]?.count || '0'),
            summary: {
                total_settled: summaryRows[0]?.total_settled || 0,
                pending_amount: summaryRows[0]?.pending_amount || 0,
                processing_amount: summaryRows[0]?.processing_amount || 0,
            },
        });
    }
}
// ============================================================================
// AUTO SETTLEMENT JOB
// ============================================================================
class AutoSettlementHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        // Get platform settlement frequency
        const settings = await (0, rds_connection_1.select)('platform_settings', { setting_key: 'settlement_frequency_days' });
        const settlementFrequency = parseInt(settings[0]?.setting_value || '7');
        // Get vendors with pending settlements
        const vendorsWithPending = await (0, rds_connection_1.query)(`
      SELECT 
        v.id as vendor_id,
        v.razorpay_account_id,
        v.bank_verified,
        SUM(s.vendor_amount) as pending_amount,
        COUNT(s.booking_id) as booking_count,
        MIN(s.created_at) as oldest_settlement
      FROM vendors v
      JOIN settlements s ON v.id = s.vendor_id
      WHERE s.status = 'pending'
        AND v.razorpay_account_id IS NOT NULL
        AND v.bank_verified = true
        AND s.created_at < NOW() - INTERVAL '${settlementFrequency} days'
      GROUP BY v.id
      HAVING SUM(s.vendor_amount) > 0
    `);
        const results = [];
        const vendorRows = Array.isArray(vendorsWithPending) ? vendorsWithPending : vendorsWithPending.rows || [];
        for (const vendor of vendorRows) {
            try {
                // Queue settlement processing
                await (0, aws_clients_1.sendToSQS)('settlement-queue', {
                    type: 'process_settlement',
                    vendor_id: vendor.vendor_id,
                    amount: vendor.pending_amount,
                });
                results.push({
                    vendor_id: vendor.vendor_id,
                    amount: vendor.pending_amount,
                    status: 'queued',
                });
            }
            catch (error) {
                results.push({
                    vendor_id: vendor.vendor_id,
                    status: 'error',
                    error: error.message,
                });
            }
        }
        return this.success({
            processed: results.length,
            results,
        });
    }
}
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function maskAccountNumber(accountNumber) {
    if (accountNumber.length <= 4)
        return '****';
    return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
}
// ============================================================================
// HONO ROUTER SETUP
// ============================================================================
function registerRazorpaySettlementEndpoints(app) {
    const createAccountHandler = new CreateLinkedAccountHandler();
    const addBankHandler = new AddBankAccountHandler();
    const verifyBankHandler = new VerifyBankAccountHandler();
    const processSettlementHandler = new ProcessSettlementHandler();
    const getSettlementStatusHandler = new GetSettlementStatusHandler();
    const getVendorSettlementsHandler = new GetVendorSettlementsHandler();
    const autoSettlementHandler = new AutoSettlementHandler();
    // Linked account management
    app.post('/razorpay/linked-account/create', async (c) => {
        const event = await createApiGatewayEvent(c);
        const context = createLambdaContext();
        const result = await createAccountHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/razorpay/linked-account/bank', async (c) => {
        const event = await createApiGatewayEvent(c);
        const context = createLambdaContext();
        const result = await addBankHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/razorpay/linked-account/verify-bank', async (c) => {
        const event = await createApiGatewayEvent(c);
        const context = createLambdaContext();
        const result = await verifyBankHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    // Settlement operations
    app.post('/settlements/process', async (c) => {
        const event = await createApiGatewayEvent(c);
        const context = createLambdaContext();
        const result = await processSettlementHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/settlements/:settlementId', async (c) => {
        const event = await createApiGatewayEvent(c);
        event.pathParameters = { settlementId: c.req.param('settlementId') };
        const context = createLambdaContext();
        const result = await getSettlementStatusHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/vendor/:vendorId/settlements', async (c) => {
        const event = await createApiGatewayEvent(c);
        event.pathParameters = { vendorId: c.req.param('vendorId') };
        const context = createLambdaContext();
        const result = await getVendorSettlementsHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    // Auto settlement (cron job)
    app.post('/settlements/auto-process', async (c) => {
        const event = await createApiGatewayEvent(c);
        const context = createLambdaContext();
        const result = await autoSettlementHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
}
async function createApiGatewayEvent(c) {
    const body = await c.req.text().catch(() => '{}');
    return {
        httpMethod: c.req.method,
        path: c.req.url,
        headers: Object.fromEntries(c.req.raw.headers),
        body,
        pathParameters: {},
        queryStringParameters: Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams),
        requestContext: { requestId: crypto_1.default.randomUUID() },
    };
}
function createLambdaContext() {
    return {
        requestId: crypto_1.default.randomUUID(),
        functionName: 'razorpay-settlement-handler',
        functionVersion: '$LATEST',
    };
}
//# sourceMappingURL=razorpay-settlements.js.map