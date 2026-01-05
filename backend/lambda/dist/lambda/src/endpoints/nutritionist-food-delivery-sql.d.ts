/**
 * ============================================================================
 * NUTRITIONIST FOOD DELIVERY SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 *
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 *
 * Rule 8 Compliance: Hyperlocal Food Delivery for Nutritionists
 *
 * Features:
 * - Meal/Menu Management (for Nutritionists selling food)
 * - Subscription Ordering (Weekly/Monthly)
 * - Hyperlocal Delivery Integration
 * - Real-time Order Tracking
 *
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()` with SQL queries
 * - Uses `products` table for meal items
 * - Uses `orders` and `order_items` tables for meal orders
 * - Uses `deliveries` table for delivery tracking
 *
 * Date: 2025-01-28
 * Migration: Batch 9 - 15 KV operations → 0
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function nutritionistFoodDeliveryEndpointsSQL(app: Hono): void;
//# sourceMappingURL=nutritionist-food-delivery-sql.d.ts.map