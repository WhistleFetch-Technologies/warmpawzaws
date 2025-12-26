import { Hono } from "npm:hono";
import { getDbClient } from "../../lib/db.ts";
import { getRegionsRepository } from "../../lib/repositories/regions.ts";
import { getServicesRepository } from "../../lib/repositories/services.ts";
import { getPromotionsRepository } from "../../lib/repositories/promotions.ts";

/**
 * ========================================================================
 * MISSING CRUD ENDPOINTS - SQL VERSION
 * ========================================================================
 * This file implements all the missing CRUD endpoints identified in the audit
 * Priority: P0-P2 critical endpoints that have UI buttons but no backend
 * 
 * ✅ SQL-ONLY VERSION
 * ❌ NO KV operations
 * ========================================================================
 */

const app = new Hono();
const client = getDbClient();

// Helper function to get/set platform settings
async function getPlatformSetting(key: string): Promise<any> {
  const { data, error } = await client
    .from('platform_settings')
    .select('setting_value')
    .eq('setting_key', key)
    .maybeSingle();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    throw error;
  }
  
  return data?.setting_value || null;
}

async function setPlatformSetting(key: string, value: any, description?: string): Promise<void> {
  const { error } = await client
    .from('platform_settings')
    .upsert({
      setting_key: key,
      setting_value: value,
      setting_type: 'object',
      description: description || `Setting for ${key}`,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'setting_key'
    });
  
  if (error) {
    throw error;
  }
}

// ============================================================================
// REGIONS MANAGEMENT
// ============================================================================

/**
 * GET /make-server-3dd53475/admin/regions
 * Get all regions
 */
