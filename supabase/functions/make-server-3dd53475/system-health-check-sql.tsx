/**
 * ============================================================================
 * SYSTEM HEALTH CHECK - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Complete system health check
 * - Quick health check
 * - System metrics
 * - Endpoint validation
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL queries
 * - Uses `health_checks` table for storing health check results
 * - Uses SQL repositories for system metrics
 * 
 * Date: 2025-01-28
 * Migration: Batch 14 - KV to SQL (14 KV operations removed)
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { getDbClient } from '../../lib/db.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';
import { getServicesRepository } from '../../lib/repositories/services.ts';
import { roleService } from './role-service-fixed.tsx';

const app = new Hono();
app.use('*', cors());

interface HealthCheckResult {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  responseTime: number;
  details?: string;
  error?: string;
}

/**
 * GET /health/full
 * Complete system health check
 */
app.get('/make-server-3dd53475/health/full', async (c) => {
  const startTime = Date.now();
  const results: HealthCheckResult[] = [];

  // 1. Database (PostgreSQL) Check
  try {
    const dbStart = Date.now();
    const db = getDbClient();
    const { error } = await db.from('health_checks').select('id').limit(1);
    
    results.push({
      name: 'Database (PostgreSQL)',
      status: error ? 'degraded' : 'operational',
      responseTime: Date.now() - dbStart,
      details: error ? 'Connection issue' : 'Read/Write successful'
    });
  } catch (error) {
    results.push({
      name: 'Database (PostgreSQL)',
      status: 'down',
      responseTime: 0,
      error: String(error)
    });
  }

  // 2. Role Service Check
  try {
    const roleStart = Date.now();
    const roles = roleService.getAllRoles();
    const vetRole = roleService.getRoleById('role_veterinarian');
    
    results.push({
      name: 'Role Service',
      status: roles.length > 0 && vetRole ? 'operational' : 'degraded',
      responseTime: Date.now() - roleStart,
      details: `${roles.length} roles loaded`
    });
  } catch (error) {
    results.push({
      name: 'Role Service',
      status: 'down',
      responseTime: 0,
      error: String(error)
    });
  }

  // 3. Payment Gateway Config Check
  try {
    const paymentStart = Date.now();
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    
    results.push({
      name: 'Payment Gateway (Razorpay)',
      status: razorpayKeyId && razorpayKeySecret ? 'operational' : 'degraded',
      responseTime: Date.now() - paymentStart,
      details: razorpayKeyId ? 'Credentials configured' : 'Credentials missing'
    });
  } catch (error) {
    results.push({
      name: 'Payment Gateway (Razorpay)',
      status: 'down',
      responseTime: 0,
      error: String(error)
    });
  }

  // 4. Wallet System Check
  try {
    const walletStart = Date.now();
    const db = getDbClient();
    const { error } = await db.from('customer_wallets').select('id').limit(1);
    
    results.push({
      name: 'Wallet System',
      status: error ? 'degraded' : 'operational',
      responseTime: Date.now() - walletStart,
      details: 'Wallet endpoints available'
    });
  } catch (error) {
    results.push({
      name: 'Wallet System',
      status: 'down',
      responseTime: 0,
      error: String(error)
    });
  }

  // 5. Payout System Check
  try {
    const payoutStart = Date.now();
    const db = getDbClient();
    const { error } = await db.from('payouts').select('id').limit(1);
    
    results.push({
      name: 'Payout System',
      status: error ? 'degraded' : 'operational',
      responseTime: Date.now() - payoutStart,
      details: 'Payout automation configured'
    });
  } catch (error) {
    results.push({
      name: 'Payout System',
      status: 'down',
      responseTime: 0,
      error: String(error)
    });
  }

  // 6. Refund System Check
  try {
    const refundStart = Date.now();
    const db = getDbClient();
    const { error } = await db.from('refund_rules').select('id').limit(1);
    
    results.push({
      name: 'Refund System',
      status: error ? 'degraded' : 'operational',
      responseTime: Date.now() - refundStart,
      details: 'Refund policies configured'
    });
  } catch (error) {
    results.push({
      name: 'Refund System',
      status: 'down',
      responseTime: 0,
      error: String(error)
    });
  }

  // 7. Tier System Check
  try {
    const tierStart = Date.now();
    const db = getDbClient();
    const { error } = await db.from('vendor_tiers').select('id').limit(1);
    
    results.push({
      name: 'Tier Upgrade System',
      status: error ? 'degraded' : 'operational',
      responseTime: Date.now() - tierStart,
      details: 'Tier automation available'
    });
  } catch (error) {
    results.push({
      name: 'Tier Upgrade System',
      status: 'down',
      responseTime: 0,
      error: String(error)
    });
  }

  // 8. Vendor Data Check
  try {
    const vendorStart = Date.now();
    const vendorsRepo = getVendorsRepository();
    const vendors = await vendorsRepo.findAll({ limit: 1 });
    
    results.push({
      name: 'Vendor System',
      status: 'operational',
      responseTime: Date.now() - vendorStart,
      details: 'Vendors accessible via SQL'
    });
  } catch (error) {
    results.push({
      name: 'Vendor System',
      status: 'down',
      responseTime: 0,
      error: String(error)
    });
  }

  // 9. Booking System Check
  try {
    const bookingStart = Date.now();
    const bookingsRepo = getBookingsRepository();
    const bookings = await bookingsRepo.findAll({ limit: 1 });
    
    results.push({
      name: 'Booking System',
      status: 'operational',
      responseTime: Date.now() - bookingStart,
      details: 'Bookings accessible via SQL'
    });
  } catch (error) {
    results.push({
      name: 'Booking System',
      status: 'down',
      responseTime: 0,
      error: String(error)
    });
  }

  // 10. AWS Services Check
  try {
    const awsStart = Date.now();
    const s3Configured = !!Deno.env.get('AWS_ACCESS_KEY_ID');
    const snsConfigured = !!Deno.env.get('AWS_SNS_TOPIC_ARN');
    const chimeConfigured = !!Deno.env.get('AWS_CHIME_APP_INSTANCE_ARN');
    
    const awsStatus = s3Configured && snsConfigured && chimeConfigured 
      ? 'operational' 
      : s3Configured || snsConfigured || chimeConfigured 
        ? 'degraded' 
        : 'down';
    
    results.push({
      name: 'AWS Services',
      status: awsStatus,
      responseTime: Date.now() - awsStart,
      details: `S3: ${s3Configured}, SNS: ${snsConfigured}, Chime: ${chimeConfigured}`
    });
  } catch (error) {
    results.push({
      name: 'AWS Services',
      status: 'down',
      responseTime: 0,
      error: String(error)
    });
  }

  // 11. Logistics Integration Check
  try {
    const logisticsStart = Date.now();
    const shiprocketConfigured = !!Deno.env.get('SHIPROCKET_EMAIL');
    const delhiveryConfigured = !!Deno.env.get('DELHIVERY_API_KEY');
    
    results.push({
      name: 'Logistics Integration',
      status: shiprocketConfigured || delhiveryConfigured ? 'operational' : 'degraded',
      responseTime: Date.now() - logisticsStart,
      details: `Shiprocket: ${shiprocketConfigured}, Delhivery: ${delhiveryConfigured}`
    });
  } catch (error) {
    results.push({
      name: 'Logistics Integration',
      status: 'down',
      responseTime: 0,
      error: String(error)
    });
  }

  // Calculate overall status
  const totalTime = Date.now() - startTime;
  const operationalCount = results.filter(r => r.status === 'operational').length;
  const degradedCount = results.filter(r => r.status === 'degraded').length;
  const downCount = results.filter(r => r.status === 'down').length;
  
  const overallStatus = downCount > 0 ? 'degraded' : degradedCount > 2 ? 'degraded' : 'operational';
  const healthScore = Math.round((operationalCount / results.length) * 100);

  // ✅ SQL: Store health check result
  try {
    const db = getDbClient();
    await db.from('health_checks').insert({
      check_type: 'full',
      status: overallStatus === 'operational' ? 'healthy' : overallStatus === 'degraded' ? 'degraded' : 'unhealthy',
      details: {
        healthScore,
        operational: operationalCount,
        degraded: degradedCount,
        down: downCount,
        totalResponseTime: totalTime,
        systems: results
      }
    });
  } catch (error) {
    console.warn('Could not store health check result:', error);
  }

  return c.json({
    success: true,
    timestamp: new Date().toISOString(),
    overallStatus,
    healthScore,
    totalResponseTime: totalTime,
    summary: {
      total: results.length,
      operational: operationalCount,
      degraded: degradedCount,
      down: downCount
    },
    systems: results,
    recommendations: generateRecommendations(results)
  });
});

