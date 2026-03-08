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
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, checkDbHealth } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { promises as dns } from 'dns';

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

  /**
   * GET /health/diagnostic
   * Diagnostic endpoint for connection troubleshooting
   * Tests DNS resolution, network connectivity, and database connection
   */
  app.get("/health/diagnostic", async (c) => {
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      environment: {
        dbHost: process.env.DB_HOST,
        dbPort: process.env.DB_PORT,
        dbName: process.env.DB_NAME,
        awsRegion: process.env.AWS_REGION,
        vpcId: process.env.VPC_ID || 'not set',
      },
      tests: [],
    };

    // Test 1: DNS Resolution
    const dbHost = process.env.DB_HOST;
    if (dbHost) {
      try {
        const dnsStart = Date.now();
        const addresses = await Promise.race([
          dns.resolve4(dbHost),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('DNS resolution timeout after 5s')), 5000);
          })
        ]);
        const dnsDuration = Date.now() - dnsStart;
        diagnostics.tests.push({
          name: 'DNS Resolution',
          status: 'success',
          duration: dnsDuration,
          details: {
            hostname: dbHost,
            resolvedAddresses: addresses,
            count: addresses.length,
          },
        });
      } catch (error: any) {
        diagnostics.tests.push({
          name: 'DNS Resolution',
          status: 'failed',
          error: error.message,
          errorCode: error.code,
          details: {
            hostname: dbHost,
          },
        });
      }
    } else {
      diagnostics.tests.push({
        name: 'DNS Resolution',
        status: 'skipped',
        reason: 'DB_HOST not set',
      });
    }

    // Test 2: Database Connection
    try {
      const dbStart = Date.now();
      const dbHealthy = await Promise.race([
        checkDbHealth(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Database health check timeout after 10s')), 10000);
        })
      ]);
      const dbDuration = Date.now() - dbStart;
      diagnostics.tests.push({
        name: 'Database Connection',
        status: dbHealthy ? 'success' : 'failed',
        duration: dbDuration,
        details: {
          connected: dbHealthy,
        },
      });
    } catch (error: any) {
      diagnostics.tests.push({
        name: 'Database Connection',
        status: 'failed',
        duration: Date.now() - (diagnostics.tests.find((t: any) => t.name === 'Database Connection')?.startTime || Date.now()),
        error: error.message,
        errorCode: error.code,
        details: {
          errorType: error.constructor.name,
        },
      });
    }

    // Test 3: Secrets Manager Access
    try {
      const secretsStart = Date.now();
      const secretArn = process.env.DB_SECRET_ARN;
      if (secretArn) {
        diagnostics.tests.push({
          name: 'Secrets Manager',
          status: 'configured',
          duration: Date.now() - secretsStart,
          details: {
            secretArn: secretArn.substring(0, 50) + '...', // Partial ARN for security
          },
        });
      } else {
        diagnostics.tests.push({
          name: 'Secrets Manager',
          status: 'not_configured',
          details: {
            reason: 'DB_SECRET_ARN not set',
          },
        });
      }
    } catch (error: any) {
      diagnostics.tests.push({
        name: 'Secrets Manager',
        status: 'error',
        error: error.message,
      });
    }

    // Summary
    const allPassed = diagnostics.tests.every((t: any) => t.status === 'success' || t.status === 'configured');
    const anyFailed = diagnostics.tests.some((t: any) => t.status === 'failed');

    diagnostics.summary = {
      overall: anyFailed ? 'failed' : allPassed ? 'success' : 'partial',
      totalTests: diagnostics.tests.length,
      passed: diagnostics.tests.filter((t: any) => t.status === 'success' || t.status === 'configured').length,
      failed: diagnostics.tests.filter((t: any) => t.status === 'failed').length,
    };

    return c.json(diagnostics, anyFailed ? 503 : 200);
  });
}

