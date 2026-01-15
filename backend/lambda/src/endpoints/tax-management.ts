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
import { isValidUUID } from '../types/entities';

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
      const { hsn_code, description, gst_rate, is_active = true } = body;

      if (!hsn_code || gst_rate === undefined) {
        return this.error('hsn_code and gst_rate are required', 400);
      }

      if (gst_rate < 0 || gst_rate > 100) {
        return this.error('gst_rate must be between 0 and 100', 400);
      }

      const result = await insert('hsn_codes', {
        hsn_code,
        description,
        gst_rate: parseFloat(gst_rate),
        is_active,
      });

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

      queryStr += ` ORDER BY category_name ASC`;

      const result = await query(queryStr, params);
      const rows = Array.isArray(result) ? result : (result as any).rows || [];

      return this.success({ taxCategories: rows });
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
    event.queryStringParameters = Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams);
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
    event.queryStringParameters = Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams);
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
   * POST /tax/calculate
   * Public endpoint for calculating tax on items (for customer checkout)
   */
  app.post('/tax/calculate', async (c) => {
    try {
      const body = await c.req.json();
      const { items, vendorId, customerId, customerLocation, vendorLocation } = body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return c.json({ error: 'items array is required' }, 400);
      }

      // Get customer and vendor locations if not provided
      let customerState = customerLocation?.state;
      let vendorState = vendorLocation?.state;

      if (!customerState && customerId) {
        const { select } = await import('../database/rds-connection');
        const customers = await select('customers', { id: customerId });
        if (customers.length > 0 && customers[0].address) {
          const addr = typeof customers[0].address === 'string'
            ? JSON.parse(customers[0].address)
            : customers[0].address;
          customerState = addr?.state;
        }
      }

      if (!vendorState && vendorId) {
        const { select } = await import('../database/rds-connection');
        const vendors = await select('vendors', { id: vendorId });
        if (vendors.length > 0 && vendors[0].address) {
          const addr = typeof vendors[0].address === 'string'
            ? JSON.parse(vendors[0].address)
            : vendors[0].address;
          vendorState = addr?.state;
        }
      }

      // Determine if inter-state (IGST) or intra-state (CGST+SGST)
      const isInterState = customerState && vendorState && customerState !== vendorState;

      // Default GST rate for pet services
      const defaultRate = 18;

      // Calculate tax for each item
      let totalAmount = 0;
      let totalTax = 0;
      let totalCGST = 0;
      let totalSGST = 0;
      let totalIGST = 0;

      const itemResults = items.map((item: any) => {
        const amount = item.amount || 0;
        const quantity = item.quantity || 1;
        const itemTotal = amount * quantity;
        
        // Get item-specific tax rate from HSN code or use default
        const taxRate = item.taxRate || defaultRate;
        const itemTax = (itemTotal * taxRate) / 100;

        totalAmount += itemTotal;
        totalTax += itemTax;

        if (isInterState) {
          totalIGST += itemTax;
          return {
            id: item.id,
            amount: itemTotal,
            taxRate,
            igst: itemTax,
            cgst: 0,
            sgst: 0,
            totalWithTax: itemTotal + itemTax,
          };
        } else {
          const halfTax = itemTax / 2;
          totalCGST += halfTax;
          totalSGST += halfTax;
          return {
            id: item.id,
            amount: itemTotal,
            taxRate,
            igst: 0,
            cgst: halfTax,
            sgst: halfTax,
            totalWithTax: itemTotal + itemTax,
          };
        }
      });

      return c.json({
        success: true,
        items: itemResults,
        totalAmount,
        totalTax,
        totalCGST,
        totalSGST,
        totalIGST,
        grandTotal: totalAmount + totalTax,
        isInterState,
        customerState,
        vendorState,
      });
    } catch (error: any) {
      console.error('Error calculating tax:', error);
      // Return a safe fallback
      return c.json({
        success: true,
        items: [],
        totalAmount: 0,
        totalTax: 0,
        totalCGST: 0,
        totalSGST: 0,
        totalIGST: 0,
        grandTotal: 0,
        error: error.message,
      });
    }
  });
}

function createApiGatewayEvent(req: any): any {
  return {
    httpMethod: req.method,
    path: req.url.split('?')[0],
    pathParameters: {},
    queryStringParameters: {},
    headers: Object.fromEntries(req.headers.entries()),
    body: JSON.stringify(req.body || {}),
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

