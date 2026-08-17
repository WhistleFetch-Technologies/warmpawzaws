/**
 * Tax Management Endpoints
 * 
 * CRUD operations for tax rules, HSN codes, and tax categories
 * AWS Serverless compatible (Lambda, RDS, Cognito)
 */

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler-enhanced';
import { query, select, insert, update, deleteRecord } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { pickTaxCategoryDisplayRate } from '../utils/tax-category-display-rate';
import { isValidUUID } from '../types/entities';
import {
  displayStateFromKey,
  inferStateFromPlainAddressText,
  resolveGstStateKey,
} from '../lib/gst-place-of-supply';
import { findCustomerByPhone } from '../utils/customer-phone-lookup';
import { resolveCatalogCategoryUuidFromRef } from '../lib/services/gst-catalog-role-resolution';
import type { TaxItem } from '../lib/services/tax-calculation-service';
import {
  catalogPriceIncludesTaxMeta,
  resolveServiceBookingTaxItem,
} from '../utils/resolve-service-booking-tax-item';

/** Address may be a JSON object, a JSON string, or legacy plain text (e.g. "Bangalore") — never JSON.parse blindly. */
function addressFieldToLocation(raw: unknown): { state?: string; city?: string; pincode?: string } | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    return {
      state: typeof o.state === 'string' ? o.state : undefined,
      city: typeof o.city === 'string' ? o.city : undefined,
      pincode: typeof o.pincode === 'string' ? o.pincode : undefined,
    };
  }
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith('{')) {
    try {
      const parsed = JSON.parse(s) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
          state: typeof parsed.state === 'string' ? parsed.state : undefined,
          city: typeof parsed.city === 'string' ? parsed.city : undefined,
          pincode: typeof parsed.pincode === 'string' ? parsed.pincode : undefined,
        };
      }
    } catch {
      /* not JSON */
    }
  }
  const inferred = inferStateFromPlainAddressText(s);
  if (inferred) {
    return {
      state: displayStateFromKey(inferred.stateKey),
      city: inferred.city,
    };
  }
  return null;
}

// ============================================================================
// TAX RULES MANAGEMENT
// ============================================================================

class GetTaxRulesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const queryParams = context.event.queryStringParameters || {};
      const { enabled, roleId, serviceStyle, category } = queryParams;

      let queryStr = `
        SELECT 
          gr.*,
          r.name as role_name
        FROM gst_rules gr
        LEFT JOIN roles r ON gr.role_id = r.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      if (enabled !== undefined) {
        queryStr += ` AND gr.enabled = $${paramIndex}`;
        params.push(enabled === 'true');
        paramIndex++;
      }

      if (roleId) {
        queryStr += ` AND gr.role_id = $${paramIndex}`;
        params.push(roleId);
        paramIndex++;
      }

      if (serviceStyle) {
        queryStr += ` AND gr.service_style = $${paramIndex}`;
        params.push(serviceStyle);
        paramIndex++;
      }

      if (category) {
        queryStr += ` AND gr.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      queryStr += ` ORDER BY gr.priority DESC, gr.created_at DESC`;

      const result = await query(queryStr, params);
      const rows = Array.isArray(result) ? result : (result as any).rows || [];

      return this.success({ taxRules: rows });
    } catch (error: any) {
      console.error('Error fetching tax rules:', error);
      return this.error(`Failed to fetch tax rules: ${error.message}`, 500);
    }
  }
}

class GetTaxRuleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const ruleId = context.event.pathParameters?.id;
      if (!ruleId) {
        return this.error('Tax rule ID is required', 400);
      }

      const queryStr = `
        SELECT 
          gr.*,
          r.name as role_name
        FROM gst_rules gr
        LEFT JOIN roles r ON gr.role_id = r.id
        WHERE gr.id = $1
      `;
      const result = await query(queryStr, [ruleId]);
      const rows = Array.isArray(result) ? result : (result as any).rows || [];

      if (rows.length === 0) {
        return this.error('Tax rule not found', 404);
      }

      return this.success({ taxRule: rows[0] });
    } catch (error: any) {
      console.error('Error fetching tax rule:', error);
      return this.error(`Failed to fetch tax rule: ${error.message}`, 500);
    }
  }
}

class CreateTaxRuleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const body = this.parseBody(context.event);
      const {
        rule_name,
        enabled = true,
        priority = 100,
        role_id,
        service_style,
        category,
        tax_category_id,
        min_amount,
        max_amount,
        customer_state,
        vendor_state,
        gst_type = 'percentage',
        gst_rate,
        cgst_percentage,
        sgst_percentage,
        igst_percentage,
        description,
      } = body;

      if (!rule_name || gst_rate === undefined) {
        return this.error('rule_name and gst_rate are required', 400);
      }

      // Validate GST rates
      if (gst_rate < 0 || gst_rate > 100) {
        return this.error('gst_rate must be between 0 and 100', 400);
      }

      const insertData: any = {
        rule_name,
        enabled,
        priority: parseInt(priority) || 100,
        gst_type,
        gst_rate: parseFloat(gst_rate),
        description,
      };

      if (role_id) insertData.role_id = role_id;
      if (service_style) insertData.service_style = service_style;
      if (category) insertData.category = category;
      if (tax_category_id) insertData.tax_category_id = tax_category_id;
      if (min_amount !== undefined) insertData.min_amount = parseFloat(min_amount);
      if (max_amount !== undefined) insertData.max_amount = parseFloat(max_amount);
      if (customer_state) insertData.customer_state = customer_state;
      if (vendor_state) insertData.vendor_state = vendor_state;
      if (cgst_percentage !== undefined) insertData.cgst_percentage = parseFloat(cgst_percentage);
      if (sgst_percentage !== undefined) insertData.sgst_percentage = parseFloat(sgst_percentage);
      if (igst_percentage !== undefined) insertData.igst_percentage = parseFloat(igst_percentage);

      const result = await insert('gst_rules', insertData);
      const taxRule = Array.isArray(result) ? result[0] : result;

      return this.success({
        taxRule,
        message: 'Tax rule created successfully',
      });
    } catch (error: any) {
      console.error('Error creating tax rule:', error);
      return this.error(`Failed to create tax rule: ${error.message}`, 500);
    }
  }
}

class UpdateTaxRuleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const ruleId = context.event.pathParameters?.id;
      if (!ruleId) {
        return this.error('Tax rule ID is required', 400);
      }

      const body = this.parseBody(context.event);
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Only update provided fields
      if (body.rule_name !== undefined) updateData.rule_name = body.rule_name;
      if (body.enabled !== undefined) updateData.enabled = body.enabled;
      if (body.priority !== undefined) updateData.priority = parseInt(body.priority);
      if (body.role_id !== undefined) updateData.role_id = body.role_id;
      if (body.service_style !== undefined) updateData.service_style = body.service_style;
      if (body.category !== undefined) updateData.category = body.category;
      if (body.tax_category_id !== undefined) updateData.tax_category_id = body.tax_category_id || null;
      if (body.min_amount !== undefined) updateData.min_amount = parseFloat(body.min_amount);
      if (body.max_amount !== undefined) updateData.max_amount = parseFloat(body.max_amount);
      if (body.customer_state !== undefined) updateData.customer_state = body.customer_state;
      if (body.vendor_state !== undefined) updateData.vendor_state = body.vendor_state;
      if (body.gst_type !== undefined) updateData.gst_type = body.gst_type;
      if (body.gst_rate !== undefined) updateData.gst_rate = parseFloat(body.gst_rate);
      if (body.cgst_percentage !== undefined) updateData.cgst_percentage = parseFloat(body.cgst_percentage);
      if (body.sgst_percentage !== undefined) updateData.sgst_percentage = parseFloat(body.sgst_percentage);
      if (body.igst_percentage !== undefined) updateData.igst_percentage = parseFloat(body.igst_percentage);
      if (body.description !== undefined) updateData.description = body.description;

      const result = await update('gst_rules', { id: ruleId }, updateData);
      const taxRule = Array.isArray(result) ? result[0] : result;

      return this.success({
        taxRule,
        message: 'Tax rule updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating tax rule:', error);
      return this.error(`Failed to update tax rule: ${error.message}`, 500);
    }
  }
}

class DeleteTaxRuleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const ruleId = context.event.pathParameters?.id;
      if (!ruleId) {
        return this.error('Tax rule ID is required', 400);
      }

      // Soft delete by disabling
      await update('gst_rules', { id: ruleId }, { enabled: false, updated_at: new Date().toISOString() });

      return this.success({ message: 'Tax rule deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting tax rule:', error);
      return this.error(`Failed to delete tax rule: ${error.message}`, 500);
    }
  }
}

// ============================================================================
// HSN CODES MANAGEMENT
// ============================================================================

class GetHSNCodesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const queryParams = context.event.queryStringParameters || {};
      const { isActive, search } = queryParams;

      let queryStr = `SELECT * FROM hsn_codes WHERE 1=1`;
      const params: any[] = [];
      let paramIndex = 1;

      if (isActive !== undefined) {
        queryStr += ` AND is_active = $${paramIndex}`;
        params.push(isActive === 'true');
        paramIndex++;
      }

      if (search) {
        queryStr += ` AND (hsn_code ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        params.push(`%${search}%`);
      }

      queryStr += ` ORDER BY hsn_code ASC`;

      const result = await query(queryStr, params);
      const rows = Array.isArray(result) ? result : (result as any).rows || [];

      return this.success({ hsnCodes: rows });
    } catch (error: any) {
      console.error('Error fetching HSN codes:', error);
      return this.error(`Failed to fetch HSN codes: ${error.message}`, 500);
    }
  }
}

class CreateHSNCodeHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const body = this.parseBody(context.event);
      const { hsn_code, description, gst_rate, is_active = true, category_id } = body;

      if (!hsn_code || gst_rate === undefined) {
        return this.error('hsn_code and gst_rate are required', 400);
      }

      if (gst_rate < 0 || gst_rate > 100) {
        return this.error('gst_rate must be between 0 and 100', 400);
      }

      const insertPayload: any = {
        hsn_code,
        description,
        gst_rate: parseFloat(gst_rate),
        is_active,
      };
      if (category_id) insertPayload.category_id = category_id;

      const result = await insert('hsn_codes', insertPayload);

      const hsnCode = Array.isArray(result) ? result[0] : result;

      return this.success({
        hsnCode,
        message: 'HSN code created successfully',
      });
    } catch (error: any) {
      console.error('Error creating HSN code:', error);
      if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
        return this.error('HSN code already exists', 409);
      }
      return this.error(`Failed to create HSN code: ${error.message}`, 500);
    }
  }
}

class UpdateHSNCodeHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const codeId = context.event.pathParameters?.id;
      if (!codeId) {
        return this.error('HSN code ID is required', 400);
      }

      const body = this.parseBody(context.event);
      const updateData: any = {};

      if (body.description !== undefined) updateData.description = body.description;
      if (body.gst_rate !== undefined) {
        if (body.gst_rate < 0 || body.gst_rate > 100) {
          return this.error('gst_rate must be between 0 and 100', 400);
        }
        updateData.gst_rate = parseFloat(body.gst_rate);
      }
      if (body.is_active !== undefined) updateData.is_active = body.is_active;
      if (body.category_id !== undefined) updateData.category_id = body.category_id || null;

      const result = await update('hsn_codes', { id: codeId }, updateData);
      const hsnCode = Array.isArray(result) ? result[0] : result;

      return this.success({
        hsnCode,
        message: 'HSN code updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating HSN code:', error);
      return this.error(`Failed to update HSN code: ${error.message}`, 500);
    }
  }
}

class DeleteHSNCodeHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const codeId = context.event.pathParameters?.id;
      if (!codeId) {
        return this.error('HSN code ID is required', 400);
      }

      // Soft delete
      await update('hsn_codes', { id: codeId }, { is_active: false });

      return this.success({ message: 'HSN code deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting HSN code:', error);
      return this.error(`Failed to delete HSN code: ${error.message}`, 500);
    }
  }
}

// ============================================================================
// TAX CATEGORIES MANAGEMENT
// ============================================================================

class GetTaxCategoriesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const queryParams = context.event.queryStringParameters || {};
      const { isActive } = queryParams;

      let queryStr = `SELECT * FROM tax_categories WHERE 1=1`;
      const params: any[] = [];

      if (isActive !== undefined) {
        queryStr += ` AND is_active = $1`;
        params.push(isActive === 'true');
      }

      const result = await query(queryStr, params);
      const rows = Array.isArray(result) ? result : (result as any).rows || [];
      const sorted = [...rows].sort((a: any, b: any) =>
        String(a.category_name ?? a.name ?? '').localeCompare(String(b.category_name ?? b.name ?? ''), undefined, {
          sensitivity: 'base',
        })
      );
      const taxCategories = sorted.map((row: Record<string, any>) => {
        const tax_rate = pickTaxCategoryDisplayRate(row);
        return {
          ...row,
          category_name: row.category_name ?? row.name,
          tax_rate,
        };
      });

      return this.success({ taxCategories });
    } catch (error: any) {
      console.error('Error fetching tax categories:', error);
      return this.error(`Failed to fetch tax categories: ${error.message}`, 500);
    }
  }
}

class CreateTaxCategoryHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const body = this.parseBody(context.event);
      const { category_name, tax_rate, description, is_active = true } = body;

      if (!category_name || tax_rate === undefined) {
        return this.error('category_name and tax_rate are required', 400);
      }

      if (tax_rate < 0 || tax_rate > 100) {
        return this.error('tax_rate must be between 0 and 100', 400);
      }

      const result = await insert('tax_categories', {
        category_name,
        tax_rate: parseFloat(tax_rate),
        description,
        is_active,
      });

      const category = Array.isArray(result) ? result[0] : result;

      return this.success({
        taxCategory: category,
        message: 'Tax category created successfully',
      });
    } catch (error: any) {
      console.error('Error creating tax category:', error);
      if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
        return this.error('Tax category already exists', 409);
      }
      return this.error(`Failed to create tax category: ${error.message}`, 500);
    }
  }
}

class UpdateTaxCategoryHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const categoryId = context.event.pathParameters?.id;
      if (!categoryId) {
        return this.error('Tax category ID is required', 400);
      }

      const body = this.parseBody(context.event);
      const updateData: any = {};

      if (body.category_name !== undefined) updateData.category_name = body.category_name;
      if (body.tax_rate !== undefined) {
        if (body.tax_rate < 0 || body.tax_rate > 100) {
          return this.error('tax_rate must be between 0 and 100', 400);
        }
        updateData.tax_rate = parseFloat(body.tax_rate);
      }
      if (body.description !== undefined) updateData.description = body.description;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;

      const result = await update('tax_categories', { id: categoryId }, updateData);
      const category = Array.isArray(result) ? result[0] : result;

      return this.success({
        taxCategory: category,
        message: 'Tax category updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating tax category:', error);
      return this.error(`Failed to update tax category: ${error.message}`, 500);
    }
  }
}

class DeleteTaxCategoryHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const categoryId = context.event.pathParameters?.id;
      if (!categoryId) {
        return this.error('Tax category ID is required', 400);
      }

      // Soft delete
      await update('tax_categories', { id: categoryId }, { is_active: false });

      return this.success({ message: 'Tax category deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting tax category:', error);
      return this.error(`Failed to delete tax category: ${error.message}`, 500);
    }
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerTaxManagementEndpoints(app: Hono) {
  // Helper to safely extract body and statusCode from handler result
  const parseHandlerResult = (result: any) => {
    const body = result.body ? JSON.parse(result.body) : result;
    const statusCode = result.statusCode || 200;
    return { body, statusCode };
  };

  // Tax Rules
  const getTaxRulesHandler = new GetTaxRulesHandler();
  const getTaxRuleHandler = new GetTaxRuleHandler();
  const createTaxRuleHandler = new CreateTaxRuleHandler();
  const updateTaxRuleHandler = new UpdateTaxRuleHandler();
  const deleteTaxRuleHandler = new DeleteTaxRuleHandler();

  app.get('/admin/tax-rules', async (c) => {
    const event = createApiGatewayEvent(c.req);
    // ✅ FIX: Safely extract query parameters from Hono request
    try {
      const query = c.req.query();
      event.queryStringParameters = query ? Object.fromEntries(Object.entries(query)) : {};
    } catch (error) {
      console.warn('[TAX-MGMT] Error extracting query params, using empty object:', error);
      event.queryStringParameters = {};
    }
    const context = createLambdaContext();
    const result = await getTaxRulesHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 400 | 500);
  });

  app.get('/admin/tax-rules/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await getTaxRuleHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 400 | 404 | 500);
  });

  app.post('/admin/tax-rules', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await createTaxRuleHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 400 | 500);
  });

  app.put('/admin/tax-rules/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await updateTaxRuleHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 400 | 404 | 500);
  });

  app.delete('/admin/tax-rules/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await deleteTaxRuleHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 404 | 500);
  });

  // HSN Codes
  const getHSNCodesHandler = new GetHSNCodesHandler();
  const createHSNCodeHandler = new CreateHSNCodeHandler();
  const updateHSNCodeHandler = new UpdateHSNCodeHandler();
  const deleteHSNCodeHandler = new DeleteHSNCodeHandler();

  app.get('/admin/hsn-codes', async (c) => {
    const event = createApiGatewayEvent(c.req);
    // ✅ FIX: Safely extract query parameters from Hono request
    try {
      const query = c.req.query();
      event.queryStringParameters = query ? Object.fromEntries(Object.entries(query)) : {};
    } catch (error) {
      console.warn('[TAX-MGMT] Error extracting query params, using empty object:', error);
      event.queryStringParameters = {};
    }
    const context = createLambdaContext();
    const result = await getHSNCodesHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 400 | 500);
  });

  app.post('/admin/hsn-codes', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await createHSNCodeHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 400 | 500);
  });

  app.put('/admin/hsn-codes/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await updateHSNCodeHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 400 | 404 | 500);
  });

  app.delete('/admin/hsn-codes/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await deleteHSNCodeHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 404 | 500);
  });

  // Tax Categories
  const getTaxCategoriesHandler = new GetTaxCategoriesHandler();
  const createTaxCategoryHandler = new CreateTaxCategoryHandler();
  const updateTaxCategoryHandler = new UpdateTaxCategoryHandler();
  const deleteTaxCategoryHandler = new DeleteTaxCategoryHandler();

  app.get('/admin/tax-categories', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.queryStringParameters = Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams);
    const context = createLambdaContext();
    const result = await getTaxCategoriesHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 400 | 500);
  });

  app.post('/admin/tax-categories', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await createTaxCategoryHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 400 | 500);
  });

  app.put('/admin/tax-categories/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await updateTaxCategoryHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 400 | 404 | 500);
  });

  app.delete('/admin/tax-categories/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await deleteTaxCategoryHandler.execute(event, context);
    const { body, statusCode } = parseHandlerResult(result);
    return c.json(body, statusCode as 200 | 404 | 500);
  });

  /**
   * GET /tax/categories
   * Public endpoint for getting tax categories (for checkout)
   */
  app.get('/tax/categories', async (c) => {
    try {
      const { query: dbQuery } = await import('../database/rds-connection');
      const result = await dbQuery(`
        SELECT id, name, description, default_gst_rate as gst_rate, is_active
        FROM tax_categories
        WHERE is_active = true
        ORDER BY name
      `);
      const rows = result.rows || [];
      return c.json({
        success: true,
        categories: rows,
      });
    } catch (error: any) {
      console.error('Error fetching tax categories:', error);
      // Return default categories if table doesn't exist
      return c.json({
        success: true,
        categories: [
          { id: '1', name: 'Pet Food', gst_rate: 18 },
          { id: '2', name: 'Pet Accessories', gst_rate: 18 },
          { id: '3', name: 'Pet Medicines', gst_rate: 12 },
          { id: '4', name: 'Services', gst_rate: 18 },
        ],
      });
    }
  });

  /**
   * GET /tax/hsn/:code
   * Public endpoint for validating HSN code and getting tax rate
   */
  app.get('/tax/hsn/:code', async (c) => {
    try {
      const code = c.req.param('code');
      const { query: dbQuery } = await import('../database/rds-connection');
      let rows: any[] = [];
      const r1 = await dbQuery(
        `
        SELECT id, hsn_code, description, gst_rate, is_active
        FROM hsn_codes
        WHERE hsn_code = $1 AND is_active = true
        LIMIT 1
      `,
        [code]
      );
      rows = r1.rows || [];
      if (rows.length === 0) {
        try {
          const r2 = await dbQuery(
            `
            SELECT id, code AS hsn_code, description, gst_rate, is_active
            FROM hsn_codes
            WHERE code = $1 AND is_active = true
            LIMIT 1
          `,
            [code]
          );
          rows = r2.rows || [];
        } catch {
          rows = [];
        }
      }

      if (rows.length === 0) {
        return c.json({
          success: true,
          hsn: { code, description: 'Unknown HSN code', gst_rate: 18 },
          message: 'HSN code not found, using default rate',
        });
      }

      const row = rows[0];
      const gstRate = Number(row.gst_rate);
      return c.json({
        success: true,
        hsn: {
          id: row.id,
          code: row.hsn_code ?? row.code ?? code,
          description: row.description,
          gst_rate: Number.isFinite(gstRate) ? gstRate : 18,
          is_active: row.is_active,
        },
      });
    } catch (error: any) {
      console.error('Error fetching HSN code:', error);
      const code = c.req.param('code');
      // Return default rate on error
      return c.json({
        success: true,
        hsn: { code, description: 'Unknown HSN code', gst_rate: 18 },
        message: 'Using default rate due to database error',
      });
    }
  });

  /**
   * POST /tax/calculate
   * Public endpoint for calculating tax on items (for customer checkout)
   * Uses TaxCalculationService with 360° mapping: serviceId/productId → catalog → HSN/TaxCategory
   */
  app.post('/tax/calculate', async (c) => {
    try {
      const body = await c.req.json();
      const {
        items,
        vendorId,
        customerId,
        customerPhone: bodyCustomerPhone,
        customerLocation,
        vendorLocation,
        bookingId: requestBookingId,
      } = body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return c.json({ error: 'items array is required' }, 400);
      }

      // Merge request + DB address; resolve state from city when needed (e.g. Bangalore → Karnataka) for CGST/SGST vs IGST.
      let customerStateRaw = customerLocation?.state;
      let customerCityRaw = customerLocation?.city;
      let customerPincode = customerLocation?.pincode;

      let customerRow: Record<string, unknown> | null = null;
      if (customerId && isValidUUID(String(customerId))) {
        const byId = await select('customers', { id: String(customerId) });
        if (byId.length > 0) customerRow = byId[0] as Record<string, unknown>;
      }
      const trimmedBodyPhone =
        typeof bodyCustomerPhone === 'string' ? bodyCustomerPhone.trim() : '';
      const idAsPhone =
        customerId && !isValidUUID(String(customerId)) ? String(customerId).trim() : '';
      const phoneForLookup = trimmedBodyPhone || idAsPhone;
      if (!customerRow && phoneForLookup) {
        const byPhone = await findCustomerByPhone(phoneForLookup);
        if (byPhone) customerRow = byPhone as Record<string, unknown>;
      }

      if (customerRow?.address) {
        const addr = addressFieldToLocation(customerRow.address);
        if (addr) {
          if (!customerStateRaw && addr.state) customerStateRaw = addr.state;
          if (!customerCityRaw && addr.city) customerCityRaw = addr.city;
          if (!customerPincode && addr.pincode) customerPincode = addr.pincode;
        } else if (typeof customerRow.address === 'string') {
          const inf = inferStateFromPlainAddressText(customerRow.address);
          if (inf) {
            if (!customerStateRaw) customerStateRaw = displayStateFromKey(inf.stateKey);
            if (!customerCityRaw && inf.city) customerCityRaw = inf.city;
          }
        }
      }

      let vendorStateRaw = vendorLocation?.state;
      let vendorCityRaw = vendorLocation?.city;

      if (vendorId) {
        const vendors = await select('vendors', { id: vendorId });
        if (vendors.length > 0 && vendors[0].address) {
          const addr = addressFieldToLocation(vendors[0].address);
          if (addr) {
            if (!vendorStateRaw && addr.state) vendorStateRaw = addr.state;
            if (!vendorCityRaw && addr.city) vendorCityRaw = addr.city;
          } else if (typeof vendors[0].address === 'string') {
            const inf = inferStateFromPlainAddressText(vendors[0].address);
            if (inf) {
              if (!vendorStateRaw) vendorStateRaw = displayStateFromKey(inf.stateKey);
              if (!vendorCityRaw && inf.city) vendorCityRaw = inf.city;
            }
          }
        }
      }

      const customerKey = resolveGstStateKey(customerStateRaw, customerCityRaw);
      const vendorKey = resolveGstStateKey(vendorStateRaw, vendorCityRaw);

      let customerLocationObj: { state: string; city?: string; pincode?: string } | undefined;
      let vendorLocationObj: { state: string; city?: string } | undefined;
      let customerState: string | undefined;
      let vendorState: string | undefined;

      if (customerKey) {
        customerState = displayStateFromKey(customerKey);
        customerLocationObj = {
          state: customerState,
          city: customerCityRaw,
          pincode: customerPincode,
        };
      } else {
        customerState = customerStateRaw;
      }

      if (vendorKey) {
        vendorState = displayStateFromKey(vendorKey);
        vendorLocationObj = { state: vendorState, city: vendorCityRaw };
      } else {
        vendorState = vendorStateRaw;
      }

      // Services: GST from Admin Catalogue category + vendor role (GST Configuration).
      // Products: HSN / tax category on product rows (unchanged).
      const { taxCalculationService } = await import('../lib/services/tax-calculation-service');

      const taxItems: Array<{
        id: string;
        type: 'product' | 'service';
        amount: number;
        quantity?: number;
        hsnCode?: string;
        hsnCodeId?: string;
        taxCategoryId?: string;
        catalogCategoryId?: string;
        category?: string;
        serviceStyle?: string;
        roleId?: string;
        amountIsTaxInclusive?: boolean;
        gstApplicationScope?: 'service_booking' | 'meal_plan_food' | 'meal_plan_delivery';
      }> = [];

      let vendorRoleId: string | undefined;
      if (vendorId) {
        const v = await select('vendors', { id: vendorId });
        if (v.length > 0) vendorRoleId = v[0].role_id;
      }

      for (const item of items) {
        const amount = Number(item.amount) || 0;
        const quantity = Number(item.quantity) || 1;
        const itemType = (item.type === 'product' ? 'product' : 'service') as 'product' | 'service';
        let category = item.category;

        const serviceId = item.serviceId;
        const productId = item.productId;

        let amountIsTaxInclusive =
          item.amountTaxInclusive === true || item.amount_is_tax_inclusive === true;

        if (itemType === 'service') {
          const gstScopeRaw = String(
            (item as { gstApplicationScope?: string }).gstApplicationScope ||
              (item as { gst_application_scope?: string }).gst_application_scope ||
              '',
          ).trim();
          const isMealPlanFoodScope = gstScopeRaw === 'meal_plan_food';
          const isMealPlanDeliveryScope = gstScopeRaw === 'meal_plan_delivery';
          const explicitCatRaw =
            (item as { catalogCategoryId?: string }).catalogCategoryId ||
            (item as { catalog_category_id?: string }).catalog_category_id;
          // Meal-plan GST rows must always resolve catalogue UUID here. Do not require `vendorId`:
          // missing vendor would skip this branch, drop `catalogCategoryId`, and fall through to the
          // generic service path — which now fails closed without Admin GST configuration.
          if (isMealPlanFoodScope && explicitCatRaw) {
            const catalogCategoryUuid = await resolveCatalogCategoryUuidFromRef(String(explicitCatRaw));
            if (catalogCategoryUuid) {
              taxItems.push({
                id: (item as { id?: string }).id || 'meal-plan-food',
                type: 'service',
                amount,
                quantity,
                catalogCategoryId: catalogCategoryUuid,
                category: category || 'nutrition',
                serviceStyle: item.serviceStyle,
                roleId: (item as { roleId?: string }).roleId || vendorRoleId,
                amountIsTaxInclusive,
                gstApplicationScope: 'meal_plan_food',
              });
              continue;
            }
          }
          if (isMealPlanDeliveryScope && explicitCatRaw) {
            const catalogCategoryUuid = await resolveCatalogCategoryUuidFromRef(String(explicitCatRaw));
            if (catalogCategoryUuid) {
              taxItems.push({
                id: (item as { id?: string }).id || 'meal-plan-delivery',
                type: 'service',
                amount,
                quantity,
                catalogCategoryId: catalogCategoryUuid,
                category: category || 'nutrition',
                serviceStyle: item.serviceStyle,
                roleId: (item as { roleId?: string }).roleId || vendorRoleId,
                amountIsTaxInclusive,
                gstApplicationScope: 'meal_plan_delivery',
              });
              continue;
            }
          }

          const bidRaw =
            (item as { bookingId?: string }).bookingId || requestBookingId;
          const bookingIdForResolve =
            bidRaw != null && String(bidRaw).trim() !== '' && isValidUUID(String(bidRaw).trim())
              ? String(bidRaw).trim()
              : undefined;

          const resolved = await resolveServiceBookingTaxItem({
            serviceId: serviceId || undefined,
            vendorId,
            bookingId: bookingIdForResolve,
            vendorRoleId: (item as { roleId?: string }).roleId || vendorRoleId,
            amount,
            quantity,
            category: category || undefined,
            serviceStyle: item.serviceStyle,
            amountIsTaxInclusive,
            itemId: (item as { id?: string }).id || serviceId,
          });
          if (!category && resolved.category) category = resolved.category;
          taxItems.push(resolved.taxItem);
          continue;
        }

        let hsnCodeId: string | undefined;
        let taxCategoryId: string | undefined;
        let hsnCode: string | undefined;

        if (productId && vendorId) {
          const products = await select('products', { id: productId }).catch(() => []);
          if (products.length > 0 && products[0].hsn_code) {
            hsnCode = products[0].hsn_code;
          }
        }

        taxItems.push({
          id: item.id || serviceId || productId || `item-${Math.random().toString(36).slice(2)}`,
          type: 'product',
          amount,
          quantity,
          hsnCode: hsnCode || item.hsnCode,
          hsnCodeId,
          taxCategoryId,
          category,
          serviceStyle: item.serviceStyle,
          roleId: item.roleId || vendorRoleId,
          amountIsTaxInclusive,
        });
      }

      const taxResult = await taxCalculationService.calculateTax({
        items: taxItems as TaxItem[],
        customerLocation: customerLocationObj,
        vendorLocation: vendorLocationObj,
        vendorId,
        serviceType: taxItems[0]?.category,
        category: taxItems[0]?.category,
      });

      const itemResults = taxResult.items.map((t) => ({
        id: t.itemId,
        amount: t.baseAmount,
        taxRate: Number(t.gstRate),
        igst: t.igstAmount,
        cgst: t.cgstAmount,
        sgst: t.sgstAmount,
        totalWithTax: t.totalAmount,
      }));

      const breakdown = taxResult.hsnSummary.map((b) => ({
        ...b,
        gstRate: Number(b.gstRate),
      }));

      return c.json({
        success: true,
        items: itemResults,
        totalAmount: taxResult.subtotal,
        totalTax: taxResult.totalTax,
        totalCGST: taxResult.totalCGST,
        totalSGST: taxResult.totalSGST,
        totalIGST: taxResult.totalIGST,
        grandTotal: taxResult.grandTotal,
        isInterState: taxResult.isInterstate,
        customerState,
        vendorState,
        breakdown,
      });
    } catch (error: any) {
      console.error('Error calculating tax:', error);
      // 200 + success:false so api clients that only parse JSON (no throw) can branch; avoids masking as "success" with empty items
      return c.json({
        success: false,
        items: [],
        totalAmount: 0,
        totalTax: 0,
        totalCGST: 0,
        totalSGST: 0,
        totalIGST: 0,
        grandTotal: 0,
        error: error?.message || 'Tax calculation failed',
      });
    }
  });
}

function createApiGatewayEvent(req: any): any {
  const headers =
    req?.headers != null && typeof (req.headers as any).entries === 'function'
      ? Object.fromEntries((req.headers as Headers).entries())
      : req?.headers != null && typeof req.headers === 'object' && !Array.isArray(req.headers)
        ? (req.headers as Record<string, string>)
        : {};
  return {
    httpMethod: req?.method ?? 'GET',
    path: (req?.url ?? '/').split('?')[0],
    pathParameters: {},
    queryStringParameters: {},
    headers,
    body: JSON.stringify(req?.body ?? {}),
    isBase64Encoded: false,
  };
}

function createLambdaContext(): any {
  return {
    functionName: 'tax-management',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:tax-management',
    memoryLimitInMB: '256',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/tax-management',
    logStreamName: 'test-stream',
  };
}

