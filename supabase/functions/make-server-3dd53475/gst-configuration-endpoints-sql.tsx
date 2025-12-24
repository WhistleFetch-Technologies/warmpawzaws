/**
 * ============================================================================
 * GST CONFIGURATION ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Handles HSN codes, tax categories, and regional GST settings
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-23
 * Migration: Phase 1, Task 1.2 - KV to SQL
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { getGstConfigurationsRepository } from '../../lib/repositories/gst-configurations.ts';

export function gstConfigurationEndpointsSQL(app: Hono) {
  const BASE_PATH = '/make-server-3dd53475';
  const gstRepo = getGstConfigurationsRepository();

  // ============================================
  // GST CONFIGURATION (Regional Settings)
  // ============================================

  /**
   * GET /admin/finance/gst-config
   * Get all GST configurations
   */
  app.get(`${BASE_PATH}/admin/finance/gst-config`, async (c) => {
    try {
      const configs = await gstRepo.findAll();
      return sendSuccess(c, { configs });
    } catch (error) {
      console.error('❌ [GST-CONFIG-SQL] Error fetching GST configs:', error);
      return sendError(c, `Failed to fetch GST configs: ${String(error)}`, 500);
    }
  });

  /**
   * POST /admin/finance/gst-config
   * Create new GST configuration
   */
  app.post(`${BASE_PATH}/admin/finance/gst-config`, async (c) => {
    try {
      const configData = await c.req.json();
      
      // Validate required fields
      if (!configData.gst_rate) {
        return sendError(c, 'GST rate is required', 400);
      }
      
      const config = await gstRepo.create({
        hsn_code: configData.hsn_code || null,
        category: configData.category || null,
        gst_rate: parseFloat(configData.gst_rate),
        cgst_rate: configData.cgst_rate ? parseFloat(configData.cgst_rate) : null,
        sgst_rate: configData.sgst_rate ? parseFloat(configData.sgst_rate) : null,
        igst_rate: configData.igst_rate ? parseFloat(configData.igst_rate) : null,
        applicable_states: configData.applicable_states || [],
        is_active: configData.is_active !== false,
      });

      console.log(`✅ [GST-CONFIG-SQL] Created GST config: ${config.id}`);
      return sendSuccess(c, { config });
    } catch (error) {
      console.error('❌ [GST-CONFIG-SQL] Error creating GST config:', error);
      return sendError(c, `Failed to create GST config: ${String(error)}`, 500);
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

      const updateData: any = {};
      if (updates.hsn_code !== undefined) updateData.hsn_code = updates.hsn_code;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.gst_rate !== undefined) updateData.gst_rate = parseFloat(updates.gst_rate);
      if (updates.cgst_rate !== undefined) updateData.cgst_rate = updates.cgst_rate ? parseFloat(updates.cgst_rate) : null;
      if (updates.sgst_rate !== undefined) updateData.sgst_rate = updates.sgst_rate ? parseFloat(updates.sgst_rate) : null;
      if (updates.igst_rate !== undefined) updateData.igst_rate = updates.igst_rate ? parseFloat(updates.igst_rate) : null;
      if (updates.applicable_states !== undefined) updateData.applicable_states = updates.applicable_states;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

      const config = await gstRepo.update(configId, updateData);
      
      console.log(`✅ [GST-CONFIG-SQL] Updated GST config: ${configId}`);
      return sendSuccess(c, { config });
    } catch (error) {
      console.error('❌ [GST-CONFIG-SQL] Error updating GST config:', error);
      return sendError(c, `Failed to update GST config: ${String(error)}`, 500);
    }
  });

  /**
   * DELETE /admin/finance/gst-config/:configId
   * Delete GST configuration
   */
  app.delete(`${BASE_PATH}/admin/finance/gst-config/:configId`, async (c) => {
    try {
      const { configId } = c.req.param();
      await gstRepo.delete(configId);
      
      console.log(`✅ [GST-CONFIG-SQL] Deleted GST config: ${configId}`);
      return sendSuccess(c, { success: true });
    } catch (error) {
      console.error('❌ [GST-CONFIG-SQL] Error deleting GST config:', error);
      return sendError(c, `Failed to delete GST config: ${String(error)}`, 500);
    }
  });

  /**
   * GET /admin/finance/gst-config/hsn/:hsnCode
   * Get GST configuration by HSN code
   */
  app.get(`${BASE_PATH}/admin/finance/gst-config/hsn/:hsnCode`, async (c) => {
    try {
      const { hsnCode } = c.req.param();
      const config = await gstRepo.findByHsnCode(hsnCode);
      
      if (!config) {
        return sendError(c, 'GST config not found for HSN code', 404);
      }
      
      return sendSuccess(c, { config });
    } catch (error) {
      console.error('❌ [GST-CONFIG-SQL] Error fetching GST config by HSN:', error);
      return sendError(c, `Failed to fetch GST config: ${String(error)}`, 500);
    }
  });

  /**
   * GET /admin/finance/gst-config/category/:category
   * Get GST configurations by category
   */
  app.get(`${BASE_PATH}/admin/finance/gst-config/category/:category`, async (c) => {
    try {
      const { category } = c.req.param();
      const configs = await gstRepo.findByCategory(category);
      
      return sendSuccess(c, { configs });
    } catch (error) {
      console.error('❌ [GST-CONFIG-SQL] Error fetching GST configs by category:', error);
      return sendError(c, `Failed to fetch GST configs: ${String(error)}`, 500);
    }
  });

  // ============================================
  // HSN CODES (Using GST Configurations table)
  // ============================================

  /**
   * GET /admin/finance/gst/hsn-codes
   * Get all HSN codes (from GST configurations)
   */
  app.get(`${BASE_PATH}/admin/finance/gst/hsn-codes`, async (c) => {
    try {
      const configs = await gstRepo.findAll();
      const hsnCodes = configs
        .filter(c => c.hsn_code)
        .map(c => ({
          id: c.id,
          hsn_code: c.hsn_code,
          gst_rate: c.gst_rate,
          category: c.category,
          is_active: c.is_active
        }));
      
      return sendSuccess(c, { hsnCodes });
    } catch (error) {
      console.error('❌ [GST-CONFIG-SQL] Error fetching HSN codes:', error);
      return sendError(c, `Failed to fetch HSN codes: ${String(error)}`, 500);
    }
  });

  /**
   * POST /admin/finance/gst/hsn-codes
   * Create new HSN code (creates GST configuration)
   */
  app.post(`${BASE_PATH}/admin/finance/gst/hsn-codes`, async (c) => {
    try {
      const hsnData = await c.req.json();
      
      if (!hsnData.hsn_code || !hsnData.gst_rate) {
        return sendError(c, 'HSN code and GST rate are required', 400);
      }
      
      const config = await gstRepo.create({
        hsn_code: hsnData.hsn_code,
        category: hsnData.category || null,
        gst_rate: parseFloat(hsnData.gst_rate),
        cgst_rate: hsnData.cgst_rate ? parseFloat(hsnData.cgst_rate) : null,
        sgst_rate: hsnData.sgst_rate ? parseFloat(hsnData.sgst_rate) : null,
        igst_rate: hsnData.igst_rate ? parseFloat(hsnData.igst_rate) : null,
        applicable_states: hsnData.applicable_states || [],
        is_active: hsnData.is_active !== false,
      });

      console.log(`✅ [GST-CONFIG-SQL] Created HSN code: ${hsnData.hsn_code}`);
      return sendSuccess(c, { 
        hsnCode: {
          id: config.id,
          hsn_code: config.hsn_code,
          gst_rate: config.gst_rate,
          category: config.category,
          is_active: config.is_active
        }
      });
    } catch (error) {
      console.error('❌ [GST-CONFIG-SQL] Error creating HSN code:', error);
      return sendError(c, `Failed to create HSN code: ${String(error)}`, 500);
    }
  });

  /**
   * PUT /admin/finance/gst/hsn-codes/:hsnId
   * Update HSN code (updates GST configuration)
   */
  app.put(`${BASE_PATH}/admin/finance/gst/hsn-codes/:hsnId`, async (c) => {
    try {
      const { hsnId } = c.req.param();
      const updates = await c.req.json();

      const updateData: any = {};
      if (updates.hsn_code !== undefined) updateData.hsn_code = updates.hsn_code;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.gst_rate !== undefined) updateData.gst_rate = parseFloat(updates.gst_rate);
      if (updates.cgst_rate !== undefined) updateData.cgst_rate = updates.cgst_rate ? parseFloat(updates.cgst_rate) : null;
      if (updates.sgst_rate !== undefined) updateData.sgst_rate = updates.sgst_rate ? parseFloat(updates.sgst_rate) : null;
      if (updates.igst_rate !== undefined) updateData.igst_rate = updates.igst_rate ? parseFloat(updates.igst_rate) : null;
      if (updates.applicable_states !== undefined) updateData.applicable_states = updates.applicable_states;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

      const config = await gstRepo.update(hsnId, updateData);
      
      console.log(`✅ [GST-CONFIG-SQL] Updated HSN code: ${hsnId}`);
      return sendSuccess(c, { 
        hsnCode: {
          id: config.id,
          hsn_code: config.hsn_code,
          gst_rate: config.gst_rate,
          category: config.category,
          is_active: config.is_active
        }
      });
    } catch (error) {
      console.error('❌ [GST-CONFIG-SQL] Error updating HSN code:', error);
      return sendError(c, `Failed to update HSN code: ${String(error)}`, 500);
    }
  });

  /**
   * DELETE /admin/finance/gst/hsn-codes/:hsnId
   * Delete HSN code (deletes GST configuration)
   */
  app.delete(`${BASE_PATH}/admin/finance/gst/hsn-codes/:hsnId`, async (c) => {
    try {
      const { hsnId } = c.req.param();
      await gstRepo.delete(hsnId);
      
      console.log(`✅ [GST-CONFIG-SQL] Deleted HSN code: ${hsnId}`);
      return sendSuccess(c, { success: true });
    } catch (error) {
      console.error('❌ [GST-CONFIG-SQL] Error deleting HSN code:', error);
      return sendError(c, `Failed to delete HSN code: ${String(error)}`, 500);
    }
  });

  // ============================================
  // TAX CATEGORIES (Using GST Configurations table)
  // ============================================

  /**
   * GET /admin/finance/gst/tax-categories
   * Get all tax categories (from GST configurations)
   */
  app.get(`${BASE_PATH}/admin/finance/gst/tax-categories`, async (c) => {
    try {
      const configs = await gstRepo.findAll();
      const categories = [...new Set(configs
        .filter(c => c.category)
        .map(c => c.category)
        .filter(Boolean))];
      
      return sendSuccess(c, { categories: categories.map(cat => ({
        name: cat,
        configs: configs.filter(c => c.category === cat)
      })) });
    } catch (error) {
      console.error('❌ [GST-CONFIG-SQL] Error fetching tax categories:', error);
      return sendError(c, `Failed to fetch tax categories: ${String(error)}`, 500);
    }
  });

  /**
   * POST /admin/finance/gst/tax-categories
   * Create new tax category (creates GST configuration)
   */
  app.post(`${BASE_PATH}/admin/finance/gst/tax-categories`, async (c) => {
    try {
      const categoryData = await c.req.json();
      
      if (!categoryData.category || !categoryData.gst_rate) {
        return sendError(c, 'Category name and GST rate are required', 400);
      }
      
      const config = await gstRepo.create({
        category: categoryData.category,
        hsn_code: categoryData.hsn_code || null,
        gst_rate: parseFloat(categoryData.gst_rate),
        cgst_rate: categoryData.cgst_rate ? parseFloat(categoryData.cgst_rate) : null,
        sgst_rate: categoryData.sgst_rate ? parseFloat(categoryData.sgst_rate) : null,
        igst_rate: categoryData.igst_rate ? parseFloat(categoryData.igst_rate) : null,
        applicable_states: categoryData.applicable_states || [],
        is_active: categoryData.is_active !== false,
      });

      console.log(`✅ [GST-CONFIG-SQL] Created tax category: ${categoryData.category}`);
      return sendSuccess(c, { 
        category: {
          id: config.id,
          name: config.category,
          gst_rate: config.gst_rate,
          is_active: config.is_active
        }
      });
    } catch (error) {
      console.error('❌ [GST-CONFIG-SQL] Error creating tax category:', error);
      return sendError(c, `Failed to create tax category: ${String(error)}`, 500);
    }
  });

  /**
   * PUT /admin/finance/gst/tax-categories/:categoryId
   * Update tax category (updates GST configuration)
   */
  app.put(`${BASE_PATH}/admin/finance/gst/tax-categories/:categoryId`, async (c) => {
    try {
      const { categoryId } = c.req.param();
      const updates = await c.req.json();

      const updateData: any = {};
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.hsn_code !== undefined) updateData.hsn_code = updates.hsn_code;
      if (updates.gst_rate !== undefined) updateData.gst_rate = parseFloat(updates.gst_rate);
      if (updates.cgst_rate !== undefined) updateData.cgst_rate = updates.cgst_rate ? parseFloat(updates.cgst_rate) : null;
      if (updates.sgst_rate !== undefined) updateData.sgst_rate = updates.sgst_rate ? parseFloat(updates.sgst_rate) : null;
      if (updates.igst_rate !== undefined) updateData.igst_rate = updates.igst_rate ? parseFloat(updates.igst_rate) : null;
      if (updates.applicable_states !== undefined) updateData.applicable_states = updates.applicable_states;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

      const config = await gstRepo.update(categoryId, updateData);
      
      console.log(`✅ [GST-CONFIG-SQL] Updated tax category: ${categoryId}`);
      return sendSuccess(c, { 
        category: {
          id: config.id,
          name: config.category,
          gst_rate: config.gst_rate,
          is_active: config.is_active
        }
      });
    } catch (error) {
      console.error('❌ [GST-CONFIG-SQL] Error updating tax category:', error);
      return sendError(c, `Failed to update tax category: ${String(error)}`, 500);
    }
  });

  /**
   * DELETE /admin/finance/gst/tax-categories/:categoryId
   * Delete tax category (deletes GST configuration)
   */
  app.delete(`${BASE_PATH}/admin/finance/gst/tax-categories/:categoryId`, async (c) => {
    try {
      const { categoryId } = c.req.param();
      await gstRepo.delete(categoryId);
      
      console.log(`✅ [GST-CONFIG-SQL] Deleted tax category: ${categoryId}`);
      return sendSuccess(c, { success: true });
    } catch (error) {
      console.error('❌ [GST-CONFIG-SQL] Error deleting tax category:', error);
      return sendError(c, `Failed to delete tax category: ${String(error)}`, 500);
    }
  });

  console.log('✅ [GST-CONFIG-SQL] GST configuration endpoints registered (SQL-only)');
}

