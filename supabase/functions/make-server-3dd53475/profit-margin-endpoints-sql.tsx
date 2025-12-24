/**
 * ============================================================================
 * PROFIT MARGIN ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * Profit Margin Analysis and Cost Management Tools
 * 
 * Features:
 * - Profit margin calculation
 * - Margin analysis dashboard
 * - Cost price management
 * - Low margin alerts
 * - Sales margin reports
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-23
 * Migration: Phase 2, Task 2.3 - Profit Margin Tools
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getProductsRepository } from "../../lib/repositories/products.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getOrdersRepository } from "../../lib/repositories/orders.ts";
import { getDbClient } from "../../lib/db.ts";

export function profitMarginEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const productsRepo = getProductsRepository();
  const vendorsRepo = getVendorsRepository();
  const ordersRepo = getOrdersRepository();
  const db = getDbClient();

  // Helper: Resolve vendor ID
  async function resolveVendorId(identifier: string): Promise<string | null> {
    return await vendorsRepo.resolveVendorId(identifier);
  }

  // Helper: Calculate profit margin
  function calculateMargin(price: number, costPrice: number): {
    profitAmount: number;
    profitMargin: number;
    marginPercentage: number;
  } {
    if (!costPrice || costPrice <= 0) {
      return {
        profitAmount: price,
        profitMargin: price,
        marginPercentage: 100, // If no cost, assume 100% margin
      };
    }

    const profitAmount = price - costPrice;
    const marginPercentage = (profitAmount / price) * 100;

    return {
      profitAmount: Math.round(profitAmount * 100) / 100,
      profitMargin: Math.round(profitAmount * 100) / 100,
      marginPercentage: Math.round(marginPercentage * 100) / 100,
    };
  }

  // ============================================
  // PRODUCT MARGIN ANALYSIS
  // ============================================

  /**
   * GET /vendor/:vendorId/products/margin-analysis
   * Get margin analysis for all products
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/products/margin-analysis`, async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const minMargin = parseFloat(c.req.query('min_margin') || '0');
      const maxMargin = parseFloat(c.req.query('max_margin') || '100');
      const alertThreshold = parseFloat(c.req.query('alert_threshold') || '10'); // Alert if margin < 10%

      const resolvedVendorId = await resolveVendorId(paramVendorId);
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      const products = await productsRepo.findByVendor(resolvedVendorId);

      // Calculate margins for each product
      const marginAnalysis = products.map(product => {
        const margin = calculateMargin(product.price, product.cost_price || 0);
        return {
          product_id: product.id,
          product_name: product.name,
          sku: product.sku,
          price: product.price,
          cost_price: product.cost_price || 0,
          stock: product.stock,
          ...margin,
          is_low_margin: margin.marginPercentage < alertThreshold,
          needs_attention: !product.cost_price || product.cost_price <= 0,
        };
      });

      // Filter by margin range
      const filtered = marginAnalysis.filter(m => 
        m.marginPercentage >= minMargin && m.marginPercentage <= maxMargin
      );

      // Aggregate statistics
      const stats = {
        total_products: products.length,
        products_with_cost: products.filter(p => p.cost_price && p.cost_price > 0).length,
        products_without_cost: products.filter(p => !p.cost_price || p.cost_price <= 0).length,
        average_margin: marginAnalysis.length > 0
          ? marginAnalysis.reduce((sum, m) => sum + m.marginPercentage, 0) / marginAnalysis.length
          : 0,
        low_margin_count: marginAnalysis.filter(m => m.is_low_margin).length,
        high_margin_count: marginAnalysis.filter(m => m.marginPercentage >= 50).length,
        total_inventory_value: products.reduce((sum, p) => sum + ((p.cost_price || 0) * p.stock), 0),
        total_potential_revenue: products.reduce((sum, p) => sum + (p.price * p.stock), 0),
      };

      return sendSuccess(c, {
        analysis: filtered,
        stats,
        low_margin_products: marginAnalysis.filter(m => m.is_low_margin),
        products_needing_attention: marginAnalysis.filter(m => m.needs_attention),
      });
    } catch (error) {
      console.error('❌ [PROFIT-MARGIN] Error fetching margin analysis:', error);
      return sendError(c, `Failed to fetch margin analysis: ${String(error)}`, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/products/:productId/margin
   * Get margin details for a specific product
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/products/:productId/margin`, async (c) => {
    try {
      const { vendorId: paramVendorId, productId } = c.req.param();

      const resolvedVendorId = await resolveVendorId(paramVendorId);
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      const product = await productsRepo.findById(productId);
      if (!product) {
        return sendError(c, 'Product not found', 404);
      }

      if (product.vendor_id !== resolvedVendorId) {
        return sendError(c, 'Product does not belong to this vendor', 403);
      }

      const margin = calculateMargin(product.price, product.cost_price || 0);

      // Get sales data for this product
      const { data: orderItems } = await db
        .from('order_items')
        .select('quantity, unit_price, total_price, order_id')
        .eq('product_id', productId);

      const totalSold = orderItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      const totalRevenue = orderItems?.reduce((sum, item) => sum + item.total_price, 0) || 0;
      const totalCost = (product.cost_price || 0) * totalSold;
      const totalProfit = totalRevenue - totalCost;
      const salesMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

      return sendSuccess(c, {
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          price: product.price,
          cost_price: product.cost_price || 0,
          stock: product.stock,
        },
        margin: {
          ...margin,
          is_low_margin: margin.marginPercentage < 10,
          needs_cost_price: !product.cost_price || product.cost_price <= 0,
        },
        sales: {
          total_sold: totalSold,
          total_revenue: totalRevenue,
          total_cost: totalCost,
          total_profit: totalProfit,
          sales_margin_percentage: Math.round(salesMargin * 100) / 100,
        },
      });
    } catch (error) {
      console.error('❌ [PROFIT-MARGIN] Error fetching product margin:', error);
      return sendError(c, `Failed to fetch product margin: ${String(error)}`, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/products/:productId/update-cost
   * Update cost price for a product
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/products/:productId/update-cost`, async (c) => {
    try {
      const { vendorId: paramVendorId, productId } = c.req.param();
      const { cost_price } = await c.req.json();

      if (cost_price === undefined || cost_price < 0) {
        return sendError(c, 'Invalid cost_price. Must be a non-negative number', 400);
      }

      const resolvedVendorId = await resolveVendorId(paramVendorId);
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      const product = await productsRepo.findById(productId);
      if (!product) {
        return sendError(c, 'Product not found', 404);
      }

      if (product.vendor_id !== resolvedVendorId) {
        return sendError(c, 'Product does not belong to this vendor', 403);
      }

      // Update cost price
      const updated = await productsRepo.update(productId, {
        cost_price: parseFloat(cost_price),
      });

      // Recalculate margin
      const margin = calculateMargin(updated.price, updated.cost_price || 0);

      console.log(`✅ [PROFIT-MARGIN] Updated cost price for product ${productId}`);

      return sendSuccess(c, {
        product: updated,
        margin,
      }, 'Cost price updated successfully');
    } catch (error) {
      console.error('❌ [PROFIT-MARGIN] Error updating cost price:', error);
      return sendError(c, `Failed to update cost price: ${String(error)}`, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/products/bulk-update-cost
   * Bulk update cost prices for multiple products
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/products/bulk-update-cost`, async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const { updates } = await c.req.json(); // Array of {product_id, cost_price}

      if (!Array.isArray(updates) || updates.length === 0) {
        return sendError(c, 'updates must be a non-empty array of {product_id, cost_price}', 400);
      }

      const resolvedVendorId = await resolveVendorId(paramVendorId);
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      const results = [];
      const errors = [];

      for (const update of updates) {
        try {
          if (!update.product_id || update.cost_price === undefined) {
            errors.push({ product_id: update.product_id, error: 'Missing product_id or cost_price' });
            continue;
          }

          const product = await productsRepo.findById(update.product_id);
          if (!product) {
            errors.push({ product_id: update.product_id, error: 'Product not found' });
            continue;
          }

          if (product.vendor_id !== resolvedVendorId) {
            errors.push({ product_id: update.product_id, error: 'Product does not belong to this vendor' });
            continue;
          }

          const updated = await productsRepo.update(update.product_id, {
            cost_price: parseFloat(update.cost_price),
          });

          const margin = calculateMargin(updated.price, updated.cost_price || 0);

          results.push({
            product_id: update.product_id,
            product_name: updated.name,
            cost_price: updated.cost_price,
            margin,
          });
        } catch (error) {
          errors.push({ product_id: update.product_id, error: String(error) });
        }
      }

      return sendSuccess(c, {
        updated: results,
        errors: errors.length > 0 ? errors : undefined,
        summary: {
          total: updates.length,
          successful: results.length,
          failed: errors.length,
        },
      }, `Bulk update completed: ${results.length} successful, ${errors.length} failed`);
    } catch (error) {
      console.error('❌ [PROFIT-MARGIN] Error bulk updating cost prices:', error);
      return sendError(c, `Failed to bulk update cost prices: ${String(error)}`, 500);
    }
  });

  // ============================================
  // SALES MARGIN REPORTS
  // ============================================

  /**
   * GET /vendor/:vendorId/sales/margin-report
   * Get sales margin report
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/sales/margin-report`, async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const period = c.req.query('period') || 'month'; // day, week, month, year
      const startDate = c.req.query('start_date');
      const endDate = c.req.query('end_date');

      const resolvedVendorId = await resolveVendorId(paramVendorId);
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      // Calculate date range
      const now = new Date();
      let dateStart: Date;
      let dateEnd: Date = now;

      if (startDate && endDate) {
        dateStart = new Date(startDate);
        dateEnd = new Date(endDate);
      } else {
        switch (period) {
          case 'day':
            dateStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case 'week':
            dateStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            dateStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case 'year':
            dateStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
          default:
            dateStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
      }

      // Get orders for this vendor
      const orders = await ordersRepo.findByVendor(resolvedVendorId);
      const filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= dateStart && orderDate <= dateEnd && order.order_status !== 'cancelled';
      });

      // Get order items for these orders
      const orderIds = filteredOrders.map(o => o.id);
      const { data: orderItems } = await db
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);

      // Calculate margins per product
      const productMargins: Record<string, any> = {};
      let totalRevenue = 0;
      let totalCost = 0;
      let totalProfit = 0;

      for (const item of orderItems || []) {
        if (!item.product_id) continue;

        const product = await productsRepo.findById(item.product_id);
        if (!product) continue;

        const itemCost = (product.cost_price || 0) * item.quantity;
        const itemRevenue = item.total_price;
        const itemProfit = itemRevenue - itemCost;

        totalRevenue += itemRevenue;
        totalCost += itemCost;
        totalProfit += itemProfit;

        if (!productMargins[item.product_id]) {
          productMargins[item.product_id] = {
            product_id: item.product_id,
            product_name: product.name,
            quantity_sold: 0,
            revenue: 0,
            cost: 0,
            profit: 0,
          };
        }

        productMargins[item.product_id].quantity_sold += item.quantity;
        productMargins[item.product_id].revenue += itemRevenue;
        productMargins[item.product_id].cost += itemCost;
        productMargins[item.product_id].profit += itemProfit;
      }

      // Calculate margin percentages
      const productMarginList = Object.values(productMargins).map((pm: any) => ({
        ...pm,
        margin_percentage: pm.revenue > 0 ? (pm.profit / pm.revenue) * 100 : 0,
      }));

      const report = {
        period,
        date_range: {
          start: dateStart.toISOString().split('T')[0],
          end: dateEnd.toISOString().split('T')[0],
        },
        summary: {
          total_orders: filteredOrders.length,
          total_revenue: Math.round(totalRevenue * 100) / 100,
          total_cost: Math.round(totalCost * 100) / 100,
          total_profit: Math.round(totalProfit * 100) / 100,
          overall_margin_percentage: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100 * 100) / 100 : 0,
        },
        by_product: productMarginList.sort((a: any, b: any) => b.profit - a.profit),
        top_products: productMarginList
          .sort((a: any, b: any) => b.profit - a.profit)
          .slice(0, 10),
        low_margin_products: productMarginList
          .filter((pm: any) => pm.margin_percentage < 10)
          .sort((a: any, b: any) => a.margin_percentage - b.margin_percentage),
      };

      return sendSuccess(c, { report });
    } catch (error) {
      console.error('❌ [PROFIT-MARGIN] Error fetching sales margin report:', error);
      return sendError(c, `Failed to fetch sales margin report: ${String(error)}`, 500);
    }
  });

  console.log('✅ [PROFIT-MARGIN-SQL] Profit margin endpoints registered (SQL-only)');
}

