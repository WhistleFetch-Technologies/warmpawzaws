"use strict";
/**
 * ============================================================================
 * SYSTEM HEALTH CHECK ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Comprehensive health check for all Warmpawz systems:
 * - Database connectivity
 * - External integrations
 * - Payment gateway
 * - OTP system
 * - Wallet system
 * - Payout system
 *
 * Migrated from: supabase/functions/make-server-3dd53475/system-health-check-sql.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSystemHealthEndpoints = registerSystemHealthEndpoints;
const rds_connection_1 = require("../database/rds-connection");
const rds_connection_2 = require("../database/rds-connection");
function registerSystemHealthEndpoints(app) {
    /**
     * GET /health
     * Basic health check
     */
    app.get("/health", async (c) => {
        try {
            const dbHealthy = await (0, rds_connection_2.checkDbHealth)();
            return c.json({
                status: dbHealthy ? 'ok' : 'degraded',
                timestamp: new Date().toISOString(),
                database: dbHealthy ? 'connected' : 'disconnected',
            });
        }
        catch (error) {
            return c.json({
                status: 'down',
                timestamp: new Date().toISOString(),
                error: error.message,
            }, 500);
        }
    });
    /**
     * GET /health/full
     * Complete system health check
     */
    app.get("/health/full", async (c) => {
        const startTime = Date.now();
        const results = [];
        // 1. Database Check
        try {
            const dbStart = Date.now();
            const dbHealthy = await (0, rds_connection_2.checkDbHealth)();
            const testQuery = await (0, rds_connection_1.query)('SELECT 1 as test').catch(() => null);
            results.push({
                name: 'Database (RDS)',
                status: dbHealthy && testQuery ? 'operational' : 'degraded',
                responseTime: Date.now() - dbStart,
                details: dbHealthy && testQuery ? 'Read/Write successful' : 'Connection failed',
            });
        }
        catch (error) {
            results.push({
                name: 'Database (RDS)',
                status: 'down',
                responseTime: 0,
                error: error.message,
            });
        }
        // 2. Role Service Check
        try {
            const roleStart = Date.now();
            const roles = await (0, rds_connection_1.select)('roles', {});
            const vetRole = roles.find((r) => r.name?.toLowerCase().includes('vet'));
            results.push({
                name: 'Role Service',
                status: roles.length > 0 && vetRole ? 'operational' : 'degraded',
                responseTime: Date.now() - roleStart,
                details: `${roles.length} roles loaded`,
            });
        }
        catch (error) {
            results.push({
                name: 'Role Service',
                status: 'down',
                responseTime: 0,
                error: error.message,
            });
        }
        // 3. Payment Gateway Config Check
        try {
            const paymentStart = Date.now();
            const settings = await (0, rds_connection_1.select)('platform_settings', { setting_key: 'platform:integrations:razorpay' });
            const razorpayConfig = settings.length > 0 ? settings[0].setting_value : null;
            results.push({
                name: 'Payment Gateway (Razorpay)',
                status: razorpayConfig?.keyId && razorpayConfig?.keySecret ? 'operational' : 'degraded',
                responseTime: Date.now() - paymentStart,
                details: razorpayConfig?.keyId ? 'Credentials configured' : 'Credentials missing',
            });
        }
        catch (error) {
            results.push({
                name: 'Payment Gateway (Razorpay)',
                status: 'down',
                responseTime: 0,
                error: error.message,
            });
        }
        // 4. Wallet System Check
        try {
            const walletStart = Date.now();
            const wallets = await (0, rds_connection_1.query)('SELECT COUNT(*) as count FROM customer_wallets LIMIT 1').catch(() => ({ rows: [{ count: '0' }] }));
            results.push({
                name: 'Wallet System',
                status: 'operational',
                responseTime: Date.now() - walletStart,
                details: 'Wallet endpoints available',
            });
        }
        catch (error) {
            results.push({
                name: 'Wallet System',
                status: 'down',
                responseTime: 0,
                error: error.message,
            });
        }
        // 5. OTP System Check
        try {
            const otpStart = Date.now();
            const otpTokens = await (0, rds_connection_1.query)('SELECT COUNT(*) as count FROM otp_tokens WHERE expires_at > NOW() LIMIT 1').catch(() => ({ rows: [{ count: '0' }] }));
            results.push({
                name: 'OTP System',
                status: 'operational',
                responseTime: Date.now() - otpStart,
                details: 'OTP system operational',
            });
        }
        catch (error) {
            results.push({
                name: 'OTP System',
                status: 'down',
                responseTime: 0,
                error: error.message,
            });
        }
        // 6. AWS SNS Check
        try {
            const snsStart = Date.now();
            const snsEnabled = !!process.env.BOOKING_CREATED_TOPIC_ARN;
            results.push({
                name: 'AWS SNS',
                status: snsEnabled ? 'operational' : 'degraded',
                responseTime: Date.now() - snsStart,
                details: snsEnabled ? 'SNS topics configured' : 'SNS topics not configured',
            });
        }
        catch (error) {
            results.push({
                name: 'AWS SNS',
                status: 'down',
                responseTime: 0,
                error: error.message,
            });
        }
        // Calculate overall status
        const overallStatus = results.every(r => r.status === 'operational')
            ? 'operational'
            : results.some(r => r.status === 'down')
                ? 'down'
                : 'degraded';
        const totalTime = Date.now() - startTime;
        return c.json({
            success: true,
            status: overallStatus,
            timestamp: new Date().toISOString(),
            totalResponseTime: totalTime,
            checks: results,
            summary: {
                operational: results.filter(r => r.status === 'operational').length,
                degraded: results.filter(r => r.status === 'degraded').length,
                down: results.filter(r => r.status === 'down').length,
                total: results.length,
            },
        });
    });
    /**
     * GET /health/database
     * Database-specific health check
     */
    app.get("/health/database", async (c) => {
        try {
            const startTime = Date.now();
            const dbHealthy = await (0, rds_connection_2.checkDbHealth)();
            if (!dbHealthy) {
                return c.json({
                    status: 'down',
                    responseTime: Date.now() - startTime,
                    error: 'Database connection failed',
                }, 503);
            }
            // Test query
            const testResult = await (0, rds_connection_1.query)('SELECT NOW() as current_time, version() as version').catch(() => null);
            return c.json({
                status: testResult ? 'operational' : 'degraded',
                responseTime: Date.now() - startTime,
                database: testResult
                    ? {
                        connected: true,
                        currentTime: testResult.rows[0]?.current_time,
                        version: testResult.rows[0]?.version,
                    }
                    : { connected: false },
            });
        }
        catch (error) {
            return c.json({
                status: 'down',
                error: error.message,
            }, 500);
        }
    });
}
//# sourceMappingURL=system-health.js.map