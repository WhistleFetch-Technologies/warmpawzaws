/**
 * GST CONFIGURATION ENDPOINTS
 * Handles HSN codes, tax categories, and regional GST settings
 */

import { Hono } from 'hono';
import * as kv from './kv_store';
import { sendSuccess, sendError } from './response-utils';

export function gstConfigurationEndpoints(app: Hono) {
  const BASE_PATH = '/make-server-3dd53475';

  // ============================================
  // GST CONFIGURATION (Regional Settings)
  // ============================================

  /**
   * GET /admin/finance/gst-config
   * Get all GST configurations
   */
  app.get(`${BASE_PATH}/admin/finance/gst-config`, async (c) => {
    try {
      const configs = await kv.get('platform:gst_configs') || [];
      return sendSuccess(c, { configs });
    } catch (error) {
      console.error('Error fetching GST configs:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/finance/gst-config
   * Create new GST configuration
   */
  app.post(`${BASE_PATH}/admin/finance/gst-config`, async (c) => {
    try {
      const configData = await c.req.json();
      const config = {
        id: `gst_config_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        ...configData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const configs = await kv.get('platform:gst_configs') || [];
      configs.push(config);
      await kv.set('platform:gst_configs', configs);

      return sendSuccess(c, { config });
    } catch (error) {
      console.error('Error creating GST config:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /admin/finance/gst-config/:configId
   * Update GST configuration
   */
  app.put(`${BASE_PATH}/admin/finance/gst-config/:configId`, async (c) => {
    try {
      const { configId } = c.req.param();
      const updates = await c.req.json();

      const configs = await kv.get('platform:gst_configs') || [];
      const index = configs.findIndex((c: any) => c.id === configId);

      if (index === -1) {
        return sendError(c, 'GST config not found', 404);
      }

      configs[index] = {
        ...configs[index],
        ...updates,
        id: configId,
        updatedAt: new Date().toISOString()
      };

      await kv.set('platform:gst_configs', configs);
      return sendSuccess(c, { config: configs[index] });
    } catch (error) {
      console.error('Error updating GST config:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /admin/finance/gst-config/:configId
   * Delete GST configuration
   */
  app.delete(`${BASE_PATH}/admin/finance/gst-config/:configId`, async (c) => {
    try {
      const { configId } = c.req.param();
      const configs = await kv.get('platform:gst_configs') || [];
      const filtered = configs.filter((c: any) => c.id !== configId);
      await kv.set('platform:gst_configs', filtered);
      return sendSuccess(c, { success: true });
    } catch (error) {
      console.error('Error deleting GST config:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // HSN CODES
  // ============================================

  /**
   * GET /admin/finance/gst/hsn-codes
   * Get all HSN codes
   */
  app.get(`${BASE_PATH}/admin/finance/gst/hsn-codes`, async (c) => {
    try {
      const hsnCodes = await kv.get('platform:hsn_codes') || [];
      return sendSuccess(c, { hsnCodes });
    } catch (error) {
      console.error('Error fetching HSN codes:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/finance/gst/hsn-codes
   * Create new HSN code
   */
  app.post(`${BASE_PATH}/admin/finance/gst/hsn-codes`, async (c) => {
    try {
      const hsnData = await c.req.json();
      const hsnCode = {
        id: `hsn_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        ...hsnData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const hsnCodes = await kv.get('platform:hsn_codes') || [];
      hsnCodes.push(hsnCode);
      await kv.set('platform:hsn_codes', hsnCodes);

      return sendSuccess(c, { hsnCode });
    } catch (error) {
      console.error('Error creating HSN code:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /admin/finance/gst/hsn-codes/:hsnId
   * Update HSN code
   */
  app.put(`${BASE_PATH}/admin/finance/gst/hsn-codes/:hsnId`, async (c) => {
    try {
      const { hsnId } = c.req.param();
      const updates = await c.req.json();

      const hsnCodes = await kv.get('platform:hsn_codes') || [];
      const index = hsnCodes.findIndex((h: any) => h.id === hsnId);

      if (index === -1) {
        return sendError(c, 'HSN code not found', 404);
      }

      hsnCodes[index] = {
        ...hsnCodes[index],
        ...updates,
        id: hsnId,
        updatedAt: new Date().toISOString()
      };

      await kv.set('platform:hsn_codes', hsnCodes);
      return sendSuccess(c, { hsnCode: hsnCodes[index] });
    } catch (error) {
      console.error('Error updating HSN code:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /admin/finance/gst/hsn-codes/:hsnId
   * Delete HSN code
   */
  app.delete(`${BASE_PATH}/admin/finance/gst/hsn-codes/:hsnId`, async (c) => {
    try {
      const { hsnId } = c.req.param();
      const hsnCodes = await kv.get('platform:hsn_codes') || [];
      const filtered = hsnCodes.filter((h: any) => h.id !== hsnId);
      await kv.set('platform:hsn_codes', filtered);
      return sendSuccess(c, { success: true });
    } catch (error) {
      console.error('Error deleting HSN code:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // TAX CATEGORIES
  // ============================================

  /**
   * GET /admin/finance/gst/tax-categories
   * Get all tax categories
   */
  app.get(`${BASE_PATH}/admin/finance/gst/tax-categories`, async (c) => {
    try {
      const categories = await kv.get('platform:tax_categories') || [];
      return sendSuccess(c, { categories });
    } catch (error) {
      console.error('Error fetching tax categories:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/finance/gst/tax-categories
   * Create new tax category
   */
  app.post(`${BASE_PATH}/admin/finance/gst/tax-categories`, async (c) => {
    try {
      const categoryData = await c.req.json();
      const category = {
        id: `tax_cat_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        ...categoryData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const categories = await kv.get('platform:tax_categories') || [];
      categories.push(category);
      await kv.set('platform:tax_categories', categories);

      return sendSuccess(c, { category });
    } catch (error) {
      console.error('Error creating tax category:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /admin/finance/gst/tax-categories/:categoryId
   * Update tax category
   */
  app.put(`${BASE_PATH}/admin/finance/gst/tax-categories/:categoryId`, async (c) => {
    try {
      const { categoryId } = c.req.param();
      const updates = await c.req.json();

      const categories = await kv.get('platform:tax_categories') || [];
      const index = categories.findIndex((cat: any) => cat.id === categoryId);

      if (index === -1) {
        return sendError(c, 'Tax category not found', 404);
      }

      categories[index] = {
        ...categories[index],
        ...updates,
        id: categoryId,
        updatedAt: new Date().toISOString()
      };

      await kv.set('platform:tax_categories', categories);
      return sendSuccess(c, { category: categories[index] });
    } catch (error) {
      console.error('Error updating tax category:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /admin/finance/gst/tax-categories/:categoryId
   * Delete tax category
   */
  app.delete(`${BASE_PATH}/admin/finance/gst/tax-categories/:categoryId`, async (c) => {
    try {
      const { categoryId } = c.req.param();
      const categories = await kv.get('platform:tax_categories') || [];
      const filtered = categories.filter((cat: any) => cat.id !== categoryId);
      await kv.set('platform:tax_categories', filtered);
      return sendSuccess(c, { success: true });
    } catch (error) {
      console.error('Error deleting tax category:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ GST configuration endpoints registered');
}

