"use strict";
/**
 * ============================================================================
 * RAZORPAY CLIENT UTILITY
 * ============================================================================
 *
 * Centralized Razorpay API client
 *
 * Date: 2025-01-28
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRazorpayConfig = getRazorpayConfig;
exports.getRazorpayAuthHeader = getRazorpayAuthHeader;
exports.razorpayRequest = razorpayRequest;
exports.getRazorpayClient = getRazorpayClient;
const rds_connection_1 = require("../database/rds-connection");
/**
 * Get Razorpay configuration from database
 */
async function getRazorpayConfig() {
    const integrations = await (0, rds_connection_1.select)('platform_integrations', {
        integration_name: 'razorpay',
    });
    if (integrations.length === 0 || !integrations[0].integration_config) {
        // Fallback to environment variables
        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!keyId || !keySecret) {
            throw new Error('Razorpay not configured. Please configure in Platform Settings.');
        }
        return {
            keyId,
            keySecret,
            webhookSecret: webhookSecret || '',
        };
    }
    const config = integrations[0].integration_config;
    return {
        keyId: config.keyId,
        keySecret: config.keySecret,
        webhookSecret: config.webhookSecret,
    };
}
/**
 * Get Razorpay authorization header
 */
async function getRazorpayAuthHeader() {
    const config = await getRazorpayConfig();
    const auth = Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64');
    return `Basic ${auth}`;
}
/**
 * Make Razorpay API request
 */
async function razorpayRequest(endpoint, method = 'GET', body) {
    const authHeader = await getRazorpayAuthHeader();
    const url = `https://api.razorpay.com/v1${endpoint}`;
    const response = await fetch(url, {
        method,
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Razorpay API error: ${error?.error?.description || response.statusText || 'Unknown error'}`);
    }
    return response.json();
}
/**
 * Convenience accessor for Razorpay client actions
 */
function getRazorpayClient() {
    const payments = {
        async refund(params) {
            const { payment_id, amount } = params;
            return razorpayRequest(`/payments/${payment_id}/refund`, 'POST', amount ? { amount } : undefined);
        },
    };
    const payouts = {
        async create(body) {
            return razorpayRequest('/payouts', 'POST', body);
        },
    };
    return {
        request: razorpayRequest,
        getConfig: getRazorpayConfig,
        getAuthHeader: getRazorpayAuthHeader,
        payments,
        payouts,
    };
}
//# sourceMappingURL=razorpay-client.js.map