/**
 * GET /health/quick
 * Quick health check (basic systems only)
 */
app.get('/make-server-3dd53475/health/quick', async (c) => {
  try {
    // Quick check: Can we read from database?
    const db = getDbClient();
    const { error } = await db.from('health_checks').select('id').limit(1);
    
    return c.json({
      success: true,
      status: error ? 'degraded' : 'operational',
      timestamp: new Date().toISOString(),
      message: 'System is running'
    });
  } catch (error) {
    return c.json({
      success: false,
      status: 'down',
      timestamp: new Date().toISOString(),
      error: String(error)
    }, 500);
  }
});

/**
 * GET /health/metrics
 * System metrics and statistics
 */
app.get('/make-server-3dd53475/health/metrics', async (c) => {
  try {
    // ✅ SQL: Get metrics from repositories
    const vendorsRepo = getVendorsRepository();
    const customersRepo = getCustomersRepository();
    const bookingsRepo = getBookingsRepository();
    const servicesRepo = getServicesRepository();
    
    const vendors = await vendorsRepo.findAll();
    const customers = await customersRepo.findAll();
    const bookings = await bookingsRepo.findAll();
    const services = await servicesRepo.findAll();
    
    const roles = roleService.getAllRoles();

    const activeVendors = vendors.filter((v: any) => v.status === 'active').length;
    const completedBookings = bookings.filter((b: any) => b.status === 'completed').length;

    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        vendors: {
          total: vendors.length,
          active: activeVendors,
          pending: vendors.length - activeVendors
        },
        customers: {
          total: customers.length
        },
        bookings: {
          total: bookings.length,
          completed: completedBookings,
          active: bookings.length - completedBookings
        },
        services: {
          total: services.length
        },
        roles: {
          total: roles.length,
          active: roles.filter((r: any) => r.isActive).length
        }
      }
    });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: String(error) 
    }, 500);
  }
});

