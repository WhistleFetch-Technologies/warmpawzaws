/**
 * ============================================================================
 * TIER UPGRADE AUTOMATION SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 *
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 *
 * Features:
 * - Automatic tier evaluation based on metrics
 * - Scheduled background processing
 * - Tier upgrade/downgrade logic
 * - Notification system for tier changes
 * - Audit trail for all tier changes
 *
 * Tier Criteria:
 * - Bronze → Silver: 10+ bookings, 4.0+ rating, ₹10,000+ revenue
 * - Silver → Gold: 50+ bookings, 4.5+ rating, ₹50,000+ revenue
 * - Gold → Platinum: 200+ bookings, 4.8+ rating, ₹200,000+ revenue
 *
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL queries
 * - Uses `vendor_tiers` table for tier configuration
 * - Uses `vendor_tier_subscriptions` table for vendor tier assignments
 * - Uses `bookings` table for metrics calculation
 * - Uses `reviews` table for rating calculation
 * - Uses `vendor_earnings` table for revenue calculation
 * - Uses `notifications` table for tier change notifications
 * - Stores audit trail in `platform_settings` JSONB
 *
 * Date: 2025-01-28
 * Migration: Batch 13 - KV to SQL (14 KV operations removed)
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function tierUpgradeAutomationSQL(mainApp: Hono): void;
export default tierUpgradeAutomationSQL;
//# sourceMappingURL=tier-upgrade-automation-sql.d.ts.map