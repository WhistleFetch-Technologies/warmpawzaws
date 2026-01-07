/**
 * ============================================================================
 * VENDOR PRODUCT MANAGEMENT ENDPOINTS
 * ============================================================================
 * 
 * Handles vendor product CRUD operations:
 * - List vendor products
 * - Create product
 * - Update product
 * - Delete product
 * - Update stock
 * 
 * Date: 2026-01-XX
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query, deleteRows } from '../database/rds-connection';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';

// ============================================================================
// GET /vendor/:vendorId/products - List vendor products
// ============================================================================

class GetVendorProductsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.vendorId;
      const search = context.event.queryStringParameters?.search;
      const category = context.event.queryStringParameters?.category;
      const status = context.event.queryStringParameters?.status;
      const limit = parseInt(context.event.queryStringParameters?.limit || '50', 10);
      const offset = parseInt(context.event.queryStringParameters?.offset || '0', 10);

      if (!vendorId) {
        return this.error('Vendor ID is required', 400);
      }

      // Verify vendor exists
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return this.error('Vendor not found', 404);
      }

      // Build query
      let productQuery = `
        SELECT p.*, 
               ec.name as category_name,
               ec.id as category_id
        FROM products p
        LEFT JOIN ecommerce_categories ec ON p.category_id = ec.id
        WHERE p.vendor_id = $1
      `;

      const params: any[] = [vendorId];
      let paramIndex = 2;

      if (search) {
        productQuery += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (category) {
        productQuery += ` AND (p.category_id = $${paramIndex} OR p.category = $${paramIndex})`;
        params.push(category);
        paramIndex++;
      }

      if (status === 'active') {
        productQuery += ` AND p.is_active = true`;
      } else if (status === 'inactive') {
        productQuery += ` AND p.is_active = false`;
      }

      productQuery += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const products = await query(productQuery, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total
        FROM products p
        WHERE p.vendor_id = $1
      `;
      const countParams: any[] = [vendorId];
      let countParamIndex = 2;

      if (search) {
        countQuery += ` AND (p.name ILIKE $${countParamIndex} OR p.description ILIKE $${countParamIndex})`;
        countParams.push(`%${search}%`);
        countParamIndex++;
      }

      if (category) {
        countQuery += ` AND (p.category_id = $${countParamIndex} OR p.category = $${countParamIndex})`;
        countParams.push(category);
        countParamIndex++;
      }

      if (status === 'active') {
        countQuery += ` AND p.is_active = true`;
      } else if (status === 'inactive') {
        countQuery += ` AND p.is_active = false`;
      }

      const countResult = await query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.total || '0', 10);

      return this.success({
        products: products.rows,
        total,
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('Error fetching vendor products:', error);
      return this.error(error.message || 'Failed to fetch products', 500);
    }
  }
}

// ============================================================================
// POST /vendor/:vendorId/products - Create product
// ============================================================================

class CreateVendorProductHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.vendorId;
      const body = this.parseBody(context.event);

      if (!vendorId) {
        return this.error('Vendor ID is required', 400);
      }

      this.validateRequired(body, ['name', 'price']);

      // Verify vendor exists
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return this.error('Vendor not found', 404);
      }

      // Prepare product data
      const productData: any = {
        vendor_id: vendorId,
        name: body.name,
        description: body.description || null,
        category_id: body.category_id || null,
        category: body.category || null,
        price: parseFloat(body.price),
        stock: parseInt(body.stock || body.stock_quantity || '0', 10),
        stock_quantity: parseInt(body.stock || body.stock_quantity || '0', 10),
        sku: body.sku || null,
        hsn_code: body.hsn_code || null,
        gst_rate: body.gst_rate ? parseFloat(body.gst_rate) : null,
        images: body.images || [],
        is_active: body.is_active !== false,
      };

      // Create product
      const newProduct = await insert('products', productData);

      return this.success({
        product: newProduct[0],
        message: 'Product created successfully',
      });
    } catch (error: any) {
      console.error('Error creating product:', error);
      return this.error(error.message || 'Failed to create product', 500);
    }
  }
}

// ============================================================================
// GET /vendor/:vendorId/products/:productId - Get product details
// ============================================================================

class GetVendorProductHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.vendorId;
      const productId = context.event.pathParameters?.productId;

      if (!vendorId || !productId) {
        return this.error('Vendor ID and Product ID are required', 400);
      }

      const products = await query(
        `SELECT p.*, 
                ec.name as category_name,
                ec.id as category_id
         FROM products p
         LEFT JOIN ecommerce_categories ec ON p.category_id = ec.id
         WHERE p.id = $1 AND p.vendor_id = $2`,
        [productId, vendorId]
      );

      if (products.rows.length === 0) {
        return this.error('Product not found', 404);
      }

      return this.success({
        product: products.rows[0],
      });
    } catch (error: any) {
      console.error('Error fetching product:', error);
      return this.error(error.message || 'Failed to fetch product', 500);
    }
  }
}

// ============================================================================
// PUT /vendor/:vendorId/products/:productId - Update product
// ============================================================================

class UpdateVendorProductHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.vendorId;
      const productId = context.event.pathParameters?.productId;
      const body = this.parseBody(context.event);

      if (!vendorId || !productId) {
        return this.error('Vendor ID and Product ID are required', 400);
      }

      // Verify product belongs to vendor
      const existingProducts = await select('products', { id: productId, vendor_id: vendorId });
      if (existingProducts.length === 0) {
        return this.error('Product not found or access denied', 404);
      }

      // Prepare update data
      const updateData: any = {};

      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.category_id !== undefined) updateData.category_id = body.category_id;
      if (body.category !== undefined) updateData.category = body.category;
      if (body.price !== undefined) updateData.price = parseFloat(body.price);
      if (body.stock !== undefined) {
        updateData.stock = parseInt(body.stock, 10);
        updateData.stock_quantity = parseInt(body.stock, 10);
      }
      if (body.stock_quantity !== undefined) {
        updateData.stock = parseInt(body.stock_quantity, 10);
        updateData.stock_quantity = parseInt(body.stock_quantity, 10);
      }
      if (body.sku !== undefined) updateData.sku = body.sku;
      if (body.hsn_code !== undefined) updateData.hsn_code = body.hsn_code;
      if (body.gst_rate !== undefined) updateData.gst_rate = body.gst_rate ? parseFloat(body.gst_rate) : null;
      if (body.images !== undefined) updateData.images = body.images;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;

      updateData.updated_at = new Date().toISOString();

      // Update product
      const updated = await update('products', { id: productId, vendor_id: vendorId }, updateData);

      if (updated.length === 0) {
        return this.error('Failed to update product', 500);
      }

      return this.success({
        product: updated[0],
        message: 'Product updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating product:', error);
      return this.error(error.message || 'Failed to update product', 500);
    }
  }
}

// ============================================================================
// DELETE /vendor/:vendorId/products/:productId - Delete product
// ============================================================================

class DeleteVendorProductHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.vendorId;
      const productId = context.event.pathParameters?.productId;

      if (!vendorId || !productId) {
        return this.error('Vendor ID and Product ID are required', 400);
      }

      // Verify product belongs to vendor
      const existingProducts = await select('products', { id: productId, vendor_id: vendorId });
      if (existingProducts.length === 0) {
        return this.error('Product not found or access denied', 404);
      }

      // Check if product has orders
      const orders = await query(
        'SELECT COUNT(*) as count FROM order_items WHERE product_id = $1',
        [productId]
      );

      if (parseInt(orders.rows[0]?.count || '0', 10) > 0) {
        // Soft delete - mark as inactive instead
        await update('products', { id: productId }, { is_active: false });
        return this.success({
          message: 'Product deactivated (has existing orders)',
        });
      }

      // Hard delete if no orders
      await deleteRows('products', { id: productId, vendor_id: vendorId });

      return this.success({
        message: 'Product deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting product:', error);
      return this.error(error.message || 'Failed to delete product', 500);
    }
  }
}

// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================

export function registerVendorProductsEndpoints(app: Hono) {
  const getProductsHandler = new GetVendorProductsHandler();
  const createProductHandler = new CreateVendorProductHandler();
  const getProductHandler = new GetVendorProductHandler();
  const updateProductHandler = new UpdateVendorProductHandler();
  const deleteProductHandler = new DeleteVendorProductHandler();

  app.get('/vendor/:vendorId/products', async (c) => {
    const response = await getProductsHandler.handle({
      event: {
        pathParameters: c.req.param(),
        queryStringParameters: Object.fromEntries(c.req.query()),
      } as any,
    } as HandlerContext);
    return c.json(response.body, response.statusCode);
  });

  app.post('/vendor/:vendorId/products', async (c) => {
    const response = await createProductHandler.handle({
      event: {
        pathParameters: c.req.param(),
        body: await c.req.json(),
      } as any,
    } as HandlerContext);
    return c.json(response.body, response.statusCode);
  });

  app.get('/vendor/:vendorId/products/:productId', async (c) => {
    const response = await getProductHandler.handle({
      event: {
        pathParameters: c.req.param(),
      } as any,
    } as HandlerContext);
    return c.json(response.body, response.statusCode);
  });

  app.put('/vendor/:vendorId/products/:productId', async (c) => {
    const response = await updateProductHandler.handle({
      event: {
        pathParameters: c.req.param(),
        body: await c.req.json(),
      } as any,
    } as HandlerContext);
    return c.json(response.body, response.statusCode);
  });

  app.delete('/vendor/:vendorId/products/:productId', async (c) => {
    const response = await deleteProductHandler.handle({
      event: {
        pathParameters: c.req.param(),
      } as any,
    } as HandlerContext);
    return c.json(response.body, response.statusCode);
  });
}

