import { Hono } from "hono";
import * as kv from "./kv_store";

/**
 * ========================================================================
 * MISSING CRUD ENDPOINTS
 * ========================================================================
 * This file implements all the missing CRUD endpoints identified in the audit
 * Priority: P0-P2 critical endpoints that have UI buttons but no backend
 * ========================================================================
 */

const app = new Hono();

// ============================================================================
// REGIONS MANAGEMENT
// ============================================================================

/**
 * GET /make-server-3dd53475/admin/regions
 * Get all regions
 */
app.get("/make-server-3dd53475/admin/regions", async (c) => {
  try {
    const regions = await kv.get('regions:list') || [];
    return c.json({ success: true, regions });
  } catch (error) {
    console.error('Error fetching regions:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /make-server-3dd53475/admin/regions
 * Create a new region
 */
app.post("/make-server-3dd53475/admin/regions", async (c) => {
  try {
    const body = await c.req.json();
    const regions = await kv.get('regions:list') || [];
    
    const newRegion = {
      id: `region_${Date.now()}`,
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    regions.push(newRegion);
    await kv.set('regions:list', regions);
    await kv.set(`region:${newRegion.id}`, newRegion);
    
    console.log(`✅ [REGIONS] Created region: ${newRegion.id}`);
    return c.json({ success: true, region: newRegion });
  } catch (error) {
    console.error('Error creating region:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * PUT /make-server-3dd53475/admin/regions/:regionId
 * Update a region
 */
app.put("/make-server-3dd53475/admin/regions/:regionId", async (c) => {
  try {
    const { regionId } = c.req.param();
    const body = await c.req.json();
    
    const existingRegion = await kv.get(`region:${regionId}`);
    if (!existingRegion) {
      return c.json({ error: 'Region not found' }, 404);
    }
    
    const updatedRegion = {
      ...existingRegion,
      ...body,
      id: regionId, // Ensure ID doesn't change
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`region:${regionId}`, updatedRegion);
    
    // Update in list
    const regions = await kv.get('regions:list') || [];
    const updatedRegions = regions.map((r: any) => 
      r.id === regionId ? updatedRegion : r
    );
    await kv.set('regions:list', updatedRegions);
    
    console.log(`✅ [REGIONS] Updated region: ${regionId}`);
    return c.json({ success: true, region: updatedRegion });
  } catch (error) {
    console.error('Error updating region:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * DELETE /make-server-3dd53475/admin/regions/:regionId
 * Delete a region
 */
app.delete("/make-server-3dd53475/admin/regions/:regionId", async (c) => {
  try {
    const { regionId } = c.req.param();
    
    const existingRegion = await kv.get(`region:${regionId}`);
    if (!existingRegion) {
      return c.json({ error: 'Region not found' }, 404);
    }
    
    // Delete from KV
    await kv.del(`region:${regionId}`);
    
    // Remove from list
    const regions = await kv.get('regions:list') || [];
    const filteredRegions = regions.filter((r: any) => r.id !== regionId);
    await kv.set('regions:list', filteredRegions);
    
    console.log(`✅ [REGIONS] Deleted region: ${regionId}`);
    return c.json({ 
      success: true, 
      message: 'Region deleted successfully',
      deletedRegionId: regionId 
    });
  } catch (error) {
    console.error('Error deleting region:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================================================
// ASSET LIBRARY MANAGEMENT
// ============================================================================

/**
 * GET /make-server-3dd53475/admin/assets
 * Get all assets
 */
app.get("/make-server-3dd53475/admin/assets", async (c) => {
  try {
    const assets = await kv.get('assets:library') || [];
    return c.json({ success: true, assets });
  } catch (error) {
    console.error('Error fetching assets:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /make-server-3dd53475/admin/assets
 * Upload a new asset
 */
app.post("/make-server-3dd53475/admin/assets", async (c) => {
  try {
    const body = await c.req.json();
    const assets = await kv.get('assets:library') || [];
    
    const newAsset = {
      id: `asset_${Date.now()}`,
      ...body,
      uploadedAt: new Date().toISOString(),
      uploadedBy: body.uploadedBy || 'admin'
    };
    
    assets.push(newAsset);
    await kv.set('assets:library', assets);
    await kv.set(`asset:${newAsset.id}`, newAsset);
    
    console.log(`✅ [ASSETS] Created asset: ${newAsset.id}`);
    return c.json({ success: true, asset: newAsset });
  } catch (error) {
    console.error('Error creating asset:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * PUT /make-server-3dd53475/admin/assets/:assetId
 * Update asset metadata
 */
app.put("/make-server-3dd53475/admin/assets/:assetId", async (c) => {
  try {
    const { assetId } = c.req.param();
    const body = await c.req.json();
    
    const existingAsset = await kv.get(`asset:${assetId}`);
    if (!existingAsset) {
      return c.json({ error: 'Asset not found' }, 404);
    }
    
    const updatedAsset = {
      ...existingAsset,
      ...body,
      id: assetId,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`asset:${assetId}`, updatedAsset);
    
    // Update in list
    const assets = await kv.get('assets:library') || [];
    const updatedAssets = assets.map((a: any) => 
      a.id === assetId ? updatedAsset : a
    );
    await kv.set('assets:library', updatedAssets);
    
    console.log(`✅ [ASSETS] Updated asset: ${assetId}`);
    return c.json({ success: true, asset: updatedAsset });
  } catch (error) {
    console.error('Error updating asset:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * DELETE /make-server-3dd53475/admin/assets/:assetId
 * Delete an asset
 */
app.delete("/make-server-3dd53475/admin/assets/:assetId", async (c) => {
  try {
    const { assetId } = c.req.param();
    
    const existingAsset = await kv.get(`asset:${assetId}`);
    if (!existingAsset) {
      return c.json({ error: 'Asset not found' }, 404);
    }
    
    // Delete from KV
    await kv.del(`asset:${assetId}`);
    
    // Remove from list
    const assets = await kv.get('assets:library') || [];
    const filteredAssets = assets.filter((a: any) => a.id !== assetId);
    await kv.set('assets:library', filteredAssets);
    
    console.log(`✅ [ASSETS] Deleted asset: ${assetId}`);
    return c.json({ 
      success: true, 
      message: 'Asset deleted successfully',
      deletedAssetId: assetId 
    });
  } catch (error) {
    console.error('Error deleting asset:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================================================
// COMMISSION RULES MANAGEMENT
// ============================================================================

/**
 * GET /make-server-3dd53475/admin/commission/rules
 * Get all commission rules
 */
app.get("/make-server-3dd53475/admin/commission/rules", async (c) => {
  try {
    const rules = await kv.get('commission:rules') || [];
    return c.json({ success: true, rules });
  } catch (error) {
    console.error('Error fetching commission rules:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /make-server-3dd53475/admin/commission/rules
 * Create a new commission rule
 */
app.post("/make-server-3dd53475/admin/commission/rules", async (c) => {
  try {
    const body = await c.req.json();
    const rules = await kv.get('commission:rules') || [];
    
    const newRule = {
      id: `rule_${Date.now()}`,
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      enabled: body.enabled !== undefined ? body.enabled : true
    };
    
    rules.push(newRule);
    await kv.set('commission:rules', rules);
    await kv.set(`commission:rule:${newRule.id}`, newRule);
    
    console.log(`✅ [COMMISSION] Created rule: ${newRule.id}`);
    return c.json({ success: true, rule: newRule });
  } catch (error) {
    console.error('Error creating commission rule:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * PUT /make-server-3dd53475/admin/commission/rules/:ruleId
 * Update a commission rule
 */
app.put("/make-server-3dd53475/admin/commission/rules/:ruleId", async (c) => {
  try {
    const { ruleId } = c.req.param();
    const body = await c.req.json();
    
    const existingRule = await kv.get(`commission:rule:${ruleId}`);
    if (!existingRule) {
      return c.json({ error: 'Commission rule not found' }, 404);
    }
    
    const updatedRule = {
      ...existingRule,
      ...body,
      id: ruleId,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`commission:rule:${ruleId}`, updatedRule);
    
    // Update in list
    const rules = await kv.get('commission:rules') || [];
    const updatedRules = rules.map((r: any) => 
      r.id === ruleId ? updatedRule : r
    );
    await kv.set('commission:rules', updatedRules);
    
    console.log(`✅ [COMMISSION] Updated rule: ${ruleId}`);
    return c.json({ success: true, rule: updatedRule });
  } catch (error) {
    console.error('Error updating commission rule:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * DELETE /make-server-3dd53475/admin/commission/rules/:ruleId
 * Delete a commission rule
 */
app.delete("/make-server-3dd53475/admin/commission/rules/:ruleId", async (c) => {
  try {
    const { ruleId } = c.req.param();
    
    const existingRule = await kv.get(`commission:rule:${ruleId}`);
    if (!existingRule) {
      return c.json({ error: 'Commission rule not found' }, 404);
    }
    
    // Delete from KV
    await kv.del(`commission:rule:${ruleId}`);
    
    // Remove from list
    const rules = await kv.get('commission:rules') || [];
    const filteredRules = rules.filter((r: any) => r.id !== ruleId);
    await kv.set('commission:rules', filteredRules);
    
    console.log(`✅ [COMMISSION] Deleted rule: ${ruleId}`);
    return c.json({ 
      success: true, 
      message: 'Commission rule deleted successfully',
      deletedRuleId: ruleId 
    });
  } catch (error) {
    console.error('Error deleting commission rule:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================================================
// ECOMMERCE PROMOTIONS (Different from Marketing Promotions)
// ============================================================================

/**
 * DELETE /make-server-3dd53475/admin/ecommerce/promotions/:id
 * Delete an ecommerce promotion
 */
app.delete("/make-server-3dd53475/admin/ecommerce/promotions/:id", async (c) => {
  try {
    const { id } = c.req.param();
    
    const existingPromo = await kv.get(`ecommerce:promo:${id}`);
    if (!existingPromo) {
      return c.json({ error: 'Promotion not found' }, 404);
    }
    
    // Delete from KV
    await kv.del(`ecommerce:promo:${id}`);
    
    // Remove from list
    const promos = await kv.get('ecommerce:promotions') || [];
    const filteredPromos = promos.filter((p: any) => p.id !== id);
    await kv.set('ecommerce:promotions', filteredPromos);
    
    console.log(`✅ [ECOMMERCE-PROMOS] Deleted promotion: ${id}`);
    return c.json({ 
      success: true, 
      message: 'Promotion deleted successfully',
      deletedPromotionId: id 
    });
  } catch (error) {
    console.error('Error deleting ecommerce promotion:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================================================
// CATALOG SERVICES (Legacy endpoint compatibility)
// ============================================================================

/**
 * DELETE /make-server-3dd53475/admin/catalog/services/:serviceId
 * Delete a service from catalog (Legacy compatibility)
 */
app.delete("/make-server-3dd53475/admin/catalog/services/:serviceId", async (c) => {
  try {
    const { serviceId } = c.req.param();
    
    // Check if service exists
    const service = await kv.get(`service:${serviceId}`);
    if (!service) {
      return c.json({ error: 'Service not found' }, 404);
    }
    
    // Delete the service
    await kv.del(`service:${serviceId}`);
    
    // Remove from catalog list
    const catalog = await kv.get('service:catalog') || [];
    const filteredCatalog = catalog.filter((s: any) => s.id !== serviceId);
    await kv.set('service:catalog', filteredCatalog);
    
    console.log(`✅ [CATALOG] Deleted service: ${serviceId}`);
    return c.json({ 
      success: true, 
      message: 'Service deleted successfully',
      deletedServiceId: serviceId 
    });
  } catch (error) {
    console.error('Error deleting catalog service:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================================================
// EXPORT
// ============================================================================

export default app;
