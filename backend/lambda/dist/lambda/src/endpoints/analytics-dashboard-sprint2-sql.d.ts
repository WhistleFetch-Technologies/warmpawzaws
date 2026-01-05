/**
 * 📊 ADVANCED ANALYTICS DASHBOARD - SPRINT 2 (SQL-ONLY VERSION)
 * Phase 7E - Sprint 2: Advanced Analytics & Reporting
 * Date: December 15, 2024
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * This file implements comprehensive analytics features:
 * - Real-time analytics dashboard
 * - User behavior tracking
 * - Conversion funnel analysis
 * - Revenue analytics
 * - Service performance metrics
 * - Automated reports
 * - Custom report builder
 *
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL repository calls
 * - All data now comes from SQL tables (bookings, customers, vendors, reviews)
 * - Analytics events stored in `platform_settings` or dedicated analytics table
 *
 * Date: 2025-01-27
 * Migration: Batch 7 - Complete KV to SQL Migration
 */
import { Hono } from 'hono';
export declare function registerAnalyticsDashboardSprint2SQL(app: Hono): void;
//# sourceMappingURL=analytics-dashboard-sprint2-sql.d.ts.map