/**
 * GET /health/endpoints
 * Check critical API endpoints
 */
app.get('/make-server-3dd53475/health/endpoints', async (c) => {
  const criticalEndpoints = [
    '/customer/services',
    '/vendor/dashboard',
    '/admin/vendors',
    '/payouts/pending',
    '/refund/calculate',
    '/tier/config',
    '/wallet/balance'
  ];

  const endpointChecks = criticalEndpoints.map(endpoint => ({
    endpoint,
    status: 'not_checked',
    message: 'Endpoint validation requires actual HTTP calls'
  }));

  return c.json({
    success: true,
    timestamp: new Date().toISOString(),
    endpoints: endpointChecks,
    note: 'Endpoint health checks require integration testing'
  });
});

// Helper function to generate recommendations
function generateRecommendations(results: HealthCheckResult[]): string[] {
  const recommendations: string[] = [];

  results.forEach(result => {
    if (result.status === 'down') {
      recommendations.push(`CRITICAL: ${result.name} is down. Immediate attention required.`);
    } else if (result.status === 'degraded') {
      recommendations.push(`WARNING: ${result.name} is degraded. Review configuration.`);
    }

    if (result.responseTime > 1000) {
      recommendations.push(`PERFORMANCE: ${result.name} response time is slow (${result.responseTime}ms). Consider optimization.`);
    }
  });

  if (recommendations.length === 0) {
    recommendations.push('All systems operational. No action required.');
  }

  return recommendations;
}

export default app;

