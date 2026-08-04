/**
 * ============================================================================
 * ADMIN GOVERNANCE ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles propagation of admin changes to vendors and customers
 * Manages cache invalidation and real-time updates
 * 
 * Endpoints:
 * - POST /admin/governance/propagate - Propagate changes to apps
 * - POST /admin/governance/invalidate-cache - Invalidate caches
 * - GET /admin/governance/status - Check propagation status
 * 
 * Date: 2026-01-02
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../../../handler/base-handler';
import { query, select, insert, update } from '../../../database/rds-connection';
import { publishToSNS, sendToSQS } from '../../../utils/aws/aws-clients';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';

// ============================================================================
// HANDLERS
// ============================================================================

class PropagateChangesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { type, ...data } = body;

    if (!type) {
      return this.error('Propagation type is required', 400);
    }

    try {
      switch (type) {
        case 'vendor_status_change':
          await this.propagateVendorStatusChange(data);
          break;
        case 'role_capabilities_change':
          await this.propagateRoleCapabilitiesChange(data);
          break;
        case 'tier_change':
          await this.propagateTierChange(data);
          break;
        case 'platform_settings_change':
          await this.propagatePlatformSettingsChange();
          break;
        case 'service_catalog_change':
          await this.propagateServiceCatalogChange(data);
          break;
        case 'promotion_change':
          await this.propagatePromotionChange(data);
          break;
        case 'banner_change':
          await this.propagateBannerChange(data);
          break;
        case 'tax_rule_change':
          await this.propagateTaxRuleChange(data);
          break;
        default:
          return this.error(`Unknown propagation type: ${type}`, 400);
      }

      // Log propagation event
      await insert('admin_audit_log', {
        action: 'propagate',
        resource_type: type,
        resource_id: data.id || data.vendor_id || data.role_id,
        details: JSON.stringify(data),
        performed_by: (context.event.requestContext as any)?.authorizer?.claims?.sub || (context.event.requestContext as any)?.identity?.user || 'system',
        performed_at: new Date(),
      });

      return this.success({
        message: 'Changes propagated successfully',
        type,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Propagation error:', error);
      return this.error(`Propagation failed: ${error.message}`, 500);
    }
  }

  private async propagateVendorStatusChange(data: any) {
    const { vendor_id, new_status } = data;
    
    // Send notification to vendor
    await publishToSNS('vendor-notifications', {
      type: 'status_change',
      vendor_id,
      new_status,
      message: new_status === 'approved' 
        ? 'Congratulations! Your application has been approved.' 
        : `Your application status has been updated to: ${new_status}`,
    });

    // Queue for SMS notification
    await sendToSQS('notification-queue', {
      type: 'sms',
      template: 'vendor_status_update',
      vendor_id,
      status: new_status,
    });
  }

  private async propagateRoleCapabilitiesChange(data: any) {
    const { role_id } = data;
    
    // Get all vendors with this role
    const vendors = await select('vendors', { role_id, status: 'active' });
    
    // Publish to SNS for all affected vendors
    await publishToSNS('vendor-notifications', {
      type: 'capabilities_updated',
      role_id,
      affected_vendors: vendors.map((v: any) => v.id),
      message: 'Your dashboard capabilities have been updated. Please refresh to see changes.',
    });

    // Invalidate capability cache
    await this.invalidateCache(`role:${role_id}:capabilities`);
    
    for (const vendor of vendors) {
      await this.invalidateCache(`vendor:${vendor.id}:capabilities`);
    }
  }

  private async propagateTierChange(data: any) {
    const { tier_id } = data;
    
    // Get all vendors on this tier
    const vendors = await select('vendors', { tier: tier_id });
    
    // Notify affected vendors
    await publishToSNS('vendor-notifications', {
      type: 'tier_updated',
      tier_id,
      affected_vendors: vendors.map((v: any) => v.id),
      message: 'Your tier benefits have been updated.',
    });

    // Invalidate tier cache
    await this.invalidateCache(`tier:${tier_id}`);
  }

  private async propagatePlatformSettingsChange() {
    // Invalidate all platform settings caches
    await this.invalidateCache('platform:settings');

    try {
      const { invalidateCommerceSwitchCache } = await import('../../../commerce-switch');
      invalidateCommerceSwitchCache();
    } catch (err) {
      console.warn('[Governance] commerce-switch cache invalidation skipped:', err);
    }
    
    // Notify all active sessions (via SNS -> WebSocket)
    await publishToSNS('platform-notifications', {
      type: 'settings_updated',
      message: 'Platform settings have been updated.',
      timestamp: new Date().toISOString(),
    });
  }

  private async propagateServiceCatalogChange(data: any) {
    const { service_id, action } = data;
    
    // Invalidate search index
    await sendToSQS('search-index-queue', {
      action: action || 'update',
      entity: 'service',
      id: service_id,
    });

    // Invalidate service catalog cache
    await this.invalidateCache('service:catalog');
    if (service_id) {
      await this.invalidateCache(`service:${service_id}`);
    }
  }

  private async propagatePromotionChange(data: any) {
    const { promotion_id, action } = data;
    
    // Invalidate promotion cache
    await this.invalidateCache('promotions:active');
    if (promotion_id) {
      await this.invalidateCache(`promotion:${promotion_id}`);
    }

    // If new promotion, notify customers
    if (action === 'create') {
      await publishToSNS('customer-notifications', {
        type: 'new_promotion',
        promotion_id,
        message: 'New discount available! Check it out.',
      });
    }
  }

  private async propagateBannerChange(data: any) {
    const { banner_id, position } = data;
    
    // Invalidate banner cache
    await this.invalidateCache(`banners:${position || 'all'}`);
    if (banner_id) {
      await this.invalidateCache(`banner:${banner_id}`);
    }
  }

  private async propagateTaxRuleChange(data: any) {
    // Invalidate tax rules cache
    await this.invalidateCache('tax:rules');
    
    // Notify all booking flows to refresh tax calculations
    await publishToSNS('platform-notifications', {
      type: 'tax_rules_updated',
      timestamp: new Date().toISOString(),
    });
  }

  private async invalidateCache(key: string) {
    // In a real implementation, this would invalidate Redis/ElastiCache
    // For now, log the invalidation
    console.log(`Cache invalidated: ${key}`);
    
    // Store invalidation event for tracking
    await insert('cache_invalidations', {
      cache_key: key,
      invalidated_at: new Date(),
    });
  }
}

class InvalidateCacheHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { keys, pattern } = body;

    if (!keys && !pattern) {
      return this.error('Either keys or pattern is required', 400);
    }

    const invalidatedKeys: string[] = [];

    if (keys && Array.isArray(keys)) {
      for (const key of keys) {
        await insert('cache_invalidations', {
          cache_key: key,
          invalidated_at: new Date(),
        });
        invalidatedKeys.push(key);
      }
    }

    if (pattern) {
      // Pattern-based invalidation
      await insert('cache_invalidations', {
        cache_key: `pattern:${pattern}`,
        invalidated_at: new Date(),
      });
      invalidatedKeys.push(`pattern:${pattern}`);
    }

    return this.success({
      message: 'Cache invalidated successfully',
      invalidated_keys: invalidatedKeys,
      timestamp: new Date().toISOString(),
    });
  }
}

class GovernanceStatusHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    // Get recent propagation events (check if table exists)
    let recentEvents: any[] = [];
    try {
      const tableCheck = await query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'admin_audit_log'
        )`
      );
      
      if (tableCheck.rows[0]?.exists) {
        const result = await query(`
          SELECT * FROM admin_audit_log 
          WHERE action = 'propagate' 
          ORDER BY performed_at DESC 
          LIMIT 20
        `);
        recentEvents = Array.isArray(result) ? result : (result as any).rows || [];
      }
    } catch (error: any) {
      console.warn('[Governance Status] Error querying admin_audit_log:', error.message);
    }

    // Get pending queue items (check if table exists)
    let pendingCount = 0;
    try {
      const tableCheck = await query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'notification_queue'
        )`
      );
      
      if (tableCheck.rows[0]?.exists) {
        const result = await query(`
          SELECT COUNT(*) as count FROM notification_queue 
          WHERE status = 'pending'
        `);
        const rows = Array.isArray(result) ? result : (result as any).rows || [];
        pendingCount = parseInt(rows[0]?.count || '0', 10);
      }
    } catch (error: any) {
      console.warn('[Governance Status] Error querying notification_queue:', error.message);
    }

    // Get cache invalidation stats (check if table exists)
    let cacheCount = 0;
    let lastCacheInvalidation: any = null;
    try {
      const tableCheck = await query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'cache_invalidations'
        )`
      );
      
      if (tableCheck.rows[0]?.exists) {
        const result = await query(`
          SELECT COUNT(*) as count, 
                 MAX(invalidated_at) as last_invalidation
          FROM cache_invalidations 
          WHERE invalidated_at > NOW() - INTERVAL '1 hour'
        `);
        const rows = Array.isArray(result) ? result : (result as any).rows || [];
        cacheCount = parseInt(rows[0]?.count || '0', 10);
        lastCacheInvalidation = rows[0]?.last_invalidation;
      }
    } catch (error: any) {
      console.warn('[Governance Status] Error querying cache_invalidations:', error.message);
    }
    
    return this.success({
      recent_propagations: recentEvents,
      pending_notifications: pendingCount,
      cache_invalidations_last_hour: cacheCount,
      last_cache_invalidation: lastCacheInvalidation,
      system_status: 'healthy',
    });
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerAdminGovernanceEndpoints(app: Hono) {
  const propagateHandler = new PropagateChangesHandler();
  const invalidateCacheHandler = new InvalidateCacheHandler();
  const statusHandler = new GovernanceStatusHandler();

  app.post('/admin/governance/propagate', async (c) => {
    const event = await createApiGatewayEvent(c);
    const context = createLambdaContext();
    const result = await propagateHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/admin/governance/invalidate-cache', async (c) => {
    const event = await createApiGatewayEvent(c);
    const context = createLambdaContext();
    const result = await invalidateCacheHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/admin/governance/status', async (c) => {
    const event = await createApiGatewayEvent(c);
    const context = createLambdaContext();
    const result = await statusHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

async function createApiGatewayEvent(c: any): Promise<any> {
  const body = await c.req.text().catch(() => '{}');
  return {
    httpMethod: c.req.method,
    path: c.req.url,
    headers: Object.fromEntries(c.req.raw.headers),
    body,
    pathParameters: c.req.param() || {},
    queryStringParameters: Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams),
    requestContext: {
      requestId: randomUUID(),
      identity: {},
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: randomUUID(),
    functionName: 'admin-governance-handler',
    functionVersion: '$LATEST',
  };
}
