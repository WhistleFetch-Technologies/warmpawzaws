/**
 * Commerce Switch HTTP endpoints — thin registrar only.
 */
import { Hono } from 'hono';
import {
  getCommerceConfigurationProvider,
  getCommerceResolver,
  getCommerceSwitchContainer,
  getDefaultPublicConfiguration,
} from '../commerce-switch';
import { parseSaveCommerceConfigurationBody } from '../commerce-switch/config/schema';
import { getDefaultCacheProvider } from '../commerce-switch/cache/in-memory-cache-provider';
import { COMMERCE_SWITCH_CONFIG_CACHE_KEY } from '../commerce-switch/cache/cache-keys';

function getAdminActor(c: any): string {
  const claims =
    c.req.raw?.headers?.get('x-admin-email') ||
    (c as any).get?.('adminEmail') ||
    (c as any).get?.('userId');
  return typeof claims === 'string' && claims.trim() ? claims.trim() : 'admin';
}

export function registerCommerceSwitchEndpoints(app: Hono): void {
  app.get('/config/commerce-switch', async (c) => {
    try {
      const publicConfig = await getCommerceResolver().resolvePublicConfiguration();
      c.header('X-Commerce-Config-Version', String(publicConfig.version));
      c.header('Cache-Control', 'no-store');
      return c.json({ success: true, ...publicConfig });
    } catch (error: any) {
      console.error('[CommerceSwitch] public GET failed:', error);
      const fallback = getDefaultPublicConfiguration();
      return c.json({ success: true, ...fallback, degraded: true });
    }
  });

  app.get('/config/commerce-switch/health', async (c) => {
    const cache = getDefaultCacheProvider().get(COMMERCE_SWITCH_CONFIG_CACHE_KEY);
    const version = await getCommerceResolver().getConfigurationVersion();
    return c.json({
      success: true,
      status: 'ok',
      configurationVersion: version,
      cacheAgeMs: cache ? Math.max(0, cache.expiresAt - Date.now()) : null,
    });
  });

  app.get('/admin/commerce-switch/configuration', async (c) => {
    const config = await getCommerceConfigurationProvider().getConfiguration();
    return c.json({ success: true, configuration: config });
  });

  app.put('/admin/commerce-switch/configuration', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const parsed = parseSaveCommerceConfigurationBody(body);
      const current = await getCommerceConfigurationProvider().getConfiguration();
      const saved = await getCommerceConfigurationProvider().saveConfiguration({
        expectedVersion: parsed.expectedVersion,
        updatedBy: getAdminActor(c),
        configuration: {
          schemaVersion: current.schemaVersion,
          activeModelId: parsed.activeModelId,
          availableModels: parsed.availableModels,
          rollout: parsed.rollout ?? current.rollout,
          features: parsed.features ?? current.features,
        },
      });
      return c.json({ success: true, configuration: saved });
    } catch (error: any) {
      if (String(error?.message || '').includes('CONFIG_VERSION_CONFLICT')) {
        return c.json({ success: false, error: error.message }, 409);
      }
      throw error;
    }
  });

  app.get('/admin/commerce-switch/models', async (c) => {
    const models = getCommerceSwitchContainer().registry.list();
    return c.json({ success: true, models });
  });

  app.get('/admin/commerce-switch/status', async (c) => {
    const config = await getCommerceConfigurationProvider().getConfiguration();
    const cache = getDefaultCacheProvider().get(COMMERCE_SWITCH_CONFIG_CACHE_KEY);
    return c.json({
      success: true,
      activeModelId: config.activeModelId,
      version: config.version,
      lastUpdated: config.updatedAt,
      cacheStatus: cache ? 'warm' : 'cold',
    });
  });

  app.post('/admin/commerce-switch/validate', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    parseSaveCommerceConfigurationBody(body);
    return c.json({ success: true, valid: true });
  });
}
