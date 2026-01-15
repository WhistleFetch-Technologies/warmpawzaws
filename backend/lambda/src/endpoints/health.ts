/**
 * ============================================================================
 * HEALTH CHECK ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * System health monitoring:
 * - Database connectivity
 * - External service status
 * - System metrics
 * 
 * Migrated from: supabase/functions/server/system-health-check.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, checkDbHealth } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

export function registerHealthEndpoints(app: Hono) {
  /**
   * GET /health
   * Basic health check
   */
  app.get("/health", async (c) => {
    try {
      const dbHealthy = await checkDbHealth();

      return c.json({
        status: dbHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        database: dbHealthy ? 'connected' : 'disconnected',
      }, dbHealthy ? 200 : 503);
    } catch (error: any) {
      return c.json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      }, 503);
    }
  });

  /**
   * GET /health/full
   * Complete system health check
   */
  app.get("/health/full", async (c) => {
    const startTime = Date.now();
    const results: any[] = [];

    // 1. Database Check
    try {
      const dbStart = Date.now();
      const dbHealthy = await checkDbHealth();
      results.push({
        name: 'Database (RDS)',
        status: dbHealthy ? 'operational' : 'down',
        responseTime: Date.now() - dbStart,
        details: dbHealthy ? 'Connection successful' : 'Connection failed',
      });
    } catch (error: any) {
      results.push({
        name: 'Database (RDS)',
        status: 'down',
        responseTime: 0,
        error: error.message,
      });
    }

    // 2. Payment Gateway Config Check
    try {
      const paymentStart = Date.now();
      const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
      const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

      results.push({
        name: 'Payment Gateway (Razorpay)',
        status: razorpayKeyId && razorpayKeySecret ? 'operational' : 'degraded',
        responseTime: Date.now() - paymentStart,
        details: razorpayKeyId ? 'Credentials configured' : 'Credentials missing',
      });
    } catch (error: any) {
      results.push({
        name: 'Payment Gateway (Razorpay)',
        status: 'down',
        responseTime: 0,
        error: error.message,
      });
    }

    // 3. AWS Services Check
    try {
      const awsStart = Date.now();
      const awsRegion = process.env.AWS_REGION;
      const snsTopicArn = process.env.BOOKING_CREATED_TOPIC_ARN;

      results.push({
        name: 'AWS Services',
        status: awsRegion && snsTopicArn ? 'operational' : 'degraded',
        responseTime: Date.now() - awsStart,
        details: awsRegion ? `Region: ${awsRegion}` : 'AWS configuration missing',
      });
    } catch (error: any) {
      results.push({
        name: 'AWS Services',
        status: 'down',
        responseTime: 0,
        error: error.message,
      });
    }

    // 4. S3 Check
    try {
      const s3Start = Date.now();
      const s3Bucket = process.env.S3_BUCKET_NAME;

      results.push({
        name: 'S3 Storage',
        status: s3Bucket ? 'operational' : 'degraded',
        responseTime: Date.now() - s3Start,
        details: s3Bucket ? `Bucket: ${s3Bucket}` : 'S3 bucket not configured',
      });
    } catch (error: any) {
      results.push({
        name: 'S3 Storage',
        status: 'down',
        responseTime: 0,
        error: error.message,
      });
    }

    const totalTime = Date.now() - startTime;
    const allOperational = results.every(r => r.status === 'operational');
    const anyDown = results.some(r => r.status === 'down');

    const overallStatus = anyDown ? 'degraded' : allOperational ? 'healthy' : 'degraded';

    return c.json({
      success: true,
      status: overallStatus,
      timestamp: new Date().toISOString(),
      totalResponseTime: totalTime,
      checks: results,
      summary: {
        total: results.length,
        operational: results.filter(r => r.status === 'operational').length,
        degraded: results.filter(r => r.status === 'degraded').length,
        down: results.filter(r => r.status === 'down').length,
      },
    }, overallStatus === 'healthy' ? 200 : 503);
  });

  /**
   * GET /health/database
   * Database-specific health check
   */
  app.get("/health/database", async (c) => {
    try {
      const startTime = Date.now();
      const dbHealthy = await checkDbHealth();
      const responseTime = Date.now() - startTime;

      // Get some basic stats
      const stats = await query('SELECT COUNT(*) as count FROM vendors').catch(() => ({ rows: [{ count: '0' }] }));

      return c.json({
        status: dbHealthy ? 'healthy' : 'unhealthy',
        responseTime,
        timestamp: new Date().toISOString(),
        stats: {
          vendors: parseInt(stats.rows[0]?.count || '0', 10),
        },
      }, dbHealthy ? 200 : 503);
    } catch (error: any) {
      return c.json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      }, 503);
    }
  });
}