app.get("/make-server-3dd53475/admin/regions", async (c) => {
  try {
    const regionsRepo = getRegionsRepository();
    const regions = await regionsRepo.findAll();
    
    // Map to response format (convert snake_case to camelCase for backward compatibility)
    const mappedRegions = regions.map(r => ({
      id: r.code || r.id, // Use code as id for backward compatibility
      name: r.name,
      code: r.code,
      country: r.country,
      region_config: r.region_config,
      is_active: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
    
    return c.json({ success: true, regions: mappedRegions });
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
    const regionsRepo = getRegionsRepository();
    
    // Map from request format to repository format
    const regionData = {
      name: body.name,
      code: body.code || body.id || `region_${Date.now()}`,
      country: body.country || 'India',
      region_config: body.region_config || body.regionConfig || {},
      is_active: body.is_active !== false,
    };
    
    const newRegion = await regionsRepo.create(regionData);
    
    console.log(`✅ [REGIONS] Created region: ${newRegion.code}`);
    return c.json({ 
      success: true, 
      region: {
        id: newRegion.code,
        name: newRegion.name,
        code: newRegion.code,
        country: newRegion.country,
        region_config: newRegion.region_config,
        is_active: newRegion.is_active,
        createdAt: newRegion.created_at,
        updatedAt: newRegion.updated_at
      }
    });
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
    const regionsRepo = getRegionsRepository();
    
    // Find region by code (regionId is typically the code)
    const existingRegion = await regionsRepo.findByCode(regionId);
    if (!existingRegion) {
      return c.json({ error: 'Region not found' }, 404);
    }
    
    // Map updates
    const updates: any = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.country !== undefined) updates.country = body.country;
    if (body.region_config !== undefined || body.regionConfig !== undefined) {
      updates.region_config = body.region_config || body.regionConfig;
    }
    if (body.is_active !== undefined) updates.is_active = body.is_active;
    
    const updatedRegion = await regionsRepo.update(regionId, updates);
    
    console.log(`✅ [REGIONS] Updated region: ${regionId}`);
    return c.json({ 
      success: true, 
      region: {
        id: updatedRegion.code,
        name: updatedRegion.name,
        code: updatedRegion.code,
        country: updatedRegion.country,
        region_config: updatedRegion.region_config,
        is_active: updatedRegion.is_active,
        createdAt: updatedRegion.created_at,
        updatedAt: updatedRegion.updated_at
      }
    });
  } catch (error) {
    console.error('Error updating region:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * DELETE /make-server-3dd53475/admin/regions/:regionId
 * Delete a region (soft delete by deactivating)
 */
app.delete("/make-server-3dd53475/admin/regions/:regionId", async (c) => {
  try {
    const { regionId } = c.req.param();
    const regionsRepo = getRegionsRepository();
    
    const existingRegion = await regionsRepo.findByCode(regionId);
    if (!existingRegion) {
      return c.json({ error: 'Region not found' }, 404);
    }
    
    // Soft delete by deactivating
    await regionsRepo.setActive(regionId, false);
    
    console.log(`✅ [REGIONS] Deleted (deactivated) region: ${regionId}`);
    return c.json({ 
      success: true, 
      message: 'Region deactivated successfully',
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
    // ✅ SQL: Get assets from platform_settings
    const assets = await getPlatformSetting('asset_library') || [];
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
    
    // ✅ SQL: Get existing assets
    const assets = await getPlatformSetting('asset_library') || [];
    
    const newAsset = {
      id: `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...body,
      uploadedAt: new Date().toISOString(),
      uploadedBy: body.uploadedBy || 'admin'
    };
    
    assets.push(newAsset);
    
    // ✅ SQL: Save updated assets list
    await setPlatformSetting('asset_library', assets, 'Asset library collection');
    
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
    
    // ✅ SQL: Get existing assets
    const assets = await getPlatformSetting('asset_library') || [];
    
    const assetIndex = assets.findIndex((a: any) => a.id === assetId);
    if (assetIndex === -1) {
      return c.json({ error: 'Asset not found' }, 404);
    }
    
    const updatedAsset = {
      ...assets[assetIndex],
      ...body,
      id: assetId, // Ensure ID doesn't change
      updatedAt: new Date().toISOString()
    };
    
    assets[assetIndex] = updatedAsset;
    
    // ✅ SQL: Save updated assets list
    await setPlatformSetting('asset_library', assets, 'Asset library collection');
    
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
    
    // ✅ SQL: Get existing assets
    const assets = await getPlatformSetting('asset_library') || [];
    
    const assetIndex = assets.findIndex((a: any) => a.id === assetId);
    if (assetIndex === -1) {
      return c.json({ error: 'Asset not found' }, 404);
    }
    
    // Remove asset from list
    const filteredAssets = assets.filter((a: any) => a.id !== assetId);
    
    // ✅ SQL: Save updated assets list
    await setPlatformSetting('asset_library', filteredAssets, 'Asset library collection');
    
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
    // ✅ SQL: Get commission rules from platform_settings
    const rules = await getPlatformSetting('commission_rules') || [];
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
    
    // ✅ SQL: Get existing rules
    const rules = await getPlatformSetting('commission_rules') || [];
    
    const newRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      enabled: body.enabled !== undefined ? body.enabled : true
    };
    
    rules.push(newRule);
    
    // ✅ SQL: Save updated rules list
    await setPlatformSetting('commission_rules', rules, 'Platform commission rules');
    
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
    
    // ✅ SQL: Get existing rules
    const rules = await getPlatformSetting('commission_rules') || [];
    
    const ruleIndex = rules.findIndex((r: any) => r.id === ruleId);
    if (ruleIndex === -1) {
      return c.json({ error: 'Commission rule not found' }, 404);
    }
    
    const updatedRule = {
      ...rules[ruleIndex],
      ...body,
      id: ruleId, // Ensure ID doesn't change
      updatedAt: new Date().toISOString()
    };
    
    rules[ruleIndex] = updatedRule;
    
    // ✅ SQL: Save updated rules list
    await setPlatformSetting('commission_rules', rules, 'Platform commission rules');
    
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
    
    // ✅ SQL: Get existing rules
    const rules = await getPlatformSetting('commission_rules') || [];
    
    const ruleIndex = rules.findIndex((r: any) => r.id === ruleId);
    if (ruleIndex === -1) {
      return c.json({ error: 'Commission rule not found' }, 404);
    }
    
    // Remove rule from list
    const filteredRules = rules.filter((r: any) => r.id !== ruleId);
    
    // ✅ SQL: Save updated rules list
    await setPlatformSetting('commission_rules', filteredRules, 'Platform commission rules');
    
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
    
    // ✅ SQL: Use PromotionsRepository to delete promotion
    const promotionsRepo = getPromotionsRepository();
    
    // Check if promotion exists
    const existingPromo = await promotionsRepo.findById(id);
    if (!existingPromo) {
      return c.json({ error: 'Promotion not found' }, 404);
    }
    
    // Soft delete by deactivating
    await promotionsRepo.delete(id);
    
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
    
    // ✅ SQL: Use ServicesRepository to delete service
    const servicesRepo = getServicesRepository();
    
    // Check if service exists
    const service = await servicesRepo.findById(serviceId);
    if (!service) {
      return c.json({ error: 'Service not found' }, 404);
    }
    
    // Soft delete by deactivating
    await servicesRepo.delete(serviceId);
    
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

