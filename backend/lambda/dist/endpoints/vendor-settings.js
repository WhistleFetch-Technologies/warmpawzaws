"use strict";
/**
 * ============================================================================
 * VENDOR SETTINGS RULES ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles vendor settings rules:
 * - Payment rules
 * - Refund tiers
 * - Booking rules
 * - Schedule settings
 *
 * Migrated from: supabase/functions/make-server-3dd53475/vendor-settings-rules-endpoints-refactored.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerVendorSettingsEndpoints = registerVendorSettingsEndpoints;
const rds_connection_1 = require("../database/rds-connection");
const sns_client_1 = require("../utils/sns-client");
const client_sns_1 = require("@aws-sdk/client-sns");
function registerVendorSettingsEndpoints(app) {
    /**
     * GET /admin/vendor-settings-rules
     * Get all payment rules and refund tiers
     */
    app.get("/admin/vendor-settings-rules", async (c) => {
        try {
            // Get payment rules
            const paymentRulesSettings = await (0, rds_connection_1.select)('platform_settings', { setting_key: 'admin:settings:payment_rules' });
            const paymentRules = paymentRulesSettings.length > 0 ? paymentRulesSettings[0].setting_value : [];
            // Get refund tiers
            const refundTiersSettings = await (0, rds_connection_1.select)('platform_settings', { setting_key: 'admin:settings:refund_tiers' });
            const refundTiers = refundTiersSettings.length > 0 ? refundTiersSettings[0].setting_value : [];
            // Get booking rules
            const bookingRulesSettings = await (0, rds_connection_1.select)('platform_settings', { setting_key: 'admin:settings:booking_rules' });
            const bookingRules = bookingRulesSettings.length > 0 ? bookingRulesSettings[0].setting_value : [];
            return c.json({
                success: true,
                paymentRules,
                refundTiers,
                bookingRules,
            });
        }
        catch (error) {
            console.error('Error fetching vendor settings rules:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /admin/vendor-settings/payment-rules
     * Create a new payment rule
     */
    app.post("/admin/vendor-settings/payment-rules", async (c) => {
        try {
            const rule = await c.req.json();
            if (!rule.id) {
                rule.id = `rule_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            }
            rule.createdAt = rule.createdAt || new Date().toISOString();
            // Get existing rules
            const existingSettings = await (0, rds_connection_1.select)('platform_settings', { setting_key: 'admin:settings:payment_rules' });
            const rules = existingSettings.length > 0 ? existingSettings[0].setting_value : [];
            // Add new rule
            rules.push(rule);
            // Save to platform_settings
            await (0, rds_connection_1.upsert)('platform_settings', {
                setting_key: 'admin:settings:payment_rules',
                setting_value: rules,
                setting_type: 'json',
                description: 'Payment rules configuration',
            }, 'setting_key');
            // Publish SNS event
            const snsClient = (0, sns_client_1.getSnsClient)();
            await snsClient.send(new client_sns_1.PublishCommand({
                TopicArn: process.env.ADMIN_SETTING_UPDATED_TOPIC_ARN,
                Message: JSON.stringify({
                    eventType: 'PaymentRuleCreated',
                    ruleId: rule.id,
                    updatedAt: new Date().toISOString(),
                }),
            })).catch(() => { });
            return c.json({ success: true, rule });
        }
        catch (error) {
            console.error('Error creating payment rule:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * PUT /admin/vendor-settings/payment-rules/:id
     * Update a payment rule
     */
    app.put("/admin/vendor-settings/payment-rules/:id", async (c) => {
        try {
            const { id } = c.req.param();
            const updates = await c.req.json();
            // Get existing rules
            const existingSettings = await (0, rds_connection_1.select)('platform_settings', { setting_key: 'admin:settings:payment_rules' });
            const rules = existingSettings.length > 0 ? existingSettings[0].setting_value : [];
            // Find and update rule
            const ruleIndex = rules.findIndex((r) => r.id === id);
            if (ruleIndex === -1) {
                return c.json({ error: 'Payment rule not found' }, 404);
            }
            rules[ruleIndex] = { ...rules[ruleIndex], ...updates, updatedAt: new Date().toISOString() };
            // Save to platform_settings
            await (0, rds_connection_1.upsert)('platform_settings', {
                setting_key: 'admin:settings:payment_rules',
                setting_value: rules,
                setting_type: 'json',
                description: 'Payment rules configuration',
            }, 'setting_key');
            return c.json({ success: true, rule: rules[ruleIndex] });
        }
        catch (error) {
            console.error('Error updating payment rule:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * DELETE /admin/vendor-settings/payment-rules/:id
     * Delete a payment rule
     */
    app.delete("/admin/vendor-settings/payment-rules/:id", async (c) => {
        try {
            const { id } = c.req.param();
            // Get existing rules
            const existingSettings = await (0, rds_connection_1.select)('platform_settings', { setting_key: 'admin:settings:payment_rules' });
            const rules = existingSettings.length > 0 ? existingSettings[0].setting_value : [];
            // Remove rule
            const filteredRules = rules.filter((r) => r.id !== id);
            // Save to platform_settings
            await (0, rds_connection_1.upsert)('platform_settings', {
                setting_key: 'admin:settings:payment_rules',
                setting_value: filteredRules,
                setting_type: 'json',
                description: 'Payment rules configuration',
            }, 'setting_key');
            return c.json({ success: true, message: 'Payment rule deleted' });
        }
        catch (error) {
            console.error('Error deleting payment rule:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /admin/vendor-settings/refund-tiers
     * Create a new refund tier
     */
    app.post("/admin/vendor-settings/refund-tiers", async (c) => {
        try {
            const tier = await c.req.json();
            if (!tier.id) {
                tier.id = `tier_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            }
            tier.createdAt = tier.createdAt || new Date().toISOString();
            // Get existing tiers
            const existingSettings = await (0, rds_connection_1.select)('platform_settings', { setting_key: 'admin:settings:refund_tiers' });
            const tiers = existingSettings.length > 0 ? existingSettings[0].setting_value : [];
            // Add new tier
            tiers.push(tier);
            // Save to platform_settings
            await (0, rds_connection_1.upsert)('platform_settings', {
                setting_key: 'admin:settings:refund_tiers',
                setting_value: tiers,
                setting_type: 'json',
                description: 'Refund tiers configuration',
            }, 'setting_key');
            return c.json({ success: true, tier });
        }
        catch (error) {
            console.error('Error creating refund tier:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /admin/vendor-settings/booking-rules
     * Create a new booking rule
     */
    app.post("/admin/vendor-settings/booking-rules", async (c) => {
        try {
            const rule = await c.req.json();
            if (!rule.id) {
                rule.id = `booking_rule_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            }
            rule.createdAt = rule.createdAt || new Date().toISOString();
            // Get existing rules
            const existingSettings = await (0, rds_connection_1.select)('platform_settings', { setting_key: 'admin:settings:booking_rules' });
            const rules = existingSettings.length > 0 ? existingSettings[0].setting_value : [];
            // Add new rule
            rules.push(rule);
            // Save to platform_settings
            await (0, rds_connection_1.upsert)('platform_settings', {
                setting_key: 'admin:settings:booking_rules',
                setting_value: rules,
                setting_type: 'json',
                description: 'Booking rules configuration',
            }, 'setting_key');
            return c.json({ success: true, rule });
        }
        catch (error) {
            console.error('Error creating booking rule:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
//# sourceMappingURL=vendor-settings.js.map